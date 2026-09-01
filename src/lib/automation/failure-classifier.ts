/**
 * Automation Failure Classifier & Fallback Decision Engine
 *
 * Distinguishes infrastructure/browser automation failures (which can be resolved
 * by Browserbase) from workflow states (which require user action or are terminal).
 */

import { FallbackReason, AutomationPreference, AutomationProvider } from "./types";
import { FailureCode, ApplicationStatus } from "../applications/types";

export interface ClassifiedError {
  category: "INFRASTRUCTURE" | "WORKFLOW_PAUSE" | "USER_INPUT_REQUIRED" | "TERMINAL";
  fallbackEligible: boolean;
  isFallbackEligible: boolean;
  fallbackReason?: FallbackReason;
  failureCode: FailureCode;
  userMessage: string;
}

/**
 * Classifies an automation error into a structured code and determines fallback eligibility.
 */
export function classifyAutomationError(error: any, stage: string = ""): ClassifiedError {
  const message = (error?.message || String(error || "")).toLowerCase();

  // 1. NON-FALLBACK WORKFLOW ERRORS
  if (message.includes("captcha") || message.includes("cloudflare") || message.includes("turnstile")) {
    return {
      category: "WORKFLOW_PAUSE",
      fallbackEligible: false,
      isFallbackEligible: false,
      failureCode: FailureCode.CAPTCHA_REQUIRED,
      userMessage: "A verification step is required that the AI agent cannot complete automatically.",
    };
  }

  if (message.includes("auth_required") || message.includes("login") || message.includes("sign in")) {
    return {
      category: "WORKFLOW_PAUSE",
      fallbackEligible: false,
      isFallbackEligible: false,
      failureCode: FailureCode.AUTH_REQUIRED,
      userMessage: "This application requires you to log in first. Please apply manually.",
    };
  }

  if (message.includes("rate limit") || message.includes("too many requests") || message.includes("blocked")) {
    return {
      category: "WORKFLOW_PAUSE",
      fallbackEligible: false,
      isFallbackEligible: false,
      failureCode: FailureCode.RATE_LIMITED,
      userMessage: "This site is temporarily blocking automated access. Please try again later.",
    };
  }

  if (message.includes("profile") || message.includes("missing")) {
    return {
      category: "USER_INPUT_REQUIRED",
      fallbackEligible: false,
      isFallbackEligible: false,
      failureCode: FailureCode.PROFILE_DATA_MISSING,
      userMessage: "Some required information is missing from your profile.",
    };
  }

  // 2. FALLBACK-ELIGIBLE BROWSER / INFRASTRUCTURE ERRORS

  // Browser crash / target closed
  if (
    message.includes("browser closed") ||
    message.includes("browser has been closed") ||
    message.includes("crashed") ||
    message.includes("target page") ||
    message.includes("target closed") ||
    message.includes("connection closed") ||
    message.includes("disconnected")
  ) {
    return {
      category: "INFRASTRUCTURE",
      fallbackEligible: true,
      isFallbackEligible: true,
      fallbackReason: FallbackReason.BROWSER_CRASH,
      failureCode: FailureCode.BROWSER_ERROR,
      userMessage: "The local browser crashed or disconnected unexpectedly.",
    };
  }

  // Session launch / context failure
  if (
    message.includes("failed to launch") ||
    message.includes("spawn") ||
    message.includes("executable doesn't exist") ||
    message.includes("session_failed")
  ) {
    return {
      category: "INFRASTRUCTURE",
      fallbackEligible: true,
      isFallbackEligible: true,
      fallbackReason: FallbackReason.LOCAL_SESSION_FAILED,
      failureCode: FailureCode.BROWSER_ERROR,
      userMessage: "Could not launch the local browser automation engine.",
    };
  }

  // Navigation / Network error
  if (
    message.includes("net::") ||
    message.includes("connection_reset") ||
    message.includes("err_name_not_resolved") ||
    message.includes("network")
  ) {
    return {
      category: "INFRASTRUCTURE",
      fallbackEligible: true,
      isFallbackEligible: true,
      fallbackReason: FallbackReason.NETWORK_ERROR,
      failureCode: FailureCode.APPLICATION_PAGE_UNAVAILABLE,
      userMessage: "A network error occurred while connecting to the application page.",
    };
  }

  // Timeout
  if (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("navigation timeout")
  ) {
    return {
      category: "INFRASTRUCTURE",
      fallbackEligible: true,
      isFallbackEligible: true,
      fallbackReason: FallbackReason.TIMEOUT,
      failureCode: FailureCode.TIMEOUT,
      userMessage: "The application page timed out while loading or responding.",
    };
  }

  // DOM parsing / execution context destroyed
  if (
    message.includes("execution context was destroyed") ||
    message.includes("navigation") ||
    message.includes("dom") ||
    message.includes("selector") ||
    message.includes("element is not attached")
  ) {
    return {
      category: "INFRASTRUCTURE",
      fallbackEligible: true,
      isFallbackEligible: true,
      fallbackReason: FallbackReason.DOM_FAILURE,
      failureCode: FailureCode.FIELD_NOT_FOUND,
      userMessage: "Could not interact with or locate form elements in the page DOM.",
    };
  }


  // File upload failure
  if (message.includes("upload") || message.includes("file input")) {
    return {
      category: "INFRASTRUCTURE",
      fallbackEligible: true,
      isFallbackEligible: true,
      fallbackReason: FallbackReason.LOCAL_FILE_UPLOAD_FAILED,
      failureCode: FailureCode.FILE_UPLOAD_FAILED,
      userMessage: "Failed to upload resume file in the local browser.",
    };
  }

  // Unsupported browser rendering feature / headless incompatibility
  if (message.includes("unsupported") || message.includes("headless")) {
    return {
      category: "INFRASTRUCTURE",
      fallbackEligible: true,
      isFallbackEligible: true,
      fallbackReason: FallbackReason.LOCAL_UNSUPPORTED_BROWSER_FEATURE,
      failureCode: FailureCode.BROWSER_ERROR,
      userMessage: "The employer site requires browser features not supported by the local headless engine.",
    };
  }

  // Default fallback for any other unexpected browser error occurring during early/mid automation stages
  if (stage === "DETECTING_FORM" || stage === "DETECTING_PAGE" || stage === "FILLING_FORM") {
    return {
      category: "INFRASTRUCTURE",
      fallbackEligible: true,
      isFallbackEligible: true,
      fallbackReason: FallbackReason.LOCAL_ELEMENT_INTERACTION_FAILED,
      failureCode: FailureCode.BROWSER_ERROR,
      userMessage: "An automation error occurred in the local browser.",
    };
  }

  return {
    category: "TERMINAL",
    fallbackEligible: false,
    isFallbackEligible: false,
    failureCode: FailureCode.UNKNOWN,
    userMessage: "An unexpected error occurred during automation.",
  };
}

