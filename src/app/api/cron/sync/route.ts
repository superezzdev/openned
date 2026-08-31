import { NextRequest, NextResponse } from "next/server";
import { syncAllSources } from "@/lib/ingestion/sync-engine";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // Verify secret if configured
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized cron execution" }, { status: 401 });
    }

    console.log("[Cron] Starting scheduled background job ingestion sync...");
    const results = await syncAllSources({ concurrency: 3 });

    const totalJobs = results.reduce((acc, r) => acc + r.stats.jobsFetched, 0);
    const totalCreated = results.reduce((acc, r) => acc + r.stats.jobsCreated, 0);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      sourcesSynced: results.length,
      totalJobsFetched: totalJobs,
      totalJobsCreated: totalCreated,
    });
  } catch (error: any) {
    console.error("[Cron] Ingestion sync error:", error);
    return NextResponse.json(
      { error: error?.message || "Cron sync failed" },
      { status: 500 }
    );
  }
}
