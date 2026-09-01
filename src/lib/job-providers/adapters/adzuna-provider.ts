import { searchAdzunaJobs, AdzunaError } from "../../ingestion/adapters/adzuna";
import { HealthCheckResult } from "../../ingestion/types";
import { globalCircuitBreaker } from "../circuit-breaker";
import { JobProvider, JobSearchParams, ProviderSearchResult } from "../types";

export class AdzunaProvider implements JobProvider {
  readonly id = "adzuna";
  readonly name = "Adzuna";
  readonly priority = 14;
  readonly enabled = true;
  readonly timeoutMs = 15000;
  readonly maxRetries = 2;
  readonly minResultsThreshold = 5;

  supports(): boolean {
    return true;
  }

  async search(params: JobSearchParams): Promise<ProviderSearchResult> {
    const startTime = Date.now();

    // 1. Circuit Breaker Check
    if (!globalCircuitBreaker.canExecute(this.id, this.name)) {
      return {
        providerId: this.id,
        providerName: this.name,
        jobs: [],
        latencyMs: 0,
        status: "circuit_open",
        errorMessage: `Adzuna circuit breaker is OPEN due to repeated failures`,
      };
    }

    const page = Math.max(1, params.page || 1);
    const limit = Math.min(50, Math.max(1, params.limit || 20));

    try {
      const result = await searchAdzunaJobs({
        query: params.query || undefined,
        location: params.location || undefined,
        country: params.country || undefined,
        page,
        resultsPerPage: limit,
      });

      const latencyMs = Date.now() - startTime;
      globalCircuitBreaker.recordSuccess(this.id, latencyMs, this.name);

      return {
        providerId: this.id,
        providerName: this.name,
        jobs: result.jobs,
        total: result.pagination.total,
        hasMore: result.jobs.length >= limit,
        latencyMs,
        status: result.jobs.length === 0 ? "empty" : "success",
      };
    } catch (err: unknown) {
      const latencyMs = Date.now() - startTime;
      const adzunaErr = err instanceof AdzunaError ? err : null;
      const errorMsg = err instanceof Error ? err.message : String(err);

      const isRateLimit = adzunaErr?.status === 429;
      const isTimeout = adzunaErr?.code === "ADZUNA_TIMEOUT_ERROR";

      globalCircuitBreaker.recordFailure(
        this.id,
        {
          is429: isRateLimit,
          isTimeout,
          message: errorMsg,
          latencyMs,
        },
        this.name
      );

      return {
        providerId: this.id,
        providerName: this.name,
        jobs: [],
        latencyMs,
        status: isRateLimit ? "rate_limited" : isTimeout ? "timeout" : "error",
        errorMessage: errorMsg,
        httpStatus: adzunaErr?.status,
      };
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      const result = await this.search({ query: "developer", limit: 1 });
      return {
        healthy: result.status === "success" || result.status === "empty",
        latencyMs: Date.now() - startTime,
        message: result.errorMessage || "Adzuna provider is healthy",
      };
    } catch (err: unknown) {
      const errorObj = err as Error;
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
        message: errorObj?.message || String(err),
      };
    }
  }
}

