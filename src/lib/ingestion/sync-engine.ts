import { createClient } from "@supabase/supabase-js";
import { getAdapterForSource } from "./adapters";
import { computeJobContentHash } from "./hasher";
import { validateNormalizedJob } from "./validator";
import {
  CanonicalJobRecord,
  JobSourceRecord,
  NormalizedJob,
  SyncOptions,
  SyncResult,
  SyncStats,
} from "./types";

/**
 * Create server Supabase client using environment variables
 */
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://aeqkkdnjzoimgdfmypcw.supabase.co";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlcWtrZG5qem9pbWdkZm15cGN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxMzQ5NjYsImV4cCI6MjEwMjcxMDk2Nn0.610VQ8wpOC1X_aFOBt2vXf3Wjd3My-ViNRdNzW1ctIA";
  return createClient(url, key);
}

// In-memory lock map with expiration timestamp for concurrency coordination within the Node process
const activeLocks = new Map<string, number>();
const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minute max lock lease

/**
 * Acquire lease lock for a job source (prevents concurrent sync of same source/company)
 */
async function acquireLock(sourceRecord: JobSourceRecord): Promise<boolean> {
  const now = Date.now();
  const keys = [
    sourceRecord.id,
    `${sourceRecord.source}:${sourceRecord.source_identifier.toLowerCase()}`,
  ];

  for (const key of keys) {
    const lockTime = activeLocks.get(key);
    if (lockTime && now - lockTime < LOCK_TIMEOUT_MS) {
      return false;
    }
  }

  for (const key of keys) {
    activeLocks.set(key, now);
  }
  return true;
}

/**
 * Release lease lock for a job source
 */
async function releaseLock(sourceRecord: JobSourceRecord): Promise<void> {
  const keys = [
    sourceRecord.id,
    `${sourceRecord.source}:${sourceRecord.source_identifier.toLowerCase()}`,
  ];
  for (const key of keys) {
    activeLocks.delete(key);
  }
}

/**
 * Synchronize a single job source
 */
