import { NormalizedJob } from "../../ingestion/types";
import { classifyEmploymentType, classifyRemoteType, normalizeIsoDate, sanitizeHtml } from "../../ingestion/normalizer";
import { executeRapidApiRequest } from "../rapidapi-client";
import { JobProvider, JobSearchParams, ProviderSearchResult } from "../types";

export interface FreeYcRawJob {
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
  employment_type?: string;
  url?: string;
  external_apply_url?: string;
  description_text?: string;
  [key: string]: unknown;
}

export function normalizeFreeYcJob(raw: FreeYcRawJob): NormalizedJob | null {
  const jobId = String(raw.id || "").trim();
  const title = String(raw.title || "").trim();
  const company = String(raw.organization || "YC Startup").trim();
  const jobUrl = String(raw.external_apply_url || raw.url || "").trim();

  if (!jobId || !title || !jobUrl) return null;

  const locList = Array.isArray(raw.locations_derived)
    ? raw.locations_derived
    : Array.isArray(raw.locations_raw)
    ? raw.locations_raw
    : typeof raw.locations_raw === "string"
    ? [raw.locations_raw]
    : [];

  const locationStr = locList.join(", ") || (raw.remote_derived ? "Remote" : "San Francisco, CA");
  const city = raw.cities_derived?.[0] || null;
  const region = raw.regions_derived?.[0] || null;
  const country = raw.countries_derived?.[0] || null;

  const rawDesc = raw.description_text || "";
  const descHtml = sanitizeHtml(rawDesc.includes("<") ? rawDesc : `<p>${rawDesc}</p>`);

  const remoteType = classifyRemoteType(locationStr, null, raw.remote_derived, `${title} ${rawDesc}`);
  const employmentType = classifyEmploymentType(raw.employment_type, title);

  return {
    source: "ycombinator",
    source_job_id: jobId,
    company_name: company,
    company_logo: raw.organization_logo || "/platforms/ycombinator.svg",
    title,
    description: rawDesc || `Position at ${company}`,
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
    salary_min: null,
    salary_max: null,
    salary_currency: null,
    salary_interval: null,
    job_url: jobUrl,
    apply_url: String(raw.external_apply_url || jobUrl),
    posted_at: normalizeIsoDate(raw.date_posted),
    updated_at_source: normalizeIsoDate(raw.date_posted),
    raw_payload: raw,
  };
}

export class FreeYcJobsProvider implements JobProvider {
  readonly id = "free-yc-jobs";
  readonly name = "Y Combinator Feed (RapidAPI)";
  readonly priority = 9;
  readonly enabled = true;
  readonly timeoutMs = 12000;
  readonly maxRetries = 2;
  readonly minResultsThreshold = 5;

  supports(): boolean {
    return true;
  }

  async search(params: JobSearchParams): Promise<ProviderSearchResult> {
    try {
      const response = await executeRapidApiRequest<FreeYcRawJob[]>({
        providerId: this.id,
        providerName: this.name,
        host: "free-y-combinator-jobs-api.p.rapidapi.com",
        url: "https://free-y-combinator-jobs-api.p.rapidapi.com/active-jb-7d",
        timeoutMs: this.timeoutMs,
        maxRetries: this.maxRetries,
      });

      let rawList = Array.isArray(response.data) ? response.data : [];

      if (params.query?.trim()) {
        const q = params.query.toLowerCase().trim();
        rawList = rawList.filter(
          (j) =>
            j.title?.toLowerCase().includes(q) ||
            j.organization?.toLowerCase().includes(q) ||
            j.description_text?.toLowerCase().includes(q)
        );
      }

      const limit = Math.min(50, Math.max(1, params.limit || 20));
      const page = Math.max(1, params.page || 1);
      const start = (page - 1) * limit;
      const paginatedList = rawList.slice(start, start + limit);

      const normalizedJobs: NormalizedJob[] = [];
      for (const raw of paginatedList) {
        const norm = normalizeFreeYcJob(raw);
        if (norm) normalizedJobs.push(norm);
      }

      return {
        providerId: this.id,
        providerName: this.name,
        jobs: normalizedJobs,
        total: rawList.length,
        hasMore: start + limit < rawList.length,
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

