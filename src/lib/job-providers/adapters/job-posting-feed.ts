import { NormalizedJob } from "../../ingestion/types";
import { classifyEmploymentType, classifyRemoteType, normalizeIsoDate, sanitizeHtml } from "../../ingestion/normalizer";
import { executeRapidApiRequest } from "../rapidapi-client";
import { JobProvider, JobSearchParams, ProviderSearchResult } from "../types";

export interface JobPostingFeedRawJob {
  id?: string | number;
  date_posted?: string;
  title?: string;
  organization?: string;
  organization_url?: string;
  organization_logo?: string;
  locations?: string[];
  locations_derived?: string[];
  cities_derived?: string[];
  regions_derived?: string[];
  countries_derived?: string[];
  ai_remote_location?: boolean | string;
  ai_salary_min_value?: number;
  ai_salary_max_value?: number;
  ai_salary_currency?: string;
  ai_salary_unit_text?: string;
  ai_experience_level?: string;
  ai_work_arrangement?: string;
  employment_type?: string;
  url?: string;
  description_text?: string;
  [key: string]: unknown;
}

export function normalizeJobPostingFeedJob(raw: JobPostingFeedRawJob): NormalizedJob | null {
  const jobId = String(raw.id || "").trim();
  const title = String(raw.title || "").trim();
  const company = String(raw.organization || "Company").trim();
  const jobUrl = String(raw.url || "").trim();

  if (!jobId || !title || !jobUrl) return null;

  const locList = Array.isArray(raw.locations_derived)
    ? raw.locations_derived
    : Array.isArray(raw.locations)
    ? raw.locations
    : [];

  const locationStr = locList.join(", ") || (raw.ai_work_arrangement?.toLowerCase().includes("remote") ? "Remote" : "USA");
  const city = raw.cities_derived?.[0] || null;
  const region = raw.regions_derived?.[0] || null;
  const country = raw.countries_derived?.[0] || null;

  const rawDesc = raw.description_text || "";
  const descHtml = sanitizeHtml(rawDesc.includes("<") ? rawDesc : `<p>${rawDesc}</p>`);

  const isRemote =
    raw.ai_work_arrangement?.toLowerCase().includes("remote") ||
    String(raw.ai_remote_location).toLowerCase() === "true";

  const remoteType = classifyRemoteType(locationStr, raw.ai_work_arrangement, isRemote, `${title} ${rawDesc}`);
  const employmentType = classifyEmploymentType(raw.employment_type, title);

  return {
    source: "job-posting-feed",
    source_job_id: jobId,
    company_name: company,
    company_logo: raw.organization_logo || "/platforms/jobpostingfeed.svg",
    title,
    description: rawDesc || `Job opening at ${company}`,
    description_html: descHtml,
    location: locationStr,
    locations_json: locList,
    country,
    region,
    city,
    remote_type: remoteType,
    employment_type: employmentType,
    department: null,
    team: null,
    salary_min: typeof raw.ai_salary_min_value === "number" ? raw.ai_salary_min_value : null,
    salary_max: typeof raw.ai_salary_max_value === "number" ? raw.ai_salary_max_value : null,
    salary_currency: raw.ai_salary_currency || (raw.ai_salary_min_value ? "USD" : null),
    salary_interval: raw.ai_salary_unit_text?.toLowerCase().includes("hour")
      ? "hourly"
      : raw.ai_salary_unit_text?.toLowerCase().includes("month")
      ? "monthly"
      : "yearly",
    job_url: jobUrl,
    apply_url: jobUrl,
    posted_at: normalizeIsoDate(raw.date_posted),
    updated_at_source: normalizeIsoDate(raw.date_posted),
    raw_payload: raw,
  };
}

export class JobPostingFeedProvider implements JobProvider {
  readonly id = "job-posting-feed";
  readonly name = "Job Posting Feed";
  readonly priority = 3;
  readonly enabled = true;
  readonly timeoutMs = 12000;
  readonly maxRetries = 2;
  readonly minResultsThreshold = 5;

  supports(): boolean {
    return true;
  }

  async search(params: JobSearchParams): Promise<ProviderSearchResult> {
    const limit = Math.min(50, Math.max(1, params.limit || 20));
    const offset = Math.max(0, ((params.page || 1) - 1) * limit);

    const urlParams = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      description_format: "text",
      include_basic_organization_details: "true",
    });

    try {
      const response = await executeRapidApiRequest<JobPostingFeedRawJob[]>({
        providerId: this.id,
        providerName: this.name,
        host: "job-posting-feed-api.p.rapidapi.com",
        url: `https://job-posting-feed-api.p.rapidapi.com/active-ats?${urlParams.toString()}`,
        timeoutMs: this.timeoutMs,
        maxRetries: this.maxRetries,
      });

      let rawList = Array.isArray(response.data) ? response.data : [];

      // In-memory filter for search query/location if provided
      if (params.query?.trim()) {
        const q = params.query.toLowerCase().trim();
        rawList = rawList.filter(
          (j) =>
            j.title?.toLowerCase().includes(q) ||
            j.organization?.toLowerCase().includes(q) ||
            j.description_text?.toLowerCase().includes(q)
        );
      }

      const normalizedJobs: NormalizedJob[] = [];
      for (const raw of rawList) {
        const norm = normalizeJobPostingFeedJob(raw);
        if (norm) normalizedJobs.push(norm);
      }

      return {
        providerId: this.id,
        providerName: this.name,
        jobs: normalizedJobs,
        total: normalizedJobs.length,
        hasMore: normalizedJobs.length >= limit,
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
