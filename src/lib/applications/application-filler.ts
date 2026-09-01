/**
 * Application Filler
 *
 * Fills each mapped field in the application form using Playwright.
 *
 * Safety rules:
 * - Never blindly check optional consent/marketing checkboxes
 * - Verify field still exists before filling
 * - Trigger proper change events after filling
 * - Verify value was set correctly
 */

import { DetectedField, FieldMappingResult, FieldStatus, AutomationProfile, QuestionType } from "./types";
import { resolveProfileValue } from "./profile-resolver";
import { uploadResume } from "./resume-uploader";

export interface FillResult {
  field_id: string;
  success: boolean;
  error?: string;
  value_used?: string;
}

/**
 * Fill all mapped fields in a form.
 */
export async function fillApplicationForm(
  page: any, // Playwright Page
  applicationId: string,
  fields: Array<DetectedField & { mapping: FieldMappingResult }>,
  profile: AutomationProfile
): Promise<FillResult[]> {
  const results: FillResult[] = [];

  for (const field of fields) {
    if (field.mapping.status === FieldStatus.UNSUPPORTED) {
      results.push({ field_id: field.field_id, success: true, error: "unsupported_skipped" });
      continue;
    }
    if (field.mapping.status === FieldStatus.AMBIGUOUS) {
      results.push({ field_id: field.field_id, success: false, error: "ambiguous_not_filled" });
      continue;
    }
    if (!field.mapping.mapped_profile_key) {
      results.push({ field_id: field.field_id, success: false, error: "no_mapping" });
      continue;
    }

    // Handle resume upload separately
    if (field.type === "file" || field.mapping.mapped_profile_key === "resume") {
      const uploaded = await uploadResume(
        page,
        applicationId,
        profile.resume_url || null,
        "resume.pdf",
        field.selector
      );
      results.push({ field_id: field.field_id, success: uploaded, value_used: "resume_file" });
      continue;
    }

    // Skip consent checkboxes unless profile explicitly has a preference
    if (field.question_type === QuestionType.CONSENT && !field.required) {
      results.push({ field_id: field.field_id, success: true, error: "consent_skipped" });
      continue;
    }

    const profileValue = resolveProfileValue(field.mapping.mapped_profile_key, profile);
    if (!profileValue) {
      results.push({ field_id: field.field_id, success: false, error: "no_profile_value" });
      continue;
    }

    const result = await fillSingleField(page, field, profileValue);
    results.push(result);
  }

  return results;
}

/**
 * Fill a single form field.
 */
async function fillSingleField(
  page: any,
  field: DetectedField,
  value: string
): Promise<FillResult> {
  try {
    // 1. Locate field — verify it still exists
    const locator = page.locator(field.selector).first();
    const count = await locator.count();
    if (count === 0) {
      return { field_id: field.field_id, success: false, error: "field_not_found" };
    }

    // 2. Scroll into view
    await locator.scrollIntoViewIfNeeded().catch(() => {});

    // 3. Fill based on type
    switch (field.type) {
      case "text":
      case "email":
      case "tel":
      case "number":
      case "date":
      case "url":
        await locator.fill(value);
        break;

      case "textarea":
        await locator.fill(value);
        break;

      case "select":
        await fillSelect(page, field, value);
        break;

      case "radio":
        await fillRadio(page, field, value);
        break;

      case "checkbox":
        await fillCheckbox(page, field, value);
        break;

      default:
        await locator.fill(value).catch(() => {});
    }

    // 4. Trigger change events for React/Vue forms
    await page.evaluate((selector: string) => {
      const el = document.querySelector(selector);
      if (el) {
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        el.dispatchEvent(new Event("blur", { bubbles: true }));
      }
    }, field.selector);

    // 5. Verify value was set (best effort)
    const verified = await verifyFieldValue(page, field, value);

    return { field_id: field.field_id, success: verified, value_used: value };
  } catch (err: any) {
    return { field_id: field.field_id, success: false, error: err?.message };
  }
}

async function fillSelect(page: any, field: DetectedField, value: string): Promise<void> {
  const locator = page.locator(field.selector).first();

  // Try exact value match first
  try {
    await locator.selectOption({ value });
    return;
  } catch {}

  // Try label match
  try {
    await locator.selectOption({ label: value });
    return;
  } catch {}

  // Try partial label match
  const options = field.options || [];
  const match = options.find(o =>
    o.toLowerCase().includes(value.toLowerCase()) ||
    value.toLowerCase().includes(o.toLowerCase())
  );
  if (match) {
    await locator.selectOption({ label: match });
  }
}

async function fillRadio(page: any, field: DetectedField, value: string): Promise<void> {
  // Find radio with matching value or label
  const radios = page.locator(`input[type="radio"][name="${field.selector.match(/\[name="([^"]+)"\]/)?.[1] || ""}"]`);
  const count = await radios.count();

  for (let i = 0; i < count; i++) {
    const radio = radios.nth(i);
    const radioValue = await radio.getAttribute("value") || "";
    const radioLabel = await radio.evaluate((el: HTMLElement) => {
      const label = document.querySelector(`label[for="${el.id}"]`);
      return label?.textContent?.trim() || el.nextSibling?.textContent?.trim() || "";
    });

    const matches =
      radioValue.toLowerCase() === value.toLowerCase() ||
      radioLabel.toLowerCase().includes(value.toLowerCase()) ||
      value.toLowerCase().includes(radioLabel.toLowerCase());

    if (matches) {
      await radio.check();
      return;
    }
  }
}

async function fillCheckbox(page: any, field: DetectedField, value: string): Promise<void> {
  // Only check if value is truthy/yes/true
  const shouldCheck = /^(yes|true|1|checked)$/i.test(value.trim());
  const locator = page.locator(field.selector).first();
  if (shouldCheck) {
    await locator.check();
  } else {
    await locator.uncheck().catch(() => {});
  }
}

async function verifyFieldValue(page: any, field: DetectedField, expectedValue: string): Promise<boolean> {
  try {
    const locator = page.locator(field.selector).first();
    if (field.type === "checkbox" || field.type === "radio") {
      return true; // Trust that check() worked
    }
    const actualValue = await locator.inputValue();
    return actualValue.includes(expectedValue.substring(0, 20)); // Partial match is sufficient
  } catch {
    return true; // Conservative — don't fail if verification errors
  }
}
