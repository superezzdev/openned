/**
 * Application Submitter
 *
 * Handles the final submission step with idempotency checks.
 * Verifies all required conditions before clicking submit.
 * Detects submission success using multiple signals.
 *
 * CRITICAL: Never retry blindly after submission — duplicate applications are worse.
 */

import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { ApplicationStatus, FailureCode } from "./types";
import { updateApplicationStatus, failApplication } from "./application-status-service";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseAdmin(url, key);
}

// Known submit button selectors across platforms
const SUBMIT_SELECTORS = [
  "button[type='submit']",
  "input[type='submit']",
  "[data-testid*='submit']",
  "[data-qa*='submit']",
  "button:has-text('Submit Application')",
  "button:has-text('Submit')",
  "button:has-text('Apply')",
  "button:has-text('Send Application')",
  "button:has-text('Complete Application')",
];

// Known confirmation signals
const CONFIRMATION_SELECTORS = [
  "[class*='confirmation']",
  "[class*='success']",
  "[class*='thank-you']",
  "[data-testid*='confirmation']",
  "[data-testid*='success']",
];

const CONFIRMATION_TEXT_PATTERNS = [
  /thank you for (your )?application/i,
  /application (has been )?submitted/i,
  /application received/i,
  /we.ve received your application/i,
  /application complete/i,
  /successfully applied/i,
  /your application is (being|now) reviewed/i,
];

// Known post-submit error indicators
const ERROR_SELECTORS = [
  "[role='alert']",
  ".error-message",
  ".form-error",
  "[class*='form-error']",
  "[class*='alert-danger']",
  ".has-error",
];

const ERROR_TEXT_PATTERNS = [
  /there was an error (submitting|processing)/i,
  /please correct the errors? below/i,
  /submission failed/i,
  /unable to submit/i,
  /already submitted an application/i,
];

/**
 * Pre-submission checks. Returns false if submission should not proceed.
 */
export async function preSubmissionChecks(
  applicationId: string
): Promise<{ canSubmit: boolean; reason?: string }> {
  const supabase = getAdminClient();

  const { data: app } = await supabase
    .from("applications")
    .select("status, missing_fields, debug_info")
    .eq("id", applicationId)
    .maybeSingle();

  if (!app) {
    return { canSubmit: false, reason: "application_not_found" };
  }

  // CRITICAL: Idempotency check — never allow duplicate submission
  if (app.status === ApplicationStatus.SUBMITTED) {
    return { canSubmit: false, reason: "already_submitted" };
  }
  if (app.status === ApplicationStatus.SUBMISSION_UNCONFIRMED) {
    return { canSubmit: false, reason: "submission_already_unconfirmed" };
  }
  if (app.status === ApplicationStatus.CANCELLED) {
    return { canSubmit: false, reason: "cancelled" };
  }

  // If submit was already clicked/attempted in a previous run, do NOT submit again
  if (app.debug_info?.submit_attempted) {
    return { canSubmit: false, reason: "submit_already_attempted" };
  }

  // Check for unresolved missing fields
  const missing = app.missing_fields || [];
  if (missing.length > 0) {
    return { canSubmit: false, reason: "missing_profile_fields" };
  }

  return { canSubmit: true };
}

import { BrowserProvider, PageHandle } from "../automation/types";

function resolveSubmitterContext(
  arg1: any,
  arg2: any,
  arg3?: any
): {
  provider: BrowserProvider | null;
  page: any;
  rawPage: any;
  applicationId: string;
} {
  if (arg3 !== undefined) {
    return {
      provider: arg1,
      page: arg2,
      rawPage: arg2?.rawPage || arg2,
      applicationId: arg3,
    };
  }
  return {
    provider: null,
    page: arg1,
    rawPage: arg1?.rawPage || arg1,
    applicationId: arg2,
  };
}

/**
 * Submit the application through BrowserProvider or Playwright page.
 * Returns true if submission was confirmed, false otherwise.
 * A browser/network timeout after clicking Submit must NOT automatically cause another submission.
 */
