/**
 * Application Automation Types
 *
 * Centralized enums and interfaces for the AI job application automation system.
 * Do NOT use free-text status strings anywhere in the codebase.
 * Always import ApplicationStatus from this file.
 */

// ---------------------------------------------------------------------------
// Application Status Enum
// ---------------------------------------------------------------------------
export enum ApplicationStatus {
  QUEUED = "QUEUED",
  DETECTING_PLATFORM = "DETECTING_PLATFORM",
  DETECTING_FORM = "DETECTING_FORM",
  MAPPING_FIELDS = "MAPPING_FIELDS",
  MISSING_PROFILE_INFO = "MISSING_PROFILE_INFO",
  READY_TO_APPLY = "READY_TO_APPLY",
  FILLING_FORM = "FILLING_FORM",
  AWAITING_USER_REVIEW = "AWAITING_USER_REVIEW",
  AWAITING_USER_ACTION = "AWAITING_USER_ACTION",
  AWAITING_USER_INPUT = "AWAITING_USER_INPUT",
  SUBMITTING = "SUBMITTING",
  SUBMITTED = "SUBMITTED",
  SUBMISSION_UNCONFIRMED = "SUBMISSION_UNCONFIRMED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
  MANUAL_APPLY_STARTED = "MANUAL_APPLY_STARTED",
}

// ---------------------------------------------------------------------------
// Failure Codes Enum
// ---------------------------------------------------------------------------
export enum FailureCode {
  PLATFORM_NOT_SUPPORTED = "PLATFORM_NOT_SUPPORTED",
  APPLICATION_PAGE_UNAVAILABLE = "APPLICATION_PAGE_UNAVAILABLE",
  AUTH_REQUIRED = "AUTH_REQUIRED",
  CAPTCHA_REQUIRED = "CAPTCHA_REQUIRED",
  RATE_LIMITED = "RATE_LIMITED",
  FIELD_NOT_FOUND = "FIELD_NOT_FOUND",
  PROFILE_DATA_MISSING = "PROFILE_DATA_MISSING",
  UNSUPPORTED_FIELD = "UNSUPPORTED_FIELD",
  FILE_UPLOAD_FAILED = "FILE_UPLOAD_FAILED",
  SUBMISSION_FAILED = "SUBMISSION_FAILED",
  SUBMISSION_UNCONFIRMED = "SUBMISSION_UNCONFIRMED",
  BROWSER_ERROR = "BROWSER_ERROR",
  TIMEOUT = "TIMEOUT",
  UNKNOWN = "UNKNOWN",
}

// ---------------------------------------------------------------------------
// Field Status Enum
// ---------------------------------------------------------------------------
export enum FieldStatus {
  MAPPED = "MAPPED",
  MISSING = "MISSING",
  AMBIGUOUS = "AMBIGUOUS",
  UNSUPPORTED = "UNSUPPORTED",
  OPTIONAL = "OPTIONAL",
}

// ---------------------------------------------------------------------------
// Application Question Type
// ---------------------------------------------------------------------------
export enum QuestionType {
  PROFILE_FIELD = "PROFILE_FIELD",
  YES_NO = "YES_NO",
  SELECT = "SELECT",
  TEXT = "TEXT",
  NUMBER = "NUMBER",
  URL = "URL",
  DATE = "DATE",
  FILE = "FILE",
  CONSENT = "CONSENT",
  OPEN_ENDED = "OPEN_ENDED",
  UNKNOWN = "UNKNOWN",
}

// ---------------------------------------------------------------------------
// Platform Detection Result
// ---------------------------------------------------------------------------
export interface PlatformDetectionResult {
  platform: string; // 'greenhouse' | 'lever' | 'ashby' | 'workable' | 'teamtailor' | 'recruitee' | 'smartrecruiters' | 'generic'
  confidence: number; // 0-1
  detection_method: "hostname" | "url_pattern" | "dom" | "meta" | "heuristic";
}

// ---------------------------------------------------------------------------
// Detected Form Field
// ---------------------------------------------------------------------------
export interface DetectedField {
  field_id: string;
  label: string;
  type: "text" | "email" | "tel" | "number" | "date" | "textarea" | "select" | "radio" | "checkbox" | "file" | "url";
  required: boolean;
  selector: string;
  source: "label" | "aria-label" | "name" | "id" | "placeholder" | "legend" | "inferred";
  options?: string[];       // for select/radio
  page_step?: number;       // for multi-step forms
  question_type?: QuestionType;
}

