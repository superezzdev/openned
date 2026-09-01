import { HealthCheckResult, NormalizedJob } from "../ingestion/types";

export type SearchMode = "sequential" | "parallel";

export interface JobSearchParams {
  query?: string;
  location?: string;
  country?: string;
  page?: number;
  limit?: number;
  remote?: boolean;
  employmentType?: string[]; // e.g. ["full-time", "contract", "internship"]
  datePosted?: string; // "all" | "today" | "3d" | "7d" | "30d"
  salaryMin?: number;
  experienceLevel?: string; // "entry" | "mid" | "senior" | "lead"
  sources?: string[]; // e.g. ["jsearch", "adzuna", "jobicy"]
  platform?: string;
  mode?: SearchMode;
  forceRefresh?: boolean;
  persist?: boolean;
}


export type ProviderExecutionStatus =
  | "success"
  | "insufficient_results"
  | "empty"
  | "error"
  | "rate_limited"
  | "timeout"
  | "circuit_open"
  | "skipped";

export interface ProviderSearchResult {
  providerId: string;
  providerName: string;
  jobs: NormalizedJob[];
  total?: number;
  hasMore?: boolean;
  latencyMs: number;
  status: ProviderExecutionStatus;
  errorMessage?: string;
  httpStatus?: number;
}

export interface ProviderConfig {
  id: string;
  name: string;
  priority: number; // Lower number = higher priority (1 is highest)
  enabled: boolean;
  timeoutMs: number;
  maxRetries: number;
  minResultsThreshold?: number; // e.g. if provider returns fewer than 5 results, try fallback
}

export interface JobProvider extends ProviderConfig {
  search(params: JobSearchParams): Promise<ProviderSearchResult>;
  supports(params: JobSearchParams): boolean;
  healthCheck?(): Promise<HealthCheckResult>;
}

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface ProviderHealth {
  providerId: string;
  providerName: string;
  status: "healthy" | "degraded" | "down";
  circuitState: CircuitState;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastFailureAt?: Date;
  lastSuccessAt?: Date;
  lastErrorMessage?: string;
  averageLatencyMs: number;
  totalRequests: number;
  cooldownUntil?: Date;
}

export interface MergedJobRecord extends NormalizedJob {
  matched_sources?: string[];
  relevance_score?: number;
}

export interface UnifiedSearchResponse {
  jobs: MergedJobRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
  sources: Record<
    string,
    {
      status: ProviderExecutionStatus;
      returned: number;
      latencyMs: number;
      error?: string;
    }
  >;
  stats: {
    totalFetched: number;
    totalMerged: number;
    duplicatesRemoved: number;
    totalDurationMs: number;
    cached?: boolean;
    mode: SearchMode;
  };
}
