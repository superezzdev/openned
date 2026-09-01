/**
 * Application Orchestrator
 *
 * The main coordinator for the AI application automation workflow.
 * Coordinates: PlatformDetector → FormDetector → FieldMapper →
 *              ProfileResolver → ApplicationFiller → ApplicationSubmitter
 *
 * This is the entry point called by the Inngest worker function.
 */

import { chromium } from "playwright";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import {
  ApplicationStatus,
  FailureCode,
  FieldStatus,
  DetectedField,
  FieldMappingResult,
  QuestionType,
} from "./types";
import { detectApplicationPlatform, enhancePlatformDetectionFromPage } from "./platform-detector";
import { detectApplicationFields, detectFormSteps, detectCaptcha, detectLoginRequired } from "./form-detector";
import { mapAllFields } from "./field-mapper";
import { loadAutomationProfile, detectMissingFields, resolveProfileValue } from "./profile-resolver";
import { fillApplicationForm } from "./application-filler";
import { submitApplication } from "./application-submitter";
import { updateApplicationStatus, failApplication, logApplicationEvent } from "./application-status-service";
import { heartbeatApplicationLock } from "./application-locking";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseAdmin(url, key);
}

const HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds

export interface OrchestratorResult {
  success: boolean;
  status: ApplicationStatus;
  paused: boolean;
  pauseReason?: string;
}

/**
 * Main orchestrator function — runs the full application automation workflow.
 * @param applicationId - The application DB record ID
 * @param workerId - The lock worker ID (for heartbeat)
 */
