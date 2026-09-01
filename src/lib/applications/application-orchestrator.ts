/**
 * Application Orchestrator
 *
 * The main coordinator for the AI application automation workflow.
 * Coordinates: PlatformDetector → FormDetector → FieldMapper →
 *              ProfileResolver → ApplicationFiller → ApplicationSubmitter
 *
 * Works with the BrowserProvider abstraction (LocalBrowserProvider and BrowserbaseProvider).
 * Supports automatic one-time fallback to Browserbase on infrastructure/browser execution failures.
 */

import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import {
  ApplicationStatus,
  FailureCode,
  FieldStatus,
  DetectedField,
  FieldMappingResult,
  QuestionType,
} from "./types";
import {
  BrowserProvider,
  PageHandle,
  BrowserSession,
  AutomationProvider,
  selectBrowserProvider,
  shouldFallbackToBrowserbase,
  BrowserbaseProvider,
  saveApplicationAutomationState,
  createAutomationSessionRecord,
  completeAutomationSessionRecord,
} from "../automation";
import { detectApplicationPlatform, enhancePlatformDetectionFromPage } from "./platform-detector";
import { detectApplicationFields, detectFormSteps, detectCaptcha, detectLoginRequired, detectRateLimited, detectPlatformSupported } from "./form-detector";
import { mapAllFields } from "./field-mapper";
import { loadAutomationProfile, detectMissingFields, resolveProfileValue } from "./profile-resolver";
import { fillApplicationForm, fillSingleField } from "./application-filler";
import { submitApplication, independentlyVerifySubmission } from "./application-submitter";
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
  fallbackTriggered?: boolean;
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

  // Idempotency check — do not restart submitted or terminal apps
  if ([ApplicationStatus.SUBMITTED, ApplicationStatus.CANCELLED].includes(app.status)) {
    return { success: true, status: app.status, paused: false };
  }

  // Start heartbeat timer
  const heartbeatTimer = setInterval(async () => {
    await heartbeatApplicationLock(applicationId, workerId);
  }, HEARTBEAT_INTERVAL_MS);

  try {
    // Select initial browser provider (Local first under AUTO, or user's explicit preference)
    let provider = selectBrowserProvider(app);

    // Run execution with initial provider
    const result = await executeWorkflow(app, provider, workerId, heartbeatTimer);
    return result;
  } finally {
    clearInterval(heartbeatTimer);
  }
}

/**
 * Execute application automation workflow with a designated BrowserProvider,
 * catching infrastructure failures and falling back to Browserbase if eligible.
 */