export async function submitApplication(
  arg1: any,
  arg2: any,
  arg3?: any
): Promise<{ submitted: boolean; confirmed: boolean; confirmationUrl?: string; externalAppId?: string }> {
  const { provider, page, rawPage, applicationId } = resolveSubmitterContext(arg1, arg2, arg3);
  const supabase = getAdminClient();

  // 1. Pre-submission checks
  const { canSubmit, reason } = await preSubmissionChecks(applicationId);
  if (!canSubmit) {
    console.warn(`[ApplicationSubmitter] Cannot submit: ${reason}`);
    if (reason === "already_submitted") return { submitted: true, confirmed: true };
    if (reason === "submit_already_attempted" || reason === "submission_already_unconfirmed") {
      return { submitted: true, confirmed: false };
    }
    return { submitted: false, confirmed: false };
  }

  // 2. Update status to SUBMITTING if not already
  await updateApplicationStatus(applicationId, ApplicationStatus.SUBMITTING);

  // 3. Record the URL before submitting (for debug)
  const preSubmitUrl = typeof page.url === "function" ? page.url() : (rawPage?.url?.() || "");

  // 4. Find and click the submit button
  let submitClicked = false;
  for (const selector of SUBMIT_SELECTORS) {
    try {
      if (provider?.click) {
        const el = await provider.findElement(page, selector);
        if (el) {
          // Mark submit_attempted BEFORE/UPON click in DB so any concurrent or retry worker is blocked
          await supabase
            .from("applications")
            .update({
              debug_info: {
                submit_attempted: true,
                submit_clicked_at: new Date().toISOString(),
                pre_submit_url: preSubmitUrl,
              },
              updated_at: new Date().toISOString(),
            })
            .eq("id", applicationId);

          await provider.click(page, selector);
          submitClicked = true;
          break;
        }
      } else if (rawPage?.locator) {
        const btn = rawPage.locator(selector).first();
        if (await btn.count() > 0 && await btn.isVisible()) {
          await supabase
            .from("applications")
            .update({
              debug_info: {
                submit_attempted: true,
                submit_clicked_at: new Date().toISOString(),
                pre_submit_url: preSubmitUrl,
              },
              updated_at: new Date().toISOString(),
            })
            .eq("id", applicationId);

          await btn.click();
          submitClicked = true;
          break;
        }
      }
    } catch {
      continue;
    }
  }

  if (!submitClicked) {
    await failApplication(
      applicationId,
      FailureCode.SUBMISSION_FAILED,
      "The submit button couldn't be found on the application form.",
      { stage: "SUBMITTING", url: preSubmitUrl, browser_session_id: "" }
    );
    return { submitted: false, confirmed: false };
  }

  // 5. Wait for page to respond with timeout safety
  try {
    if (rawPage?.waitForNavigation) {
      await Promise.race([
        rawPage.waitForNavigation({ timeout: 8000 }).catch(() => {}),
        rawPage.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {}),
      ]);
    } else if (provider?.waitForTimeout) {
      await provider.waitForTimeout(page, 2000);
    }
  } catch (err: any) {
    console.warn("[ApplicationSubmitter] Post-submit wait timeout (page may still have submitted):", err?.message);
  }
  try {
    if (rawPage?.waitForTimeout) {
      await rawPage.waitForTimeout(500);
    } else if (provider?.waitForTimeout) {
      await provider.waitForTimeout(page, 500);
    }
  } catch {}

  const postSubmitUrl = typeof page.url === "function" ? page.url() : (rawPage?.url?.() || "");

  // 6. Independent verification of submission
  const verification = provider
    ? await independentlyVerifySubmission(provider, page, preSubmitUrl)
    : await independentlyVerifySubmission(page, preSubmitUrl);

  if (verification.hasError) {
    // Explicit error from server
    await failApplication(
      applicationId,
      FailureCode.SUBMISSION_FAILED,
      verification.errorMessage || "The application form returned an error after submission.",
      { stage: "SUBMITTING", url: postSubmitUrl, error: verification.errorMessage }
    );
    return { submitted: true, confirmed: false, confirmationUrl: postSubmitUrl };
  }

  if (verification.confirmed) {
    await updateApplicationStatus(applicationId, ApplicationStatus.SUBMITTED, {
      confirmation_url: postSubmitUrl !== preSubmitUrl ? postSubmitUrl : undefined,
      external_application_id: verification.externalAppId || undefined,
      debug_info: {
        submit_attempted: true,
        confirmed_via: verification.confirmedVia,
        pre_url: preSubmitUrl,
        post_url: postSubmitUrl,
      },
    });

    // Update user_job_interactions
    const { data: app } = await supabase
      .from("applications")
      .select("user_id, job_id")
      .eq("id", applicationId)
      .maybeSingle();

    if (app) {
      await supabase.from("user_job_interactions").upsert(
        { user_id: app.user_id, canonical_job_id: app.job_id, applied_status: true, applied_at: new Date().toISOString() },
        { onConflict: "user_id,canonical_job_id" }
      );
    }

    return {
      submitted: true,
      confirmed: true,
      confirmationUrl: postSubmitUrl,
      externalAppId: verification.externalAppId,
    };
  }

  // 7. Cannot independently confirm (e.g. timeout or ambiguous page)
  // CRITICAL: set SUBMISSION_UNCONFIRMED. Never retry blindly.
  await updateApplicationStatus(applicationId, ApplicationStatus.SUBMISSION_UNCONFIRMED, {
    confirmation_url: postSubmitUrl,
    debug_info: {
      submit_attempted: true,
      pre_url: preSubmitUrl,
      post_url: postSubmitUrl,
      reason: "confirmation_unverified_after_submit",
    },
  });

  return { submitted: true, confirmed: false, confirmationUrl: postSubmitUrl };
}

export interface SubmissionVerificationResult {
  confirmed: boolean;
  confirmedVia?: "url" | "dom" | "text" | "ref_id";
  hasError: boolean;
  errorMessage?: string;
  externalAppId?: string;
}