export async function runApplicationAutomation(
  applicationId: string,
  workerId: string
): Promise<OrchestratorResult> {
  const supabase = getAdminClient();

  // Load application record
  const { data: app } = await supabase
    .from("applications")
    .select("*")
    .eq("id", applicationId)
    .maybeSingle();

  if (!app) {
    return { success: false, status: ApplicationStatus.FAILED, paused: false, pauseReason: "not_found" };
  }

  // Idempotency check — do not restart submitted or failed apps
  if ([ApplicationStatus.SUBMITTED, ApplicationStatus.CANCELLED].includes(app.status)) {
    return { success: true, status: app.status, paused: false };
  }

  const userId = app.user_id;
  const applyUrl = app.apply_url;
  const browserSessionId = app.browser_session_id || crypto.randomUUID();

  // Start heartbeat timer
  const heartbeatTimer = setInterval(async () => {
    await heartbeatApplicationLock(applicationId, workerId);
  }, HEARTBEAT_INTERVAL_MS);

  let browser: any = null;
  let page: any = null;

  try {
    // -------------------------------------------------------------------------
    // STAGE 1: DETECTING_PLATFORM
    // -------------------------------------------------------------------------
    await updateApplicationStatus(applicationId, ApplicationStatus.DETECTING_PLATFORM, {
      browser_session_id: browserSessionId,
    });

    const platformResult = await detectApplicationPlatform(applyUrl);

    // -------------------------------------------------------------------------
    // STAGE 2: DETECTING_FORM — open browser
    // -------------------------------------------------------------------------
    await updateApplicationStatus(applicationId, ApplicationStatus.DETECTING_FORM, {
      platform: platformResult.platform,
      platform_confidence: platformResult.confidence,
      platform_detection_method: platformResult.detection_method,
    });

    logApplicationEvent("browser_session_started", {
      application_id: applicationId,
      browser_session_id: browserSessionId,
      platform: platformResult.platform,
    });

    // Launch Playwright browser (headless)
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      viewport: { width: 1280, height: 800 },
    });
    page = await context.newPage();

    // Navigate to apply URL
    await page.goto(applyUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000); // Let JS-rendered content load

    // Check for rate limiting
    const { detectRateLimited, detectPlatformSupported } = await import("./form-detector");
    const isRateLimited = await detectRateLimited(page);
    if (isRateLimited) {
      clearInterval(heartbeatTimer);
      await failApplication(
        applicationId,
        FailureCode.RATE_LIMITED,
        "This site is temporarily blocking automated access. Please try again later or apply manually.",
        { stage: "DETECTING_PAGE", url: page.url(), browser_session_id: browserSessionId }
      );
      return { success: false, status: ApplicationStatus.FAILED, paused: false };
    }

    // Check for login wall
    const loginRequired = await detectLoginRequired(page);
    if (loginRequired) {
      clearInterval(heartbeatTimer);
      await updateApplicationStatus(applicationId, ApplicationStatus.AWAITING_USER_ACTION, {
        error_message: "This application requires you to log in first. Please apply manually.",
        failure_code: FailureCode.AUTH_REQUIRED,
      });
      return {
        success: false,
        status: ApplicationStatus.AWAITING_USER_ACTION,
        paused: true,
        pauseReason: "auth_required",
      };
    }

    // Check for CAPTCHA
    const captchaDetected = await detectCaptcha(page);
    if (captchaDetected) {
      clearInterval(heartbeatTimer);
      await updateApplicationStatus(applicationId, ApplicationStatus.AWAITING_USER_ACTION, {
        error_message: "This employer requires a verification step that the AI agent cannot complete automatically.",
        failure_code: FailureCode.CAPTCHA_REQUIRED,
      });
      return {
        success: false,
        status: ApplicationStatus.AWAITING_USER_ACTION,
        paused: true,
        pauseReason: "captcha_required",
      };
    }

    // Enhance platform detection with DOM signals
    const enhancedPlatform = await enhancePlatformDetectionFromPage(page, platformResult);
    if (enhancedPlatform.platform !== platformResult.platform) {
      await supabase
        .from("applications")
        .update({
          platform: enhancedPlatform.platform,
          platform_confidence: enhancedPlatform.confidence,
          platform_detection_method: enhancedPlatform.detection_method,
        })
        .eq("id", applicationId);
    }

    // Check if platform is supported
    const platformSupport = await detectPlatformSupported(enhancedPlatform.platform, page);
    if (!platformSupport.supported) {
      clearInterval(heartbeatTimer);
      await failApplication(
        applicationId,
        FailureCode.PLATFORM_NOT_SUPPORTED,
        platformSupport.reason || "This job platform isn't fully supported for automated application. You can apply manually.",
        { stage: "DETECTING_PLATFORM", url: page.url(), browser_session_id: browserSessionId }
      );
      return { success: false, status: ApplicationStatus.FAILED, paused: false };
    }

    // Detect form fields
    const detectedFields = await detectApplicationFields(page);

    if (detectedFields.length === 0) {
      // No form found — might be a non-standard page
      await failApplication(
        applicationId,
        FailureCode.FIELD_NOT_FOUND,
        "No application form fields were detected on this page.",
        { stage: "DETECTING_FORM", url: page.url(), browser_session_id: browserSessionId }
      );
      return { success: false, status: ApplicationStatus.FAILED, paused: false };
    }

    // Detect form steps
    const totalSteps = await detectFormSteps(page);

    // Save form schema to DB
    const formSchemaId = await saveFormSchema(applicationId, enhancedPlatform.platform, page.url(), detectedFields);

    // -------------------------------------------------------------------------
    // STAGE 3: MAPPING_FIELDS
    // -------------------------------------------------------------------------
    await updateApplicationStatus(applicationId, ApplicationStatus.MAPPING_FIELDS, {
      form_schema_id: formSchemaId,
    });

    // Load user profile
    const profile = await loadAutomationProfile(userId);

    // Map all fields
    const mappedFields = await mapAllFields(detectedFields, profile);

    // Save field mappings
    await saveFieldMappings(formSchemaId, mappedFields);

    // -------------------------------------------------------------------------
    // STAGE 4: Check for missing profile fields
    // -------------------------------------------------------------------------
    const missingProfileFields = detectMissingFields(
      mappedFields.filter(f => f.mapping.mapped_profile_key !== null),
      profile
    );

    if (missingProfileFields.length > 0) {
      clearInterval(heartbeatTimer);
      await updateApplicationStatus(applicationId, ApplicationStatus.MISSING_PROFILE_INFO, {
        missing_fields: missingProfileFields,
      });

      logApplicationEvent("application_missing_profile_info", {
        application_id: applicationId,
        missing_count: missingProfileFields.length,
        browser_session_id: browserSessionId,
      });

      // Close browser — session will be restarted when user provides info
      await browser.close();
      browser = null;

      return {
        success: false,
        status: ApplicationStatus.MISSING_PROFILE_INFO,
        paused: true,
        pauseReason: "missing_profile_fields",
      };
    }

    // -------------------------------------------------------------------------
    // STAGE 5: READY_TO_APPLY → FILLING_FORM & RESUME UPLOAD
    // -------------------------------------------------------------------------
    await updateApplicationStatus(applicationId, ApplicationStatus.READY_TO_APPLY);
    await updateApplicationStatus(applicationId, ApplicationStatus.FILLING_FORM);

    // Fill the form and upload resume
    const fillResults = await fillApplicationForm(page, applicationId, mappedFields, profile);

    // Check if any required field failed because it disappeared from the DOM
    const missingDisappeared = fillResults.find(r => !r.success && r.error === "field_not_found");
    if (missingDisappeared) {
      const fieldDef = mappedFields.find(f => f.field_id === missingDisappeared.field_id);
      if (fieldDef?.required) {
        clearInterval(heartbeatTimer);
        await failApplication(
          applicationId,
          FailureCode.FIELD_NOT_FOUND,
          `A required field "${fieldDef.label || missingDisappeared.field_id}" could not be located on the application form.`,
          { stage: "FILLING_FORM", field: missingDisappeared.field_id, browser_session_id: browserSessionId }
        );
        return { success: false, status: ApplicationStatus.FAILED, paused: false };
      }
    }

    // Handle multi-step forms: navigate through pages
    if (totalSteps > 1) {
      await handleMultiStepForm(page, applicationId, workerId, mappedFields, profile, browserSessionId, totalSteps);
      // If status changed to paused in handleMultiStepForm, return early
      const { data: currentApp } = await supabase.from("applications").select("status").eq("id", applicationId).maybeSingle();
      if (currentApp?.status && currentApp.status !== ApplicationStatus.FILLING_FORM) {
        clearInterval(heartbeatTimer);
        await browser.close();
        browser = null;
        return { success: false, status: currentApp.status, paused: true, pauseReason: "multistep_pause" };
      }
    }

    // -------------------------------------------------------------------------
    // STAGE 5B: Check for unknown employer questions (Step 22-23)
    // -------------------------------------------------------------------------
    const { data: savedFormFields } = await supabase
      .from("application_form_fields")
      .select("field_key, current_value, selector")
      .eq("application_form_id", formSchemaId);

    const answeredMap = new Map((savedFormFields || []).map((sf: any) => [sf.field_key, sf.current_value]));

    // Fill previously saved answers to custom questions if any
    for (const sf of savedFormFields || []) {
      if (sf.current_value && sf.selector) {
        try {
          const loc = page.locator(sf.selector).first();
          if (await loc.count() > 0 && await loc.isVisible()) {
            await loc.fill(sf.current_value);
          }
        } catch {}
      }
    }

    // Identify unanswered unknown / custom employer questions
    const unansweredUnknown = mappedFields.filter(f => {
      if (answeredMap.get(f.field_id)) return false; // already answered
      if (f.mapping.mapped_profile_key && resolveProfileValue(f.mapping.mapped_profile_key, profile)) {
        return false; // answered via user profile
      }
      if (f.type === "file" || f.mapping.mapped_profile_key === "resume") return false;
      // Pause if field is required, or is an explicit custom/open-ended question
      return (
        f.required ||
        f.question_type === QuestionType.OPEN_ENDED ||
        f.question_type === QuestionType.UNKNOWN ||
        f.mapping.status === FieldStatus.AMBIGUOUS
      );
    });

    if (unansweredUnknown.length > 0) {
      clearInterval(heartbeatTimer);
      const questionDescriptors = unansweredUnknown.map(q => ({
        field_key: q.field_id,
        label: q.label,
        type: q.type,
        options: q.options,
      }));

      await updateApplicationStatus(applicationId, ApplicationStatus.AWAITING_USER_INPUT, {
        missing_fields: questionDescriptors,
      });

      logApplicationEvent("application_awaiting_user_input", {
        application_id: applicationId,
        unknown_count: unansweredUnknown.length,
        browser_session_id: browserSessionId,
      });

      await browser.close();
      browser = null;

      return {
        success: false,
        status: ApplicationStatus.AWAITING_USER_INPUT,
        paused: true,
        pauseReason: "unknown_questions",
      };
    }

    // -------------------------------------------------------------------------
    // STAGE 6: AWAITING_USER_REVIEW (Step 24)
    // -------------------------------------------------------------------------
    clearInterval(heartbeatTimer);
    await updateApplicationStatus(applicationId, ApplicationStatus.AWAITING_USER_REVIEW);

    // Close browser — user will confirm, then we re-open for final submission
    await browser.close();
    browser = null;

    return {
      success: true,
      status: ApplicationStatus.AWAITING_USER_REVIEW,
      paused: true,
      pauseReason: "awaiting_user_review",
    };

  } catch (err: any) {
    clearInterval(heartbeatTimer);

    const errorMsg = err?.message || "Unknown error";
    console.error("[ApplicationOrchestrator] Error:", {
      application_id: applicationId,
      error: errorMsg,
      browser_session_id: browserSessionId,
    });

    let failureCode = FailureCode.BROWSER_ERROR;
    if (errorMsg.includes("timeout") || errorMsg.includes("Timeout")) failureCode = FailureCode.TIMEOUT;
    if (errorMsg.includes("net::ERR")) failureCode = FailureCode.APPLICATION_PAGE_UNAVAILABLE;

    await failApplication(
      applicationId,
      failureCode,
      "An error occurred during automation. Please try again or apply manually.",
      {
        stage: "ORCHESTRATOR",
        error: errorMsg,
        browser_session_id: browserSessionId,
      }
    );

    return { success: false, status: ApplicationStatus.FAILED, paused: false };
  } finally {
    if (browser) {
      try { await browser.close(); } catch {}
    }
  }
}

