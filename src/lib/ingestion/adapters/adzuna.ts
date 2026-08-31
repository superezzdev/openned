import {
  HealthCheckResult,
  JobSourceAdapter,
  JobSourceRecord,
  NormalizedJob,
  RawJob,
  RawJobDetails,
} from "../types";
import {
  classifyEmploymentType,
  classifyRemoteType,
  htmlToPlainText,
  normalizeIsoDate,
  sanitizeHtml,
} from "../normalizer";
import { calculateBackoff } from "../http-client";

export const SOURCE_NAME = "adzuna" as const;

export interface AdzunaCredentials {
  appId: string;
  appKey: string;
  country: string;
}

export interface AdzunaSearchParams {
  query?: string;
  location?: string;
  country?: string;
  page?: number;
  resultsPerPage?: number;
  sortBy?: "date" | "relevance" | "salary";
  salaryMin?: number;
  salaryMax?: number;
  fullTime?: boolean;
  contract?: boolean;
  permanent?: boolean;
  maxDaysOld?: number;
  category?: string;
}

export interface AdzunaLocation {
  __CLASS__?: string;
  area?: string[];
  display_name?: string;
}

export interface AdzunaCompany {
  __CLASS__?: string;
  display_name?: string;
}

export interface AdzunaCategory {
  __CLASS__?: string;
  label?: string;
  tag?: string;
}

export interface AdzunaRawJob {
  id?: string | number;
  title?: string;
  description?: string;
  redirect_url?: string;
  created?: string;
  company?: AdzunaCompany;
  location?: AdzunaLocation;
  salary_min?: number;
  salary_max?: number;
  salary_is_predicted?: number | string | boolean;
  contract_type?: string;
  contract_time?: string;
  category?: AdzunaCategory;
  adref?: string;
  latitude?: number;
  longitude?: number;
  [key: string]: unknown;
}

export interface AdzunaApiResponse {
  results?: AdzunaRawJob[];
  count?: number;
  mean?: number;
  [key: string]: unknown;
}

export interface AdzunaSearchResult {
  source: "adzuna";
  jobs: NormalizedJob[];
  pagination: {
    page: number;
    resultsPerPage: number;
    total: number;
  };
}

export class AdzunaError extends Error {
  readonly code: string;
  readonly status?: number;

  constructor(code: string, message: string, status?: number) {
    super(message);
    this.name = "AdzunaError";
    this.code = code;
    this.status = status;
  }
}

/**
 * Safely retrieve Adzuna API credentials from environment variables without throwing secrets
 */
export function getAdzunaCredentials(overrideCountry?: string): AdzunaCredentials {
  const appId = process.env.ADZUNA_APP_ID?.trim();
  const appKey = process.env.ADZUNA_APP_KEY?.trim();
  const country = (overrideCountry || process.env.ADZUNA_COUNTRY || "in").trim().toLowerCase();

  if (!appId || !appKey) {
    throw new AdzunaError(
      "ADZUNA_CONFIGURATION_ERROR",
      "Adzuna API credentials (ADZUNA_APP_ID / ADZUNA_APP_KEY) are not configured.",
      500
    );
  }

  return { appId, appKey, country };
}

/**
 * Currency resolver based on country code
 */
function getCurrencyForCountry(country: string): string {
  const c = country.toLowerCase();
  switch (c) {
    case "in":
      return "INR";
    case "gb":
    case "uk":
      return "GBP";
    case "us":
      return "USD";
    case "ca":
      return "CAD";
    case "au":
      return "AUD";
    case "de":
    case "fr":
    case "nl":
    case "it":
    case "es":
    case "at":
    case "be":
      return "EUR";
    case "sg":
      return "SGD";
    case "nz":
      return "NZD";
    case "za":
      return "ZAR";
    default:
      return "USD";
  }
}

/**
 * Normalizes a raw Adzuna job into the canonical NormalizedJob schema
 */
