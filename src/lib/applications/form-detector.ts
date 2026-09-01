/**
 * Form Detector
 *
 * Inspects a loaded Playwright page and returns a normalized schema of
 * all detected form fields. Supports multi-step forms and rich field detection.
 *
 * Never relies solely on CSS selectors — always uses multiple fallback strategies.
 */

import { DetectedField, QuestionType } from "./types";

/**
 * Main form field detection function.
 * Takes a Playwright Page object and returns normalized field list.
 */
export async function detectApplicationFields(page: any): Promise<DetectedField[]> {
  try {
    const rawFields: DetectedField[] = await page.evaluate(() => {
      const fields: any[] = [];
      let fieldIndex = 0;

      function getLabel(el: Element): { text: string; source: string } {
        // 1. aria-label
        const ariaLabel = el.getAttribute("aria-label");
        if (ariaLabel?.trim()) return { text: ariaLabel.trim(), source: "aria-label" };

        // 2. aria-labelledby
        const labelledBy = el.getAttribute("aria-labelledby");
        if (labelledBy) {
          const labelEl = document.getElementById(labelledBy);
          if (labelEl?.textContent?.trim()) return { text: labelEl.textContent.trim(), source: "aria-label" };
        }

        // 3. <label for="id">
        const id = el.getAttribute("id");
        if (id) {
          const labelEl = document.querySelector(`label[for="${CSS.escape(id)}"]`);
          if (labelEl?.textContent?.trim()) return { text: labelEl.textContent.trim(), source: "label" };
        }

        // 4. Parent <label>
        const parentLabel = el.closest("label");
        if (parentLabel) {
          const text = parentLabel.textContent?.replace((el as HTMLInputElement).value || "", "").trim();
          if (text) return { text, source: "label" };
        }

        // 5. Fieldset legend (for radio groups)
        const fieldset = el.closest("fieldset");
        if (fieldset) {
          const legend = fieldset.querySelector("legend");
          if (legend?.textContent?.trim()) return { text: legend.textContent.trim(), source: "legend" };
        }

        // 6. Preceding sibling text / question div
        const parent = el.parentElement;
        if (parent) {
          const prevSiblings = Array.from(parent.children);
          const idx = prevSiblings.indexOf(el as HTMLElement);
          for (let i = idx - 1; i >= 0; i--) {
            const sib = prevSiblings[i];
            const text = sib.textContent?.trim();
            if (text && text.length > 1 && text.length < 200) return { text, source: "inferred" };
          }
        }

        // 7. name or placeholder as fallback
        const name = el.getAttribute("name");
        if (name) return { text: name.replace(/[_-]/g, " "), source: "name" };
        const placeholder = el.getAttribute("placeholder");
        if (placeholder?.trim()) return { text: placeholder.trim(), source: "placeholder" };
        const id2 = el.getAttribute("id");
        if (id2) return { text: id2.replace(/[_-]/g, " "), source: "id" };

        return { text: "Unknown Field", source: "inferred" };
      }

      function isRequired(el: Element): boolean {
        if (el.hasAttribute("required")) return true;
        if (el.getAttribute("aria-required") === "true") return true;
        // Visual indicators: *, (Required)
        const parent = el.closest(".form-group, .field-wrapper, [class*='field'], [class*='question']");
        if (parent) {
          const text = parent.textContent || "";
          if (text.includes("*") || /required/i.test(text)) return true;
        }
        return false;
      }

      function buildSelector(el: Element): string {
        const id = el.getAttribute("id");
        if (id) return `#${CSS.escape(id)}`;
        const name = el.getAttribute("name");
        const type = el.getAttribute("type") || el.tagName.toLowerCase();
        if (name) return `[name="${CSS.escape(name)}"]`;
        // Fallback: generate a position-based selector
        const parent = el.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter(c => c.tagName === el.tagName);
          const idx = siblings.indexOf(el as HTMLElement);
          return `${el.tagName.toLowerCase()}:nth-of-type(${idx + 1})`;
        }
        return el.tagName.toLowerCase();
      }

      function normalizeFieldId(label: string, index: number): string {
        return label
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, "")
          .trim()
          .replace(/\s+/g, "_")
          .substring(0, 50) || `field_${index}`;
      }

      // -----------------------------------------------------------------------
      // Process all interactive form inputs
      // -----------------------------------------------------------------------
      const inputs = document.querySelectorAll<HTMLInputElement>(
        "input:not([type='hidden']):not([type='submit']):not([type='button']):not([type='reset']):not([type='image']), textarea, select"
      );

      const processedNames = new Set<string>();

      for (const el of inputs) {
        const tagName = el.tagName.toLowerCase();
        const inputType = (el as HTMLInputElement).type?.toLowerCase() || tagName;

        // Skip if we've already processed a radio/checkbox group with this name
        const nameKey = el.getAttribute("name") || "";
        if ((inputType === "radio" || inputType === "checkbox") && processedNames.has(nameKey) && nameKey) {
          continue;
        }
        if (nameKey) processedNames.add(nameKey);

        const { text: labelText, source } = getLabel(el);
        const required = isRequired(el);
        const selector = buildSelector(el);
        const fieldIndex2 = fieldIndex++;

        let fieldType: string = inputType;
        if (tagName === "textarea") fieldType = "textarea";
        if (tagName === "select") fieldType = "select";

        // Normalize field type
        const typeMap: Record<string, string> = {
          text: "text", email: "email", tel: "tel", phone: "tel",
          number: "number", date: "date", url: "url",
          textarea: "textarea", select: "select",
          radio: "radio", checkbox: "checkbox", file: "file",
        };
        fieldType = typeMap[fieldType] || "text";

        // Get options for select
        let options: string[] = [];
        if (tagName === "select") {
          options = Array.from((el as unknown as HTMLSelectElement).options)
            .filter(o => o.value && o.value !== "")
            .map(o => o.text.trim());
        }

        // Get radio options by name
        if (inputType === "radio" && nameKey) {
          const radios = document.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${CSS.escape(nameKey)}"]`);
          options = Array.from(radios).map(r => {
            const l = getLabel(r);
            return r.value || l.text;
          }).filter(Boolean);
        }

        // Get checkbox label
        if (inputType === "checkbox" && nameKey) {
          const checkboxes = document.querySelectorAll<HTMLInputElement>(`input[type="checkbox"][name="${CSS.escape(nameKey)}"]`);
          if (checkboxes.length > 1) {
            options = Array.from(checkboxes).map(c => {
              const l = getLabel(c);
              return c.value || l.text;
            }).filter(Boolean);
          }
        }

        fields.push({
          field_id: normalizeFieldId(labelText, fieldIndex2),
          label: labelText,
          type: fieldType,
          required,
          selector,
          source,
          options: options.length > 0 ? options : undefined,
          page_step: 1,
        });
      }

      return fields;
    });

    // Deduplicate by field_id
    const seen = new Set<string>();
    const deduped: DetectedField[] = [];
    for (const f of rawFields) {
      if (!seen.has(f.field_id)) {
        seen.add(f.field_id);
        // Classify question type
        f.question_type = classifyQuestionType(f);
        deduped.push(f);
      }
    }

    return deduped;
  } catch (err) {
    console.error("[FormDetector] detectApplicationFields failed:", err);
    return [];
  }
}

