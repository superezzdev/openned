/**
 * GET /api/applications/[id]/session
 *
 * Retrieve safe session and automation provider details for an application.
 * Never leaks API keys, passwords, cookies, or sensitive tokens.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { getSessionsForApplication } from "@/lib/automation/automation-session-service";
import { browserbaseService } from "@/lib/automation/browserbase-service";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseAdmin(url, key);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const adminClient = getAdminClient();

    // Verify user owns the application
    const { data: application, error } = await adminClient
      .from("applications")
      .select(`
        id, user_id, status, browser_session_id, automation_provider,
        automation_preference, fallback_used, fallback_reason,
        last_automation_error, created_at, updated_at
      `)
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!application) return NextResponse.json({ error: "Application not found" }, { status: 404 });

    // Fetch related session records
    const sessionHistory = await getSessionsForApplication(id);

    // Build safe session representation
    const provider = application.automation_provider || "LOCAL";
    const isBrowserbase = provider === "BROWSERBASE";

    let debugUrl: string | null = null;
    let replayUrl: string | null = null;

    if (isBrowserbase && application.browser_session_id) {
      replayUrl = browserbaseService.getReplayUrl(application.browser_session_id);
      // Only include debug URL if user is the application owner
      try {
        const liveUrls = await browserbaseService.getLiveDebugUrls(application.browser_session_id);
        debugUrl = liveUrls.debuggerUrl || null;
      } catch {
        debugUrl = null;
      }
    }


    return NextResponse.json({
      session: {
        application_id: application.id,
        current_provider: provider,
        automation_preference: application.automation_preference || "AUTO",
        browser_session_id: application.browser_session_id,
        fallback_used: Boolean(application.fallback_used),
        fallback_reason: application.fallback_reason || null,
        last_error: application.last_automation_error || null,
        debug_url: debugUrl,
        replay_url: replayUrl,
        history: sessionHistory.map((s) => ({
          id: s.id,
          provider: s.provider,
          session_id: s.session_id,
          status: s.status,
          started_at: s.started_at,
          ended_at: s.ended_at,
          current_url: s.current_url,
          error_message: s.error_message,
        })),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
