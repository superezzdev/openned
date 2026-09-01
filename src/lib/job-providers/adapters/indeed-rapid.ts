import { NormalizedJob } from "../../ingestion/types";
import { classifyEmploymentType, classifyRemoteType, normalizeIsoDate, sanitizeHtml } from "../../ingestion/normalizer";
import { executeRapidApiRequest } from "../rapidapi-client";
import { JobProvider, JobSearchParams, ProviderSearchResult } from "../types";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export interface IndeedRawJob {
  id?: string | number;
  job_id?: string;
  title?: string;
  job_title?: string;
  company_name?: string;
  company?: string;
  location?: string;
  locality?: string;
  country?: string;
  url?: string;
  link?: string;
  job_url?: string;
  salary?: string;
  description?: string;
  pub_date?: string;
  date?: string;
  [key: string]: unknown;
}

export function normalizeIndeedJob(raw: IndeedRawJob): NormalizedJob | null {
  const jobId = String(raw.id || raw.job_id || "").trim();
  const title = String(raw.title || raw.job_title || "").trim();
  const company = String(raw.company_name || raw.company || "Company").trim();
  const jobUrl = String(raw.url || raw.link || raw.job_url || `https://www.indeed.com/viewjob?jk=${jobId}`).trim();

  if (!jobId || !title) return null;

  const loc = raw.location || raw.locality || raw.country || "USA";
  const desc = raw.description || `Indeed position at ${company}`;
  const descHtml = sanitizeHtml(desc.includes("<") ? desc : `<p>${desc}</p>`);

  const remoteType = classifyRemoteType(loc, null, loc.toLowerCase().includes("remote"), `${title} ${desc}`);
  const employmentType = classifyEmploymentType(null, title);

  return {
    source: "indeed",
    source_job_id: jobId,
    company_name: company,
    company_logo: "/platforms/indeed.svg",
    title,
    description: desc,
    description_html: descHtml,
    location: loc,
    locations_json: [loc],
    country: raw.country || null,
    region: null,
    city: null,
    remote_type: remoteType,
    employment_type: employmentType,
    department: null,
    team: null,
    salary_min: null,
    salary_max: null,
    salary_currency: null,
    salary_interval: null,
    job_url: jobUrl,
    apply_url: jobUrl,
    posted_at: normalizeIsoDate(raw.pub_date || raw.date),
    updated_at_source: normalizeIsoDate(raw.pub_date || raw.date),
    raw_payload: raw,
  };
}

export class IndeedRapidProvider implements JobProvider {
  readonly id = "indeed";
  readonly name = "Indeed";
  readonly priority = 11;
  readonly enabled = true;
  readonly timeoutMs = 8000;
  readonly maxRetries = 1;
  readonly minResultsThreshold = 5;

  supports(): boolean {
    return true;
  }

  async search(params: JobSearchParams): Promise<ProviderSearchResult> {
    const startTime = Date.now();
    const country = (params.country || "US").toUpperCase();
    const limit = Math.min(50, Math.max(1, params.limit || 20));
    const query = (params.query || "").toLowerCase().trim();

    // 1. First attempt: RapidAPI if available
    try {
      const response = await executeRapidApiRequest<{
        data?: IndeedRawJob[];
        results?: IndeedRawJob[];
      }>({
        providerId: this.id,
        providerName: this.name,
        host: "indeed46.p.rapidapi.com",
        url: `https://indeed46.p.rapidapi.com/job?country=${country}&sort=-1&page_size=${limit}`,
        timeoutMs: 4000,
        maxRetries: 0,
      });

      const rawList = Array.isArray(response.data?.data)
        ? response.data.data
        : Array.isArray(response.data?.results)
        ? response.data.results
        : [];

      const normalizedJobs: NormalizedJob[] = [];
      for (const raw of rawList) {
        const norm = normalizeIndeedJob(raw);
        if (norm) normalizedJobs.push(norm);
      }

      if (normalizedJobs.length > 0) {
        return {
          providerId: this.id,
          providerName: this.name,
          jobs: normalizedJobs,
          total: normalizedJobs.length,
          hasMore: normalizedJobs.length >= limit,
          latencyMs: response.latencyMs,
          status: "success",
        };
      }
    } catch (rapidErr) {
      // RapidAPI failure handled gracefully
    }

    // 2. Query Supabase canonical_jobs table
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";
      const supabase = createSupabaseClient(url, key);

      let dbQuery = supabase
        .from("canonical_jobs")
        .select("*")
        .or("source.eq.indeed,source.eq.indeed-rapid,source.ilike.%indeed%")
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
      console.warn("[indeed-provider] DB fallback warning:", dbErr);
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


