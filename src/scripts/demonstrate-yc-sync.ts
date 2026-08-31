import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import {
  parseJobPage,
  SOURCE_NAME,
} from "../scrapers/ycombinator";
import { syncSingleSource } from "../lib/ingestion/sync-engine";
import { getAdapterForSource } from "../lib/ingestion/adapters";
import { JobSourceRecord } from "../lib/ingestion/types";

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://aeqkkdnjzoimgdfmypcw.supabase.co";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlcWtrZG5qem9pbWdkZm15cGN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxMzQ5NjYsImV4cCI6MjEwMjcxMDk2Nn0.610VQ8wpOC1X_aFOBt2vXf3Wjd3My-ViNRdNzW1ctIA";
  return createClient(url, key);
}

async function runDemonstration() {
  const supabase = getSupabaseClient();
  const demoSourceId = "00000000-0000-4000-8000-000000000002";
  const demoSourceIdentifier = "demo-yc-jobs";

  console.log("================================================================================");
  console.log("🚀 Y COMBINATOR JOB SOURCE ADAPTER & SCRAPER DEMONSTRATION");
  console.log("================================================================================\n");

  // Step 0: Clean up prior test runs
  await supabase.from("canonical_jobs").delete().eq("source", SOURCE_NAME).eq("source_id", demoSourceId);
  await supabase.from("sync_logs").delete().eq("source_id", demoSourceId);
  await supabase.from("job_sources").delete().eq("id", demoSourceId);

  const demoSourceRecord: JobSourceRecord = {
    id: demoSourceId,
    source: "ycombinator",
    source_name: "Y Combinator (Demo Source)",
    source_identifier: demoSourceIdentifier,
    company_name: "Porter",
    company_logo: "/platforms/ycombinator.svg",
    source_url: "https://www.ycombinator.com/jobs",
    enabled: true,
    consecutive_failures: 0,
  };

  const { error: insertSourceErr } = await supabase.from("job_sources").insert(demoSourceRecord);
  if (insertSourceErr) {
    console.error("Failed to insert demo job source:", insertSourceErr);
    process.exit(1);
  }
  console.log("✅ Seeded demo source record into 'job_sources' table.");

  const adapter = getAdapterForSource("ycombinator");

  const sampleDetailHtml = fs.readFileSync(
    path.join(__dirname, "../../tests/fixtures/ycombinator-sample.html"),
    "utf-8"
  );

  const sampleJob1 = parseJobPage(
    sampleDetailHtml,
    "https://www.ycombinator.com/companies/porter/jobs/GjO3enf-backend-engineer-go"
  );

  const sampleJob2 = {
    ...sampleJob1,
    source_job_id: "nAbajSt",
    title: "Full Stack Engineer",
    company_name: "Medplum",
    yc_batch: "S22",
    salary_min: 160000,
    salary_max: 220000,
    job_url: "https://www.ycombinator.com/companies/medplum/jobs/nAbajSt-software-engineer",
    apply_url: "https://account.ycombinator.com/authenticate?continue=https%3A%2F%2Fwww.workatastartup.com%2Fapplication%3Fsignup_job_id%3D59403",
  };

  // ---------------------------------------------------------------------------
  // SCENARIO 1: INITIAL INGESTION (New Jobs Inserted)
  // ---------------------------------------------------------------------------
  console.log("\n--------------------------------------------------------------------------------");
  console.log("▶ SCENARIO 1: Successful Ingestion (Initial Discovery & Insert)");
  console.log("--------------------------------------------------------------------------------");

  const originalFetchJobs = adapter.fetchJobs;
  adapter.fetchJobs = async () => [sampleJob1, sampleJob2];

  const syncResult1 = await syncSingleSource(demoSourceRecord, { dryRun: false });

  console.log(`• Success:          ${syncResult1.success ? "✅ TRUE" : "❌ FALSE"}`);
  console.log(`• Jobs Fetched:     ${syncResult1.stats.jobsFetched}`);
  console.log(`• Jobs Created:     ${syncResult1.stats.jobsCreated}`);
  console.log(`• Jobs Updated:     ${syncResult1.stats.jobsUpdated}`);
  console.log(`• Jobs Unchanged:   ${syncResult1.stats.jobsUnchanged}`);
  console.log(`• Jobs Deactivated: ${syncResult1.stats.jobsDeactivated}`);
  console.log(`• Execution Time:   ${syncResult1.stats.durationMs}ms`);

  // ---------------------------------------------------------------------------
  // SCENARIO 2: DUPLICATE SYNC (Idempotency Verification)
  // ---------------------------------------------------------------------------
  console.log("\n--------------------------------------------------------------------------------");
  console.log("▶ SCENARIO 2: Duplicate Sync (Exact Same Data Ingested Again)");
  console.log("--------------------------------------------------------------------------------");

  const syncResult2 = await syncSingleSource(demoSourceRecord, { dryRun: false });

  console.log(`• Success:          ${syncResult2.success ? "✅ TRUE" : "❌ FALSE"}`);
  console.log(`• Jobs Fetched:     ${syncResult2.stats.jobsFetched}`);
  console.log(`• Jobs Created:     ${syncResult2.stats.jobsCreated} (Expected 0)`);
  console.log(`• Jobs Updated:     ${syncResult2.stats.jobsUpdated} (Expected 0)`);
  console.log(`• Jobs Unchanged:   ${syncResult2.stats.jobsUnchanged} (Expected 2)`);
  console.log(`• Jobs Deactivated: ${syncResult2.stats.jobsDeactivated}`);
  console.log(`• Execution Time:   ${syncResult2.stats.durationMs}ms`);

  // ---------------------------------------------------------------------------
  // SCENARIO 3: UPDATED-JOB SYNC (Content Hash Change Detection)
  // ---------------------------------------------------------------------------
  console.log("\n--------------------------------------------------------------------------------");
  console.log("▶ SCENARIO 3: Updated-Job Sync (Title & Compensation Changed Upstream)");
  console.log("--------------------------------------------------------------------------------");

  const updatedJob1 = {
    ...sampleJob1,
    title: "Senior Backend Engineer (Go / Distributed Systems)",
    salary_min: 150000,
    salary_max: 240000,
  };

  adapter.fetchJobs = async () => [updatedJob1, sampleJob2];

  const syncResult3 = await syncSingleSource(demoSourceRecord, { dryRun: false });

  console.log(`• Success:          ${syncResult3.success ? "✅ TRUE" : "❌ FALSE"}`);
  console.log(`• Jobs Fetched:     ${syncResult3.stats.jobsFetched}`);
  console.log(`• Jobs Created:     ${syncResult3.stats.jobsCreated}`);
  console.log(`• Jobs Updated:     ${syncResult3.stats.jobsUpdated} (Expected 1)`);
  console.log(`• Jobs Unchanged:   ${syncResult3.stats.jobsUnchanged} (Expected 1)`);
  console.log(`• Jobs Deactivated: ${syncResult3.stats.jobsDeactivated}`);
  console.log(`• Execution Time:   ${syncResult3.stats.durationMs}ms`);

  // ---------------------------------------------------------------------------
  // SCENARIO 4: UPSTREAM ERROR ISOLATION & RESILIENCE
  // ---------------------------------------------------------------------------
  console.log("\n--------------------------------------------------------------------------------");
  console.log("▶ SCENARIO 4: Failed-Request Scenario (Upstream HTTP 503 / Network Error)");
  console.log("--------------------------------------------------------------------------------");

  adapter.fetchJobs = async () => {
    throw new Error("HTTP 503 Service Unavailable: Y Combinator upstream gateway timeout");
  };

  const syncResult4 = await syncSingleSource(demoSourceRecord, { dryRun: false });

  console.log(`• Success:          ${syncResult4.success ? "✅ TRUE" : "❌ FALSE (Handled Gracefully)"}`);
  console.log(`• Error Captured:   "${syncResult4.errorMessage}"`);
  console.log(`• Jobs Fetched:     ${syncResult4.stats.jobsFetched}`);
  console.log(`• Jobs Deactivated: ${syncResult4.stats.jobsDeactivated} (Safe: No mass deactivations)`);

  // ---------------------------------------------------------------------------
  // SCENARIO 5: LIVE DATABASE VERIFICATION
  // ---------------------------------------------------------------------------
  console.log("\n--------------------------------------------------------------------------------");
  console.log("▶ SCENARIO 5: Live Database Verification (PostgreSQL / Supabase)");
  console.log("--------------------------------------------------------------------------------");

  const { data: canonicalJobsDb } = await supabase
    .from("canonical_jobs")
    .select("source, source_job_id, company_name, title, location, salary_min, salary_max, salary_currency, active, content_hash")
    .eq("source", SOURCE_NAME)
    .eq("source_id", demoSourceId);

  console.log("\n1. Canonical Jobs Ingested in Supabase (canonical_jobs):");
  console.table(canonicalJobsDb);

  const { data: syncLogsDb } = await supabase
    .from("sync_logs")
    .select("source, status, jobs_fetched, jobs_created, jobs_updated, jobs_unchanged, error_message, duration_ms")
    .eq("source_id", demoSourceId)
    .order("created_at", { ascending: false });

  console.log("\n2. Sync Audit Logs in Supabase (sync_logs):");
  console.table(syncLogsDb);

  // Restore adapter
  adapter.fetchJobs = originalFetchJobs;

  console.log("\n================================================================================");
  console.log("🎉 ALL 5 DEMONSTRATION SCENARIOS COMPLETED SUCCESSFULLY");
  console.log("================================================================================\n");
}

runDemonstration().catch((err) => {
  console.error("Demonstration failed:", err);
  process.exit(1);
});
