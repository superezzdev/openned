import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveApplicationsCount } from "@/lib/applications/application-status-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/applications/active-count
 * Returns the count of currently active (in-progress) applications for the authenticated user.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const count = await getActiveApplicationsCount(user.id);
    return NextResponse.json({ count });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to fetch active applications count" },
      { status: 500 }
    );
  }
}