// ---------------------------------------------------------------------------
// Field Mapping Result
// ---------------------------------------------------------------------------
export interface FieldMappingResult {
  mapped_profile_key: string | null;
  confidence: number;
  reason: "direct_match" | "semantic_match" | "ai_match" | "no_match";
  status: FieldStatus;
}

export { AutomationProvider, AutomationPreference, FallbackReason } from "../automation/types";
import type { AutomationProvider, AutomationPreference } from "../automation/types";

// ---------------------------------------------------------------------------
// Application Record (mirrors DB)
// ---------------------------------------------------------------------------
export interface ApplicationRecord {
  id: string;
  user_id: string;
  job_id: string;
  status: ApplicationStatus;
  source: string;
  platform?: string | null;
  platform_confidence?: number | null;
  platform_detection_method?: string | null;
  apply_url: string;
  browser_session_id?: string | null;
  automation_provider?: AutomationProvider | string | null;
  automation_preference?: AutomationPreference | string | null;
  automation_attempts?: number;
  fallback_used?: boolean;
  fallback_reason?: string | null;
  last_automation_error?: string | null;
  browser_provider?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  submitted_at?: string | null;
  confirmation_url?: string | null;
  external_application_id?: string | null;
  error_message?: string | null;
  failure_code?: string | null;
  missing_fields?: MissingFieldInfo[];
  form_schema_id?: string | null;
  resume_file_id?: string | null;
  debug_info?: Record<string, any>;
  created_at: string;
  updated_at: string;
}


// ---------------------------------------------------------------------------
// Missing field info
// ---------------------------------------------------------------------------
export interface MissingFieldInfo {
  field_key: string;
  label: string;
  type: string;
  options?: string[];
}

// ---------------------------------------------------------------------------
// User Application Profile (extended for AI automation)
// ---------------------------------------------------------------------------
export interface AutomationProfile {
  user_id: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  summary?: string | null;
  linkedin_url?: string | null;
  github_url?: string | null;
  portfolio_url?: string | null;
  website_url?: string | null;
  twitter_url?: string | null;
  work_authorization?: string | null;
  years_experience?: number | null;
  skills: string[];
  experiences: Array<{
    job_title?: string | null;
    company_name?: string | null;
    responsibilities?: string | null;
    duration?: string | null;
  }>;
  educations: Array<{
    degree?: string | null;
    field_of_study?: string | null;
    institution?: string | null;
  }>;
  resume_url?: string | null;
  resume_file_id?: string | null;
}

// ---------------------------------------------------------------------------
// Application Form Field (DB record)
// ---------------------------------------------------------------------------
export interface ApplicationFormField {
  id?: string;
  application_form_id: string;
  field_key: string;
  label?: string;
  type: string;
  required: boolean;
  selector?: string;
  options_json?: string[];
  page_step: number;
  mapped_profile_key?: string | null;
  current_value?: string | null;
  status: FieldStatus;
}

// ---------------------------------------------------------------------------
// User-friendly failure messages
// ---------------------------------------------------------------------------
export const FAILURE_CODE_MESSAGES: Record<FailureCode, string> = {
  [FailureCode.PLATFORM_NOT_SUPPORTED]: "This job platform isn't fully supported yet. You can apply manually.",
  [FailureCode.APPLICATION_PAGE_UNAVAILABLE]: "The application page couldn't be loaded. It may have moved or expired.",
  [FailureCode.AUTH_REQUIRED]: "This application requires you to log in first. Please apply manually.",
  [FailureCode.CAPTCHA_REQUIRED]: "A verification step is required that the AI agent cannot complete automatically.",
  [FailureCode.RATE_LIMITED]: "This site is temporarily blocking automated access. Please try again later.",
  [FailureCode.FIELD_NOT_FOUND]: "A required field on the application form couldn't be located.",
  [FailureCode.PROFILE_DATA_MISSING]: "Some required information is missing from your profile.",
  [FailureCode.UNSUPPORTED_FIELD]: "An unsupported field type was encountered on this form.",
  [FailureCode.FILE_UPLOAD_FAILED]: "Your resume couldn't be uploaded to the application form.",
  [FailureCode.SUBMISSION_FAILED]: "The application form couldn't be submitted.",
  [FailureCode.SUBMISSION_UNCONFIRMED]: "The application was submitted but confirmation couldn't be verified. Please check the employer's site.",
  [FailureCode.BROWSER_ERROR]: "A browser automation error occurred. Please try again.",
  [FailureCode.TIMEOUT]: "The operation timed out waiting for the page to respond.",
  [FailureCode.UNKNOWN]: "An unexpected error occurred. Please try again or apply manually.",
};

