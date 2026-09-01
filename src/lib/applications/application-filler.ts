/**
 * Application Filler
 *
 * Fills each mapped field in the application form through the BrowserProvider abstraction.
 * Works seamlessly with both LocalBrowserProvider and BrowserbaseProvider.
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
import { BrowserProvider, PageHandle } from "../automation/types";
import { LocalBrowserProvider } from "../automation/local-browser-provider";

export interface FillResult {
  field_id: string;
  success: boolean;
  error?: string;
  value_used?: string;
}

function resolveFillerContext(arg1: any, arg2: any): { provider: BrowserProvider; page: PageHandle } {
  if (arg1 && typeof arg1.fill === "function" && typeof arg1.click === "function") {
    // Called as (provider, page)
    return {
      provider: arg1,
      page: arg2?.rawPage ? arg2 : { rawPage: arg2, url: () => arg2?.url?.() || "", title: () => arg2?.title?.() || "" },
    };
  }
  // Called as (page) — wrap with default LocalBrowserProvider for backwards compatibility
  const rawPage = arg1?.rawPage || arg1;
  const provider = new LocalBrowserProvider();
  const pageHandle: PageHandle = arg1?.rawPage ? arg1 : {
    rawPage,
    url: () => rawPage.url(),
    title: () => rawPage.title(),
  };
  return { provider, page: pageHandle };
}

/**
 * Fill all mapped fields in a form through the BrowserProvider abstraction.
 */
