/**
 * POST /api/applications/queue-recovery
 * Reconciles applications stuck in QUEUED status without active locks
 * and triggers them to prevent applications from stalling indefinitely.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { inngest } from "@/lib/inngest/client";
import { ApplicationStatus } from "@/lib/applications/types";
import { recoverStaleLocks, isApplicationLocked } from "@/lib/applications/application-locking";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseAdmin(url, key);
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const adminClient = getAdminClient();

    // 1. Recover any expired stale worker locks across the board
    const recoveredLocksCount = await recoverStaleLocks();

    // 2. Find applications stuck in QUEUED status for this user
    // Consider any QUEUED application created at least 30 seconds ago
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();

    const { data: stuckApps, error } = await adminClient
      .from("applications")
      .select("id, user_id, status, created_at, updated_at")
      .eq("user_id", user.id)
      .eq("status", ApplicationStatus.QUEUED)
      .eq("source", "ai_agent")
      .lt("updated_at", thirtySecondsAgo)
      .limit(10);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const triggeredAppIds: string[] = [];

    for (const app of stuckApps || []) {
      const locked = await isApplicationLocked(app.id);
      if (locked) continue;

      // Dispatch start event
      try {
        await inngest.send({
          name: "application/start",
          data: {
            application_id: app.id,
            user_id: app.user_id,
          },
        });
        triggeredAppIds.push(app.id);
      } catch (sendErr) {
        console.warn(`[queue-recovery] Failed to send Inngest event for ${app.id}:`, sendErr);
        // Fallback: direct asynchronous execution
        (async () => {
          try {
            const { acquireApplicationLock, releaseApplicationLock } = await import(
              "@/lib/applications/application-locking"
            );
            const { runApplicationAutomation } = await import(
              "@/lib/applications/application-orchestrator"
            );
            const workerId = await acquireApplicationLock(app.id);
            if (workerId) {
              try {
                await runApplicationAutomation(app.id, workerId);
              } finally {
                await releaseApplicationLock(app.id, workerId);
              }
            }
          } catch (workerErr) {
            console.error(`[queue-recovery] Direct execution error for ${app.id}:`, workerErr);
          }
        })().catch(() => {});
        triggeredAppIds.push(app.id);
      }
    }

    return NextResponse.json({
      success: true,
      stuckFound: stuckApps?.length || 0,
      recoveredLocks: recoveredLocksCount,
      triggered: triggeredAppIds,
    });
  } catch (err: any) {
    console.error("[POST /api/applications/queue-recovery]", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
