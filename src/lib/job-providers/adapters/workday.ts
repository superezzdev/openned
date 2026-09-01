import { NormalizedJob } from "../../ingestion/types";
import { classifyEmploymentType, classifyRemoteType, normalizeIsoDate, sanitizeHtml } from "../../ingestion/normalizer";
import { executeRapidApiRequest } from "../rapidapi-client";
import { JobProvider, JobSearchParams, ProviderSearchResult } from "../types";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export interface WorkdayRawJob {
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
  description_text?: string;
  [key: string]: unknown;
}

export function normalizeWorkdayJob(raw: WorkdayRawJob): NormalizedJob | null {
  const jobId = String(raw.id || "").trim();
  const title = String(raw.title || "").trim();
  const company = String(raw.organization || "Company").trim();
  const jobUrl = String(raw.url || "").trim();

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

  return {
    source: "workday",
    source_job_id: jobId,
    company_name: company,
    company_logo: raw.organization_logo || "/platforms/workday.svg",
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
    apply_url: jobUrl,
    posted_at: normalizeIsoDate(raw.date_posted),
    updated_at_source: normalizeIsoDate(raw.date_posted),
    raw_payload: raw,
  };
}

export class WorkdayProvider implements JobProvider {
  readonly id = "workday";
  readonly name = "Workday";
  readonly priority = 7;
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

    // 1. Try RapidAPI if available
    try {
      const endpoint = params.datePosted === "today" ? "active-ats-24h" : "active-ats-7d";
      const response = await executeRapidApiRequest<WorkdayRawJob[]>({
        providerId: this.id,
        providerName: this.name,
        host: "workday-jobs-api.p.rapidapi.com",
        url: `https://workday-jobs-api.p.rapidapi.com/${endpoint}`,
        timeoutMs: 4000,
        maxRetries: 0,
      });

      const rawList = Array.isArray(response.data) ? response.data : [];
      let filtered = rawList;
      if (query) {
        filtered = rawList.filter(
          (j) =>
            j.title?.toLowerCase().includes(query) ||
            j.organization?.toLowerCase().includes(query) ||
            j.description_text?.toLowerCase().includes(query)
        );
      }

      const normalizedJobs: NormalizedJob[] = [];
      for (const raw of filtered) {
        const norm = normalizeWorkdayJob(raw);
        if (norm) normalizedJobs.push(norm);
      }

      if (normalizedJobs.length > 0) {
        return {
          providerId: this.id,
          providerName: this.name,
          jobs: normalizedJobs.slice(0, limit),
          total: normalizedJobs.length,
          hasMore: normalizedJobs.length >= limit,
          latencyMs: response.latencyMs,
          status: "success",
        };
      }
    } catch (rapidErr) {
      // RapidAPI failure handled gracefully
    }

    // 2. Query canonical_jobs database for cached Workday positions
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";
      const supabase = createSupabaseClient(url, key);

      let dbQuery = supabase
        .from("canonical_jobs")
        .select("*")
        .eq("source", "workday")
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
      console.warn("[workday-provider] DB fallback warning:", dbErr);
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