// ---------------------------------------------------------------------------
// Application status display config
// ---------------------------------------------------------------------------
export const APPLICATION_STATUS_CONFIG: Record<
  ApplicationStatus,
  { label: string; color: string; bgColor: string; borderColor: string; description: string }
> = {
  [ApplicationStatus.QUEUED]: {
    label: "Queued",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/25",
    description: "Your application is queued and will start shortly.",
  },
  [ApplicationStatus.DETECTING_PLATFORM]: {
    label: "Detecting Platform",
    color: "text-indigo-400",
    bgColor: "bg-indigo-500/10",
    borderColor: "border-indigo-500/25",
    description: "Identifying the job platform...",
  },
  [ApplicationStatus.DETECTING_FORM]: {
    label: "Detecting Form",
    color: "text-violet-400",
    bgColor: "bg-violet-500/10",
    borderColor: "border-violet-500/25",
    description: "Opening the application and scanning the form...",
  },
  [ApplicationStatus.MAPPING_FIELDS]: {
    label: "Mapping Fields",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/25",
    description: "Matching your profile to the application fields...",
  },
  [ApplicationStatus.MISSING_PROFILE_INFO]: {
    label: "Missing Profile Info",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/25",
    description: "Some required information is missing from your profile.",
  },
  [ApplicationStatus.READY_TO_APPLY]: {
    label: "Ready to Apply",
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10",
    borderColor: "border-cyan-500/25",
    description: "All fields mapped. Ready to fill the application.",
  },
  [ApplicationStatus.FILLING_FORM]: {
    label: "Filling Form",
    color: "text-teal-400",
    bgColor: "bg-teal-500/10",
    borderColor: "border-teal-500/25",
    description: "Automatically filling your application...",
  },
  [ApplicationStatus.AWAITING_USER_REVIEW]: {
    label: "Awaiting Review",
    color: "text-sky-400",
    bgColor: "bg-sky-500/10",
    borderColor: "border-sky-500/25",
    description: "Your application is ready for your review before submission.",
  },
  [ApplicationStatus.AWAITING_USER_ACTION]: {
    label: "Awaiting Your Action",
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/25",
    description: "The AI agent needs your help to continue.",
  },
  [ApplicationStatus.AWAITING_USER_INPUT]: {
    label: "Awaiting Input",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/25",
    description: "An unknown question requires your input.",
  },
  [ApplicationStatus.SUBMITTING]: {
    label: "Submitting",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/25",
    description: "Submitting your application...",
  },
  [ApplicationStatus.SUBMITTED]: {
    label: "Submitted",
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/25",
    description: "Your application has been submitted successfully!",
  },
  [ApplicationStatus.SUBMISSION_UNCONFIRMED]: {
    label: "Submission Unconfirmed",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/25",
    description: "Application submitted but confirmation couldn't be verified. Please check the employer's site.",
  },
  [ApplicationStatus.FAILED]: {
    label: "Failed",
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/25",
    description: "The application encountered an error.",
  },
  [ApplicationStatus.CANCELLED]: {
    label: "Cancelled",
    color: "text-slate-400",
    bgColor: "bg-slate-500/10",
    borderColor: "border-slate-500/25",
    description: "This application was cancelled.",
  },
  [ApplicationStatus.MANUAL_APPLY_STARTED]: {
    label: "Applying Manually",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/25",
    description: "You opened the application URL to apply manually.",
  },
};

// Active statuses that should trigger UI polling
export const ACTIVE_APPLICATION_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.QUEUED,
  ApplicationStatus.DETECTING_PLATFORM,
  ApplicationStatus.DETECTING_FORM,
  ApplicationStatus.MAPPING_FIELDS,
  ApplicationStatus.READY_TO_APPLY,
  ApplicationStatus.FILLING_FORM,
  ApplicationStatus.SUBMITTING,
];

// Terminal statuses — no more changes expected
export const TERMINAL_APPLICATION_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.SUBMITTED,
  ApplicationStatus.FAILED,
  ApplicationStatus.CANCELLED,
  ApplicationStatus.MANUAL_APPLY_STARTED,
  ApplicationStatus.SUBMISSION_UNCONFIRMED,
];

// Paused statuses — waiting for user
export const PAUSED_APPLICATION_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.MISSING_PROFILE_INFO,
  ApplicationStatus.AWAITING_USER_REVIEW,
  ApplicationStatus.AWAITING_USER_ACTION,
  ApplicationStatus.AWAITING_USER_INPUT,
];