/**
 * Handle multi-step form navigation.
 * Detects "Next" buttons, advances, and fills newly visible fields.
 */
async function handleMultiStepForm(
  page: any,
  applicationId: string,
  workerId: string,
  allMappedFields: Array<DetectedField & { mapping: FieldMappingResult }>,
  profile: any,
  browserSessionId: string,
  totalSteps: number
): Promise<void> {
  const NEXT_SELECTORS = [
    "button:has-text('Next')",
    "button:has-text('Continue')",
    "button:has-text('Next Step')",
    "[data-testid*='next']",
    "[data-qa*='next']",
  ];

  for (let step = 2; step <= totalSteps; step++) {
    // Click Next
    for (const sel of NEXT_SELECTORS) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.count() > 0 && await btn.isVisible()) {
          await btn.click();
          await page.waitForLoadState("domcontentloaded", { timeout: 10000 });
          await page.waitForTimeout(1500);
          break;
        }
      } catch {}
    }

    // Check for CAPTCHA on new step
    const captchaDetected = await detectCaptcha(page);
    if (captchaDetected) {
      await updateApplicationStatus(applicationId, ApplicationStatus.AWAITING_USER_ACTION, {
        error_message: "A CAPTCHA appeared on a later step that the AI agent cannot solve.",
        failure_code: FailureCode.CAPTCHA_REQUIRED,
      });
      return;
    }

    // Detect newly visible fields
    const newFields = await detectApplicationFields(page);
    const newFieldIds = new Set(allMappedFields.map(f => f.field_id));
    const trulyNewFields = newFields.filter(f => !newFieldIds.has(f.field_id));

    if (trulyNewFields.length > 0) {
      const mappedNew = await mapAllFields(trulyNewFields, profile);

      // Check for new missing required fields
      const { detectMissingFields: detectMF } = await import("./profile-resolver");
      const newMissing = detectMF(mappedNew, profile);

      if (newMissing.length > 0) {
        // Pause for missing fields — save application state
        const { data: app } = await (await import("@supabase/supabase-js")).createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        ).from("applications").select("missing_fields").eq("id", applicationId).maybeSingle();

        const existingMissing = app?.missing_fields || [];
        await updateApplicationStatus(applicationId, ApplicationStatus.MISSING_PROFILE_INFO, {
          missing_fields: [...existingMissing, ...newMissing],
        });
        return;
      }

      await fillApplicationForm(page, applicationId, mappedNew, profile);
    }

    await heartbeatApplicationLock(applicationId, workerId);
  }
}