/**
 * Detect if the form has multiple steps by looking for step indicators.
 */
export async function detectFormSteps(page: any): Promise<number> {
  try {
    return await page.evaluate(() => {
      // Step indicators: progress bars, breadcrumbs, "Step X of Y" text
      const stepText = document.body.textContent?.match(/step\s+\d+\s+of\s+(\d+)/i);
      if (stepText) return parseInt(stepText[1], 10);
      const progressSteps = document.querySelectorAll("[class*='step'], [class*='Step'], [data-step]");
      if (progressSteps.length > 1) return progressSteps.length;
      return 1;
    });
  } catch {
    return 1;
  }
}

/**
 * Detect CAPTCHA presence.
 */
export async function detectCaptcha(page: any): Promise<boolean> {
  try {
    return await page.evaluate(() => {
      const captchaSelectors = [
        ".g-recaptcha", "[data-sitekey]", ".h-captcha",
        "iframe[src*='recaptcha']", "iframe[src*='hcaptcha']",
        "[class*='captcha']", "[id*='captcha']",
      ];
      return captchaSelectors.some(sel => !!document.querySelector(sel));
    });
  } catch {
    return false;
  }
}

/**
 * Detect if a login wall is present.
 */
export async function detectLoginRequired(page: any): Promise<boolean> {
  try {
    const url = page.url();
    if (/sign.?in|login|auth/i.test(url)) return true;

    return await page.evaluate(() => {
      const loginKeywords = ["sign in to apply", "login to apply", "create an account to apply"];
      const text = document.body.textContent?.toLowerCase() || "";
      return loginKeywords.some(k => text.includes(k));
    });
  } catch {
    return false;
  }
}

