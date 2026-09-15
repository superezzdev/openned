import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSavedJobsCount } from "@/lib/jobs-service";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const count = await getSavedJobsCount(user.id);

    return NextResponse.json({
      success: true,
      count,
    });
  } catch (error: any) {
    console.error("Error in GET /api/jobs/saved-count:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch saved jobs count" },
      { status: 500 }
    );
  }
}
