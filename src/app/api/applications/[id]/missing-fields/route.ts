/**
 * POST /api/applications/[id]/missing-fields
 * Save user-provided missing profile information and resume automation.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { inngest } from "@/lib/inngest/client";
import { updateProfileWithMissingFields } from "@/lib/applications/profile-resolver";
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
    const body = await req.json();
    const values = (body.values || {}) as Record<string, string>;

    if (!values || typeof values !== "object") {
      return NextResponse.json({ error: "Missing values object" }, { status: 400 });
    }

    const adminClient = getAdminClient();

    // Verify application belongs to user and is in MISSING_PROFILE_INFO
    const { data: application } = await adminClient
      .from("applications")
      .select("id, status, user_id, missing_fields, form_schema_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    if (application.status !== ApplicationStatus.MISSING_PROFILE_INFO &&
        application.status !== ApplicationStatus.AWAITING_USER_INPUT) {
      return NextResponse.json({
        error: `Application is not waiting for missing fields (status: ${application.status})`,
      }, { status: 400 });
    }

    // 1. Save values to user profile (makes them reusable)
    await updateProfileWithMissingFields(user.id, values);

    // 2. Determine which missing fields are now resolved
    const currentMissing: any[] = application.missing_fields || [];
    const providedKeys = new Set(Object.keys(values).filter(k => values[k]?.trim()));
    const remainingMissing = currentMissing.filter(
      (f: any) => !providedKeys.has(f.field_key)
    );

    // 3. Update application record — clear resolved missing fields
    await adminClient.from("applications").update({
      missing_fields: remainingMissing,
      status: ApplicationStatus.QUEUED, // Reset to QUEUED so worker can pick up
      updated_at: new Date().toISOString(),
    }).eq("id", id);

    // 4. Update application_form_fields mappings if form schema exists
    if (application.form_schema_id) {
      for (const [key, rawValue] of Object.entries(values)) {
        const valStr = typeof rawValue === "string" ? rawValue.trim() : String(rawValue ?? "").trim();
        if (!valStr) continue;
        await adminClient
          .from("application_form_fields")
          .update({ current_value: valStr, status: "MAPPED" })
          .eq("application_form_id", application.form_schema_id)
          .or(`mapped_profile_key.eq.${key},field_key.eq.${key}`);
      }
    }

    // 5. Resume automation via Inngest
    await inngest.send({
      name: "application/resume",
      data: {
        application_id: id,
        user_id: user.id,
        reason: "missing_fields_filled",
      },
    });

    return NextResponse.json({
      success: true,
      remaining_missing: remainingMissing.length,
      message: "Profile updated and application is resuming.",
    });
  } catch (err: any) {
    console.error("[POST /api/applications/:id/missing-fields]", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
