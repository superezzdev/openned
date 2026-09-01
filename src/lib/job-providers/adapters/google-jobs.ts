import { NormalizedJob } from "../../ingestion/types";
import { classifyEmploymentType, classifyRemoteType, normalizeIsoDate, sanitizeHtml } from "../../ingestion/normalizer";
import { executeRapidApiRequest } from "../rapidapi-client";
import { JobProvider, JobSearchParams, ProviderSearchResult } from "../types";

export interface GoogleJobsRawJob {
  title?: string;
  link?: string;
  url?: string;
  snippet?: string;
  description?: string;
  company?: string;
  employer?: string;
  salary?: string;
  jobType?: string;
  postedDate?: string;
  location?: string;
  [key: string]: unknown;
}

export function normalizeGoogleJob(raw: GoogleJobsRawJob, idx: number): NormalizedJob | null {
  const title = String(raw.title || "").trim();
  const company = String(raw.company || raw.employer || "Company").trim();
  const jobUrl = String(raw.link || raw.url || "").trim();

  if (!title || !jobUrl) return null;

  const validUrl = jobUrl.startsWith("http://") || jobUrl.startsWith("https://") ? jobUrl : `https://${jobUrl}`;
  const jobId = `google-${idx}-${Buffer.from(validUrl).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 16)}`;

  const loc = raw.location || "USA";
  const desc = raw.description || raw.snippet || "";
  const descHtml = sanitizeHtml(desc.includes("<") ? desc : `<p>${desc}</p>`);

  const remoteType = classifyRemoteType(loc, null, loc.toLowerCase().includes("remote"), `${title} ${desc}`);
  const employmentType = classifyEmploymentType(raw.jobType, title);

  let salaryMin: number | null = null;
  let salaryMax: number | null = null;
  if (raw.salary) {
    const nums = raw.salary.match(/\d+[\d,]*/g);
    if (nums && nums.length >= 2) {
      salaryMin = parseInt(nums[0].replace(/,/g, ""), 10);
      salaryMax = parseInt(nums[1].replace(/,/g, ""), 10);
    }
  }

  return {
    source: "google-jobs",
    source_job_id: jobId,
    company_name: company,
    company_logo: "/platforms/googlejobs.svg",
    title,
    description: desc || `Position at ${company}`,
    description_html: descHtml,
    location: loc,
    locations_json: [loc],
    country: null,
    region: null,
    city: null,
    remote_type: remoteType,
    employment_type: employmentType,
    department: null,
    team: null,
    salary_min: salaryMin,
    salary_max: salaryMax,
    salary_currency: salaryMin ? "USD" : null,
    salary_interval: salaryMin ? "yearly" : null,
    job_url: jobUrl,
    apply_url: jobUrl,
    posted_at: normalizeIsoDate(raw.postedDate),
    updated_at_source: normalizeIsoDate(raw.postedDate),
    raw_payload: raw,
  };
}

export class GoogleJobsProvider implements JobProvider {
  readonly id = "google-jobs";
  readonly name = "Google Jobs (RapidAPI)";
  readonly priority = 8;
  readonly enabled = true;
  readonly timeoutMs = 12000;
  readonly maxRetries = 2;
  readonly minResultsThreshold = 5;

  supports(): boolean {
    return true;
  }

  async search(params: JobSearchParams): Promise<ProviderSearchResult> {
    const query = params.query?.trim() || "Software Engineer";
    const loc = params.location?.trim() || params.country || "US";

    const urlParams = new URLSearchParams({
      include: query,
      location: loc,
      language: "English",
    });

    try {
      const response = await executeRapidApiRequest<{
        jobs?: GoogleJobsRawJob[];
        totalResults?: number;
      }>({
        providerId: this.id,
        providerName: this.name,
        host: "google-jobs-api.p.rapidapi.com",
        url: `https://google-jobs-api.p.rapidapi.com/google-jobs?${urlParams.toString()}`,
        timeoutMs: this.timeoutMs,
        maxRetries: this.maxRetries,
      });

      const rawList = Array.isArray(response.data?.jobs) ? response.data.jobs : [];
      const normalizedJobs: NormalizedJob[] = [];

      rawList.forEach((raw, idx) => {
        const norm = normalizeGoogleJob(raw, idx);
        if (norm) normalizedJobs.push(norm);
      });

      return {
        providerId: this.id,
        providerName: this.name,
        jobs: normalizedJobs,
        total: typeof response.data?.totalResults === "number" ? response.data.totalResults : normalizedJobs.length,
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

