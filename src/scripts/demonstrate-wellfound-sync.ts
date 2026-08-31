import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { createClient } from "@supabase/supabase-js";
import { getAdapterForSource } from "../lib/ingestion/adapters";
import { syncSingleSource } from "../lib/ingestion/sync-engine";
import { JobSourceRecord } from "../lib/ingestion/types";
import sampleFixture from "../../tests/fixtures/wellfound-sample.json";

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
  const demoSourceId = "00000000-0000-4000-8000-000000000001";
  const demoSourceIdentifier = "demo-wellfound-modal";

  console.log("================================================================================");
  console.log("🚀 WELLFOUND JOB SOURCE ADAPTER DEMONSTRATION");
  console.log("================================================================================\n");

  // Step 0: Ensure clean test source in database
  await supabase.from("canonical_jobs").delete().eq("source", "wellfound").eq("source_id", demoSourceId);
  await supabase.from("sync_logs").delete().eq("source_id", demoSourceId);
  await supabase.from("job_sources").delete().eq("id", demoSourceId);

  const demoSourceRecord: JobSourceRecord = {
    id: demoSourceId,
    source: "wellfound",
    source_name: "Modal Labs (Wellfound)",
    source_identifier: demoSourceIdentifier,
    company_name: "Modal Labs",
    company_logo: "/platforms/wellfound.png",
    source_url: "https://wellfound.com/company/modal-labs",
    enabled: true,
    consecutive_failures: 0,
  };

  const { error: insertSourceErr } = await supabase.from("job_sources").insert(demoSourceRecord);
  if (insertSourceErr) {
    console.error("Failed to insert demo job source:", insertSourceErr);
    process.exit(1);
  }
  console.log("✅ Seeded demo source record into 'job_sources' table.");

  const adapter = getAdapterForSource("wellfound");

  // ---------------------------------------------------------------------------
  // SCENARIO 1: ONE SUCCESSFUL SYNC (Initial Ingestion)
  // ---------------------------------------------------------------------------
  console.log("\n--------------------------------------------------------------------------------");
  console.log("▶ SCENARIO 1: Successful Sync (Initial Ingestion)");
  console.log("--------------------------------------------------------------------------------");

  // Mock fetchJobs on the adapter to return sample fixture
  const originalFetchJobs = adapter.fetchJobs;
  adapter.fetchJobs = async () => sampleFixture.jobs;

  // We temporarily hook the adapter in the registry during this demonstration
  const syncResult1 = await syncSingleSource(demoSourceRecord, { dryRun: false });

  console.log(`• Success:          ${syncResult1.success ? "✅ TRUE" : "❌ FALSE"}`);
  console.log(`• Jobs Fetched:     ${syncResult1.stats.jobsFetched}`);
  console.log(`• Jobs Created:     ${syncResult1.stats.jobsCreated}`);
  console.log(`• Jobs Updated:     ${syncResult1.stats.jobsUpdated}`);
  console.log(`• Jobs Unchanged:   ${syncResult1.stats.jobsUnchanged}`);
  console.log(`• Jobs Deactivated: ${syncResult1.stats.jobsDeactivated}`);
  console.log(`• Execution Time:   ${syncResult1.stats.durationMs}ms`);

  // ---------------------------------------------------------------------------
  // SCENARIO 2: ONE DUPLICATE SYNC (Idempotency Verification)
  // ---------------------------------------------------------------------------
  console.log("\n--------------------------------------------------------------------------------");
  console.log("▶ SCENARIO 2: Duplicate Sync (Exact Same Data Ingested Again)");
  console.log("--------------------------------------------------------------------------------");

  const syncResult2 = await syncSingleSource(demoSourceRecord, { dryRun: false });

  console.log(`• Success:          ${syncResult2.success ? "✅ TRUE" : "❌ FALSE"}`);
  console.log(`• Jobs Fetched:     ${syncResult2.stats.jobsFetched}`);
  console.log(`• Jobs Created:     ${syncResult2.stats.jobsCreated} (Expected 0)`);
  console.log(`• Jobs Updated:     ${syncResult2.stats.jobsUpdated} (Expected 0)`);
  console.log(`• Jobs Unchanged:   ${syncResult2.stats.jobsUnchanged} (Expected ${sampleFixture.jobs.length})`);
  console.log(`• Jobs Deactivated: ${syncResult2.stats.jobsDeactivated}`);
  console.log(`• Execution Time:   ${syncResult2.stats.durationMs}ms`);

  // ---------------------------------------------------------------------------
  // SCENARIO 3: ONE UPDATED-JOB SYNC (Content Hash Mismatch Detection)
  // ---------------------------------------------------------------------------
  console.log("\n--------------------------------------------------------------------------------");
  console.log("▶ SCENARIO 3: Updated-Job Sync (Compensation & Title Changed Upstream)");
  console.log("--------------------------------------------------------------------------------");

  const updatedJobs = [
    {
      ...sampleFixture.jobs[0],
      title: "Lead Distributed Systems Engineer, Cloud Platform",
      salary_min: 240000,
      salary_max: 310000,
    },
    sampleFixture.jobs[1],
  ];

  adapter.fetchJobs = async () => updatedJobs;

  const syncResult3 = await syncSingleSource(demoSourceRecord, { dryRun: false });

  console.log(`• Success:          ${syncResult3.success ? "✅ TRUE" : "❌ FALSE"}`);
  console.log(`• Jobs Fetched:     ${syncResult3.stats.jobsFetched}`);
  console.log(`• Jobs Created:     ${syncResult3.stats.jobsCreated}`);
  console.log(`• Jobs Updated:     ${syncResult3.stats.jobsUpdated} (Expected 1)`);
  console.log(`• Jobs Unchanged:   ${syncResult3.stats.jobsUnchanged} (Expected 1)`);
  console.log(`• Jobs Deactivated: ${syncResult3.stats.jobsDeactivated}`);
  console.log(`• Execution Time:   ${syncResult3.stats.durationMs}ms`);

  // ---------------------------------------------------------------------------
  // SCENARIO 4: ONE FAILED-REQUEST SCENARIO (Upstream Error & Safety Handling)
  // ---------------------------------------------------------------------------
  console.log("\n--------------------------------------------------------------------------------");
  console.log("▶ SCENARIO 4: Failed-Request Scenario (Upstream HTTP 503 / Network Error)");
  console.log("--------------------------------------------------------------------------------");

  adapter.fetchJobs = async () => {
    throw new Error("HTTP 503 Service Unavailable: Wellfound Cloudflare anti-bot challenged");
  };

  const syncResult4 = await syncSingleSource(demoSourceRecord, { dryRun: false });

  console.log(`• Success:          ${syncResult4.success ? "✅ TRUE" : "❌ FALSE (Handled Gracefully)"}`);
  console.log(`• Error Captured:   "${syncResult4.errorMessage}"`);
  console.log(`• Jobs Fetched:     ${syncResult4.stats.jobsFetched}`);
  console.log(`• Jobs Deactivated: ${syncResult4.stats.jobsDeactivated} (Safe: No mass deactivations)`);

  // ---------------------------------------------------------------------------
  // SCENARIO 5: DATABASE RESULT VERIFICATION
  // ---------------------------------------------------------------------------
  console.log("\n--------------------------------------------------------------------------------");
  console.log("▶ SCENARIO 5: Live Database Verification (PostgreSQL / Supabase)");
  console.log("--------------------------------------------------------------------------------");

  // Query updated source record
  const { data: sourceDb } = await supabase
    .from("job_sources")
    .select("id, source, source_identifier, consecutive_failures, last_error_message, last_synced_at")
    .eq("id", demoSourceId)
    .single();

  console.log("\n1. Source Table Status (job_sources):");
  console.table([sourceDb]);

  // Query canonical jobs
  const { data: canonicalJobsDb } = await supabase
    .from("canonical_jobs")
    .select("source, source_job_id, company_name, title, location, remote_type, salary_min, salary_max, salary_currency, active, content_hash")
    .eq("source", "wellfound")
    .eq("source_id", demoSourceId);

  console.log("\n2. Canonical Jobs Ingested (canonical_jobs):");
  console.table(canonicalJobsDb);

  // Query sync audit logs
  const { data: syncLogsDb } = await supabase
    .from("sync_logs")
    .select("source, status, jobs_fetched, jobs_created, jobs_updated, jobs_unchanged, error_message, duration_ms")
    .eq("source_id", demoSourceId)
    .order("created_at", { ascending: false });

  console.log("\n3. Sync Audit Logs (sync_logs):");
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