export function normalizeAdzunaJob(raw: AdzunaRawJob | RawJob, sourceRecord?: JobSourceRecord): NormalizedJob {
  const rawId = String(raw.id || raw.source_job_id || raw.adref || "").trim();
  const title = String(raw.title || "").trim();
  const companyName = String(raw.company?.display_name || sourceRecord?.company_name || "Company").trim();
  const jobUrl = String(raw.redirect_url || raw.job_url || raw.url || "").trim();
  const applyUrl = jobUrl;

  // Extract location fields
  let locationName = "";
  const locationsJson: string[] = [];
  let city: string | null = null;
  let region: string | null = null;
  let country: string | null = null;

  if (raw.location?.display_name) {
    locationName = String(raw.location.display_name).trim();
    locationsJson.push(locationName);
  }

  if (Array.isArray(raw.location?.area)) {
    const areas = (raw.location.area as unknown[]).filter((a): a is string => typeof a === "string" && Boolean(a.trim()));
    if (areas.length > 0) {
      if (areas.length >= 1) country = areas[0];
      if (areas.length >= 2) region = areas[1];
      if (areas.length >= 3) city = areas[areas.length - 1];

      for (const a of areas) {
        if (!locationsJson.includes(a)) {
          locationsJson.push(a);
        }
      }
      if (!locationName) {
        locationName = areas.join(", ");
      }
    }
  }

  // Description extraction & sanitization
  const rawDesc = raw.description || "";
  const descriptionHtml = sanitizeHtml(rawDesc.includes("<") ? rawDesc : `<p>${rawDesc}</p>`);
  const descriptionPlain = rawDesc.includes("<") ? htmlToPlainText(descriptionHtml) : rawDesc.trim();

  // Remote & Employment classification
  const isRemote =
    title.toLowerCase().includes("remote") ||
    locationName.toLowerCase().includes("remote") ||
    descriptionPlain.toLowerCase().includes("work from home") ||
    descriptionPlain.toLowerCase().includes("100% remote");

  const remoteType = classifyRemoteType(
    locationName,
    null,
    isRemote,
    `${title} ${descriptionPlain}`
  );

  let rawEmployment = raw.contract_time || raw.contract_type || "";
  if (raw.contract_time === "full_time" || raw.contract_type === "permanent") {
    rawEmployment = "full-time";
  } else if (raw.contract_time === "part_time") {
    rawEmployment = "part-time";
  } else if (raw.contract_type === "contract") {
    rawEmployment = "contract";
  }

  const employmentType = classifyEmploymentType(rawEmployment, title);

  // Salary parsing
  const salaryMin = typeof raw.salary_min === "number" && !isNaN(raw.salary_min) ? raw.salary_min : null;
  const salaryMax = typeof raw.salary_max === "number" && !isNaN(raw.salary_max) ? raw.salary_max : null;
  let salaryCurrency: string | null = null;
  let salaryInterval: "yearly" | "monthly" | "hourly" | null = null;

  if (salaryMin !== null || salaryMax !== null) {
    const defaultCountry = (sourceRecord?.metadata?.country || process.env.ADZUNA_COUNTRY || "in").toLowerCase();
    salaryCurrency = getCurrencyForCountry(defaultCountry);
    salaryInterval = "yearly";
  }

  // Department from category
  const department = raw.category?.label || raw.category?.tag || null;

  return {
    source: SOURCE_NAME,
    source_job_id: rawId,
    company_name: companyName,
    company_logo: sourceRecord?.company_logo || "/platforms/adzuna.svg",
    title,
    description: descriptionPlain || `Position at ${companyName}`,
    description_html: descriptionHtml,
    location: locationName || (remoteType === "remote" ? "Remote" : "India"),
    locations_json: locationsJson,
    country: country || null,
    region: region || null,
    city: city || null,
    remote_type: remoteType,
    employment_type: employmentType,
    department: department ? String(department).trim() : null,
    team: null,
    salary_min: salaryMin,
    salary_max: salaryMax,
    salary_currency: salaryCurrency,
    salary_interval: salaryInterval,
    job_url: jobUrl,
    apply_url: applyUrl,
    posted_at: normalizeIsoDate(raw.created),
    updated_at_source: normalizeIsoDate(raw.created),
    raw_payload: raw,
  };
}

export interface AdzunaFetchOptions {
  maxRetries?: number;
  timeoutMs?: number;
  baseDelayMs?: number;
}

/**
 * Fetch raw job listings from Adzuna API with exponential backoff & rate limit handling
 */
