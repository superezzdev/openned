import { NextRequest, NextResponse } from "next/server";
import { syncAllSources } from "@/lib/ingestion/sync-engine";
import { JobSource, SyncOptions } from "@/lib/ingestion/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { source, company, dryRun, limit, concurrency } = body;

    const options: SyncOptions = {
      sourceFilter: source && source !== "all" ? (source as JobSource) : undefined,
      companyFilter: company || undefined,
      dryRun: Boolean(dryRun),
      limit: limit ? parseInt(String(limit), 10) : undefined,
      concurrency: concurrency ? parseInt(String(concurrency), 10) : 4,
    };

    const results = await syncAllSources(options);

    let totalFetched = 0;
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalUnchanged = 0;
    let totalDeactivated = 0;
    let successCount = 0;
    let failureCount = 0;

    for (const r of results) {
      totalFetched += r.stats.jobsFetched;
      totalCreated += r.stats.jobsCreated;
      totalUpdated += r.stats.jobsUpdated;
      totalUnchanged += r.stats.jobsUnchanged;
      totalDeactivated += r.stats.jobsDeactivated;
      if (r.success) successCount++;
      else failureCount++;
    }

    return NextResponse.json({
      success: true,
      summary: {
        sourcesProcessed: results.length,
        succeeded: successCount,
        failed: failureCount,
        jobsFetched: totalFetched,
        jobsCreated: totalCreated,
        jobsUpdated: totalUpdated,
        jobsUnchanged: totalUnchanged,
        jobsDeactivated: totalDeactivated,
        dryRun: Boolean(options.dryRun),
      },
      results,
    });
  } catch (error: any) {
    console.error("Error in POST /api/admin/job-sources/sync:", error);
    return NextResponse.json(
      { error: error?.message || "Sync execution failed" },
      { status: 500 }
    );
  }
}
