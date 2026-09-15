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

    // Try sending event to Inngest — returns immediately
    let inngestDispatched = false;
    try {
      await inngest.send({
        name: "application/start",
        data: {
          application_id: id,
          user_id: user.id,
        },
      });
      inngestDispatched = true;
    } catch (inngestErr: any) {
      console.warn(
        `[POST /api/applications/:id/start] Inngest send failed (${inngestErr?.message}). Falling back to direct background worker.`,
      );
    }

    // Direct background execution fallback if Inngest daemon was offline/failed
    if (!inngestDispatched) {
      (async () => {
        try {
          const { acquireApplicationLock, releaseApplicationLock } = await import(
            "@/lib/applications/application-locking"
          );
          const { runApplicationAutomation } = await import(
            "@/lib/applications/application-orchestrator"
          );
          const workerId = await acquireApplicationLock(id);
          if (workerId) {
            try {
              await runApplicationAutomation(id, workerId);
            } finally {
              await releaseApplicationLock(id, workerId);
            }
          }
        } catch (workerErr) {
          console.error(`[POST /api/applications/:id/start] Direct execution error:`, workerErr);
        }
      })().catch(() => {});
    }

    return NextResponse.json({
      queued: true,
      application_id: id,
      inngest: inngestDispatched,
      message: "Application automation has started. You can track progress or navigate away.",
    });
  } catch (err: any) {
    console.error("[POST /api/applications/:id/start]", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