/**
 * Detect if rate limited by the employer site.
 */
export async function detectRateLimited(page: any): Promise<boolean> {
  try {
    return await page.evaluate(() => {
      const text = document.body?.textContent?.toLowerCase() || "";
      const rateLimitKeywords = [
        "rate limit",
        "too many requests",
        "temporarily blocked",
        "access denied",
        "1015 error",
        "request blocked",
      ];
      return rateLimitKeywords.some(k => text.includes(k));
    });
  } catch {
    return false;
  }
}

/**
 * Check if the application page belongs to an unsupported platform or intranet.
 */
export async function detectPlatformSupported(
  platform: string,
  page: any
): Promise<{ supported: boolean; reason?: string }> {
  const UNSUPPORTED_PLATFORMS = ["internal_only", "unsupported", "oracle_taleo_legacy"];
  if (UNSUPPORTED_PLATFORMS.includes(platform.toLowerCase())) {
    return { supported: false, reason: "Platform is not supported for AI automated submission" };
  }

  try {
    const isUnsupportedDom = await page.evaluate(() => {
      const text = document.body?.textContent?.toLowerCase() || "";
      return text.includes("this portal does not accept external applications") ||
             text.includes("internal employees only");
    });
    if (isUnsupportedDom) {
      return { supported: false, reason: "Internal portal or unsupported application gateway" };
    }
  } catch {}

  return { supported: true };
}

/**
 * Classify question type from field metadata.
 */
function classifyQuestionType(field: DetectedField): QuestionType {
  const label = field.label.toLowerCase();

  if (field.type === "file") return QuestionType.FILE;
  if (field.type === "checkbox" && field.options?.length === 0) {
    if (/consent|agree|subscribe|newsletter|marketing/i.test(label)) return QuestionType.CONSENT;
    return QuestionType.YES_NO;
  }
  if (field.type === "radio" || field.type === "select") {
    const opts = field.options || [];
    if (opts.length === 2 && opts.some(o => /yes|no|true|false/i.test(o))) return QuestionType.YES_NO;
    return QuestionType.SELECT;
  }
  if (field.type === "email" || label.includes("email")) return QuestionType.PROFILE_FIELD;
  if (field.type === "tel" || label.includes("phone")) return QuestionType.PROFILE_FIELD;
  if (field.type === "url" || label.includes("linkedin") || label.includes("github") || label.includes("portfolio")) {
    return QuestionType.PROFILE_FIELD;
  }
  if (field.type === "date") return QuestionType.DATE;
  if (field.type === "number") return QuestionType.NUMBER;
  if (label.match(/first.?name|last.?name|full.?name|city|location|country|address|zip/)) return QuestionType.PROFILE_FIELD;
  if (field.type === "textarea" && field.label.length > 20) return QuestionType.OPEN_ENDED;
  return QuestionType.UNKNOWN;
}