/**
 * Independently verify submission status without trusting previous state.
 * Supports both:
 * independentlyVerifySubmission(provider, page, preSubmitUrl)
 * independentlyVerifySubmission(page, preSubmitUrl)
 */
export async function independentlyVerifySubmission(
  arg1: any,
  arg2?: any,
  arg3?: any
): Promise<SubmissionVerificationResult> {
  let provider: BrowserProvider | null = null;
  let page: any;
  let rawPage: any;
  let preSubmitUrl: string | undefined;

  if (arg1?.providerType && arg2) {
    provider = arg1;
    page = arg2;
    rawPage = arg2?.rawPage || arg2;
    preSubmitUrl = arg3;
  } else if (arg3 !== undefined && typeof arg3 === "string" && typeof arg2 !== "string") {
    provider = arg1;
    page = arg2;
    rawPage = arg2?.rawPage || arg2;
    preSubmitUrl = arg3;
  } else {
    page = arg1;
    rawPage = arg1?.rawPage || arg1;
    preSubmitUrl = typeof arg2 === "string" ? arg2 : undefined;
  }


  try {
    const postSubmitUrl = typeof page.url === "function" ? page.url() : (rawPage?.url?.() || "");
    const evaluate = <T = any, R = any>(fn: any, a?: T): Promise<R> =>
      provider?.evaluate ? provider.evaluate(page, fn, a) : rawPage.evaluate(fn, a);

    // 1. Check for explicit error banners first
    for (const sel of ERROR_SELECTORS) {
      if (rawPage?.locator) {
        const el = rawPage.locator(sel).first();
        if ((await el.count().catch(() => 0)) > 0 && (await el.isVisible().catch(() => false))) {
          const errText = await el.textContent().catch(() => "");
          if (errText && errText.trim().length > 3) {
            return { confirmed: false, hasError: true, errorMessage: errText.trim() };
          }
        }
      }
    }

    const bodyText: string = await evaluate(() => document.body.textContent || "").catch(() => "");
    for (const pattern of ERROR_TEXT_PATTERNS) {
      const match = bodyText.match(pattern);
      if (match) {
        return { confirmed: false, hasError: true, errorMessage: match[0] };
      }
    }

    // 2. Check URL for confirmation patterns
    if (/confirmation|success|thank-you|thank_you|submitted|applied/i.test(postSubmitUrl)) {
      const externalAppId = await detectExternalApplicationId(page);
      return { confirmed: true, confirmedVia: "url", hasError: false, externalAppId: externalAppId || undefined };
    }

    // 3. Check DOM for confirmation elements
    for (const sel of CONFIRMATION_SELECTORS) {
      if (rawPage?.locator) {
        const el = rawPage.locator(sel).first();
        if ((await el.count().catch(() => 0)) > 0 && (await el.isVisible().catch(() => false))) {
          const externalAppId = await detectExternalApplicationId(page);
          return { confirmed: true, confirmedVia: "dom", hasError: false, externalAppId: externalAppId || undefined };
        }
      }
    }

    // 4. Check page text for confirmation messages
    for (const pattern of CONFIRMATION_TEXT_PATTERNS) {
      if (pattern.test(bodyText)) {
        const externalAppId = await detectExternalApplicationId(page);
        return { confirmed: true, confirmedVia: "text", hasError: false, externalAppId: externalAppId || undefined };
      }
    }

    // 5. Check if external application ID is detected
    const externalAppId = await detectExternalApplicationId(page);
    if (externalAppId) {
      return { confirmed: true, confirmedVia: "ref_id", hasError: false, externalAppId };
    }

    return { confirmed: false, hasError: false };
  } catch (err: any) {
    console.warn("[ApplicationSubmitter] Error during independent verification:", err?.message);
    return { confirmed: false, hasError: false };
  }
}

/**
 * Detect submission success using multiple signals.
 */
export async function detectSubmissionSuccess(page: any): Promise<boolean> {
  const result = await independentlyVerifySubmission(page);
  return result.confirmed;
}

/**
 * Try to extract an external application ID from the confirmation page.
 */
export async function detectExternalApplicationId(page: any): Promise<string | null> {
  try {
    const rawPage = page?.rawPage || page;
    const url = typeof page.url === "function" ? page.url() : (rawPage?.url?.() || "");
    const refMatch = url.match(/[?&](application_id|ref|id|confirmation)=([a-zA-Z0-9_-]+)/);
    if (refMatch) return refMatch[2];

    const evaluate = (fn: any) => (rawPage?.evaluate ? rawPage.evaluate(fn) : page.evaluate(fn));
    const pageText: string = await evaluate(() => document.body.textContent || "").catch(() => "");
    const textMatch = pageText.match(/(?:application|reference|confirmation)\s*(?:id|number|#)[\s:]*([A-Z0-9_-]{5,20})/i);
    if (textMatch) return textMatch[1];

    return null;
  } catch {
    return null;
  }
}

export const ApplicationSubmitter = {
  submit: submitApplication,
  verify: independentlyVerifySubmission,
  preSubmissionChecks,
};


