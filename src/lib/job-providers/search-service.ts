import { NormalizedJob } from "../ingestion/types";
import { computeJobContentHash } from "../ingestion/hasher";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { deduplicateJobs } from "./deduplicator";
import { rankJobs } from "./ranker";
import { jobProviderRegistry, JobProviderRegistry } from "./registry";
import {
  JobProvider,
  JobSearchParams,
  MergedJobRecord,
  ProviderExecutionStatus,
  ProviderSearchResult,
  UnifiedSearchResponse,
} from "./types";

interface CacheEntry {
  response: UnifiedSearchResponse;
  expiresAt: number;
}

export class JobSearchService {
  private readonly registry: JobProviderRegistry;
  private readonly searchCache = new Map<string, CacheEntry>();
  private readonly cacheTtlMs: number;

  constructor(registry: JobProviderRegistry = jobProviderRegistry) {
    this.registry = registry;
    const ttlSeconds = parseInt(process.env.JOB_SEARCH_CACHE_TTL_SECONDS || "300", 10);
    this.cacheTtlMs = (!isNaN(ttlSeconds) && ttlSeconds > 0 ? ttlSeconds : 300) * 1000;
  }

  /**
   * Generates a deterministic cache key from search parameters
   */
  private getCacheKey(params: JobSearchParams): string {
    const q = (params.query || "").toLowerCase().trim();
    const loc = (params.location || "").toLowerCase().trim();
    const c = (params.country || "").toLowerCase().trim();
    const p = params.page || 1;
    const l = params.limit || 20;
    const r = params.remote ? "1" : "0";
    const src = (params.sources || []).sort().join(",");
    const mode = params.mode || "sequential";
    return `${q}:${loc}:${c}:${p}:${l}:${r}:${src}:${mode}`;
  }