export interface FallbackDecision {
  shouldFallback: boolean;
  reason?: FallbackReason;
  blockReason?: string;
  classifiedError: ClassifiedError;
}

/**
 * Fallback Decision Engine
 *
 * Rules:
 * 1. Only fallback if user selected AUTO (never if LOCAL_ONLY)
 * 2. Only fallback if current provider is LOCAL (never loop Browserbase -> Browserbase)
 * 3. Never fallback if max fallback attempts (1) was already reached
 * 4. Never fallback if status is SUBMITTED, SUBMITTING, or SUBMISSION_UNCONFIRMED
 * 5. Only fallback if classified error is fallback-eligible
 */
export function shouldFallbackToBrowserbase(
  error: any,
  application: {
    automation_preference?: string | null;
    automation_provider?: string | null;
    fallback_used?: boolean | null;
    status?: ApplicationStatus | string;
    debug_info?: Record<string, any>;
  },
  stage: string = ""
): FallbackDecision {
  const classified = classifyAutomationError(error, stage);

  // Guard 1: User explicitly opted out of Browserbase
  if (application.automation_preference === AutomationPreference.LOCAL_ONLY) {
    return {
      shouldFallback: false,
      blockReason: "LOCAL_ONLY",
      classifiedError: classified,
    };
  }


  // Guard 2: Already on Browserbase — no infinite fallback loops
  if (application.automation_provider === AutomationProvider.BROWSERBASE) {
    return {
      shouldFallback: false,
      blockReason: "already_on_browserbase",
      classifiedError: classified,
    };
  }

  // Guard 3: Max fallback attempts reached for this application run (ceiling = 1)
  if (application.fallback_used === true) {
    return {
      shouldFallback: false,
      blockReason: "already_used",
      classifiedError: classified,
    };
  }

  // Guard 4: Idempotency safety — never fallback during or after submission
  const noFallbackStatuses: string[] = [
    ApplicationStatus.SUBMITTED,
    ApplicationStatus.SUBMITTING,
    ApplicationStatus.SUBMISSION_UNCONFIRMED,
    ApplicationStatus.CANCELLED,
  ];
  if (application.status && noFallbackStatuses.includes(application.status)) {
    return {
      shouldFallback: false,
      blockReason: "terminal_or_submitting",
      classifiedError: classified,
    };
  }
  if (application.debug_info?.submit_attempted) {
    return {
      shouldFallback: false,
      blockReason: "submit_attempted",
      classifiedError: classified,
    };
  }

  // Guard 5: Error must be eligible for fallback
  if (!classified.fallbackEligible || !classified.fallbackReason) {
    return {
      shouldFallback: false,
      blockReason: "not_eligible",
      classifiedError: classified,
    };
  }

  return {
    shouldFallback: true,
    reason: classified.fallbackReason,
    classifiedError: classified,
  };
}

