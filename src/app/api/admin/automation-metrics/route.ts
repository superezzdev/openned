/**
 * GET /api/admin/automation-metrics
 *
 * Compute automation engine performance and reliability metrics:
 * - total applications
 * - local successes & failures
 * - browserbase fallbacks, successes & failures
 * - fallback rate
 * - submission success rate
 * - captcha rate
 * - profile-missing rate
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { AutomationMetrics } from "@/lib/automation/types";
import { ApplicationStatus, FailureCode } from "@/lib/applications/types";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseAdmin(url, key);
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const adminClient = getAdminClient();

    // Query recent applications
    const { data: applications, error } = await adminClient
      .from("applications")
      .select(`
        id, status, automation_provider, fallback_used,
        failure_code, started_at, completed_at, submitted_at, created_at
      `)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const apps = applications || [];
    const totalApplications = apps.length;

    let localSuccesses = 0;
    let localFailures = 0;
    let browserbaseFallbacks = 0;
    let browserbaseSuccesses = 0;
    let browserbaseFailures = 0;
    let totalSubmitted = 0;
    let totalCaptcha = 0;
    let totalProfileMissing = 0;

    let totalLocalDurationMs = 0;
    let localDurationCount = 0;
    let totalBrowserbaseDurationMs = 0;
    let browserbaseDurationCount = 0;

    for (const app of apps) {
      const isSubmitted = app.status === ApplicationStatus.SUBMITTED;
      const isFailed = app.status === ApplicationStatus.FAILED;
      const isBrowserbase = app.automation_provider === "BROWSERBASE";
      const fallbackUsed = Boolean(app.fallback_used);

      if (isSubmitted) totalSubmitted++;
      if (app.failure_code === FailureCode.CAPTCHA_REQUIRED) totalCaptcha++;
      if (app.failure_code === FailureCode.PROFILE_DATA_MISSING) totalProfileMissing++;
      if (fallbackUsed) browserbaseFallbacks++;

      // Duration calculation if timestamps exist
      const startTime = app.started_at ? new Date(app.started_at).getTime() : null;
      const endTime = (app.submitted_at || app.completed_at) ? new Date(app.submitted_at || app.completed_at).getTime() : null;
      const duration = startTime && endTime && endTime > startTime ? endTime - startTime : null;

      if (isBrowserbase) {
        if (isSubmitted) browserbaseSuccesses++;
        if (isFailed) browserbaseFailures++;
        if (duration) {
          totalBrowserbaseDurationMs += duration;
          browserbaseDurationCount++;
        }
      } else {
        if (isSubmitted) localSuccesses++;
        if (isFailed) localFailures++;
        if (duration) {
          totalLocalDurationMs += duration;
          localDurationCount++;
        }
      }
    }

    const fallbackRate = totalApplications > 0 ? (browserbaseFallbacks / totalApplications) * 100 : 0;
    const totalLocalAttempts = localSuccesses + localFailures;
    const localSuccessRate = totalLocalAttempts > 0 ? (localSuccesses / totalLocalAttempts) * 100 : 100;

    const totalBrowserbaseAttempts = browserbaseSuccesses + browserbaseFailures;
    const browserbaseSuccessRate = totalBrowserbaseAttempts > 0 ? (browserbaseSuccesses / totalBrowserbaseAttempts) * 100 : 100;

    const submissionSuccessRate = totalApplications > 0 ? (totalSubmitted / totalApplications) * 100 : 0;
    const captchaRate = totalApplications > 0 ? (totalCaptcha / totalApplications) * 100 : 0;
    const profileMissingRate = totalApplications > 0 ? (totalProfileMissing / totalApplications) * 100 : 0;

    const metrics: AutomationMetrics = {
      totalApplications,
      localSuccesses,
      localFailures,
      browserbaseFallbacks,
      browserbaseSuccesses,
      browserbaseFailures,
      fallbackRate: Math.round(fallbackRate * 10) / 10,
      localSuccessRate: Math.round(localSuccessRate * 10) / 10,
      browserbaseSuccessRate: Math.round(browserbaseSuccessRate * 10) / 10,
      submissionSuccessRate: Math.round(submissionSuccessRate * 10) / 10,
      captchaRate: Math.round(captchaRate * 10) / 10,
      profileMissingRate: Math.round(profileMissingRate * 10) / 10,
      averageLocalDurationMs: localDurationCount > 0 ? Math.round(totalLocalDurationMs / localDurationCount) : 0,
      averageBrowserbaseDurationMs: browserbaseDurationCount > 0 ? Math.round(totalBrowserbaseDurationMs / browserbaseDurationCount) : 0,
    };

    return NextResponse.json({ metrics });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