  /**
   * Asynchronously persists normalized jobs into Supabase canonical_jobs table
   */
  private async persistJobsToDatabase(jobs: MergedJobRecord[]): Promise<void> {
    if (jobs.length === 0) return;

    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";
      const supabase = createSupabaseClient(url, key);
      const nowIso = new Date().toISOString();


      const jobsToUpsert = jobs.map((job) => ({
        source: job.source,
        source_job_id: job.source_job_id,
        company_name: job.company_name,
        company_logo: job.company_logo || null,
        title: job.title,
        description: job.description || null,
        description_html: job.description_html || null,
        location: job.location || null,
        locations_json: job.locations_json || [],
        country: job.country || null,
        region: job.region || null,
        city: job.city || null,
        remote_type: job.remote_type || null,
        employment_type: job.employment_type || null,
        department: job.department || null,
        team: job.team || null,
        salary_min: job.salary_min || null,
        salary_max: job.salary_max || null,
        salary_currency: job.salary_currency || null,
        salary_interval: job.salary_interval || null,
        job_url: job.job_url,
        apply_url: job.apply_url || job.job_url,
        posted_at: job.posted_at || null,
        updated_at_source: job.updated_at_source || null,
        scraped_at: nowIso,
        last_seen_at: nowIso,
        active: true,
        raw_payload: job.raw_payload || null,
        content_hash: computeJobContentHash(job),
        updated_at: nowIso,
      }));

      await supabase
        .from("canonical_jobs")
        .upsert(jobsToUpsert, { onConflict: "source,source_job_id" });
    } catch (dbErr: unknown) {
      const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
      console.warn("[job-search-service] Non-blocking canonical_jobs DB upsert warning:", msg);
    }
  }

  /**
   * Execute sequential fallback search
   */
  private async executeSequentialSearch(
    providers: JobProvider[],
    params: JobSearchParams
  ): Promise<{
    collectedJobs: NormalizedJob[];
    sourceReports: Record<string, { status: ProviderExecutionStatus; returned: number; latencyMs: number; error?: string }>;
  }> {
    const collectedJobs: NormalizedJob[] = [];
    const sourceReports: Record<string, { status: ProviderExecutionStatus; returned: number; latencyMs: number; error?: string }> = {};
    const targetCount = params.limit || 20;

    for (const provider of providers) {
      if (collectedJobs.length >= targetCount) {
        sourceReports[provider.id] = {
          status: "skipped",
          returned: 0,
          latencyMs: 0,
        };
        continue;
      }

      console.log(`[jobs] [sequential] attempting provider '${provider.id}'...`);
      let result: ProviderSearchResult;
      try {
        result = await provider.search(params);
      } catch (err: unknown) {
        const errorObj = err as Error;
        result = {
          providerId: provider.id,
          providerName: provider.name,
          jobs: [],
          latencyMs: 0,
          status: "error",
          errorMessage: errorObj?.message || String(err),
        };
      }


      sourceReports[provider.id] = {
        status: result.status,
        returned: result.jobs.length,
        latencyMs: result.latencyMs,
        error: result.errorMessage,
      };


      console.log(
        `[${provider.id}] status=${result.status} results=${result.jobs.length} latency=${result.latencyMs}ms${
          result.errorMessage ? ` error="${result.errorMessage}"` : ""
        }`
      );

      if (result.jobs.length > 0) {
        collectedJobs.push(...result.jobs);
      }

      // Check if threshold reached or if we should fallback to next provider
      const threshold = provider.minResultsThreshold ?? 5;
      if (result.jobs.length < threshold && collectedJobs.length < targetCount) {
        console.log(
          `[jobs] provider '${provider.id}' returned insufficient results (${result.jobs.length} < ${threshold}). Falling back to next eligible provider.`
        );
      }
    }

    return { collectedJobs, sourceReports };
  }

  /**
   * Execute parallel aggregation search across all eligible providers
   */
  private async executeParallelSearch(
    providers: JobProvider[],
    params: JobSearchParams
  ): Promise<{
    collectedJobs: NormalizedJob[];
    sourceReports: Record<string, { status: ProviderExecutionStatus; returned: number; latencyMs: number; error?: string }>;
  }> {
    const collectedJobs: NormalizedJob[] = [];
    const sourceReports: Record<string, { status: ProviderExecutionStatus; returned: number; latencyMs: number; error?: string }> = {};

    console.log(`[jobs] [parallel] dispatching to ${providers.length} providers concurrently...`);

    const promises = providers.map(async (provider) => {
      try {
        const result = await provider.search(params);
        return { providerId: provider.id, result };
      } catch (err: unknown) {
        const errorObj = err as Error;
        return {
          providerId: provider.id,
          result: {
            providerId: provider.id,
            providerName: provider.name,
            jobs: [],
            latencyMs: 0,
            status: "error" as ProviderExecutionStatus,
            errorMessage: errorObj?.message || String(err),
          },
        };
      }
    });

    const results = await Promise.allSettled(promises);

    for (const res of results) {
      if (res.status === "fulfilled") {
        const { providerId, result } = res.value;
        sourceReports[providerId] = {
          status: result.status,
          returned: result.jobs.length,
          latencyMs: result.latencyMs,
          error: result.errorMessage,
        };

        console.log(
          `[${providerId}] status=${result.status} results=${result.jobs.length} latency=${result.latencyMs}ms`
        );

        if (result.jobs.length > 0) {
          collectedJobs.push(...result.jobs);
        }
      }
    }

    return { collectedJobs, sourceReports };
  }

  /**
   * Main Search entrypoint: handles routing, fallback, deduplication, ranking, caching, and persistence
   */
  async search(params: JobSearchParams = {}): Promise<UnifiedSearchResponse> {
    const startTime = Date.now();
    const cacheKey = this.getCacheKey(params);
    const mode = params.mode || (process.env.JOB_SEARCH_DEFAULT_MODE === "parallel" ? "parallel" : "sequential");

    const page = Math.max(1, params.page || 1);
    const limit = Math.min(50, Math.max(1, params.limit || 20));

    // 1. Check in-memory cache (unless explicit force refresh)
    const cached = this.searchCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      console.log(`[jobs] serving search results from cache for query="${params.query || ""}"`);
      return {
        ...cached.response,
        stats: {
          ...cached.response.stats,
          cached: true,
          totalDurationMs: Date.now() - startTime,
        },
      };
    }

    console.log(
      `[jobs] search_started query="${params.query || ""}" location="${params.location || ""}" country="${
        params.country || ""
      }" mode=${mode}`
    );

    // 2. Discover eligible providers
    const eligibleProviders = this.registry.getEligibleProviders(params);

    if (eligibleProviders.length === 0) {
      return {
        jobs: [],
        pagination: { page, limit, total: 0, hasMore: false },
        sources: {},
        stats: {
          totalFetched: 0,
          totalMerged: 0,
          duplicatesRemoved: 0,
          totalDurationMs: Date.now() - startTime,
          cached: false,
          mode,
        },
      };
    }

    // 3. Execute Search according to selected mode (sequential fallback vs parallel)
    const { collectedJobs, sourceReports } =
      mode === "parallel"
        ? await this.executeParallelSearch(eligibleProviders, params)
        : await this.executeSequentialSearch(eligibleProviders, params);

    // 4. Deduplicate across providers
    const { mergedJobs, duplicatesCount } = deduplicateJobs(collectedJobs);

    // 5. Deterministic Ranking
    const rankedJobs = rankJobs(mergedJobs, params);

    // 6. Pagination
    const startIndex = (page - 1) * limit;
    const paginatedJobs = rankedJobs.slice(startIndex, startIndex + limit);

    console.log(
      `[jobs] fetched=${collectedJobs.length} merged=${rankedJobs.length} duplicates_removed=${duplicatesCount} returned=${paginatedJobs.length}`
    );

    const totalDurationMs = Date.now() - startTime;

    const response: UnifiedSearchResponse = {
      jobs: paginatedJobs,
      pagination: {
        page,
        limit,
        total: rankedJobs.length,
        hasMore: startIndex + limit < rankedJobs.length,
      },
      sources: sourceReports,
      stats: {
        totalFetched: collectedJobs.length,
        totalMerged: rankedJobs.length,
        duplicatesRemoved: duplicatesCount,
        totalDurationMs,
        cached: false,
        mode,
      },
    };

    // 7. Store in search cache
    if (this.cacheTtlMs > 0 && paginatedJobs.length > 0) {
      this.searchCache.set(cacheKey, {
        response,
        expiresAt: Date.now() + this.cacheTtlMs,
      });
    }

    // 8. Database Persistence (non-blocking)
    if (params.persist !== false && paginatedJobs.length > 0) {
      this.persistJobsToDatabase(paginatedJobs).catch(() => {});
    }

    return response;
  }

  /**
   * Clear in-memory cache
   */
  clearCache(): void {
    this.searchCache.clear();
  }
}

// Global Singleton Search Service
export const jobSearchService = new JobSearchService();
