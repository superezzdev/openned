/**
 * POST /api/applications/[id]/review
 * User confirms review and authorizes final submission.
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

    // Atomic conditional update to prevent double-submit race conditions
    const { data: updated, error: updateError } = await adminClient
      .from("applications")
      .update({
        status: ApplicationStatus.SUBMITTING,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("status", ApplicationStatus.AWAITING_USER_REVIEW)
      .select("id, status")
      .maybeSingle();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    if (!updated) {
      const { data: appExists } = await adminClient
        .from("applications")
        .select("id, status, user_id")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!appExists) {
        return NextResponse.json({ error: "Application not found" }, { status: 404 });
      }

      return NextResponse.json({
        error: `Application is not awaiting review or already submitting (status: ${appExists.status})`,
        status: appExists.status,
      }, { status: 409 });
    }

    // Send review-approved event to Inngest
    await inngest.send({
      name: "application/resume",
      data: {
        application_id: id,
        user_id: user.id,
        reason: "review_approved",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Review confirmed. Submitting your application now.",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
