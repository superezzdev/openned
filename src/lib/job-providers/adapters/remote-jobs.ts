import { NormalizedJob } from "../../ingestion/types";
import { classifyEmploymentType, classifyRemoteType, normalizeIsoDate, sanitizeHtml } from "../../ingestion/normalizer";
import { executeRapidApiRequest } from "../rapidapi-client";
import { JobProvider, JobSearchParams, ProviderSearchResult } from "../types";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export interface RemoteJobs1RawJob {
  id?: string | number;
  slug?: string;
  url?: string;
  title?: string;
  description?: string;
  datePosted?: string;
  employmentTypes?: string[];
  locationTypes?: string[];
  company?: {
    name?: string;
    logoUrl?: string;
    websiteUrl?: string;
  };
  countries?: string[];
  [key: string]: unknown;
}

export function normalizeRemoteJobs1Job(raw: RemoteJobs1RawJob): NormalizedJob | null {
  const jobId = String(raw.id || raw.slug || "").trim();
  const title = String(raw.title || "").trim();
  const rawRecord = raw as Record<string, unknown>;
  const companyObj = raw.company as { name?: string } | undefined;
  const company = String(
    companyObj?.name ||
      (typeof rawRecord.company === "string" ? rawRecord.company : "") ||
      (typeof rawRecord.company_name === "string" ? rawRecord.company_name : "") ||
      "Remote Company"
  ).trim();
  const jobUrl = String(raw.url || raw.company?.websiteUrl || "").trim();

  if (!jobId || !title || !jobUrl) return null;

  const loc = raw.countries?.join(", ") || "Remote";
  const desc = raw.description || "";
  const descHtml = sanitizeHtml(desc.includes("<") ? desc : `<p>${desc}</p>`);

  const remoteType = classifyRemoteType(loc, null, true, `${title} ${desc}`);
  const rawEmployment = Array.isArray(raw.employmentTypes) ? raw.employmentTypes.join(", ") : "";
  const employmentType = classifyEmploymentType(rawEmployment, title);

  return {
    source: "remote-jobs",
    source_job_id: jobId,
    company_name: company,
    company_logo: raw.company?.logoUrl || "/platforms/remotejobs.svg",
    title,
    description: desc || `Remote position at ${company}`,
    description_html: descHtml,
    location: loc,
    locations_json: raw.countries || ["Remote"],
    country: raw.countries?.[0] || null,
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
    posted_at: normalizeIsoDate(raw.datePosted),
    updated_at_source: normalizeIsoDate(raw.datePosted),
    raw_payload: raw,
  };
}

export class RemoteJobsProvider implements JobProvider {
  readonly id = "remote-jobs";
  readonly name = "Remote Jobs";
  readonly priority = 6;
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
    const collectedJobs: NormalizedJob[] = [];

