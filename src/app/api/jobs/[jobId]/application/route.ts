/**
 * GET /api/jobs/[jobId]/application
 * Get the current user's application for a specific job.
 * Returns null if no application exists.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseAdmin(url, key);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { jobId } = await params;
    const adminClient = getAdminClient();

    const { data: application } = await adminClient
      .from("applications")
      .select("id, status, source, platform, failure_code, error_message, missing_fields, submitted_at, created_at, updated_at")
      .eq("user_id", user.id)
      .eq("job_id", jobId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({ application: application || null });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
