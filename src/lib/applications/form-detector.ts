/**
 * Form Detector
 *
 * Inspects a loaded Playwright page and returns a normalized schema of
 * all detected form fields. Supports multi-step forms and rich field detection.
 *
 * Never relies solely on CSS selectors — always uses multiple fallback strategies.
 */

import { DetectedField, QuestionType } from "./types";
import { BrowserProvider, PageHandle } from "../automation/types";

function resolveContext(arg1: any, arg2?: any): {
  page: any;
  evaluate: <T = any, R = any>(fn: any, arg?: T) => Promise<R>;
  getUrl: () => string;
} {
  if (arg2) {
    // Called as (provider, page)
    const provider = arg1 as BrowserProvider;
    const page = arg2 as PageHandle;
    return {
      page,
      evaluate: (fn, a) => (provider.evaluate ? provider.evaluate(page, fn, a) : (page.rawPage || page).evaluate(fn, a)),
      getUrl: () => (typeof page.url === "function" ? page.url() : ""),
    };
  }
  // Called as (page)
  const page = arg1;
  const rawPage = page?.rawPage || page;
  return {
    page,
    evaluate: (fn, a) => rawPage.evaluate(fn, a),
    getUrl: () => (typeof page?.url === "function" ? page.url() : ""),
  };
}

/**
 * Main form field detection function.
 * Supports both detectApplicationFields(provider, page) and detectApplicationFields(page).
 */