    // 1. First attempt: RemoteOK Free Public API
    try {
      const res = await fetch("https://remoteok.com/api", {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; OpennedJobs/1.0)" },
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (res.ok) {
        const rawList = await res.json();
        if (Array.isArray(rawList)) {
          for (const item of rawList.slice(1)) {
            // first item is disclaimer
            if (!item || !item.id || !item.position) continue;
            const title = String(item.position || "").trim();
            const company = String(item.company || "Remote Company").trim();
            const tags = Array.isArray(item.tags) ? item.tags.join(" ") : "";
            const desc = item.description || "";

            if (query && !title.toLowerCase().includes(query) && !tags.toLowerCase().includes(query) && !company.toLowerCase().includes(query)) {
              continue;
            }

            collectedJobs.push({
              source: "remote-jobs",
              source_job_id: `remoteok-${item.id}`,
              company_name: company,
              company_logo: item.company_logo || item.logo || "/platforms/remotejobs.svg",
              title,
              description: sanitizeHtml(desc.slice(0, 1000)),
              description_html: sanitizeHtml(desc),
              location: item.location || "Remote (Worldwide)",
              locations_json: [item.location || "Remote"],
              country: null,
              region: null,
              city: null,
              remote_type: "remote",
              employment_type: "full-time",
              department: "Engineering",
              team: null,
              salary_min: item.salary_min || null,
              salary_max: item.salary_max || null,
              salary_currency: "USD",
              salary_interval: "yearly",
              job_url: item.url || `https://remoteok.com/remote-jobs/${item.id}`,
              apply_url: item.apply_url || item.url || `https://remoteok.com/remote-jobs/${item.id}`,
              posted_at: item.date ? normalizeIsoDate(item.date) : new Date().toISOString(),
              updated_at_source: item.date ? normalizeIsoDate(item.date) : new Date().toISOString(),
              raw_payload: item,
            });

            if (collectedJobs.length >= limit) break;
          }
        }
      }
    } catch (remoteOkErr) {
      console.warn("[remote-jobs-provider] RemoteOK API warning:", remoteOkErr);
    }

    // 2. Second attempt: Remotive Free API (if needed more)
    if (collectedJobs.length < limit) {
      try {
        const catParam = query ? `&search=${encodeURIComponent(query)}` : "&category=software-dev";
        const res = await fetch(`https://remotive.com/api/remote-jobs?limit=${limit}${catParam}`, {
          headers: { "Accept": "application/json" },
          signal: AbortSignal.timeout(5000),
        });

        if (res.ok) {
          const data = await res.json();
          const rJobs = data?.jobs || [];
          for (const item of rJobs) {
            if (!item || !item.id || !item.title) continue;
            collectedJobs.push({
              source: "remote-jobs",
              source_job_id: `remotive-${item.id}`,
              company_name: item.company_name || "Remote Company",
              company_logo: item.company_logo || "/platforms/remotejobs.svg",
              title: item.title,
              description: sanitizeHtml((item.description || "").slice(0, 1000)),
              description_html: sanitizeHtml(item.description || ""),
              location: item.candidate_required_location || "Remote",
              locations_json: [item.candidate_required_location || "Remote"],
              country: null,
              region: null,
              city: null,
              remote_type: "remote",
              employment_type: classifyEmploymentType(item.job_type, item.title),
              department: item.category || "Software Development",
              team: null,
              salary_min: null,
              salary_max: null,
              salary_currency: null,
              salary_interval: null,
              job_url: item.url,
              apply_url: item.url,
              posted_at: normalizeIsoDate(item.publication_date),
              updated_at_source: normalizeIsoDate(item.publication_date),
              raw_payload: item,
            });

            if (collectedJobs.length >= limit) break;
          }
        }
      } catch (remotiveErr) {
        console.warn("[remote-jobs-provider] Remotive API warning:", remotiveErr);
      }
    }

    // 3. Third attempt: RapidAPI (if still needed)
    if (collectedJobs.length < limit) {
      try {
        const country = (params.country || "us").toLowerCase();
        const urlParams = new URLSearchParams({
          country,
          limit: String(limit),
          include_company: "true",
          include_total_count: "true",
        });

        const response = await executeRapidApiRequest<{
          data?: RemoteJobs1RawJob[];
          total_count?: number;
        }>({
          providerId: this.id,
          providerName: this.name,
          host: "remote-jobs1.p.rapidapi.com",
          url: `https://remote-jobs1.p.rapidapi.com/jobs?${urlParams.toString()}`,
          timeoutMs: 5000,
          maxRetries: 0,
        });

        const rawList = Array.isArray(response.data?.data) ? response.data.data : [];
        for (const raw of rawList) {
          const norm = normalizeRemoteJobs1Job(raw);
          if (norm) collectedJobs.push(norm);
          if (collectedJobs.length >= limit) break;
        }
      } catch (rapidErr) {
        // rapid failure is gracefully absorbed
      }
    }

    // 4. Fourth attempt: Supabase DB Fallback
    if (collectedJobs.length === 0) {
      try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";
        const supabase = createSupabaseClient(url, key);

        const { data: dbJobs } = await supabase
          .from("canonical_jobs")
          .select("*")
          .or("source.eq.remote-jobs,source.eq.remote_jobs,source.eq.jobicy")
          .eq("active", true)
          .order("posted_at", { ascending: false, nullsFirst: false })
          .limit(limit);

        if (dbJobs && dbJobs.length > 0) {
          return {
            providerId: this.id,
            providerName: this.name,
            jobs: dbJobs as NormalizedJob[],
            total: dbJobs.length,
            hasMore: false,
            latencyMs: Date.now() - startTime,
            status: "success",
          };
        }
      } catch (dbErr) {
        console.warn("[remote-jobs-provider] DB fallback warning:", dbErr);
      }
    }

    return {
      providerId: this.id,
      providerName: this.name,
      jobs: collectedJobs.slice(0, limit),
      total: collectedJobs.length,
      hasMore: collectedJobs.length >= limit,
      latencyMs: Date.now() - startTime,
      status: collectedJobs.length === 0 ? "empty" : "success",
    };
  }
}


