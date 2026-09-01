import { NormalizedJob } from "../../ingestion/types";
import { normalizeIsoDate, sanitizeHtml } from "../../ingestion/normalizer";
import { executeRapidApiRequest } from "../rapidapi-client";
import { JobProvider, JobSearchParams, ProviderSearchResult } from "../types";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export interface FreelancerRawProject {
  id?: string | number;
  title?: string;
  projectName?: string;
  preview_description?: string;
  description?: string;
  currency?: {
    code?: string;
    sign?: string;
    id?: number;
  } | string;
  budget?: {
    minimum?: number;
    maximum?: number;
    name?: string;
    project_type?: string;
    currency_id?: number;
  } | string | number;
  budgetMin?: number;
  budgetMax?: number;
  url?: string;
  link?: string;
  seo_url?: string;
  submitdate?: number | string;
  postedDate?: string;
  jobs?: Array<{ id: number; name: string }>;
  skills?: string[];
  [key: string]: unknown;
}

export function normalizeFreelancerJob(raw: FreelancerRawProject): NormalizedJob | null {
  const jobId = String(raw.id || "").trim();
  const title = String(raw.title || raw.projectName || "").trim();
  const seoUrl = raw.seo_url ? `https://www.freelancer.com/projects/${raw.seo_url}` : null;
  const jobUrl = String(raw.url || raw.link || seoUrl || (jobId ? `https://www.freelancer.com/projects/${jobId}` : "https://www.freelancer.com")).trim();

  if (!jobId || !title) return null;

  const desc = raw.description || raw.preview_description || "";
  const descHtml = sanitizeHtml(desc.includes("<") ? desc : `<p>${desc}</p>`);

  let salaryMin: number | null = null;
  let salaryMax: number | null = null;
  let salaryCurrency = "USD";

  if (typeof raw.budget === "object" && raw.budget !== null) {
    salaryMin = typeof raw.budget.minimum === "number" ? raw.budget.minimum : null;
    salaryMax = typeof raw.budget.maximum === "number" ? raw.budget.maximum : null;
  } else if (typeof raw.budgetMin === "number") {
    salaryMin = raw.budgetMin;
    salaryMax = typeof raw.budgetMax === "number" ? raw.budgetMax : null;
  }

  if (typeof raw.currency === "object" && raw.currency !== null && raw.currency.code) {
    salaryCurrency = raw.currency.code;
  } else if (typeof raw.currency === "string") {
    salaryCurrency = raw.currency;
  }

  let postedAt: string | null = null;
  if (typeof raw.submitdate === "number") {
    postedAt = new Date(raw.submitdate * 1000).toISOString();
  } else if (raw.postedDate) {
    postedAt = normalizeIsoDate(raw.postedDate);
  } else {
    postedAt = new Date().toISOString();
  }

  return {
    source: "freelancer",
    source_job_id: jobId,
    company_name: "Freelancer Client",
    company_logo: "/platforms/freelancer.svg",
    title,
    description: desc || `Freelance contract: ${title}`,
    description_html: descHtml,
    location: "Remote (Worldwide)",
    locations_json: ["Remote"],
    country: null,
    region: null,
    city: null,
    remote_type: "remote",
    employment_type: "contract",
    department: "Freelance",
    team: null,
    salary_min: salaryMin,
    salary_max: salaryMax,
    salary_currency: salaryCurrency,
    salary_interval: "monthly",
    job_url: jobUrl,
    apply_url: jobUrl,
    posted_at: postedAt,
    updated_at_source: postedAt,
    raw_payload: raw as Record<string, unknown>,
  };
}

export class FreelancerProvider implements JobProvider {
  readonly id = "freelancer";
  readonly name = "Freelancer";
  readonly priority = 12;
  readonly enabled = true;
  readonly timeoutMs = 8000;
  readonly maxRetries = 1;
  readonly minResultsThreshold = 3;

  supports(params: JobSearchParams): boolean {
    return true;
  }

  async search(params: JobSearchParams): Promise<ProviderSearchResult> {
    const startTime = Date.now();
    const query = params.query?.trim() || "developer";
    const limit = Math.min(50, Math.max(1, params.limit || 20));

    // 1. First attempt: Official Free Freelancer.com REST API
    try {
      const url = `https://www.freelancer.com/api/projects/0.1/projects/active?query=${encodeURIComponent(query)}&limit=${limit}&compact=true`;
      const res = await fetch(url, {
        headers: {
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; OpennedJobSearch/1.0)",
        },
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (res.ok) {
        const data = await res.json();
        const rawProjects: FreelancerRawProject[] = data?.result?.projects || [];
        const normalizedJobs: NormalizedJob[] = [];

        for (const raw of rawProjects) {
          const norm = normalizeFreelancerJob(raw);
          if (norm) normalizedJobs.push(norm);
        }

        if (normalizedJobs.length > 0) {
          return {
            providerId: this.id,
            providerName: this.name,
            jobs: normalizedJobs,
            total: normalizedJobs.length,
            hasMore: normalizedJobs.length >= limit,
            latencyMs: Date.now() - startTime,
            status: "success",
          };
        }
      }
    } catch (apiErr) {
      console.warn("[freelancer-provider] Official API call warning:", apiErr);
    }

    // 2. Second attempt: RapidAPI (if configured & available)
    try {
      const response = await executeRapidApiRequest<FreelancerRawProject[] | { jobs?: FreelancerRawProject[] }>({
        providerId: this.id,
        providerName: this.name,
        host: "freelancer-api.p.rapidapi.com",
        url: "https://freelancer-api.p.rapidapi.com/api/find-job",
        timeoutMs: 5000,
        maxRetries: 0,
      });

      const resData = response.data;
      let rawList: FreelancerRawProject[] = [];
      if (Array.isArray(resData)) {
        rawList = resData;
      } else if (resData && typeof resData === "object" && Array.isArray((resData as { jobs?: FreelancerRawProject[] }).jobs)) {
        rawList = (resData as { jobs: FreelancerRawProject[] }).jobs;
      }

      const normalizedJobs: NormalizedJob[] = [];
      for (const raw of rawList) {
        const norm = normalizeFreelancerJob(raw);
        if (norm) normalizedJobs.push(norm);
      }

      if (normalizedJobs.length > 0) {
        return {
          providerId: this.id,
          providerName: this.name,
          jobs: normalizedJobs.slice(0, limit),
          total: normalizedJobs.length,
          hasMore: false,
          latencyMs: response.latencyMs,
          status: "success",
        };
      }
    } catch (rapidErr) {
      // RapidAPI failure is expected when quota exceeded or endpoint 503
    }

    // 3. Third attempt: Canonical DB Fallback
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";
      const supabase = createSupabaseClient(url, key);

      const { data: dbJobs } = await supabase
        .from("canonical_jobs")
        .select("*")
        .eq("source", "freelancer")
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
      console.warn("[freelancer-provider] DB fallback warning:", dbErr);
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


