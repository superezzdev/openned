import { NormalizedJob } from "../../ingestion/types";
import { classifyEmploymentType, classifyRemoteType, normalizeIsoDate, sanitizeHtml } from "../../ingestion/normalizer";
import { executeRapidApiRequest } from "../rapidapi-client";
import { JobProvider, JobSearchParams, ProviderSearchResult } from "../types";

export interface JobicyRawJob {
  id?: string | number;
  url?: string;
  jobSlug?: string;
  jobTitle?: string;
  companyName?: string;
  companyLogo?: string;
  jobIndustry?: string[];
  jobType?: string[];
  jobGeo?: string;
  jobLevel?: string;
  jobExcerpt?: string;
  jobDescription?: string;
  pubDate?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  salaryPeriod?: string;
  [key: string]: unknown;
}

export function normalizeJobicyJob(raw: JobicyRawJob): NormalizedJob | null {
  const jobId = String(raw.id || raw.jobSlug || "").trim();
  const title = String(raw.jobTitle || "").trim();
  const company = String(raw.companyName || "Company").trim();
  const jobUrl = String(raw.url || "").trim();

  if (!jobId || !title || !jobUrl) return null;

  const loc = raw.jobGeo || "Remote";
  const desc = raw.jobDescription || raw.jobExcerpt || "";
  const descHtml = sanitizeHtml(desc.includes("<") ? desc : `<p>${desc}</p>`);

  const remoteType = classifyRemoteType(loc, null, true, `${title} ${desc}`);
  const rawEmployment = Array.isArray(raw.jobType) ? raw.jobType.join(", ") : "";
  const employmentType = classifyEmploymentType(rawEmployment, title);

  let salaryInterval: "yearly" | "monthly" | "hourly" | null = null;
  if (raw.salaryPeriod) {
    const p = raw.salaryPeriod.toLowerCase();
    if (p.includes("hour")) salaryInterval = "hourly";
    else if (p.includes("month")) salaryInterval = "monthly";
    else salaryInterval = "yearly";
  }

  return {
    source: "jobicy",
    source_job_id: jobId,
    company_name: company,
    company_logo: raw.companyLogo || "/platforms/jobicy.svg",
    title,
    description: desc || `Remote position at ${company}`,
    description_html: descHtml,
    location: loc,
    locations_json: [loc],
    country: raw.jobGeo || null,
    region: null,
    city: null,
    remote_type: remoteType,
    employment_type: employmentType,
    department: Array.isArray(raw.jobIndustry) ? raw.jobIndustry[0] : null,
    team: null,
    salary_min: typeof raw.salaryMin === "number" ? raw.salaryMin : null,
    salary_max: typeof raw.salaryMax === "number" ? raw.salaryMax : null,
    salary_currency: raw.salaryCurrency || (raw.salaryMin ? "USD" : null),
    salary_interval: salaryInterval,
    job_url: jobUrl,
    apply_url: jobUrl,
    posted_at: normalizeIsoDate(raw.pubDate),
    updated_at_source: normalizeIsoDate(raw.pubDate),
    raw_payload: raw,
  };
}

export class JobicyProvider implements JobProvider {
  readonly id = "jobicy";
  readonly name = "Jobicy";
  readonly priority = 5;
  readonly enabled = true;
  readonly timeoutMs = 12000;
  readonly maxRetries = 2;
  readonly minResultsThreshold = 5;

  supports(): boolean {
    return true;
  }

  async search(params: JobSearchParams): Promise<ProviderSearchResult> {
    const limit = Math.min(50, Math.max(1, params.limit || 20));
    const urlParams = new URLSearchParams({
      count: String(limit),
    });

    // Valid predefined geo slugs in Jobicy
    const validGeos = new Set(["usa", "uk", "apac", "emea", "latam", "canada", "germany", "france", "japan", "australia"]);
    const rawGeo = (params.location || params.country || "").toLowerCase().trim();
    if (validGeos.has(rawGeo)) {
      urlParams.set("geo", rawGeo);
    } else if (rawGeo === "us" || rawGeo === "united states") {
      urlParams.set("geo", "usa");
    }

    if (params.query?.trim()) {
      urlParams.set("tag", params.query.trim().toLowerCase());
    }


    try {
      const response = await executeRapidApiRequest<{
        jobs?: JobicyRawJob[];
        jobCount?: number;
      }>({
        providerId: this.id,
        providerName: this.name,
        host: "jobicy.p.rapidapi.com",
        url: `https://jobicy.p.rapidapi.com/api/v2/remote-jobs?${urlParams.toString()}`,
        timeoutMs: this.timeoutMs,
        maxRetries: this.maxRetries,
      });

      const rawList = Array.isArray(response.data?.jobs) ? response.data.jobs : [];
      const normalizedJobs: NormalizedJob[] = [];

      for (const raw of rawList) {
        const norm = normalizeJobicyJob(raw);
        if (norm) normalizedJobs.push(norm);
      }

      return {
        providerId: this.id,
        providerName: this.name,
        jobs: normalizedJobs,
        total: typeof response.data?.jobCount === "number" ? response.data.jobCount : normalizedJobs.length,
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

