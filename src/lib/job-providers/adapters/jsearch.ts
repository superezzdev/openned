import { NormalizedJob } from "../../ingestion/types";
import { classifyEmploymentType, classifyRemoteType, normalizeIsoDate, sanitizeHtml } from "../../ingestion/normalizer";
import { executeRapidApiRequest } from "../rapidapi-client";
import { JobProvider, JobSearchParams, ProviderSearchResult } from "../types";

export interface JSearchRawJob {
  job_id?: string;
  job_title?: string;
  employer_name?: string;
  employer_logo?: string;
  employer_website?: string;
  job_publisher?: string;
  job_employment_type?: string;
  job_apply_link?: string;
  job_description?: string;
  job_is_remote?: boolean;
  job_city?: string;
  job_state?: string;
  job_country?: string;
  job_latitude?: number;
  job_longitude?: number;
  job_posted_at_datetime_utc?: string;
  job_posted_at_timestamp?: number;
  job_min_salary?: number;
  job_max_salary?: number;
  job_salary_currency?: string;
  job_salary_period?: string;
  [key: string]: unknown;
}

export function normalizeJSearchJob(raw: JSearchRawJob): NormalizedJob | null {
  const jobId = String(raw.job_id || "").trim();
  const title = String(raw.job_title || "").trim();
  const company = String(raw.employer_name || "Company").trim();
  const jobUrl = String(raw.job_apply_link || raw.employer_website || "").trim();

  if (!jobId || !title || !jobUrl) return null;

  const city = raw.job_city || null;
  const region = raw.job_state || null;
  const country = raw.job_country || null;
  const locationParts: string[] = [city, region, country].filter((p): p is string => Boolean(p));
  const locationStr = locationParts.length > 0 ? locationParts.join(", ") : raw.job_is_remote ? "Remote" : "USA";


  const rawDesc = raw.job_description || "";
  const descHtml = sanitizeHtml(rawDesc.includes("<") ? rawDesc : `<p>${rawDesc}</p>`);

  const remoteType = classifyRemoteType(locationStr, null, raw.job_is_remote, `${title} ${rawDesc}`);
  const employmentType = classifyEmploymentType(raw.job_employment_type, title);

  let salaryInterval: "yearly" | "monthly" | "hourly" | null = null;
  if (raw.job_salary_period) {
    const p = raw.job_salary_period.toLowerCase();
    if (p.includes("hour")) salaryInterval = "hourly";
    else if (p.includes("month")) salaryInterval = "monthly";
    else salaryInterval = "yearly";
  }

  return {
    source: "jsearch",
    source_job_id: jobId,
    company_name: company,
    company_logo: raw.employer_logo || "/platforms/jsearch.svg",
    title,
    description: rawDesc || `Job opening at ${company}`,
    description_html: descHtml,
    location: locationStr,
    locations_json: locationParts,
    country,
    region,
    city,
    remote_type: remoteType,
    employment_type: employmentType,
    department: null,
    team: null,
    salary_min: typeof raw.job_min_salary === "number" ? raw.job_min_salary : null,
    salary_max: typeof raw.job_max_salary === "number" ? raw.job_max_salary : null,
    salary_currency: raw.job_salary_currency || (raw.job_min_salary ? "USD" : null),
    salary_interval: salaryInterval,
    job_url: jobUrl,
    apply_url: jobUrl,
    posted_at: normalizeIsoDate(raw.job_posted_at_datetime_utc),
    updated_at_source: normalizeIsoDate(raw.job_posted_at_datetime_utc),
    raw_payload: raw,
  };
}

export class JSearchProvider implements JobProvider {
  readonly id = "jsearch";
  readonly name = "JSearch";
  readonly priority = 1;
  readonly enabled = true;
  readonly timeoutMs = 12000;
  readonly maxRetries = 2;
  readonly minResultsThreshold = 5;

  supports(params: JobSearchParams): boolean {
    return Boolean(params.query || params.location || params.country);
  }

  async search(params: JobSearchParams): Promise<ProviderSearchResult> {
    const page = Math.max(1, params.page || 1);
    const country = (params.country || "us").toLowerCase();
    const queryParts = [params.query, params.location, params.remote ? "remote" : ""].filter(Boolean);
    const query = queryParts.join(" ") || "developer";

    const urlParams = new URLSearchParams({
      query,
      page: String(page),
      num_pages: "1",
      country,
    });

    if (params.datePosted) {
      urlParams.set("date_posted", params.datePosted === "today" ? "today" : params.datePosted === "3d" ? "3days" : "all");
    }

    if (params.employmentType && params.employmentType.length > 0) {
      urlParams.set("employment_types", params.employmentType.join(",").toUpperCase());
    }

    try {
      // Try search-v2 endpoint first, then search if needed
      const response = await executeRapidApiRequest<{
        status?: string;
        data?: JSearchRawJob[] | { jobs?: JSearchRawJob[] };
      }>({
        providerId: this.id,
        providerName: this.name,
        host: "jsearch.p.rapidapi.com",
        url: `https://jsearch.p.rapidapi.com/search-v2?${urlParams.toString()}`,
        timeoutMs: this.timeoutMs,
        maxRetries: this.maxRetries,
      });

      let rawList: JSearchRawJob[] = [];
      const resData = response.data?.data;
      if (Array.isArray(resData)) {
        rawList = resData;
      } else if (resData && typeof resData === "object" && Array.isArray((resData as { jobs?: JSearchRawJob[] }).jobs)) {
        rawList = (resData as { jobs: JSearchRawJob[] }).jobs;
      } else if (Array.isArray(response.data)) {
        rawList = response.data;
      }

      const normalizedJobs: NormalizedJob[] = [];
      for (const raw of rawList) {
        const norm = normalizeJSearchJob(raw);
        if (norm) normalizedJobs.push(norm);
      }

      return {
        providerId: this.id,
        providerName: this.name,
        jobs: normalizedJobs,
        total: normalizedJobs.length,
        hasMore: normalizedJobs.length >= 10,
        latencyMs: response.latencyMs,
        status: normalizedJobs.length === 0 ? "empty" : "success",
      };
    } catch (err: unknown) {
      const errorObj = err as Error & { isRateLimit?: boolean; isTimeout?: boolean };
      return {
        providerId: this.id,
        providerName: this.name,
        jobs: [],
        latencyMs: 0,
        status: errorObj.isRateLimit ? "rate_limited" : errorObj.isTimeout ? "timeout" : "error",
        errorMessage: errorObj.message || String(err),
      };
    }
  }
}

