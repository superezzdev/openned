import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { runYCombinatorScraper, ScraperOptions, SOURCE_NAME } from "../scrapers/ycombinator";

function parseArgs(): ScraperOptions {
  const args = process.argv.slice(2);
  const options: ScraperOptions = {};

  for (const arg of args) {
    if (arg.startsWith("--limit=")) {
      options.maxJobs = parseInt(arg.replace("--limit=", ""), 10);
    } else if (arg.startsWith("--max-jobs=")) {
      options.maxJobs = parseInt(arg.replace("--max-jobs=", ""), 10);
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg.startsWith("--concurrency=")) {
      options.concurrency = parseInt(arg.replace("--concurrency=", ""), 10);
    } else if (arg.startsWith("--delay=")) {
      options.requestDelayMs = parseInt(arg.replace("--delay=", ""), 10);
    } else if (arg.startsWith("--timeout=")) {
      options.timeoutMs = parseInt(arg.replace("--timeout=", ""), 10);
    } else if (arg.startsWith("--roles=")) {
      options.roles = arg.replace("--roles=", "").split(",").map((r) => r.trim()).filter(Boolean);
    } else if (arg === "--remote-only") {
      options.includeRemoteOnly = true;
    }
  }

  return options;
}

async function main() {
  const options = parseArgs();

  console.log("\n========================================================");
  console.log(`🚀 Starting ${SOURCE_NAME.toUpperCase()} Job Ingestion Scraper`);
  console.log("========================================================");
  console.log(`• Source:        ${SOURCE_NAME}`);
  console.log(`• Max Jobs:      ${options.maxJobs || "All available"}`);
  console.log(`• Concurrency:   ${options.concurrency || 5}`);
  console.log(`• Request Delay: ${options.requestDelayMs ?? 300}ms`);
  console.log(`• Mode:          ${options.dryRun ? "DRY RUN (No DB updates)" : "LIVE DATABASE UPSERT"}`);
  if (options.roles && options.roles.length > 0) {
    console.log(`• Roles Filter:  ${options.roles.join(", ")}`);
  }
  console.log("--------------------------------------------------------\n");

  const result = await runYCombinatorScraper(options);

  console.log("\n========================================================");
  console.log(`📊 ${SOURCE_NAME.toUpperCase()} Scraping Execution Summary`);
  console.log("========================================================");
  console.table([
    {
      Source: SOURCE_NAME,
      Discovered: result.discovered,
      Fetched: result.fetched,
      Inserted: result.inserted,
      Updated: result.updated,
      Unchanged: result.unchanged,
      Failed: result.failed,
      "Duration (ms)": result.durationMs,
    },
  ]);

  if (result.jobs.length > 0) {
    console.log(`\nSample Ingested Jobs (Showing first ${Math.min(5, result.jobs.length)} of ${result.jobs.length}):`);
    console.table(
      result.jobs.slice(0, 5).map((j) => ({
        ID: j.source_job_id,
        Company: j.company_name,
        Batch: j.yc_batch || "N/A",
        Title: j.title,
        Location: j.location?.join(", ") || "Remote",
        Salary: j.salary_min && j.salary_max ? `$${Math.round(j.salary_min / 1000)}k - $${Math.round(j.salary_max / 1000)}k` : "N/A",
        Remote: j.remote ? "✅ Yes" : "No",
      }))
    );
  }

  if (result.errors.length > 0) {
    console.log(`\n⚠️  Warnings / Errors encountered (${result.errors.length}):`);
    result.errors.slice(0, 5).forEach((e, idx) => console.log(`  ${idx + 1}. ${e}`));
  }

  console.log("========================================================\n");
}

main().catch((err) => {
  console.error("Fatal error running YC Scraper:", err);
  process.exit(1);
});