export async function fetchAdzunaJobs(
  params: AdzunaSearchParams = {},
  fetchOptions: AdzunaFetchOptions = {}
): Promise<AdzunaApiResponse> {
  const creds = getAdzunaCredentials(params.country);
  const page = Math.max(1, params.page || 1);
  const resultsPerPage = Math.min(50, Math.max(1, params.resultsPerPage || 20));
  const country = creds.country;

  // Build Adzuna URL
  const baseUrl = `https://api.adzuna.com/v1/api/jobs/${encodeURIComponent(country)}/search/${page}`;
  const queryParams = new URLSearchParams({
    app_id: creds.appId,
    app_key: creds.appKey,
    results_per_page: String(resultsPerPage),
    "content-type": "application/json",
  });

  if (params.query?.trim()) {
    queryParams.set("what", params.query.trim());
  }
  if (params.location?.trim()) {
    queryParams.set("where", params.location.trim());
  }
  if (params.sortBy) {
    queryParams.set("sort_by", params.sortBy);
  }
  if (params.salaryMin && params.salaryMin > 0) {
    queryParams.set("salary_min", String(params.salaryMin));
  }
  if (params.salaryMax && params.salaryMax > 0) {
    queryParams.set("salary_max", String(params.salaryMax));
  }
  if (params.fullTime) {
    queryParams.set("full_time", "1");
  }
  if (params.contract) {
    queryParams.set("contract", "1");
  }
  if (params.permanent) {
    queryParams.set("permanent", "1");
  }
  if (params.maxDaysOld && params.maxDaysOld > 0) {
    queryParams.set("max_days_old", String(params.maxDaysOld));
  }
  if (params.category?.trim()) {
    queryParams.set("category", params.category.trim());
  }

  const requestUrl = `${baseUrl}?${queryParams.toString()}`;

  // Safe structured log (never log app_key)
  console.log(
    `[${SOURCE_NAME}] request_started query="${params.query || ""}" location="${params.location || ""}" country="${country}" page=${page} per_page=${resultsPerPage}`
  );

  const maxRetries = fetchOptions.maxRetries ?? 3;
  const timeoutMs = fetchOptions.timeoutMs ?? 20000;
  const baseDelayMs = fetchOptions.baseDelayMs ?? 1000;
  let attempt = 0;

  while (attempt <= maxRetries) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(requestUrl, {
        method: "GET",
        signal: controller.signal,
        headers: {
          "Accept": "application/json",
          "User-Agent": "Openned-JobIngestion/1.0 (+https://openned.dev)",
        },
      });

      clearTimeout(timeoutId);

      // Handle 401 / 403 Authentication Errors (DO NOT RETRY)
      if (res.status === 401 || res.status === 403) {
        throw new AdzunaError(
          "ADZUNA_AUTHENTICATION_ERROR",
          "Invalid or unauthorized Adzuna API credentials.",
          res.status
        );
      }

      // Handle 429 Rate Limit Error
      if (res.status === 429) {
        if (attempt < maxRetries) {
          const retryAfter = res.headers.get("Retry-After");
          const delayMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : calculateBackoff(attempt, baseDelayMs, 10000);
          console.warn(`[${SOURCE_NAME}] [HTTP 429] Rate limited. Retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          attempt++;
          continue;
        }
        throw new AdzunaError("ADZUNA_RATE_LIMIT_ERROR", "Adzuna API rate limit exceeded.", 429);
      }

      // Handle 5xx Server Errors
      if (res.status >= 500 && res.status <= 504) {
        if (attempt < maxRetries) {
          const delayMs = calculateBackoff(attempt, baseDelayMs, 8000);
          console.warn(`[${SOURCE_NAME}] [HTTP ${res.status}] Server error. Retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          attempt++;
          continue;
        }
        throw new AdzunaError("ADZUNA_API_ERROR", `Adzuna API returned HTTP ${res.status}: ${res.statusText}`, res.status);
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new AdzunaError(
          "ADZUNA_API_ERROR",
          `Adzuna API request failed (HTTP ${res.status}): ${errText.slice(0, 200)}`,
          res.status
        );
      }

      const data: AdzunaApiResponse = await res.json();
      const results = Array.isArray(data.results) ? data.results : [];
      const total = typeof data.count === "number" ? data.count : results.length;

      console.log(`[${SOURCE_NAME}] response_received results=${results.length} total=${total}`);
      return data;
    } catch (err: unknown) {
      clearTimeout(timeoutId);

      if (err instanceof AdzunaError) {
        throw err;
      }

      const errorObj = err as Error;
      const isTimeout = errorObj.name === "AbortError";
      const isNetwork = errorObj.message?.includes("fetch failed") || isTimeout;

      if (isNetwork && attempt < maxRetries) {
        const delayMs = calculateBackoff(attempt, baseDelayMs, 8000);
        console.warn(`[${SOURCE_NAME}] Network error: ${isTimeout ? "Timeout" : errorObj.message}. Retrying in ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        attempt++;
        continue;
      }

      throw new AdzunaError(
        isTimeout ? "ADZUNA_TIMEOUT_ERROR" : "ADZUNA_NETWORK_ERROR",
        `Network failure while reaching Adzuna: ${errorObj.message || String(err)}`,
        503
      );
    }
  }

  throw new AdzunaError("ADZUNA_API_ERROR", `Failed to complete Adzuna request after ${maxRetries} retries`, 500);
}

/**
 * Public search function that returns normalized jobs and pagination
 */
export async function searchAdzunaJobs(params: AdzunaSearchParams = {}): Promise<AdzunaSearchResult> {
  const page = Math.max(1, params.page || 1);
  const resultsPerPage = Math.min(50, Math.max(1, params.resultsPerPage || 20));

  const response = await fetchAdzunaJobs(params);
  const rawJobs = Array.isArray(response.results) ? response.results : [];
  const normalizedJobs: NormalizedJob[] = [];

  for (const raw of rawJobs) {
    try {
      const normalized = normalizeAdzunaJob(raw);
      if (normalized.title && normalized.job_url && normalized.source_job_id) {
        normalizedJobs.push(normalized);
      }
    } catch (normalizeErr: unknown) {
      const msg = normalizeErr instanceof Error ? normalizeErr.message : String(normalizeErr);
      console.warn(`[${SOURCE_NAME}] Failed to normalize Adzuna job ${raw?.id}:`, msg);
    }
  }

  console.log(`[${SOURCE_NAME}] normalized=${normalizedJobs.length}`);

  return {
    source: "adzuna",
    jobs: normalizedJobs,
    pagination: {
      page,
      resultsPerPage,
      total: typeof response.count === "number" ? response.count : normalizedJobs.length,
    },
  };
}

/**
 * Adzuna JobSourceAdapter for the ingestion pipeline
 */
export class AdzunaAdapter implements JobSourceAdapter {
  readonly source = SOURCE_NAME;

  /**
   * Fetch jobs for a configured Adzuna source record
   */
  async fetchJobs(source: JobSourceRecord): Promise<RawJob[]> {
    const query = source.source_identifier || source.company_name || "";
    const country = source.metadata?.country || process.env.ADZUNA_COUNTRY || "in";

    try {
      const data = await fetchAdzunaJobs({
        query: query === "adzuna-jobs" || query === "all" ? undefined : query,
        location: source.metadata?.location,
        country,
        resultsPerPage: source.metadata?.resultsPerPage || 30,
      });
      return Array.isArray(data.results) ? data.results : [];
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[${SOURCE_NAME}] fetchJobs error for source ${source.id}:`, msg);
      throw err;
    }
  }

  /**
   * Fetch detailed job data if needed
   */
  async fetchJobDetails(source: JobSourceRecord, job: RawJob): Promise<RawJobDetails> {
    return job;
  }

  /**
   * Normalize an Adzuna raw job
   */
  normalize(raw: RawJob, source?: JobSourceRecord): NormalizedJob {
    return normalizeAdzunaJob(raw as AdzunaRawJob, source);
  }

  /**
   * Health check for Adzuna API
   */
  async healthCheck(source: JobSourceRecord): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      const creds = getAdzunaCredentials(source.metadata?.country);
      const url = `https://api.adzuna.com/v1/api/jobs/${encodeURIComponent(creds.country)}/search/1?app_id=${creds.appId}&app_key=${creds.appKey}&results_per_page=1&content-type=application/json`;

      const res = await fetch(url, {
        method: "GET",
        headers: { "Accept": "application/json" },
      });

      const latencyMs = Date.now() - startTime;
      return {
        healthy: res.ok,
        latencyMs,
        message: res.ok ? "Adzuna API online" : `Status ${res.status}: ${res.statusText}`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Adzuna health check failed";
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
        message: msg,
      };
    }
  }
}
