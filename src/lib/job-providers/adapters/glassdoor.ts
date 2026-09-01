import { NormalizedJob } from "../../ingestion/types";
import { classifyEmploymentType, classifyRemoteType, normalizeIsoDate, sanitizeHtml } from "../../ingestion/normalizer";
import { JobProvider, JobSearchParams, ProviderSearchResult } from "../types";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export interface GlassdoorRawJob {
  id?: string | number;
  job_id?: string;
  title?: string;
  job_title?: string;
  company_name?: string;
  company?: string;
  rating?: number | string;
  location?: string;
  salary?: string;
  salary_min?: number;
  salary_max?: number;
  url?: string;
  link?: string;
  job_url?: string;
  description?: string;
  pub_date?: string;
  [key: string]: unknown;
}

export function normalizeGlassdoorJob(raw: GlassdoorRawJob): NormalizedJob | null {
  const jobId = String(raw.id || raw.job_id || "").trim();
  const title = String(raw.title || raw.job_title || "").trim();
  const company = String(raw.company_name || raw.company || "Company").trim();
  const jobUrl = String(raw.url || raw.link || raw.job_url || `https://www.glassdoor.com/Job/${company.toLowerCase().replace(/[^a-z0-9]/g, "-")}-jobs`).trim();

  if (!jobId || !title) return null;

  const loc = raw.location || "USA (Remote / Hybrid)";
  const desc = raw.description || `Glassdoor verified role at ${company}`;
  const descHtml = sanitizeHtml(desc.includes("<") ? desc : `<p>${desc}</p>`);

  const remoteType = classifyRemoteType(loc, null, loc.toLowerCase().includes("remote"), `${title} ${desc}`);
  const employmentType = classifyEmploymentType(null, title);

  return {
    source: "glassdoor",
    source_job_id: jobId,
    company_name: company,
    company_logo: "/platforms/glassdoor.svg",
    title,
    description: desc,
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
    salary_min: typeof raw.salary_min === "number" ? raw.salary_min : null,
    salary_max: typeof raw.salary_max === "number" ? raw.salary_max : null,
    salary_currency: "USD",
    salary_interval: "yearly",
    job_url: jobUrl,
    apply_url: jobUrl,
    posted_at: normalizeIsoDate(raw.pub_date),
    updated_at_source: normalizeIsoDate(raw.pub_date),
    raw_payload: raw,
  };
}

export class GlassdoorJobsProvider implements JobProvider {
  readonly id = "glassdoor";
  readonly name = "Glassdoor";
  readonly priority = 5;
  readonly enabled = true;
  readonly timeoutMs = 8000;
  readonly maxRetries = 1;
  readonly minResultsThreshold = 5;

  supports(): boolean {
    return true;
  }

  async search(params: JobSearchParams): Promise<ProviderSearchResult> {
    const startTime = Date.now();
    const limit = Math.min(50, Math.max(1, params.limit || 20));
    const query = (params.query || "").toLowerCase().trim();

    // Query canonical_jobs database for Glassdoor listings
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";
      const supabase = createSupabaseClient(url, key);

      let dbQuery = supabase
        .from("canonical_jobs")
        .select("*")
        .or("source.eq.glassdoor,source.eq.salary-enricher,source.ilike.%glassdoor%")
        .eq("active", true)
        .order("posted_at", { ascending: false, nullsFirst: false })
        .limit(limit);

      if (query) {
        dbQuery = dbQuery.or(`title.ilike.%${query}%,company_name.ilike.%${query}%,description.ilike.%${query}%`);
      }

      const { data: dbJobs } = await dbQuery;

      if (dbJobs && dbJobs.length > 0) {
        return {
          providerId: this.id,
          providerName: this.name,
          jobs: dbJobs as NormalizedJob[],
          total: dbJobs.length,
          hasMore: dbJobs.length >= limit,
          latencyMs: Date.now() - startTime,
          status: "success",
        };
      }
    } catch (dbErr) {
      console.warn("[glassdoor-provider] DB search warning:", dbErr);
    }

    return {
      providerId: this.id,
      providerName: this.name,
      jobs: [],
      latencyMs: Date.now() - startTime,
      status: "empty",
    };
  }
}
