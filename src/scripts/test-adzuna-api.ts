import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import {
  fetchAdzunaJobs,
  normalizeAdzunaJob,
  AdzunaError,
} from "../lib/ingestion/adapters/adzuna";
import { validateNormalizedJob } from "../lib/ingestion/validator";

async function runRealApiTest() {
  console.log("================================================================================");
  console.log("🚀 ADZUNA JOBS REAL API INTEGRATION TEST");
  console.log("================================================================================\n");

  const appId = process.env.ADZUNA_APP_ID?.trim();
  const appKey = process.env.ADZUNA_APP_KEY?.trim();
  const country = (process.env.ADZUNA_COUNTRY || "in").trim().toLowerCase();
  const query = "software engineer";
  const location = "India";

  console.log("Adzuna Integration Test");
  console.log("-----------------------");
  console.log(`Credentials:   ${appId && appKey ? "configured" : "MISSING"}`);
  console.log(`App ID:        ${appId ? `${appId.slice(0, 3)}***` : "None"}`);
  console.log(`Country:       ${country}`);
  console.log(`Query:         ${query}`);
  console.log(`Location:      ${location}\n`);

  if (!appId || !appKey) {
    console.error("RESULT: FAIL");
    console.error("Reason: ADZUNA_APP_ID or ADZUNA_APP_KEY is missing in environment (.env.local / .env)\n");
    process.exit(1);
  }

  try {
    const startTime = Date.now();
    const response = await fetchAdzunaJobs({
      query,
      location,
      country,
      page: 1,
      resultsPerPage: 5,
    });
    const latencyMs = Date.now() - startTime;

    const results = Array.isArray(response.results) ? response.results : [];
    const count = typeof response.count === "number" ? response.count : results.length;

    console.log(`HTTP status:    200`);
    console.log(`Jobs returned:  ${results.length}`);
    console.log(`Total count:    ${count}`);
    console.log(`Latency:        ${latencyMs}ms\n`);

    if (results.length === 0) {
      console.warn("⚠️  Warning: API request succeeded but returned 0 results for query.");
    }

    const firstRawJob = results[0];
    if (!firstRawJob) {
      console.error("RESULT: FAIL");
      console.error("Reason: No jobs returned to validate normalization.");
      process.exit(1);
    }

    // Normalize first job
    const normalized = normalizeAdzunaJob(firstRawJob);
    const validation = validateNormalizedJob(normalized);

    console.log("First job verification:");
    console.log(`• Title:                   ${normalized.title}`);
    console.log(`• Company:                 ${normalized.company_name}`);
    console.log(`• Location:                ${normalized.location}`);
    console.log(`• Source:                  ${normalized.source}`);
    console.log(`• Source Job ID:           ${normalized.source_job_id}`);
    console.log(`• Job URL:                 ${normalized.job_url}`);
    console.log(`• Apply URL:               ${normalized.apply_url}`);
    console.log(`• Salary Display:          ${normalized.salary_min ? `${normalized.salary_currency || "INR"} ${normalized.salary_min} - ${normalized.salary_max}` : "Unspecified"}`);
    console.log(`• Employment Type:         ${normalized.employment_type || "Unspecified"}`);
    console.log(`• Remote Type:             ${normalized.remote_type || "Unspecified"}`);
    console.log(`• Validation Schema Valid: ${validation.valid ? "YES" : `NO (${validation.errors?.join(", ")})`}`);

    // Verify required fields
    const hasSource = normalized.source === "adzuna";
    const hasSourceJobId = Boolean(normalized.source_job_id && normalized.source_job_id.length > 0);
    const hasTitle = Boolean(normalized.title && normalized.title.length > 0);
    const hasJobUrl = Boolean(normalized.job_url && normalized.job_url.startsWith("http"));

    if (!hasSource || !hasSourceJobId || !hasTitle || !hasJobUrl || !validation.valid) {
      console.error("\nRESULT: FAIL");
      console.error("Reason: One or more required fields failed validation.");
      process.exit(1);
    }

    console.log("\n================================================================================");
    console.log("RESULT: PASS");
    console.log("================================================================================\n");
  } catch (err: unknown) {
    console.error("\nRESULT: FAIL");
    if (err instanceof AdzunaError) {
      console.error(`Error Code: ${err.code}`);
      console.error(`Message:    ${err.message}`);
      if (err.status) console.error(`Status:     ${err.status}`);
    } else {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Reason:     ${msg}`);
    }
    console.error("================================================================================\n");
    process.exit(1);
  }
}

runRealApiTest();
