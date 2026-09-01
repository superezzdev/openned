import dotenv from "dotenv";
import path from "node:path";
import fs from "node:fs";

// Load .env.local and .env
const envLocalPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
}
dotenv.config();
import { jobProviderRegistry } from "../lib/job-providers";
import { validateNormalizedJob } from "../lib/ingestion/validator";

interface TestResult {
  id: string;
  name: string;
  credentialsStatus: "CONFIGURED" | "MISSING";
  requestStatus: "PASS" | "FAIL" | "SKIPPED";
  jobsReturned: number;
  normalizationStatus: "PASS" | "FAIL" | "N/A";
  latencyMs: number;
  error?: string;
}

async function runRealApiIntegrationTests() {
  console.log("\n========================================================");
  console.log("       JOB PROVIDER REAL API INTEGRATION TEST SUITE       ");
  console.log("========================================================\n");

  const providers = jobProviderRegistry.getAll();
  const results: TestResult[] = [];

  const testParams = {
    query: "software engineer",
    location: "US",
    country: "us",
    limit: 10,
    page: 1,
  };

  for (const provider of providers) {
    console.log(`[TEST] Testing provider: ${provider.name} (${provider.id})...`);

    // Check credentials presence without leaking
    let hasCreds = false;
    if (provider.id === "adzuna") {
      hasCreds = Boolean(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY);
    } else {
      const specificVar = `RAPIDAPI_${provider.id.toUpperCase().replace(/-/g, "_")}_KEY`;
      hasCreds = Boolean(process.env[specificVar] || process.env.RAPIDAPI_KEY);
    }

    if (!hasCreds) {
      console.log(`  └─ Credentials: MISSING. Skipping live call.\n`);
      results.push({
        id: provider.id,
        name: provider.name,
        credentialsStatus: "MISSING",
        requestStatus: "SKIPPED",
        jobsReturned: 0,
        normalizationStatus: "N/A",
        latencyMs: 0,
      });
      continue;
    }

    const startTime = Date.now();
    try {
      const searchRes = await provider.search(testParams);
      const latencyMs = searchRes.latencyMs || Date.now() - startTime;

      if (searchRes.status === "error" || searchRes.status === "rate_limited" || searchRes.status === "timeout") {
        console.log(`  └─ Request: FAIL (${searchRes.status}) | Error: ${searchRes.errorMessage || "Unknown"}\n`);
        results.push({
          id: provider.id,
          name: provider.name,
          credentialsStatus: "CONFIGURED",
          requestStatus: "FAIL",
          jobsReturned: 0,
          normalizationStatus: "N/A",
          latencyMs,
          error: searchRes.errorMessage || searchRes.status,
        });
        continue;
      }

      // Check normalization on returned jobs
      let normPassed = false;
      if (searchRes.jobs.length > 0) {
        const firstJob = searchRes.jobs[0];
        const validation = validateNormalizedJob(firstJob);
        normPassed = validation.valid && Boolean(firstJob.title && firstJob.job_url && firstJob.company_name);
      } else {
        normPassed = true; // Empty result set is still validly parsed
      }

      console.log(
        `  └─ Request: PASS | HTTP/Status: ${searchRes.status} | Jobs: ${searchRes.jobs.length} | Norm: ${
          normPassed ? "PASS" : "FAIL"
        } | Latency: ${latencyMs}ms\n`
      );

      results.push({
        id: provider.id,
        name: provider.name,
        credentialsStatus: "CONFIGURED",
        requestStatus: "PASS",
        jobsReturned: searchRes.jobs.length,
        normalizationStatus: normPassed ? "PASS" : "FAIL",
        latencyMs,
      });
    } catch (err: unknown) {
      const errorObj = err as Error;
      const latencyMs = Date.now() - startTime;
      console.log(`  └─ Request Exception: FAIL | ${errorObj?.message || String(err)}\n`);
      results.push({
        id: provider.id,
        name: provider.name,
        credentialsStatus: "CONFIGURED",
        requestStatus: "FAIL",
        jobsReturned: 0,
        normalizationStatus: "N/A",
        latencyMs,
        error: errorObj?.message || String(err),
      });
    }

  }

  // Summary Output Table
  console.log("========================================================");
  console.log("                  INTEGRATION SUMMARY                   ");
  console.log("========================================================");
  console.table(
    results.map((r) => ({
      Provider: r.name,
      ID: r.id,
      Credentials: r.credentialsStatus,
      Status: r.requestStatus,
      "Jobs Count": r.jobsReturned,
      Normalization: r.normalizationStatus,
      Latency: `${r.latencyMs}ms`,
    }))
  );

  const passedCount = results.filter((r) => r.requestStatus === "PASS").length;
  const failedCount = results.filter((r) => r.requestStatus === "FAIL").length;
  const skippedCount = results.filter((r) => r.requestStatus === "SKIPPED").length;

  console.log(`\nResults: ${passedCount} PASSED, ${failedCount} FAILED, ${skippedCount} SKIPPED out of ${results.length} providers.\n`);

  if (failedCount > 0) {
    console.warn("Some providers experienced transient failures or rate limits during live testing.");
  }
}

runRealApiIntegrationTests().catch((err) => {
  console.error("Fatal error during provider integration tests:", err);
  process.exit(1);
});
