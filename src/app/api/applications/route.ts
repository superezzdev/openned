/**
 * POST /api/applications
 * Create a new application record.
 *
 * GET /api/applications?jobIds=id1,id2,...
 * Bulk fetch applications for multiple job IDs (for the jobs list).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { ApplicationStatus } from "@/lib/applications/types";

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

    const body = await req.json();
    const { job_id, apply_url, source } = body;

    if (!job_id || !apply_url) {
      return NextResponse.json({ error: "Missing job_id or apply_url" }, { status: 400 });
    }

    // Validate source
    const validSources = ["ai_agent", "manual"];
    const appSource = validSources.includes(source) ? source : "ai_agent";
    const initialStatus = appSource === "manual"
      ? ApplicationStatus.MANUAL_APPLY_STARTED
      : ApplicationStatus.QUEUED;

    // Idempotency: check if active application already exists for this user+job
    const adminClient = getAdminClient();
    const { data: existing } = await adminClient
      .from("applications")
      .select("id, status")
      .eq("user_id", user.id)
      .eq("job_id", job_id)
      .not("status", "in", `(${ApplicationStatus.FAILED},${ApplicationStatus.CANCELLED})`)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ application: existing, already_exists: true });
    }

    // Create application record
    const { data: application, error } = await adminClient
      .from("applications")
      .insert({
        user_id: user.id,
        job_id,
        apply_url,
        source: appSource,
        status: initialStatus,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      // If unique constraint violation (concurrent request created it), fetch existing
      if ((error as any).code === "23505") {
        const { data: activeExisting } = await adminClient
          .from("applications")
          .select("id, status")
          .eq("user_id", user.id)
          .eq("job_id", job_id)
          .not("status", "in", `(${ApplicationStatus.FAILED},${ApplicationStatus.CANCELLED})`)
          .maybeSingle();

        if (activeExisting) {
          return NextResponse.json({ application: activeExisting, already_exists: true });
        }
      }

      console.error("[POST /api/applications] DB error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ application }, { status: 201 });
  } catch (err: any) {
    console.error("[POST /api/applications]", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const jobIds = searchParams.get("jobIds");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const adminClient = getAdminClient();
    let query = adminClient
      .from("applications")
      .select("id, job_id, status, source, platform, apply_url, missing_fields, failure_code, error_message, created_at, updated_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (jobIds) {
      const ids = jobIds.split(",").map(s => s.trim()).filter(Boolean);
      query = query.in("job_id", ids);
    }

    if (status) {
      query = query.eq("status", status);
    }

    const { data: applications, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ applications: applications || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