/**
 * Save the detected form schema to the database.
 * Returns the form schema ID.
 */
async function saveFormSchema(
  applicationId: string,
  platform: string,
  pageUrl: string,
  fields: DetectedField[]
): Promise<string> {
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from("application_forms")
    .insert({
      application_id: applicationId,
      platform,
      page_url: pageUrl,
      version: 1,
      fields_json: fields,
      detected_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

/**
 * Save field mappings to application_form_fields table.
 */
async function saveFieldMappings(
  formSchemaId: string,
  mappedFields: Array<DetectedField & { mapping: FieldMappingResult }>
): Promise<void> {
  const supabase = getAdminClient();

  const rows = mappedFields.map((f) => ({
    application_form_id: formSchemaId,
    field_key: f.field_id,
    label: f.label,
    type: f.type,
    required: f.required,
    selector: f.selector,
    options_json: f.options || [],
    page_step: f.page_step || 1,
    mapped_profile_key: f.mapping.mapped_profile_key,
    status: f.mapping.status,
  }));

  if (rows.length > 0) {
    await supabase.from("application_form_fields").insert(rows);
  }
}

/**
 * Resume a paused application (after user fills missing fields or after review approval).
 * Re-opens browser and continues from the appropriate step.
 */
export async function resumeApplicationAfterMissingFields(
  applicationId: string,
  workerId: string
): Promise<OrchestratorResult> {
  const supabase = getAdminClient();

  const { data: app } = await supabase
    .from("applications")
    .select("*")
    .eq("id", applicationId)
    .maybeSingle();

  if (!app) {
    return { success: false, status: ApplicationStatus.FAILED, paused: false };
  }

  // Re-run from beginning (browser was closed), but with updated profile
  return runApplicationAutomation(applicationId, workerId);
}

/**
 * Final submission after user review approval.
 */
export async function submitAfterReview(
  applicationId: string,
  workerId: string
): Promise<OrchestratorResult> {
  let browser: any = null;

  try {
    const supabase = getAdminClient();
    const { data: app } = await supabase
      .from("applications")
      .select("*")
      .eq("id", applicationId)
      .maybeSingle();

    if (!app) return { success: false, status: ApplicationStatus.FAILED, paused: false };

    // Accept SUBMITTING, AWAITING_USER_REVIEW, or QUEUED (if resumed by worker)
    const validSubmitStatuses = [
      ApplicationStatus.AWAITING_USER_REVIEW,
      ApplicationStatus.SUBMITTING,
      ApplicationStatus.QUEUED,
    ];
    if (!validSubmitStatuses.includes(app.status)) {
      return { success: true, status: app.status, paused: false };
    }

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();

    await page.goto(app.apply_url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);

    // CRITICAL: If submit was already attempted in a prior run, NEVER click submit again!
    // Instead, run independent verification only.
    if (app.debug_info?.submit_attempted) {
      const { independentlyVerifySubmission } = await import("./application-submitter");
      const verification = await independentlyVerifySubmission(page, app.apply_url);
      if (verification.confirmed) {
        await updateApplicationStatus(applicationId, ApplicationStatus.SUBMITTED, {
          external_application_id: verification.externalAppId,
        });
        return { success: true, status: ApplicationStatus.SUBMITTED, paused: false };
      }
      return { success: true, status: ApplicationStatus.SUBMISSION_UNCONFIRMED, paused: false };
    }

    // Re-fill the form before submitting (session may have expired)
    const profile = await loadAutomationProfile(app.user_id);
    const { data: formRecord } = await supabase
      .from("application_forms")
      .select("id, fields_json")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (formRecord?.fields_json) {
      const fields = formRecord.fields_json as DetectedField[];
      const mapped = await mapAllFields(fields, profile);
      await fillApplicationForm(page, applicationId, mapped, profile);

      // Also fill any user-provided answers to custom questions
      const { data: savedAnswers } = await supabase
        .from("application_form_fields")
        .select("field_key, current_value, selector")
        .eq("application_form_id", formRecord.id)
        .not("current_value", "is", null);

      for (const ans of savedAnswers || []) {
        if (ans.current_value && ans.selector) {
          try {
            const loc = page.locator(ans.selector).first();
            if (await loc.count() > 0 && await loc.isVisible()) {
              await loc.fill(ans.current_value);
            }
          } catch {}
        }
      }
    }

    const { submitted, confirmed, confirmationUrl } = await submitApplication(page, applicationId);

    return {
      success: submitted,
      status: confirmed ? ApplicationStatus.SUBMITTED : ApplicationStatus.SUBMISSION_UNCONFIRMED,
      paused: false,
    };
  } catch (err: any) {
    const supabase = getAdminClient();
    const { data: currentApp } = await supabase
      .from("applications")
      .select("debug_info, status")
      .eq("id", applicationId)
      .maybeSingle();

    // If submit was already clicked, do NOT fail — stay as SUBMISSION_UNCONFIRMED
    if (currentApp?.debug_info?.submit_attempted || currentApp?.status === ApplicationStatus.SUBMISSION_UNCONFIRMED) {
      return { success: true, status: ApplicationStatus.SUBMISSION_UNCONFIRMED, paused: false };
    }

    await failApplication(
      applicationId,
      FailureCode.SUBMISSION_FAILED,
      "An error occurred during final submission.",
      { stage: "SUBMITTING", error: err?.message }
    );
    return { success: false, status: ApplicationStatus.FAILED, paused: false };
  } finally {
    if (browser) { try { await browser.close(); } catch {} }
  }
}
