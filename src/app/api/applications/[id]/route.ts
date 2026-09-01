/**
 * GET /api/applications/[id]
 * Get full application details for the current user.
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const adminClient = getAdminClient();

    // User-scoped query — never return another user's application
    const { data: application, error } = await adminClient
      .from("applications")
      .select(`
        *,
        application_forms (
          id,
          platform,
          page_url,
          fields_json,
          detected_at,
          application_form_fields (
            id, field_key, label, type, required, mapped_profile_key, current_value, status, options_json, page_step
          )
        )
      `)
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!application) return NextResponse.json({ error: "Application not found" }, { status: 404 });

    // Fetch the job details for display
    const { data: job } = await adminClient
      .from("canonical_jobs")
      .select("title, company_name, company_logo, job_url")
      .eq("id", application.job_id)
      .maybeSingle();

    return NextResponse.json({ application: { ...application, job } });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
