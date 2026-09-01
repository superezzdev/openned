/**
 * GET & POST /api/user/automation-preference
 *
 * Fetches and updates the authenticated user's global automation preference.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { AutomationPreference } from "@/lib/automation/types";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseAdmin(url, key);
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const adminClient = getAdminClient();
    const { data: profile } = await adminClient
      .from("profiles")
      .select("automation_preference")
      .eq("user_id", user.id)
      .maybeSingle();

    const preference = profile?.automation_preference || AutomationPreference.AUTO;

    return NextResponse.json({
      automation_preference: preference,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const preference = body.automation_preference;

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
    const { error } = await adminClient
      .from("profiles")
      .update({
        automation_preference: preference,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      automation_preference: preference,
      message: `Default automation engine set to ${preference}`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
