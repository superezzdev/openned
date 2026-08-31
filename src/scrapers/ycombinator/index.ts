import { createClient } from "@supabase/supabase-js";
import { computeJobContentHash } from "../../lib/ingestion/hasher";
import { validateNormalizedJob } from "../../lib/ingestion/validator";
import {
  HealthCheckResult,
  JobSourceAdapter,
  JobSourceRecord,
  NormalizedJob,
  RawJob,
  RawJobDetails,
} from "../../lib/ingestion/types";
import {
  DEFAULT_MAX_CONCURRENCY,
  DEFAULT_REQUEST_DELAY_MS,
  DEFAULT_TIMEOUT_MS,
  SOURCE_NAME,
} from "./constants";
import {
  canonicalizeJobUrl,
  discoverJobUrls,
  extractJobIdFromUrl,
  extractJobUrlsFromHtml,
  fetchHtmlWithRetry,
  isYcJobUrl,
  sleep,
} from "./fetcher";
import {
  extractApplyUrl,
  extractCompany,
  extractDescription,
  extractEmbeddedJobData,
  extractJsonLd,
  extractLocation,
  extractSalary,
  extractText,
  parseJobPage,
} from "./parser";
import {
  computeYcContentHash,
  normalizeYcJobToCanonical,
  normalizeYcJobToScrapedJob,
} from "./normalizer";
import {
  ScraperOptions,
  ScraperResult,
  YCJobRaw,
  YCScrapedJob,
} from "./types";

export {
  SOURCE_NAME,
  canonicalizeJobUrl,
  isYcJobUrl,
  extractJobIdFromUrl,
  extractJobUrlsFromHtml,
  discoverJobUrls,
  fetchHtmlWithRetry,
  extractJsonLd,
  extractEmbeddedJobData,
  extractText,
  extractSalary,
  extractLocation,
  extractCompany,
  extractDescription,
  extractApplyUrl,
  parseJobPage,
  computeYcContentHash,
  normalizeYcJobToScrapedJob,
  normalizeYcJobToCanonical,
};

export type {
  ScraperOptions,
  ScraperResult,
  YCJobRaw,
  YCScrapedJob,
};

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://aeqkkdnjzoimgdfmypcw.supabase.co";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlcWtrZG5qem9pbWdkZm15cGN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxMzQ5NjYsImV4cCI6MjEwMjcxMDk2Nn0.610VQ8wpOC1X_aFOBt2vXf3Wjd3My-ViNRdNzW1ctIA";
  return createClient(url, key);
}

/**
 * Main Standalone Runner for the Y Combinator Jobs Scraper
 *
 * Flow:
 * 1. Fetch YC job listing/index pages.
 * 2. Extract all publicly visible job URLs.
 * 3. Normalize relative URLs to absolute URLs.
 * 4. Remove duplicate URLs.
 * 5. Fetch each individual job page (with controlled concurrency, rate limiting, error isolation).
 * 6. Parse available structured/visible information.
 * 7. Normalize everything into the application's common Job schema.
 * 8. Generate a stable source_job_id.
 * 9. Calculate a content hash for change detection.
 * 10. Upsert into PostgreSQL / Supabase.
 * 11. Log structured summary (discovered, fetched, inserted, updated, unchanged, failed).
 */
