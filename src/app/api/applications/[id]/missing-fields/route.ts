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

    const allowedStatuses = [
      ApplicationStatus.MISSING_PROFILE_INFO,
      ApplicationStatus.AWAITING_USER_INPUT,
      ApplicationStatus.AWAITING_USER_REVIEW,
      ApplicationStatus.READY_TO_APPLY,
    ];

    if (!allowedStatuses.includes(application.status as ApplicationStatus)) {
      return NextResponse.json({
        error: `Application is not in a valid state for missing fields (status: ${application.status})`,
      }, { status: 400 });
    }

    // 1. Save values to user profile (makes them reusable across applications)
    await updateProfileWithMissingFields(user.id, values);

    // 2. Resolve form schema ID if not explicitly on application row
    let formSchemaId = application.form_schema_id;
    if (!formSchemaId) {
      const { data: form } = await adminClient
        .from("application_forms")
        .select("id")
        .eq("application_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (form?.id) {
        formSchemaId = form.id;
      }
    }

    // 3. Update application_form_fields with user values
    if (formSchemaId) {
      for (const [key, rawValue] of Object.entries(values)) {
        const valStr = typeof rawValue === "string" ? rawValue.trim() : String(rawValue ?? "").trim();
        if (!valStr) continue;
        await adminClient
          .from("application_form_fields")
          .update({ current_value: valStr, status: "MAPPED" })
          .eq("application_form_id", formSchemaId)
          .or(`mapped_profile_key.eq.${key},field_key.eq.${key}`);
      }
    }

    // 4. Determine which missing fields are now resolved
    const currentMissing: any[] = application.missing_fields || [];
    const providedKeys = new Set(Object.keys(values).filter(k => values[k]?.trim()));
    const remainingMissing = currentMissing.filter(
      (f: any) => !providedKeys.has(f.field_key) && !providedKeys.has(f.label)
    );

    const isReview = application.status === ApplicationStatus.AWAITING_USER_REVIEW;

    // 5. Update application record — clear resolved missing fields
    const nextStatus = isReview ? ApplicationStatus.AWAITING_USER_REVIEW : ApplicationStatus.QUEUED;
    await adminClient.from("applications").update({
      missing_fields: remainingMissing,
      status: nextStatus,
      form_schema_id: formSchemaId || application.form_schema_id,
      updated_at: new Date().toISOString(),
    }).eq("id", id);

    // 6. Resume automation via Inngest if paused waiting for input
    if (!isReview) {
      await inngest.send({
        name: "application/resume",
        data: {
          application_id: id,
          user_id: user.id,
          reason: "missing_fields_filled",
        },
      });
    }

    return NextResponse.json({
      success: true,
      remaining_missing: remainingMissing.length,
      remaining_fields: remainingMissing,
      status: nextStatus,
      message: isReview
        ? "Information saved. Your application is ready for review."
        : "Profile updated and application is resuming.",
    });
  } catch (err: any) {
    console.error("[POST /api/applications/:id/missing-fields]", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
