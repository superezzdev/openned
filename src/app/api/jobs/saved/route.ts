import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchSavedJobs } from "@/lib/jobs-service";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobs, applicationMap } = await fetchSavedJobs(user.id);

    return NextResponse.json({
      success: true,
      jobs,
      applicationMap,
      count: jobs.length,
    });
  } catch (error: any) {
    console.error("Error in GET /api/jobs/saved:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch saved jobs" },
      { status: 500 }
    );
  }
}
