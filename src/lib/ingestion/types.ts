export type JobSource = "greenhouse" | "lever" | "ashby" | "workable" | "wellfound" | "custom";

export type RemoteType = "remote" | "hybrid" | "onsite";
export type EmploymentType = "full-time" | "part-time" | "contract" | "internship";
export type SalaryInterval = "yearly" | "monthly" | "hourly";

export interface JobSourceRecord {
  id: string;
  source: JobSource;
  source_name: string;
  source_identifier: string; // e.g. "stripe", "figma", "openai"
  company_name: string;
  company_logo?: string | null;
  source_url: string;
  enabled: boolean;
  last_synced_at?: string | null;
  last_success_at?: string | null;
  last_error_at?: string | null;
  last_error_message?: string | null;
  consecutive_failures: number;
  metadata?: Record<string, any> | null;
  created_at?: string;
  updated_at?: string;
}

export interface DiscoveredSource {
  source: JobSource;
  source_name: string;
  source_identifier: string;
  company_name: string;
  company_logo?: string | null;
  source_url: string;
  metadata?: Record<string, any>;
}

export interface RawJob {
  [key: string]: any;
}

export interface RawJobDetails {
  [key: string]: any;
}

export interface NormalizedJob {
  source: JobSource;
  source_job_id: string;
  company_name: string;
  company_logo?: string | null;
  title: string;
  description?: string | null;
  description_html?: string | null;
  location?: string | null;
  locations_json?: string[] | { city?: string; region?: string; country?: string; address?: string }[];
  country?: string | null;
  region?: string | null;
  city?: string | null;
  remote_type?: RemoteType | null;
  employment_type?: EmploymentType | null;
  department?: string | null;
  team?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string | null;
  salary_interval?: SalaryInterval | null;
  job_url: string;
  apply_url: string;
  posted_at?: string | null;
  updated_at_source?: string | null;
  raw_payload?: Record<string, any> | null;
}

export interface CanonicalJobRecord extends NormalizedJob {
  id: string;
  source_id?: string | null;
  scraped_at: string;
  first_seen_at: string;
  last_seen_at: string;
  active: boolean;
  content_hash: string;
  created_at: string;
  updated_at: string;
}

export interface HealthCheckResult {
  healthy: boolean;
  latencyMs: number;
  message?: string;
}

export interface JobSourceAdapter {
  source: JobSource;
  discoverSources?(companyQuery?: string): Promise<DiscoveredSource[]>;
  fetchJobs(source: JobSourceRecord): Promise<RawJob[]>;
  fetchJobDetails?(source: JobSourceRecord, job: RawJob): Promise<RawJobDetails>;
  normalize(raw: RawJob | RawJobDetails, source: JobSourceRecord): NormalizedJob;
  healthCheck?(source: JobSourceRecord): Promise<HealthCheckResult>;
}

export interface SyncStats {
  jobsFetched: number;
  jobsCreated: number;
  jobsUpdated: number;
  jobsUnchanged: number;
  jobsDeactivated: number;
  durationMs: number;
  errors: string[];
}

export interface SyncResult {
  sourceId: string;
  sourceIdentifier: string;
  source: JobSource;
  success: boolean;
  stats: SyncStats;
  errorMessage?: string | null;
}

export interface SyncOptions {
  sourceFilter?: JobSource;
  companyFilter?: string; // id, slug, or company name
  dryRun?: boolean;
  concurrency?: number;
  limit?: number; // max sources to sync
}
