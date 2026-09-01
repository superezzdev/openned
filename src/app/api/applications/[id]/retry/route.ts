/**
 * POST /api/applications/[id]/retry
 *
 * Retry a failed application with clean reset.
 * Triggers Inngest background worker.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { inngest } from "@/lib/inngest/client";
import { ApplicationStatus } from "@/lib/applications/types";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseAdmin(url, key);
}

export async function POST(
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
    const body = await req.json().catch(() => ({}));
    const adminClient = getAdminClient();

    const { data: application } = await adminClient
      .from("applications")
      .select("id, status, user_id, debug_info, automation_attempts")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    // Never retry if already submitted or submit was attempted
    if (application.status === ApplicationStatus.SUBMITTED) {
      return NextResponse.json({ error: "Application is already submitted" }, { status: 400 });
    }
    if (application.debug_info?.submit_attempted) {
      return NextResponse.json(
        { error: "Submission was already attempted. Please verify on the employer site before retrying." },
        { status: 400 }
      );
    }

    const nextAttempts = (application.automation_attempts || 1) + 1;
    const resetFallback = body.reset_fallback ?? true;

    // Reset status to QUEUED and clear prior error
    await adminClient
      .from("applications")
      .update({
        status: ApplicationStatus.QUEUED,
        error_message: null,
        failure_code: null,
        last_automation_error: null,
        automation_attempts: nextAttempts,
        ...(resetFallback ? { fallback_used: false, fallback_reason: null } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    // Release any lingering locks
    await adminClient.from("application_worker_locks").delete().eq("application_id", id);

    // Trigger Inngest start event
    await inngest.send({
      name: "application/start",
      data: {
        application_id: id,
        user_id: user.id,
      },
    });

    return NextResponse.json({
      success: true,
      application_id: id,
      status: ApplicationStatus.QUEUED,
      message: "Application retry has been queued.",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
