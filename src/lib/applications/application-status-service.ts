/**
 * Application Status Service
 *
 * Single source of truth for all application status transitions.
 * Handles DB updates, structured logging, and timestamp management.
 */

import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { ApplicationStatus, FailureCode, ACTIVE_APPLICATION_STATUSES } from "./types";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseAdmin(url, key);
}

/**
 * Count active (in-progress) applications for a given user.
 */
export async function getActiveApplicationsCount(userId: string): Promise<number> {
  try {
    const supabase = getAdminClient();
    const { count, error } = await supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("status", ACTIVE_APPLICATION_STATUSES);

    if (error) {
      console.error("[ApplicationStatusService] Failed to get active count:", error.message);
      return 0;
    }
    return count ?? 0;
  } catch (err: any) {
    console.error("[ApplicationStatusService] Error getting active count:", err);
    return 0;
  }
}

export interface StatusUpdateOptions {
  error_message?: string;
  failure_code?: FailureCode;
  platform?: string;
  platform_confidence?: number;
  platform_detection_method?: string;
  browser_session_id?: string;
  form_schema_id?: string;
  missing_fields?: any[];
  debug_info?: Record<string, any>;
  confirmation_url?: string;
  external_application_id?: string;
}

/**
 * Update application status with optional extra fields.
 * All status changes must go through this function to ensure
 * consistent logging and timestamp tracking.
 */
export async function updateApplicationStatus(
  applicationId: string,
  status: ApplicationStatus,
  extra: StatusUpdateOptions = {}
): Promise<void> {
  const supabase = getAdminClient();

  const now = new Date().toISOString();
  const updatePayload: Record<string, any> = {
    status,
    updated_at: now,
    ...extra,
  };

  // Set timestamps for lifecycle events
  if (status === ApplicationStatus.QUEUED || status === ApplicationStatus.DETECTING_PLATFORM) {
    updatePayload.started_at = updatePayload.started_at || now;
  }
  if (status === ApplicationStatus.SUBMITTED || status === ApplicationStatus.FAILED || status === ApplicationStatus.CANCELLED) {
    updatePayload.completed_at = now;
  }
  if (status === ApplicationStatus.SUBMITTED) {
    updatePayload.submitted_at = now;
  }

  const { error } = await supabase
    .from("applications")
    .update(updatePayload)
    .eq("id", applicationId);

  if (error) {
    console.error("[ApplicationStatusService] Failed to update status:", {
      application_id: applicationId,
      status,
      error: error.message,
    });
    throw error;
  }

  // Structured log — never log personal data
  logApplicationEvent("application_stage_changed", {
    application_id: applicationId,
    stage: status,
    timestamp: now,
    ...(extra.failure_code ? { failure_code: extra.failure_code } : {}),
    ...(extra.platform ? { platform: extra.platform } : {}),
    ...(extra.browser_session_id ? { browser_session_id: extra.browser_session_id } : {}),
  });
}

/**
 * Mark an application as FAILED with structured debugging info.
 */
export async function failApplication(
  applicationId: string,
  failureCode: FailureCode,
  userMessage: string,
  debugInfo?: {
    stage?: string;
    error?: string;
    url?: string;
    browser_session_id?: string;
    field?: string;
  }
): Promise<void> {
  await updateApplicationStatus(applicationId, ApplicationStatus.FAILED, {
    failure_code: failureCode,
    error_message: userMessage,
    debug_info: {
      ...(debugInfo || {}),
      timestamp: new Date().toISOString(),
      failure_code: failureCode,
    },
  });
}

/**
 * Structured event logger. Never logs passwords, tokens, cookies, or resume contents.
 */
export function logApplicationEvent(
  event: string,
  data: {
    application_id?: string;
    user_id?: string;
    job_id?: string;
    platform?: string;
    stage?: string;
    browser_session_id?: string;
    failure_code?: string;
    timestamp?: string;
    [key: string]: any;
  }
): void {
  // Comprehensive blocked key list
  const BLOCKED_KEY_SUBSTRINGS = [
    "password", "cookie", "token", "secret", "auth",
    "resume_content", "file_content", "credential", "jwt",
    "api_key", "signature", "access_token", "refresh_token",
    "profile_full", "ssn", "authorization", "bearer"
  ];

  function sanitizeValue(val: any): any {
    if (typeof val === "string") {
      // If URL has query parameters, strip sensitive query params
      if (val.startsWith("http://") || val.startsWith("https://")) {
        try {
          const parsed = new URL(val);
          const sensitiveParams = ["token", "sig", "signature", "auth", "key", "secret", "code", "jwt"];
          for (const sp of sensitiveParams) {
            parsed.searchParams.delete(sp);
          }
          return parsed.toString();
        } catch {
          return val.split("?")[0]; // fallback: remove query string completely
        }
      }
      return val;
    }
    if (Array.isArray(val)) {
      return val.map(sanitizeValue);
    }
    if (val && typeof val === "object") {
      const sanitizedObj: Record<string, any> = {};
      for (const [subK, subV] of Object.entries(val)) {
        if (!BLOCKED_KEY_SUBSTRINGS.some(b => subK.toLowerCase().includes(b))) {
          sanitizedObj[subK] = sanitizeValue(subV);
        }
      }
      return sanitizedObj;
    }
    return val;
  }

  const safe: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) {
    if (!BLOCKED_KEY_SUBSTRINGS.some((b) => k.toLowerCase().includes(b))) {
      safe[k] = sanitizeValue(v);
    }
  }

  console.log(JSON.stringify({ event, ...safe }));
}
