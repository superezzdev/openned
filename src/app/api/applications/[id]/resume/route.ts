/**
 * POST /api/applications/[id]/resume
 *
 * Resume a paused application. Triggers the Inngest resume worker.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { inngest } from "@/lib/inngest/client";
import { ApplicationStatus, PAUSED_APPLICATION_STATUSES } from "@/lib/applications/types";

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
    const reason = body.reason || "user_resumed";

    const adminClient = getAdminClient();

    const { data: application } = await adminClient
      .from("applications")
      .select("id, status, user_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const currentStatus = application.status as ApplicationStatus;
    const isPaused = PAUSED_APPLICATION_STATUSES.includes(currentStatus);

    if (!isPaused && currentStatus !== ApplicationStatus.QUEUED) {
      return NextResponse.json(
        { error: `Cannot resume application in status: ${currentStatus}` },
        { status: 400 }
      );
    }

    // Trigger Inngest resume event
    await inngest.send({
      name: "application/resume",
      data: {
        application_id: id,
        user_id: user.id,
        reason,
      },
    });

    return NextResponse.json({
      success: true,
      application_id: id,
      message: "Application resumption has been triggered.",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