export async function syncSingleSource(
  sourceRecord: JobSourceRecord,
  options: SyncOptions = {}
): Promise<SyncResult> {
  const startTime = Date.now();
  const supabase = getSupabaseClient();
  const isDryRun = Boolean(options.dryRun);

  const stats: SyncStats = {
    jobsFetched: 0,
    jobsCreated: 0,
    jobsUpdated: 0,
    jobsUnchanged: 0,
    jobsDeactivated: 0,
    durationMs: 0,
    errors: [],
  };

  const lockAcquired = await acquireLock(sourceRecord);
  if (!lockAcquired) {
    const msg = `Source ${sourceRecord.source_name} (${sourceRecord.id}) is already being synced. Lock acquisition skipped.`;
    console.warn(`[source=${sourceRecord.source}] [event=sync_locked] ${msg}`);
    return {
      sourceId: sourceRecord.id,
      sourceIdentifier: sourceRecord.source_identifier,
      source: sourceRecord.source,
      success: false,
      stats,
      errorMessage: msg,
    };
  }

  console.log(
    `[source=${sourceRecord.source}] [event=sync_started] [source_identifier=${sourceRecord.source_identifier}] [company=${sourceRecord.company_name}] [dry_run=${isDryRun}]`
  );

  try {
    const adapter = getAdapterForSource(sourceRecord.source);

    // 1. Fetch raw jobs
    const rawJobs = await adapter.fetchJobs(sourceRecord);
    stats.jobsFetched = rawJobs.length;

    // 2. Fetch existing active jobs for this source to compute change diffs and handle deactivation
    const { data: existingDbJobs, error: existingJobsError } = await supabase
      .from("canonical_jobs")
      .select("id, source_job_id, content_hash, active")
      .eq("source", sourceRecord.source)
      .eq("source_id", sourceRecord.id);

    if (existingJobsError) {
      console.warn(`[source=${sourceRecord.source}] Error fetching existing jobs:`, existingJobsError.message);
    }

    const existingMap = new Map<string, { id: string; content_hash: string; active: boolean }>();
    if (existingDbJobs) {
      for (const ej of existingDbJobs) {
        existingMap.set(ej.source_job_id, {
          id: ej.id,
          content_hash: ej.content_hash,
          active: ej.active,
        });
      }
    }

    const seenSourceJobIds = new Set<string>();
    const jobsToUpsertMap = new Map<string, any>();
    const nowIso = new Date().toISOString();

    // 3. Normalize, Validate, and Prepare Jobs
    for (const raw of rawJobs) {
      try {
        let jobDetails = raw;
        if (adapter.fetchJobDetails && (!raw.description || raw.description.length < 50)) {
          jobDetails = await adapter.fetchJobDetails(sourceRecord, raw);
        }

        const normalized: NormalizedJob = adapter.normalize(jobDetails, sourceRecord);
        const validation = validateNormalizedJob(normalized);

        if (!validation.valid || !validation.sanitizedJob) {
          const err = `Validation failed for job ${normalized.source_job_id} ("${normalized.title}"): ${validation.errors?.join(", ")}`;
          console.warn(`[source=${sourceRecord.source}] [event=job_validation_rejected] ${err}`);
          stats.errors.push(err);
          continue;
        }

        const validJob = validation.sanitizedJob;
        const isDuplicateInBatch = seenSourceJobIds.has(validJob.source_job_id);
        seenSourceJobIds.add(validJob.source_job_id);

        const contentHash = computeJobContentHash(validJob);
        const existing = existingMap.get(validJob.source_job_id);

        if (!isDuplicateInBatch) {
          if (!existing) {
            stats.jobsCreated++;
            console.log(`[source=${sourceRecord.source}] [event=job_created] [source_job_id=${validJob.source_job_id}] [title="${validJob.title}"]`);
          } else if (existing.content_hash !== contentHash || !existing.active) {
            stats.jobsUpdated++;
            console.log(`[source=${sourceRecord.source}] [event=job_updated] [source_job_id=${validJob.source_job_id}] [title="${validJob.title}"]`);
          } else {
            stats.jobsUnchanged++;
          }
        }

        // Deduplicate in-memory by source_job_id to prevent PostgreSQL 21000 batch upsert conflicts
        jobsToUpsertMap.set(validJob.source_job_id, {
          source: validJob.source,
          source_job_id: validJob.source_job_id,
          source_id: sourceRecord.id,
          company_name: validJob.company_name,
          company_logo: validJob.company_logo || sourceRecord.company_logo || null,
          title: validJob.title,
          description: validJob.description || null,
          description_html: validJob.description_html || null,
          location: validJob.location || null,
          locations_json: validJob.locations_json || [],
          country: validJob.country || null,
          region: validJob.region || null,
          city: validJob.city || null,
          remote_type: validJob.remote_type || null,
          employment_type: validJob.employment_type || null,
          department: validJob.department || null,
          team: validJob.team || null,
          salary_min: validJob.salary_min || null,
          salary_max: validJob.salary_max || null,
          salary_currency: validJob.salary_currency || null,
          salary_interval: validJob.salary_interval || null,
          job_url: validJob.job_url,
          apply_url: validJob.apply_url,
          posted_at: validJob.posted_at || null,
          updated_at_source: validJob.updated_at_source || null,
          scraped_at: nowIso,
          last_seen_at: nowIso,
          active: true,
          raw_payload: validJob.raw_payload || null,
          content_hash: contentHash,
          updated_at: nowIso,
        });
      } catch (jobErr: any) {
        const errMsg = `Error processing raw job: ${jobErr?.message || jobErr}`;
        console.error(`[source=${sourceRecord.source}] [event=job_process_error]`, errMsg);
        stats.errors.push(errMsg);
      }
    }

    const jobsToUpsert = Array.from(jobsToUpsertMap.values());

    // 4. Safe Reconciliation / Deactivation Strategy
    // Only mark jobs inactive if sync succeeded cleanly and returned valid jobs
    const missingJobIdsToDeactivate: string[] = [];
    const activeExistingCount = Array.from(existingMap.values()).filter((j) => j.active).length;

    if (rawJobs.length > 0 && stats.jobsFetched > 0 && stats.errors.length < rawJobs.length * 0.5) {
      for (const [existingId, info] of existingMap.entries()) {
        if (!seenSourceJobIds.has(existingId) && info.active) {
          missingJobIdsToDeactivate.push(info.id);
        }
      }

      // Safety guard against mass accidental deactivations (>70% drop when previously having >= 5 active jobs)
      if (activeExistingCount >= 5 && missingJobIdsToDeactivate.length > activeExistingCount * 0.7) {
        const warn = `[Mass Deactivation Prevented] Sync returned ${seenSourceJobIds.size} jobs, but ${activeExistingCount} were previously active (${missingJobIdsToDeactivate.length} missing). Deactivation skipped as a safety precaution.`;
        console.warn(`[source=${sourceRecord.source}] [event=mass_deactivation_prevented] ${warn}`);
        stats.errors.push(warn);
        missingJobIdsToDeactivate.length = 0; // abort deactivation for this run
      }

      stats.jobsDeactivated = missingJobIdsToDeactivate.length;
      if (stats.jobsDeactivated > 0) {
        console.log(
          `[source=${sourceRecord.source}] [event=jobs_reconciled] Marking ${stats.jobsDeactivated} closed/removed jobs as inactive.`
        );
      }
    }

    // 5. Database Commit (unless dry run)
    if (!isDryRun) {
      // Upsert jobs in batches of 100
      const batchSize = 100;
      for (let i = 0; i < jobsToUpsert.length; i += batchSize) {
        const batch = jobsToUpsert.slice(i, i + batchSize);
        const { error: upsertError } = await supabase
          .from("canonical_jobs")
          .upsert(batch, {
            onConflict: "source,source_job_id",
            ignoreDuplicates: false,
          });

        if (upsertError) {
          console.error(`[source=${sourceRecord.source}] Upsert batch error:`, upsertError);
          stats.errors.push(`Upsert error: ${upsertError.message}`);
        }
      }

      // Mark missing jobs inactive
      if (missingJobIdsToDeactivate.length > 0) {
        await supabase
          .from("canonical_jobs")
          .update({ active: false, updated_at: nowIso })
          .in("id", missingJobIdsToDeactivate);
      }

      // Update source status
      await supabase
        .from("job_sources")
        .update({
          last_synced_at: nowIso,
          last_success_at: nowIso,
          last_error_at: null,
          last_error_message: null,
          consecutive_failures: 0,
          updated_at: nowIso,
        })
        .eq("id", sourceRecord.id);

      // Record Sync Audit Log
      await supabase.from("sync_logs").insert({
        source_id: sourceRecord.id,
        source: sourceRecord.source,
        status: stats.errors.length > 0 ? "partial" : "success",
        jobs_fetched: stats.jobsFetched,
        jobs_created: stats.jobsCreated,
        jobs_updated: stats.jobsUpdated,
        jobs_unchanged: stats.jobsUnchanged,
        jobs_deactivated: stats.jobsDeactivated,
        error_message: stats.errors.length > 0 ? stats.errors.slice(0, 3).join("; ") : null,
        duration_ms: Date.now() - startTime,
        created_at: nowIso,
      });
    }

    stats.durationMs = Date.now() - startTime;

    console.log(
      `[source=${sourceRecord.source}] [event=sync_completed] [fetched=${stats.jobsFetched}] [created=${stats.jobsCreated}] [updated=${stats.jobsUpdated}] [unchanged=${stats.jobsUnchanged}] [deactivated=${stats.jobsDeactivated}] [duration=${stats.durationMs}ms]`
    );

    return {
      sourceId: sourceRecord.id,
      sourceIdentifier: sourceRecord.source_identifier,
      source: sourceRecord.source,
      success: true,
      stats,
    };
  } catch (syncError: any) {
    const durationMs = Date.now() - startTime;
    stats.durationMs = durationMs;
    const errorMsg = syncError?.message || String(syncError);
    stats.errors.push(errorMsg);

    console.error(
      `[source=${sourceRecord.source}] [event=sync_failed] [source_identifier=${sourceRecord.source_identifier}] [error="${errorMsg}"]`
    );

    if (!isDryRun) {
      const nowIso = new Date().toISOString();
      await supabase
        .from("job_sources")
        .update({
          last_synced_at: nowIso,
          last_error_at: nowIso,
          last_error_message: errorMsg,
          consecutive_failures: (sourceRecord.consecutive_failures || 0) + 1,
          updated_at: nowIso,
        })
        .eq("id", sourceRecord.id);

      await supabase.from("sync_logs").insert({
        source_id: sourceRecord.id,
        source: sourceRecord.source,
        status: "failed",
        jobs_fetched: stats.jobsFetched,
        jobs_created: 0,
        jobs_updated: 0,
        jobs_unchanged: 0,
        jobs_deactivated: 0,
        error_message: errorMsg,
        duration_ms: durationMs,
        created_at: nowIso,
      });
    }

    return {
      sourceId: sourceRecord.id,
      sourceIdentifier: sourceRecord.source_identifier,
      source: sourceRecord.source,
      success: false,
      stats,
      errorMessage: errorMsg,
    };
  } finally {
    await releaseLock(sourceRecord);
  }
}

/**
 * Synchronize all enabled job sources with controlled concurrency
 */
export async function syncAllSources(options: SyncOptions = {}): Promise<SyncResult[]> {
  const supabase = getSupabaseClient();
  const concurrency = options.concurrency || 4;

  let query = supabase.from("job_sources").select("*").eq("enabled", true);

  if (options.sourceFilter) {
    query = query.eq("source", options.sourceFilter);
  }

  if (options.companyFilter) {
    query = query.or(
      `source_identifier.ilike.%${options.companyFilter}%,company_name.ilike.%${options.companyFilter}%`
    );
  }

  if (options.limit && options.limit > 0) {
    query = query.limit(options.limit);
  }

  const { data: sources, error } = await query;

  if (error || !sources || sources.length === 0) {
    console.warn("No enabled job sources found to synchronize.");
    return [];
  }

  console.log(`Starting synchronization of ${sources.length} sources (concurrency=${concurrency})...`);

  const results: SyncResult[] = [];
  const queue = [...sources];

  async function worker() {
    while (queue.length > 0) {
      const source = queue.shift();
      if (!source) break;
      const res = await syncSingleSource(source, options);
      results.push(res);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, sources.length) }, () => worker());
  await Promise.all(workers);

  return results;
}
