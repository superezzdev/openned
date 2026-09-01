/**
 * POST /api/applications/[id]/start
 * Start the AI automation workflow for a QUEUED application.
 * Sends event to Inngest and returns immediately.
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const adminClient = getAdminClient();

    // Verify application belongs to user and is in QUEUED status
    const { data: application } = await adminClient
      .from("applications")
      .select("id, status, user_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    // Only start QUEUED applications
    const startableStatuses = [ApplicationStatus.QUEUED];
    if (!startableStatuses.includes(application.status as ApplicationStatus)) {
      return NextResponse.json({
        error: `Cannot start application in status: ${application.status}`,
        current_status: application.status,
      }, { status: 400 });
    }

    // Send event to Inngest — returns immediately
    await inngest.send({
      name: "application/start",
      data: {
        application_id: id,
        user_id: user.id,
      },
    });

    return NextResponse.json({
      queued: true,
      application_id: id,
      message: "Application automation has been queued. You can navigate away.",
    });
  } catch (err: any) {
    console.error("[POST /api/applications/:id/start]", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
