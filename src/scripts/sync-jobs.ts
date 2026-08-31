import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { syncAllSources } from "../lib/ingestion/sync-engine";
import { JobSource, SyncOptions } from "../lib/ingestion/types";

function parseArgs(): SyncOptions {
  const args = process.argv.slice(2);
  const options: SyncOptions = {};

  for (const arg of args) {
    if (arg.startsWith("--source=")) {
      options.sourceFilter = arg.replace("--source=", "").trim() as JobSource;
    } else if (arg.startsWith("--company=")) {
      options.companyFilter = arg.replace("--company=", "").trim();
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg.startsWith("--limit=")) {
      options.limit = parseInt(arg.replace("--limit=", ""), 10);
    } else if (arg.startsWith("--concurrency=")) {
      options.concurrency = parseInt(arg.replace("--concurrency=", ""), 10);
    }
  }

  return options;
}

async function runCliSync() {
  const options = parseArgs();

  console.log("\n========================================================");
  console.log("🚀 Starting Job Ingestion Synchronization");
  console.log("========================================================");
  if (options.sourceFilter) console.log(`• Filter Source:  ${options.sourceFilter}`);
  if (options.companyFilter) console.log(`• Filter Company: ${options.companyFilter}`);
  if (options.dryRun) console.log(`• Mode:           DRY RUN (No DB mutations)`);
  if (options.limit) console.log(`• Limit:          ${options.limit}`);
  console.log("--------------------------------------------------------\n");

  const startTime = Date.now();
  const results = await syncAllSources(options);
  const totalDuration = Date.now() - startTime;

  let totalFetched = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalUnchanged = 0;
  let totalDeactivated = 0;
  let successCount = 0;
  let failureCount = 0;

  console.log("\n========================================================");
  console.log("📊 Synchronization Summary Report");
  console.log("========================================================");
  console.table(
    results.map((r) => {
      totalFetched += r.stats.jobsFetched;
      totalCreated += r.stats.jobsCreated;
      totalUpdated += r.stats.jobsUpdated;
      totalUnchanged += r.stats.jobsUnchanged;
      totalDeactivated += r.stats.jobsDeactivated;
      if (r.success) successCount++;
      else failureCount++;

      return {
        Source: r.source,
        Identifier: r.sourceIdentifier,
        Status: r.success ? "✅ OK" : "❌ FAILED",
        Fetched: r.stats.jobsFetched,
        Created: r.stats.jobsCreated,
        Updated: r.stats.jobsUpdated,
        Unchanged: r.stats.jobsUnchanged,
        Deactivated: r.stats.jobsDeactivated,
        "Time (ms)": r.stats.durationMs,
      };
    })
  );

  console.log("--------------------------------------------------------");
  console.log(`Sources Processed:   ${results.length} (${successCount} Succeeded, ${failureCount} Failed)`);
  console.log(`Total Jobs Fetched:  ${totalFetched}`);
  console.log(`Total Jobs Created:  ${totalCreated}`);
  console.log(`Total Jobs Updated:  ${totalUpdated}`);
  console.log(`Total Jobs Unchanged:${totalUnchanged}`);
  console.log(`Total Deactivated:   ${totalDeactivated}`);
  console.log(`Total Execution Time:${totalDuration}ms`);
  console.log("========================================================\n");
}

runCliSync().catch((err) => {
  console.error("Fatal error during CLI synchronization:", err);
  process.exit(1);
});