async function executeWorkflow(
  app: any,
  provider: BrowserProvider,
  workerId: string,
  heartbeatTimer: NodeJS.Timeout
): Promise<OrchestratorResult> {
  const supabase = getAdminClient();
  const applicationId = app.id;
  const userId = app.user_id;
  const applyUrl = app.apply_url;

  let session: BrowserSession | null = null;
  let currentStage: string = app.status || "DETECTING_PLATFORM";

  try {
    // -------------------------------------------------------------------------
    // STAGE 1: DETECTING_PLATFORM
    // -------------------------------------------------------------------------
    currentStage = "DETECTING_PLATFORM";
    await updateApplicationStatus(applicationId, ApplicationStatus.DETECTING_PLATFORM, {
      browser_session_id: app.browser_session_id || undefined,
    });

    const platformResult = await detectApplicationPlatform(applyUrl);

    // -------------------------------------------------------------------------
    // STAGE 2: CREATE BROWSER SESSION & OPEN PAGE
    // -------------------------------------------------------------------------
    currentStage = "DETECTING_FORM";
    await updateApplicationStatus(applicationId, ApplicationStatus.DETECTING_FORM, {
      platform: platformResult.platform,
      platform_confidence: platformResult.confidence,
      platform_detection_method: platformResult.detection_method,
    });

    // Create session through provider abstraction
    session = await provider.createSession();

    // Update DB with active session details & provider
    await supabase
      .from("applications")
      .update({
        browser_session_id: session.id,
        browser_provider: provider.providerType,
        automation_provider: provider.providerType,
        updated_at: new Date().toISOString(),
      })
      .eq("id", applicationId);

    // Record in automation_sessions table
    await createAutomationSessionRecord(applicationId, provider.providerType, session.id, {
      debug_url: session.debugUrl,
      replay_url: session.replayUrl,
      platform: platformResult.platform,
    });

    logApplicationEvent("browser_session_started", {
      application_id: applicationId,
      browser_session_id: session.id,
      provider: provider.providerType,
      platform: platformResult.platform,
    });

    // Save initial checkpoint
    await saveApplicationAutomationState(applicationId, {
      stage: currentStage,
      platform: platformResult.platform,
      page_url: applyUrl,
      provider: provider.providerType,
      session_id: session.id,
    });

    // Normalize ATS application URLs if they point to the job description
    let targetApplyUrl = applyUrl;
    if (typeof targetApplyUrl === "string") {
      if (/jobs\.ashbyhq\.com\/[^/]+\/[^/?#]+(?:\/)?$/i.test(targetApplyUrl)) {
        targetApplyUrl = targetApplyUrl.replace(/\/$/, "") + "/application";
      } else if (/jobs\.lever\.co\/[^/]+\/[^/?#]+(?:\/)?$/i.test(targetApplyUrl)) {
        targetApplyUrl = targetApplyUrl.replace(/\/$/, "") + "/apply";
      }
    }

    // Open target page via provider abstraction
    const page = await provider.openPage(session, targetApplyUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await provider
      .waitForSelector(
        page,
        "form, input:not([type='hidden']), textarea, a[href*='apply'], a[href*='application'], button:has-text('Apply')",
        { timeout: 6000 }
      )
      .catch(() => {});
    await provider.waitForTimeout(page, 1500); // Allow JS hydration

    // Check for rate limiting
    const isRateLimited = await detectRateLimited(provider, page);
    if (isRateLimited) {
      clearInterval(heartbeatTimer);
      await failApplication(
        applicationId,
        FailureCode.RATE_LIMITED,
        "This site is temporarily blocking automated access. Please try again later or apply manually.",
        { stage: "DETECTING_PAGE", url: await provider.getCurrentUrl(page), browser_session_id: session.id }
      );
      return { success: false, status: ApplicationStatus.FAILED, paused: false };
    }

    // Check for login wall
    const loginRequired = await detectLoginRequired(provider, page);
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
    const captchaDetected = await detectCaptcha(provider, page);
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
    const enhancedPlatform = await enhancePlatformDetectionFromPage(provider, page, platformResult);
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

    // Check platform support
    const platformSupport = await detectPlatformSupported(enhancedPlatform.platform, provider, page);
    if (!platformSupport.supported) {
      clearInterval(heartbeatTimer);
      await failApplication(
        applicationId,
        FailureCode.PLATFORM_NOT_SUPPORTED,
        platformSupport.reason || "This job platform isn't fully supported for automated application. You can apply manually.",
        { stage: "DETECTING_PLATFORM", url: await provider.getCurrentUrl(page), browser_session_id: session.id }
      );
      return { success: false, status: ApplicationStatus.FAILED, paused: false };
    }

    // Detect form fields through provider abstraction
    let detectedFields = await detectApplicationFields(provider, page);

    // If 0 fields found, check if we landed on a job description page with an "Apply" button or link
    if (detectedFields.length === 0) {
      logApplicationEvent("searching_apply_button", {
        application_id: applicationId,
        current_url: await provider.getCurrentUrl(page),
      });

      const applySelectors = [
        "button.jobs-apply-button",
        "button:has-text('Easy Apply')",
        "button:has-text('Apply now')",
        "button:has-text('Apply Now')",
        "button:has-text('Apply for this job')",
        "a:has-text('Apply for this job')",
        "a:has-text('Apply Now')",
        "button:has-text('Apply')",
        "a:has-text('Apply')",
        "[data-live-test-job-apply-button]",
        "[data-job-id]",
        "a[href*='/application']",
        "a[href*='/apply']",
        "a[data-testid*='apply']",
        "button[data-testid*='apply']",
      ];

      for (const sel of applySelectors) {
        try {
          const el = await provider.findElement(page, sel);
          if (el) {
            await provider.click(page, sel);
            await provider
              .waitForSelector(
                page,
                ".jobs-easy-apply-modal, div[role='dialog'], form, input:not([type='hidden']), textarea",
                { timeout: 10000 }
              )
              .catch(() => {});
            await provider.waitForTimeout(page, 1500);
            detectedFields = await detectApplicationFields(provider, page);
            if (detectedFields.length > 0) break;
          }
        } catch {}
      }
    }

    if (detectedFields.length === 0) {
      throw new Error("No application form fields were detected on this page.");
    }

    // Detect form steps
    const totalSteps = await detectFormSteps(provider, page);

    // Save form schema to DB
    const currentUrl = await provider.getCurrentUrl(page);
    const formSchemaId = await saveFormSchema(applicationId, enhancedPlatform.platform, currentUrl, detectedFields);

    // -------------------------------------------------------------------------
    // STAGE 3: MAPPING_FIELDS
    // -------------------------------------------------------------------------
    currentStage = "MAPPING_FIELDS";
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
    currentStage = "MISSING_PROFILE_INFO";
    const missingProfileFields = detectMissingFields(
      mappedFields.filter((f) => f.mapping.mapped_profile_key !== null),
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
        browser_session_id: session.id,
      });

      // Save state checkpoint
      await saveApplicationAutomationState(applicationId, {
        stage: "MISSING_PROFILE_INFO",
        form_schema_id: formSchemaId,
        missing_fields: missingProfileFields,
        platform: enhancedPlatform.platform,
        page_url: currentUrl,
      });

      await provider.closeSession(session);
      session = null;

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
    currentStage = "FILLING_FORM";
    await updateApplicationStatus(applicationId, ApplicationStatus.READY_TO_APPLY);
    await updateApplicationStatus(applicationId, ApplicationStatus.FILLING_FORM);

    // Save state checkpoint
    await saveApplicationAutomationState(applicationId, {
      stage: "FILLING_FORM",
      form_schema_id: formSchemaId,
      platform: enhancedPlatform.platform,
      page_url: currentUrl,
    });

    // Fill the form and upload resume through provider abstraction
    const fillResults = await fillApplicationForm(provider, page, applicationId, mappedFields, profile);

    // Check if any required field failed because it disappeared from the DOM
    const missingDisappeared = fillResults.find((r) => !r.success && r.error === "field_not_found");
    if (missingDisappeared) {
      const fieldDef = mappedFields.find((f) => f.field_id === missingDisappeared.field_id);
      if (fieldDef?.required) {
        throw new Error(
          `A required field "${fieldDef.label || missingDisappeared.field_id}" could not be located on the application form.`
        );
      }
    }

    // Handle multi-step forms: navigate through pages
    if (totalSteps > 1) {
      await handleMultiStepForm(
        provider,
        page,
        applicationId,
        workerId,
        mappedFields,
        profile,
        session.id,
        totalSteps
      );

      const { data: currentApp } = await supabase
        .from("applications")
        .select("status")
        .eq("id", applicationId)
        .maybeSingle();

      if (currentApp?.status && currentApp.status !== ApplicationStatus.FILLING_FORM) {
        clearInterval(heartbeatTimer);
        await provider.closeSession(session);
        session = null;
        return { success: false, status: currentApp.status, paused: true, pauseReason: "multistep_pause" };
      }
    }

    // -------------------------------------------------------------------------
    // STAGE 5B: Check for unknown employer questions
    // -------------------------------------------------------------------------
    const { data: savedFormFields } = await supabase
      .from("application_form_fields")
      .select("field_key, current_value, selector, type, label, options_json")
      .eq("application_form_id", formSchemaId);

    const answeredMap = new Map(
      (savedFormFields || []).map((sf: any) => [sf.field_key, sf.current_value])
    );

    // Fill previously saved answers to custom questions if any
    for (const sf of savedFormFields || []) {
      if (sf.current_value && sf.selector) {
        try {
          const fieldDef = mappedFields.find(
            (f) => f.field_id === sf.field_key || f.selector === sf.selector
          ) || {
            field_id: sf.field_key,
            label: sf.label || sf.field_key,
            type: sf.type || "text",
            required: false,
            selector: sf.selector,
            options: sf.options_json,
            source: "inferred",
            page_step: 1,
          };
          await fillSingleField(provider, page, fieldDef as any, sf.current_value);
        } catch {}
      }
    }

    // Identify unanswered unknown / custom employer questions
    const unansweredUnknown = mappedFields.filter((f) => {
      if (answeredMap.get(f.field_id)) return false;
      if (f.mapping.mapped_profile_key && resolveProfileValue(f.mapping.mapped_profile_key, profile)) {
        return false;
      }
      if (f.type === "file" || f.mapping.mapped_profile_key === "resume") return false;
      return (
        f.required ||
        f.question_type === QuestionType.OPEN_ENDED ||
        f.question_type === QuestionType.UNKNOWN ||
        f.mapping.status === FieldStatus.AMBIGUOUS
      );
    });

    if (unansweredUnknown.length > 0) {
      clearInterval(heartbeatTimer);
      const questionDescriptors = unansweredUnknown.map((q) => ({
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
        browser_session_id: session.id,
      });

      await saveApplicationAutomationState(applicationId, {
        stage: "AWAITING_USER_INPUT",
        form_schema_id: formSchemaId,
        missing_fields: questionDescriptors,
      });

      await provider.closeSession(session);
      session = null;

      return {
        success: false,
        status: ApplicationStatus.AWAITING_USER_INPUT,
        paused: true,
        pauseReason: "unknown_questions",
      };
    }

    // -------------------------------------------------------------------------
    // STAGE 6: AWAITING_USER_REVIEW
    // -------------------------------------------------------------------------
    clearInterval(heartbeatTimer);
    await updateApplicationStatus(applicationId, ApplicationStatus.AWAITING_USER_REVIEW);

    await saveApplicationAutomationState(applicationId, {
      stage: "AWAITING_USER_REVIEW",
      form_schema_id: formSchemaId,
    });

    // Close browser session safely — will be re-opened for final submission after review
    await provider.closeSession(session);
    session = null;

    return {
      success: true,
      status: ApplicationStatus.AWAITING_USER_REVIEW,
      paused: true,
      pauseReason: "awaiting_user_review",
    };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    console.error(`[ApplicationOrchestrator] Provider ${provider.providerType} error:`, {
      application_id: applicationId,
      error: errorMsg,
      stage: currentStage,
    });

    // -------------------------------------------------------------------------
    // FALLBACK DECISION LOGIC
    // -------------------------------------------------------------------------
    const fallbackDecision = shouldFallbackToBrowserbase(err, app, currentStage);

    if (fallbackDecision.shouldFallback && provider.providerType !== AutomationProvider.BROWSERBASE) {
      console.log(`[ApplicationOrchestrator] Falling back to Browserbase... Reason: ${fallbackDecision.reason}`);

      // 1. Structured fallback audit log
      logApplicationEvent("automation_fallback", {
        application_id: applicationId,
        from_provider: provider.providerType,
        to_provider: AutomationProvider.BROWSERBASE,
        reason: fallbackDecision.reason,
        stage: currentStage,
        timestamp: new Date().toISOString(),
      });

      // 2. Mark fallback in DB
      await supabase
        .from("applications")
        .update({
          fallback_used: true,
          fallback_reason: fallbackDecision.reason,
          automation_provider: AutomationProvider.BROWSERBASE,
          browser_provider: AutomationProvider.BROWSERBASE,
          last_automation_error: errorMsg,
          updated_at: new Date().toISOString(),
        })
        .eq("id", applicationId);

      // 3. Close local session safely
      if (session) {
        await provider.closeSession(session).catch(() => {});
        session = null;
      }

      // 4. Update memory app object
      const fallbackApp = {
        ...app,
        fallback_used: true,
        fallback_reason: fallbackDecision.reason,
        automation_provider: AutomationProvider.BROWSERBASE,
        browser_provider: AutomationProvider.BROWSERBASE,
      };

      // 5. Resume same workflow with BrowserbaseProvider
      const browserbaseProvider = new BrowserbaseProvider();
      return executeWorkflow(fallbackApp, browserbaseProvider, workerId, heartbeatTimer);
    }

    // No fallback eligible or Browserbase itself failed: terminal failure
    clearInterval(heartbeatTimer);
    const failureCode = fallbackDecision.classifiedError?.failureCode || FailureCode.BROWSER_ERROR;
    const userMessage = fallbackDecision.classifiedError?.userMessage || "An error occurred during automation.";

    await failApplication(applicationId, failureCode, userMessage, {
      stage: currentStage,
      error: errorMsg,
      browser_session_id: session?.id || app.browser_session_id,
    });

    return { success: false, status: ApplicationStatus.FAILED, paused: false };
  } finally {
    if (session) {
      await provider.closeSession(session).catch(() => {});
    }
  }
}

/**
 * Handle multi-step form navigation through provider abstraction.
 */
async function handleMultiStepForm(
  provider: BrowserProvider,
  page: PageHandle,
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
    for (const sel of NEXT_SELECTORS) {
      try {
        const btn = await provider.findElement(page, sel);
        if (btn) {
          await provider.click(page, sel);
          await provider.waitForTimeout(page, 1500);
          break;
        }
      } catch {}
    }

    // Check for CAPTCHA on new step
    const captchaDetected = await detectCaptcha(provider, page);
    if (captchaDetected) {
      await updateApplicationStatus(applicationId, ApplicationStatus.AWAITING_USER_ACTION, {
        error_message: "A CAPTCHA appeared on a later step that the AI agent cannot solve.",
        failure_code: FailureCode.CAPTCHA_REQUIRED,
      });
      return;
    }

    // Detect newly visible fields
    const newFields = await detectApplicationFields(provider, page);
    const newFieldIds = new Set(allMappedFields.map((f) => f.field_id));
    const trulyNewFields = newFields.filter((f) => !newFieldIds.has(f.field_id));

    if (trulyNewFields.length > 0) {
      const mappedNew = await mapAllFields(trulyNewFields, profile);
      const { detectMissingFields: detectMF } = await import("./profile-resolver");
      const newMissing = detectMF(mappedNew, profile);

      if (newMissing.length > 0) {
        const supabase = getAdminClient();
        const { data: appRecord } = await supabase
          .from("applications")
          .select("missing_fields")
          .eq("id", applicationId)
          .maybeSingle();

        const existingMissing = appRecord?.missing_fields || [];
        await updateApplicationStatus(applicationId, ApplicationStatus.MISSING_PROFILE_INFO, {
          missing_fields: [...existingMissing, ...newMissing],
        });
        return;
      }

      await fillApplicationForm(provider, page, applicationId, mappedNew, profile);
    }

    await heartbeatApplicationLock(applicationId, workerId);
  }
}

/**
 * Save the detected form schema to the database.
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
 * Resume a paused application (after user fills missing fields).
 */
export async function resumeApplicationAfterMissingFields(
  applicationId: string,
  workerId: string
): Promise<OrchestratorResult> {
  return runApplicationAutomation(applicationId, workerId);
}

/**
 * Final submission after user review approval.
 * Uses provider abstraction and adheres to provider selection.
 */
export async function submitAfterReview(
  applicationId: string,
  workerId: string
): Promise<OrchestratorResult> {
  const supabase = getAdminClient();
  const { data: app } = await supabase
    .from("applications")
    .select("*")
    .eq("id", applicationId)
    .maybeSingle();

  if (!app) return { success: false, status: ApplicationStatus.FAILED, paused: false };

  const validSubmitStatuses = [
    ApplicationStatus.AWAITING_USER_REVIEW,
    ApplicationStatus.SUBMITTING,
    ApplicationStatus.QUEUED,
  ];
  if (!validSubmitStatuses.includes(app.status)) {
    return { success: true, status: app.status, paused: false };
  }

  const provider = selectBrowserProvider(app);
  let session: BrowserSession | null = null;

  try {
    session = await provider.createSession();
    const page = await provider.openPage(session, app.apply_url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await provider.waitForTimeout(page, 2000);

    // CRITICAL: If submit was already attempted in a prior run, NEVER click submit again!
    if (app.debug_info?.submit_attempted) {
      const verification = await independentlyVerifySubmission(provider, page, app.apply_url);
      if (verification.confirmed) {
        await updateApplicationStatus(applicationId, ApplicationStatus.SUBMITTED, {
          external_application_id: verification.externalAppId,
        });
        return { success: true, status: ApplicationStatus.SUBMITTED, paused: false };
      }
      return { success: true, status: ApplicationStatus.SUBMISSION_UNCONFIRMED, paused: false };
    }

    // Re-fill form before final submit
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
      await fillApplicationForm(provider, page, applicationId, mapped, profile);

      const { data: savedAnswers } = await supabase
        .from("application_form_fields")
        .select("field_key, current_value, selector, type, label, options_json")
        .eq("application_form_id", formRecord.id)
        .not("current_value", "is", null);

      for (const ans of savedAnswers || []) {
        if (ans.current_value && ans.selector) {
          try {
            const fieldDef = fields.find(
              (f) => f.field_id === ans.field_key || f.selector === ans.selector
            ) || {
              field_id: ans.field_key,
              label: ans.label || ans.field_key,
              type: ans.type || "text",
              required: false,
              selector: ans.selector,
              options: ans.options_json,
              source: "inferred",
              page_step: 1,
            };
            await fillSingleField(provider, page, fieldDef as any, ans.current_value);
          } catch {}
        }
      }
    }

    const { submitted, confirmed } = await submitApplication(provider, page, applicationId);

    return {
      success: submitted,
      status: confirmed ? ApplicationStatus.SUBMITTED : ApplicationStatus.SUBMISSION_UNCONFIRMED,
      paused: false,
    };
  } catch (err: any) {
    const { data: currentApp } = await supabase
      .from("applications")
      .select("debug_info, status")
      .eq("id", applicationId)
      .maybeSingle();

    if (
      currentApp?.debug_info?.submit_attempted ||
      currentApp?.status === ApplicationStatus.SUBMISSION_UNCONFIRMED
    ) {
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
    if (session) {
      await provider.closeSession(session).catch(() => {});
    }
  }
}

export const ApplicationOrchestrator = {
  run: runApplicationAutomation,
  resumeAfterMissingFields: resumeApplicationAfterMissingFields,
  submitAfterReview,
};