export async function detectApplicationFields(
  pageOrProvider: any,
  maybePage?: any
): Promise<DetectedField[]> {
  const { evaluate } = resolveContext(pageOrProvider, maybePage);
  try {
    const rawFields: DetectedField[] = await evaluate(() => {

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
        if (id && !id.startsWith("headlessui-") && !id.startsWith(":r")) return `#${CSS.escape(id)}`;
        const name = el.getAttribute("name");
        if (name) return `[name="${CSS.escape(name)}"]`;
        const testId = el.getAttribute("data-testid") || el.getAttribute("data-qa") || el.getAttribute("data-automation-id");
        if (testId) return `[data-testid="${CSS.escape(testId)}"]`;
        const ariaLabel = el.getAttribute("aria-label");
        if (ariaLabel) return `[aria-label="${CSS.escape(ariaLabel)}"]`;
        const placeholder = el.getAttribute("placeholder");
        if (placeholder) return `[placeholder="${CSS.escape(placeholder)}"]`;

        // Fallback: generate a path relative to form or parent
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
      // Find candidate application container or fallback to document
      // -----------------------------------------------------------------------
      const appContainer = document.querySelector(
        ".jobs-easy-apply-modal, [data-test-modal-id='easy-apply-modal'], div[role='dialog']:has(input, select, textarea), form#job_application, form.application-form, #application_form, [data-testid*='application-form'], [data-ui*='application']"
      );

      const rootElement = appContainer || document;

      const inputs = rootElement.querySelectorAll<HTMLInputElement>(
        "input:not([type='hidden']):not([type='submit']):not([type='button']):not([type='reset']):not([type='image']), textarea, select"
      );

      const processedNames = new Set<string>();

      for (const el of inputs) {
        const tagName = el.tagName.toLowerCase();
        const inputType = (el as HTMLInputElement).type?.toLowerCase() || tagName;
        const nameKey = el.getAttribute("name") || "";
        const idKey = el.getAttribute("id") || "";

        // Skip navigation, header, and footer inputs
        const inNavOrHeader = el.closest(
          "nav, header, footer, [role='navigation'], [role='banner'], [role='contentinfo'], .nav, .navbar, #navbar, .global-nav, #global-nav, .site-header, #header"
        );
        if (inNavOrHeader) {
          continue;
        }

        // Skip search and filter inputs (e.g. LinkedIn job search, skill search, location search, filter inputs)
        const isSearchOrFilter =
          inputType === "search" ||
          el.getAttribute("role") === "search" ||
          el.closest("[role='search'], form[role='search'], .search-box, .search-bar, .jobs-search-box, .search-filters") !== null ||
          /search|find|filter|query|keyword/i.test(nameKey) ||
          /search|find|filter|query|keyword/i.test(idKey) ||
          /search|find|filter|query|keyword/i.test(el.getAttribute("placeholder") || "") ||
          /search|find|filter|query|keyword/i.test(el.getAttribute("aria-label") || "");

        if (isSearchOrFilter) {
          continue;
        }

        // Skip password inputs (job applications never require account passwords)
        if (inputType === "password" || /password/i.test(nameKey) || /password/i.test(idKey)) {
          continue;
        }

        // Skip site login/signin forms
        const inLoginForm = el.closest(
          "form[action*='login'], form[action*='signin'], .login-form, .sign-in-form, #login-form"
        );
        if (inLoginForm) {
          continue;
        }

        // Skip cookie/consent/chat widgets
        const inWidget = el.closest(
          "#onetrust-consent-sdk, #cookie-law-info-bar, [class*='intercom'], [class*='crisp'], [id*='zendesk']"
        );
        if (inWidget) {
          continue;
        }

        // Skip bot detection / CAPTCHA tokens (e.g. g-recaptcha-response, h-captcha-response, cf-turnstile-response)
        if (nameKey.includes("recaptcha") || idKey.includes("recaptcha") ||
            nameKey.includes("captcha") || idKey.includes("captcha") ||
            nameKey.includes("turnstile") || idKey.includes("turnstile")) {
          continue;
        }

        // Skip hidden / invisible elements (except file inputs which may be stylized)
        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden" || (el as HTMLElement).hidden) {
          if (inputType !== "file") {
            continue;
          }
        }

        // Skip if we've already processed a radio/checkbox group with this name
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
export async function detectFormSteps(pageOrProvider: any, maybePage?: any): Promise<number> {
  const { evaluate } = resolveContext(pageOrProvider, maybePage);
  try {
    return await evaluate(() => {
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
 * Detect active, visible, blocking CAPTCHA presence.
 * Ignores background invisible tokens (e.g. reCAPTCHA v3 / Enterprise with size=invisible or grecaptcha-badge).
 */
export async function detectCaptcha(pageOrProvider: any, maybePage?: any): Promise<boolean> {
  const { evaluate } = resolveContext(pageOrProvider, maybePage);
  try {
    return await evaluate(() => {
      // 1. reCAPTCHA v2 / Enterprise interactive image challenge puzzle popup (bframe)
      const recaptchaBFrame = document.querySelector<HTMLElement>(
        "iframe[src*='/recaptcha/api2/bframe'], iframe[src*='/recaptcha/enterprise/bframe']"
      );
      if (recaptchaBFrame && recaptchaBFrame.offsetWidth > 0 && recaptchaBFrame.offsetHeight > 0) {
        return true;
      }

      // 2. reCAPTCHA interactive checkbox (non-invisible anchor with visible width)
      const recaptchaAnchor = document.querySelector<HTMLElement>("iframe[src*='recaptcha'][src*='anchor']");
      if (recaptchaAnchor) {
        const src = recaptchaAnchor.getAttribute("src") || "";
        if (!src.includes("size=invisible") && recaptchaAnchor.offsetWidth > 50) {
          return true;
        }
      }

      // 3. hCaptcha visible challenge box
      const hcaptchaBox = document.querySelector<HTMLElement>(
        "iframe[src*='hcaptcha.com'][src*='box'], iframe[src*='hcaptcha.com'][src*='challenge']"
      );
      if (hcaptchaBox && hcaptchaBox.offsetWidth > 0 && hcaptchaBox.offsetHeight > 0) {
        return true;
      }

      // 4. Cloudflare Turnstile visible challenge
      const turnstile = document.querySelector<HTMLElement>("iframe[src*='challenges.cloudflare.com']");
      if (turnstile && turnstile.offsetWidth > 0 && turnstile.offsetHeight > 0) {
        return true;
      }

      // 5. Arkose Labs / FunCaptcha visible challenge
      const arkose = document.querySelector<HTMLElement>("iframe[src*='arkoselabs'], iframe[src*='funcaptcha']");
      if (arkose && arkose.offsetWidth > 0 && arkose.offsetHeight > 0) {
        return true;
      }

      // 6. Explicit interactive captcha containers that are not marked invisible
      const explicitCaptcha = document.querySelector<HTMLElement>(
        ".g-recaptcha:not([data-size='invisible']), .h-captcha:not([data-size='invisible'])"
      );
      if (explicitCaptcha) {
        const style = window.getComputedStyle(explicitCaptcha);
        if (style.display !== "none" && style.visibility !== "hidden") {
          return true;
        }
      }

      return false;
    });
  } catch {
    return false;
  }
}

/**
 * Detect if a login wall is present.
 */
export async function detectLoginRequired(pageOrProvider: any, maybePage?: any): Promise<boolean> {
  const { evaluate, getUrl } = resolveContext(pageOrProvider, maybePage);
  try {
    const url = getUrl();
    if (/sign.?in|login|auth/i.test(url)) return true;

    return await evaluate(() => {
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
export async function detectRateLimited(pageOrProvider: any, maybePage?: any): Promise<boolean> {
  const { evaluate } = resolveContext(pageOrProvider, maybePage);
  try {
    return await evaluate(() => {
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
  pageOrProvider: any,
  maybePage?: any
): Promise<{ supported: boolean; reason?: string }> {
  const UNSUPPORTED_PLATFORMS = ["internal_only", "unsupported", "oracle_taleo_legacy"];
  if (UNSUPPORTED_PLATFORMS.includes(platform.toLowerCase())) {
    return { supported: false, reason: "Platform is not supported for AI automated submission" };
  }

  const { evaluate } = resolveContext(pageOrProvider, maybePage);
  try {
    const isUnsupportedDom = await evaluate(() => {
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
 * Shared FormDetector Object
 */
export const FormDetector = {
  detect: detectApplicationFields,
  detectSteps: detectFormSteps,
  detectCaptcha,
  detectLoginRequired,
  detectRateLimited,
  detectPlatformSupported,
};


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
