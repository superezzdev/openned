/**
 * POST /api/applications/[id]/automation-provider
 *
 * Update the automation preference or provider for an unstarted application.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { AutomationPreference } from "@/lib/automation/types";
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const preference = body.automation_preference || body.provider;

    const validPreferences = [
      AutomationPreference.AUTO,
      AutomationPreference.LOCAL_ONLY,
      AutomationPreference.BROWSERBASE_ONLY,
    ];

    if (!preference || !validPreferences.includes(preference)) {
      return NextResponse.json(
        { error: "Invalid automation preference. Allowed: AUTO, LOCAL_ONLY, BROWSERBASE_ONLY" },
        { status: 400 }
      );
    }

    const adminClient = getAdminClient();

    // Verify application belongs to user
    const { data: application } = await adminClient
      .from("applications")
      .select("id, status, user_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    // Only allow updating on non-terminal, unstarted/queued applications
    const modifiableStatuses = [
      ApplicationStatus.QUEUED,
      ApplicationStatus.MISSING_PROFILE_INFO,
      ApplicationStatus.AWAITING_USER_INPUT,
      ApplicationStatus.AWAITING_USER_ACTION,
    ];

    if (!modifiableStatuses.includes(application.status as ApplicationStatus)) {
      return NextResponse.json(
        { error: `Cannot change automation engine while in status: ${application.status}` },
        { status: 400 }
      );
    }

    const { error: updateError } = await adminClient
      .from("applications")
      .update({
        automation_preference: preference,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      application_id: id,
      automation_preference: preference,
      message: `Automation preference updated to ${preference}`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