export async function runYCombinatorScraper(options: ScraperOptions = {}): Promise<ScraperResult> {
  const startTime = Date.now();
  const concurrency = options.concurrency || DEFAULT_MAX_CONCURRENCY;
  const requestDelayMs = options.requestDelayMs || DEFAULT_REQUEST_DELAY_MS;
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const isDryRun = Boolean(options.dryRun);

  const supabase = getSupabaseClient();
  const scrapedJobs: YCScrapedJob[] = [];
  const errors: string[] = [];

  let discoveredCount = 0;
  let fetchedCount = 0;
  let insertedCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  let failedCount = 0;

  console.log(`[${SOURCE_NAME}] Starting scraper run (concurrency=${concurrency}, delay=${requestDelayMs}ms, dryRun=${isDryRun})...`);

  // 1-4. Discover, canonicalize, and deduplicate job URLs
  const jobUrls = await discoverJobUrls(options);
  discoveredCount = jobUrls.length;

  if (jobUrls.length === 0) {
    console.warn(`[${SOURCE_NAME}] No job URLs discovered.`);
    return {
      discovered: 0,
      fetched: 0,
      inserted: 0,
      updated: 0,
      unchanged: 0,
      failed: 0,
      jobs: [],
      errors: ["No job URLs discovered"],
      durationMs: Date.now() - startTime,
    };
  }

  // Fetch existing YC jobs from DB for change diffing
  const existingJobMap = new Map<string, { id: string; content_hash: string; active: boolean }>();
  if (!isDryRun) {
    try {
      const { data: existingDbJobs } = await supabase
        .from("canonical_jobs")
        .select("id, source_job_id, content_hash, active")
        .eq("source", SOURCE_NAME);

      if (existingDbJobs) {
        for (const ej of existingDbJobs) {
          existingJobMap.set(ej.source_job_id, {
            id: ej.id,
            content_hash: ej.content_hash,
            active: ej.active,
          });
        }
      }
    } catch (dbErr: any) {
      console.warn(`[${SOURCE_NAME}] Could not fetch existing DB jobs: ${dbErr?.message || dbErr}`);
    }
  }

  // 5-7. Fetch & Parse individual job pages with concurrency & isolation
  const queue = [...jobUrls];
  const normalizedJobsToUpsert: any[] = [];
  const seenJobIds = new Set<string>();

  async function worker(_workerId: number) {
    while (queue.length > 0) {
      const url = queue.shift();
      if (!url) break;

      try {
        // Fetch page HTML
        const html = await fetchHtmlWithRetry(url, { timeoutMs });
        fetchedCount++;

        // Parse structured data
        const rawJob = parseJobPage(html, url);

        // Normalize into user schema
        const scrapedJob = normalizeYcJobToScrapedJob(rawJob);
        scrapedJobs.push(scrapedJob);

        // Canonical job for database
        const canonicalJob = normalizeYcJobToCanonical(rawJob);
        const validation = validateNormalizedJob(canonicalJob);

        if (!validation.valid || !validation.sanitizedJob) {
          const errMsg = `Validation failed for ${url}: ${validation.errors?.join(", ")}`;
          console.warn(`[${SOURCE_NAME}] ${errMsg}`);
          errors.push(errMsg);
          failedCount++;
          continue;
        }

        const validJob = validation.sanitizedJob;
        if (seenJobIds.has(validJob.source_job_id)) {
          // Skip in-batch duplicate
          continue;
        }
        seenJobIds.add(validJob.source_job_id);

        const contentHash = computeJobContentHash(validJob);
        const existing = existingJobMap.get(validJob.source_job_id);
        const nowIso = new Date().toISOString();

        if (!existing) {
          insertedCount++;
        } else if (existing.content_hash !== contentHash || !existing.active) {
          updatedCount++;
        } else {
          unchangedCount++;
        }

        normalizedJobsToUpsert.push({
          source: SOURCE_NAME,
          source_job_id: validJob.source_job_id,
          company_name: validJob.company_name,
          company_logo: validJob.company_logo || "/platforms/ycombinator.png",
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

        if (requestDelayMs > 0) {
          await sleep(requestDelayMs);
        }
      } catch (err: any) {
        failedCount++;
        const errStr = `Failed fetching/processing job ${url}: ${err?.message || err}`;
        console.error(`[${SOURCE_NAME}] ${errStr}`);
        errors.push(errStr);
      }
    }
  }

  const workerCount = Math.min(concurrency, jobUrls.length);
  const workers = Array.from({ length: workerCount }, (_, i) => worker(i + 1));
  await Promise.all(workers);

  // 10. Database Upsert (unless dry run)
  if (!isDryRun && normalizedJobsToUpsert.length > 0) {
    const batchSize = 100;
    for (let i = 0; i < normalizedJobsToUpsert.length; i += batchSize) {
      const batch = normalizedJobsToUpsert.slice(i, i + batchSize);
      const { error: upsertErr } = await supabase
        .from("canonical_jobs")
        .upsert(batch, {
          onConflict: "source,source_job_id",
          ignoreDuplicates: false,
        });

      if (upsertErr) {
        const msg = `Database upsert batch error: ${upsertErr.message}`;
        console.error(`[${SOURCE_NAME}] ${msg}`);
        errors.push(msg);
      }
    }

    // Record sync log
    try {
      await supabase.from("sync_logs").insert({
        source: SOURCE_NAME,
        status: errors.length > 0 ? (normalizedJobsToUpsert.length > 0 ? "partial" : "failed") : "success",
        jobs_fetched: fetchedCount,
        jobs_created: insertedCount,
        jobs_updated: updatedCount,
        jobs_unchanged: unchangedCount,
        jobs_deactivated: 0,
        error_message: errors.length > 0 ? errors.slice(0, 3).join("; ") : null,
        duration_ms: Date.now() - startTime,
        created_at: new Date().toISOString(),
      });
    } catch {
      // Ignore sync log failure
    }
  }

  const durationMs = Date.now() - startTime;

  // 11. Structured Logging Output
  console.log(`\n======================================================`);
  console.log(`[${SOURCE_NAME}] discovered=${discoveredCount}`);
  console.log(`[${SOURCE_NAME}] fetched=${fetchedCount}`);
  console.log(`[${SOURCE_NAME}] inserted=${insertedCount}`);
  console.log(`[${SOURCE_NAME}] updated=${updatedCount}`);
  console.log(`[${SOURCE_NAME}] unchanged=${unchangedCount}`);
  console.log(`[${SOURCE_NAME}] failed=${failedCount}`);
  console.log(`[${SOURCE_NAME}] duration=${durationMs}ms`);
  console.log(`======================================================\n`);

  return {
    discovered: discoveredCount,
    fetched: fetchedCount,
    inserted: insertedCount,
    updated: updatedCount,
    unchanged: unchangedCount,
    failed: failedCount,
    jobs: scrapedJobs,
    errors,
    durationMs,
  };
}

/**
 * Adapter implementing JobSourceAdapter for the core ingestion pipeline
 */
export class YCombinatorAdapter implements JobSourceAdapter {
  readonly source = SOURCE_NAME;

  /**
   * Fetches published jobs from YC public pages
   */
  async fetchJobs(_source: JobSourceRecord): Promise<RawJob[]> {
    const urls = await discoverJobUrls({ maxJobs: 50 });
    const rawJobs: RawJob[] = [];

    for (const url of urls) {
      try {
        const html = await fetchHtmlWithRetry(url, { timeoutMs: 15000 });
        const raw = parseJobPage(html, url);
        rawJobs.push(raw);
        await sleep(200);
      } catch (err: any) {
        console.warn(`[${SOURCE_NAME}] Failed to fetch job ${url}: ${err?.message || err}`);
      }
    }

    return rawJobs;
  }

  /**
   * Optionally fetches detailed description if only a summary was available
   */
  async fetchJobDetails(_source: JobSourceRecord, job: RawJob): Promise<RawJobDetails> {
    if (job.description && job.description.length >= 100) {
      return job;
    }
    if (!job.job_url) return job;

    try {
      const html = await fetchHtmlWithRetry(job.job_url, { timeoutMs: 15000 });
      return parseJobPage(html, job.job_url);
    } catch {
      return job;
    }
  }

  /**
   * Normalizes a raw YC job into canonical NormalizedJob format
   */
  normalize(raw: RawJob, source: JobSourceRecord): NormalizedJob {
    return normalizeYcJobToCanonical(raw as YCJobRaw, source);
  }

  /**
   * Health check for Y Combinator jobs page
   */
  async healthCheck(_source: JobSourceRecord): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      const res = await fetch("https://www.ycombinator.com/jobs", {
        method: "HEAD",
        headers: {
          "User-Agent": "Mozilla/5.0",
        },
      });
      return {
        healthy: res.ok,
        latencyMs: Date.now() - startTime,
        message: res.ok ? "Y Combinator jobs board online" : `Status ${res.status}: ${res.statusText}`,
      };
    } catch (err: any) {
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
        message: err?.message || "Y Combinator health check failed",
      };
    }
  }
}