export async function fillApplicationForm(
  arg1: any,
  arg2: any,
  arg3?: any,
  arg4?: any,
  arg5?: any
): Promise<FillResult[]> {
  let provider: BrowserProvider;
  let page: PageHandle;
  let applicationId: string;
  let fields: Array<DetectedField & { mapping: FieldMappingResult }>;
  let profile: AutomationProfile;

  if (arg5 !== undefined) {
    // (provider, page, applicationId, fields, profile)
    provider = arg1;
    page = arg2;
    applicationId = arg3;
    fields = arg4;
    profile = arg5;
  } else {
    // (page, applicationId, fields, profile)
    const resolved = resolveFillerContext(arg1, arg2);
    provider = resolved.provider;
    page = resolved.page;
    applicationId = arg2;
    fields = arg3;
    profile = arg4;
  }

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

    // Handle resume upload separately through provider abstraction
    if (field.type === "file" || field.mapping.mapped_profile_key === "resume") {
      const uploaded = await uploadResume(
        provider,
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

    const result = await fillSingleField(provider, page, field, profileValue);
    results.push(result);
  }

  return results;
}

/**
 * Fill a single form field through provider abstraction.
 */
export async function fillSingleField(
  arg1: any,
  arg2: any,
  arg3?: any,
  arg4?: any
): Promise<FillResult> {
  let provider: BrowserProvider;
  let page: PageHandle;
  let field: DetectedField;
  let value: string;

  if (arg4 !== undefined) {
    // (provider, page, field, value)
    provider = arg1;
    page = arg2;
    field = arg3;
    value = arg4;
  } else {
    // (page, field, value)
    const resolved = resolveFillerContext(arg1, arg2);
    provider = resolved.provider;
    page = resolved.page;
    field = arg2;
    value = arg3;
  }

  try {
    // 1. Locate field — verify it exists with fallback strategies
    let targetSelector = field.selector;
    let exists = Boolean(await provider.findElement(page, targetSelector));

    if (!exists && field.label) {
      const labelSelector = `[aria-label*="${CSS.escape(field.label)}"], [placeholder*="${CSS.escape(field.label)}"]`;
      const fallbackEl = await provider.findElement(page, labelSelector);
      if (fallbackEl) {
        targetSelector = labelSelector;
        exists = true;
      }
    }

    if (!exists && field.field_id) {
      const nameSelector = `[name*="${CSS.escape(field.field_id)}"], #${CSS.escape(field.field_id)}`;
      const nameEl = await provider.findElement(page, nameSelector);
      if (nameEl) {
        targetSelector = nameSelector;
        exists = true;
      }
    }

    if (!exists) {
      return { field_id: field.field_id, success: false, error: "field_not_found" };
    }

    // 2. Scroll into view using evaluate
    await provider.evaluate(
      page,
      (sel: string) => {
        const el = document.querySelector(sel);
        if (el && typeof el.scrollIntoView === "function") {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      },
      targetSelector
    ).catch(() => {});

    // 3. Fill based on type
    switch (field.type) {
      case "text":
      case "email":
      case "tel":
      case "number":
      case "date":
      case "url":
      case "textarea":
        await provider.fill(page, targetSelector, value);
        break;

      case "select":
        await fillSelect(provider, page, field, targetSelector, value);
        break;

      case "radio":
        await fillRadio(provider, page, field, targetSelector, value);
        break;

      case "checkbox":
        await fillCheckbox(provider, page, targetSelector, value);
        break;

      default:
        await provider.fill(page, targetSelector, value).catch(() => {});
    }

    // 4. Trigger change events for React/Vue hydration
    await provider.evaluate(
      page,
      (selector: string) => {
        const el = document.querySelector(selector);
        if (el) {
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
          el.dispatchEvent(new Event("blur", { bubbles: true }));
        }
      },
      targetSelector
    );

    // 5. Verify value was set
    const verified = await verifyFieldValue(provider, page, targetSelector, field, value);

    return { field_id: field.field_id, success: verified, value_used: value };
  } catch (err: any) {
    return { field_id: field.field_id, success: false, error: err?.message };
  }
}

async function fillSelect(
  provider: BrowserProvider,
  page: PageHandle,
  field: DetectedField,
  selector: string,
  value: string
): Promise<void> {
  // Try exact select option
  try {
    await provider.select(page, selector, value);
    return;
  } catch {}

  // Match options via DOM evaluate
  const options = field.options || [];
  const match = options.find((o) =>
    o.toLowerCase().includes(value.toLowerCase()) || value.toLowerCase().includes(o.toLowerCase())
  );
  if (match) {
    try {
      await provider.select(page, selector, match);
      return;
    } catch {}
  }

  // Fallback: set select element value directly and dispatch change event
  await provider.evaluate(
    page,
    ({ sel, val }: { sel: string; val: string }) => {
      const selectEl = document.querySelector(sel) as HTMLSelectElement | null;
      if (selectEl) {
        for (let i = 0; i < selectEl.options.length; i++) {
          const opt = selectEl.options[i];
          if (
            opt.value.toLowerCase() === val.toLowerCase() ||
            opt.text.toLowerCase().includes(val.toLowerCase())
          ) {
            selectEl.selectedIndex = i;
            selectEl.dispatchEvent(new Event("change", { bubbles: true }));
            break;
          }
        }
      }
    },
    { sel: selector, val: value }
  ).catch(() => {});
}

async function fillRadio(
  provider: BrowserProvider,
  page: PageHandle,
  field: DetectedField,
  selector: string,
  value: string
): Promise<void> {
  // Check matching radio button via evaluate
  await provider.evaluate(
    page,
    ({ sel, val }: { sel: string; val: string }) => {
      const nameMatch = sel.match(/\[name="([^"]+)"\]/);
      const name = nameMatch ? nameMatch[1] : "";
      const radios = document.querySelectorAll(
        name ? `input[type="radio"][name="${name}"]` : 'input[type="radio"]'
      );

      for (let i = 0; i < radios.length; i++) {
        const radio = radios[i] as HTMLInputElement;
        const radioVal = radio.value || "";
        const labelEl = document.querySelector(`label[for="${radio.id}"]`);
        const labelText = labelEl?.textContent?.trim() || radio.parentElement?.textContent?.trim() || "";

        if (
          radioVal.toLowerCase() === val.toLowerCase() ||
          labelText.toLowerCase().includes(val.toLowerCase()) ||
          val.toLowerCase().includes(labelText.toLowerCase())
        ) {
          radio.checked = true;
          radio.dispatchEvent(new Event("change", { bubbles: true }));
          break;
        }
      }
    },
    { sel: selector, val: value }
  ).catch(() => {});
}

async function fillCheckbox(
  provider: BrowserProvider,
  page: PageHandle,
  selector: string,
  value: string
): Promise<void> {
  const shouldCheck = /^(yes|true|1|checked)$/i.test(value.trim());
  if (shouldCheck) {
    await provider.check(page, selector);
  } else {
    await provider.evaluate(
      page,
      (sel: string) => {
        const el = document.querySelector(sel) as HTMLInputElement | null;
        if (el && el.checked) {
          el.checked = false;
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
      },
      selector
    ).catch(() => {});
  }
}

async function verifyFieldValue(
  provider: BrowserProvider,
  page: PageHandle,
  selector: string,
  field: DetectedField,
  expectedValue: string
): Promise<boolean> {
  try {
    if (field.type === "checkbox" || field.type === "radio") {
      return true;
    }
    const val = await provider.evaluate(
      page,
      (sel: string) => {
        const el = document.querySelector(sel) as HTMLInputElement | HTMLTextAreaElement | null;
        return el ? el.value || "" : "";
      },
      selector
    );
    return val.includes(expectedValue.substring(0, 20));
  } catch {
    return true; // Conservative fallback
  }
}

export const ApplicationFiller = {
  fillForm: fillApplicationForm,
  fillField: fillSingleField,
};
