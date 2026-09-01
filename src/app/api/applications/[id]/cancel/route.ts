/**
 * POST /api/applications/[id]/cancel
 * Cancel an in-progress or paused application.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { ApplicationStatus, TERMINAL_APPLICATION_STATUSES } from "@/lib/applications/types";

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

    const { data: application } = await adminClient
      .from("applications")
      .select("id, status, user_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!application) return NextResponse.json({ error: "Application not found" }, { status: 404 });

    if (TERMINAL_APPLICATION_STATUSES.includes(application.status as ApplicationStatus)) {
      return NextResponse.json({ error: "Cannot cancel a terminal application" }, { status: 400 });
    }

    await adminClient.from("applications").update({
      status: ApplicationStatus.CANCELLED,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", id);

    // Release any stale lock
    const { releaseApplicationLock } = await import("@/lib/applications/application-locking");
    // No-op if no lock exists
    await adminClient.from("application_worker_locks").delete().eq("application_id", id);

    return NextResponse.json({ success: true, message: "Application cancelled." });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
