import { NormalizedJob } from "../../ingestion/types";
import { classifyEmploymentType, classifyRemoteType, normalizeIsoDate, sanitizeHtml } from "../../ingestion/normalizer";
import { executeRapidApiRequest } from "../rapidapi-client";
import { JobProvider, JobSearchParams, ProviderSearchResult } from "../types";

export interface ActiveJobsDbRawJob {
  id?: string | number;
  date_posted?: string;
  title?: string;
  organization?: string;
  organization_url?: string;
  organization_logo?: string;
  locations_raw?: string[] | string;
  locations_derived?: string[];
  cities_derived?: string[];
  regions_derived?: string[];
  countries_derived?: string[];
  remote_derived?: boolean;
  salary_raw?: string;
  employment_type?: string;
  url?: string;
  external_apply_url?: string;
  description_text?: string;
  seniority?: string;
  [key: string]: unknown;
}

export function normalizeActiveJobsDbJob(raw: ActiveJobsDbRawJob): NormalizedJob | null {
  const jobId = String(raw.id || "").trim();
  const title = String(raw.title || "").trim();
  const company = String(raw.organization || "Company").trim();
  const jobUrl = String(raw.external_apply_url || raw.url || "").trim();

  if (!jobId || !title || !jobUrl) return null;

  const locList = Array.isArray(raw.locations_derived)
    ? raw.locations_derived
    : Array.isArray(raw.locations_raw)
    ? raw.locations_raw
    : typeof raw.locations_raw === "string"
    ? [raw.locations_raw]
    : [];

  const locationStr = locList.join(", ") || (raw.remote_derived ? "Remote" : "USA");
  const city = raw.cities_derived?.[0] || null;
  const region = raw.regions_derived?.[0] || null;
  const country = raw.countries_derived?.[0] || null;

  const rawDesc = raw.description_text || "";
  const descHtml = sanitizeHtml(rawDesc.includes("<") ? rawDesc : `<p>${rawDesc}</p>`);

  const remoteType = classifyRemoteType(locationStr, null, raw.remote_derived, `${title} ${rawDesc}`);
  const employmentType = classifyEmploymentType(raw.employment_type, title);

  // Parse salary if present in salary_raw
  let salaryMin: number | null = null;
  let salaryMax: number | null = null;
  let salaryCurrency: string | null = null;

  if (raw.salary_raw) {
    const numbers = raw.salary_raw.match(/\d+[\d,]*/g);
    if (numbers && numbers.length >= 2) {
      salaryMin = parseInt(numbers[0].replace(/,/g, ""), 10);
      salaryMax = parseInt(numbers[1].replace(/,/g, ""), 10);
      salaryCurrency = "USD";
    }
  }

  return {
    source: "active-jobs-db",
    source_job_id: jobId,
    company_name: company,
    company_logo: raw.organization_logo || "/platforms/activejobs.svg",
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
    salary_min: salaryMin,
    salary_max: salaryMax,
    salary_currency: salaryCurrency,
    salary_interval: salaryMin ? "yearly" : null,
    job_url: jobUrl,
    apply_url: String(raw.external_apply_url || jobUrl),
    posted_at: normalizeIsoDate(raw.date_posted),
    updated_at_source: normalizeIsoDate(raw.date_posted),
    raw_payload: raw,
  };
}

export class ActiveJobsDbProvider implements JobProvider {
  readonly id = "active-jobs-db";
  readonly name = "Active Jobs DB";
  readonly priority = 2;
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
      time_frame: params.datePosted === "today" ? "24h" : "7d",
      description_format: "text",
    });

    if (params.query?.trim()) {
      urlParams.set("title", `"${params.query.trim()}"`);
    }

    if (params.location?.trim()) {
      urlParams.set("location", `"${params.location.trim()}"`);
    }

    try {
      const response = await executeRapidApiRequest<ActiveJobsDbRawJob[]>({
        providerId: this.id,
        providerName: this.name,
        host: "active-jobs-db.p.rapidapi.com",
        url: `https://active-jobs-db.p.rapidapi.com/active-ats?${urlParams.toString()}`,
        timeoutMs: this.timeoutMs,
        maxRetries: this.maxRetries,
      });

      const rawList = Array.isArray(response.data) ? response.data : [];
      const normalizedJobs: NormalizedJob[] = [];

      for (const raw of rawList) {
        const norm = normalizeActiveJobsDbJob(raw);
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

