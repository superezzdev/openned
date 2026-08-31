import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. Total and Active Job counts
    const { count: totalCanonicalJobs } = await supabase
      .from("canonical_jobs")
      .select("*", { count: "exact", head: true });

    const { count: activeCanonicalJobs } = await supabase
      .from("canonical_jobs")
      .select("*", { count: "exact", head: true })
      .eq("active", true);

    // 2. Total Sources count and active sources count
    const { count: totalSources } = await supabase
      .from("job_sources")
      .select("*", { count: "exact", head: true });

    const { count: enabledSources } = await supabase
      .from("job_sources")
      .select("*", { count: "exact", head: true })
      .eq("enabled", true);

    // 3. Platform Breakdown for Active Canonical Jobs
    const { data: activeJobs } = await supabase
      .from("canonical_jobs")
      .select("source")
      .eq("active", true);

    const platformBreakdown: Record<string, number> = {
      greenhouse: 0,
      lever: 0,
      ashby: 0,
      workable: 0,
      custom: 0,
    };

    if (activeJobs) {
      for (const j of activeJobs) {
        if (platformBreakdown[j.source] !== undefined) {
          platformBreakdown[j.source]++;
        } else {
          platformBreakdown[j.source] = 1;
        }
      }
    }

    // 4. Recent Sync Logs
    const { data: recentLogs } = await supabase
      .from("sync_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);

    return NextResponse.json({
      success: true,
      metrics: {
        totalCanonicalJobs: totalCanonicalJobs || 0,
        activeCanonicalJobs: activeCanonicalJobs || 0,
        totalSources: totalSources || 0,
        enabledSources: enabledSources || 0,
        platformBreakdown,
      },
      recentLogs: recentLogs || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to fetch job sources status" },
      { status: 500 }
    );
  }
}
