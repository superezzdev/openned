import {
  HealthCheckResult,
  JobSourceAdapter,
  JobSourceRecord,
  NormalizedJob,
  RawJob,
  RawJobDetails,
} from "../types";
import { fetchJson, resilientFetch } from "../http-client";
import {
  classifyEmploymentType,
  classifyRemoteType,
  htmlToPlainText,
  normalizeIsoDate,
  sanitizeHtml,
} from "../normalizer";

export class WorkableAdapter implements JobSourceAdapter {
  readonly source = "workable" as const;

  /**
   * Fetch published jobs from Workable public endpoints with pagination support
   */
  async fetchJobs(source: JobSourceRecord): Promise<RawJob[]> {
    const slug = source.source_identifier.trim().toLowerCase();
    const allJobs: RawJob[] = [];

    // Primary: Workable V3 public accounts search endpoint with cursor pagination
    try {
      const v3Url = `https://apply.workable.com/api/v3/accounts/${slug}/jobs`;
      let token: string | undefined = undefined;
      const maxPages = 10; // safety ceiling: up to 100 jobs per source run

      for (let page = 0; page < maxPages; page++) {
        const body: Record<string, any> = {
          query: "",
          location: [],
          department: [],
          worktype: [],
          remote: [],
        };
        if (token) {
          body.token = token;
        }

        const res = await resilientFetch(v3Url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) break;

        const data = await res.json();
        if (Array.isArray(data.results) && data.results.length > 0) {
          allJobs.push(...data.results);
        }

        if (!data.nextPage || data.results.length === 0) {
          break;
        }
        token = data.nextPage;
      }

      if (allJobs.length > 0) {
        return allJobs;
      }
    } catch {
      // Fallback to widget endpoint
    }

    // Secondary: Workable Widget V1 endpoint (returns all jobs at once for widget-enabled accounts)
    try {
      const widgetUrl = `https://apply.workable.com/api/v1/widget/accounts/${slug}`;
      const data = await fetchJson<{ jobs: RawJob[] }>(widgetUrl);
      if (Array.isArray(data?.jobs) && data.jobs.length > 0) {
        return data.jobs;
      }
    } catch {
      // Fallback to accounts V1
    }

    // Tertiary: Workable V1 accounts jobs
    try {
      const v1Url = `https://apply.workable.com/api/v1/accounts/${slug}/jobs`;
      const data = await fetchJson<{ results: RawJob[] }>(v1Url);
      if (Array.isArray(data?.results) && data.results.length > 0) {
        return data.results;
      }
    } catch {
      // No jobs found across endpoints
    }

    return allJobs;
  }

  /**
   * Optionally fetch detailed job description if the listing only returned brief summary
   */
  async fetchJobDetails(source: JobSourceRecord, job: RawJob): Promise<RawJobDetails> {
    const shortcode = job.shortcode || job.id || job.code;
    if (!shortcode || job.description) {
      return job;
    }

    const slug = source.source_identifier.trim().toLowerCase();
    try {
      const detailUrl = `https://apply.workable.com/api/v1/accounts/${slug}/jobs/${shortcode}`;
      const detail = await fetchJson<RawJobDetails>(detailUrl);
      return { ...job, ...detail };
    } catch {
      return job;
    }
  }

  /**
   * Normalize a raw Workable job into canonical format
   */
  normalize(raw: RawJob, source: JobSourceRecord): NormalizedJob {
    const shortcode = String(raw.shortcode || raw.id || raw.code || "").trim();
    const title = String(raw.title || "").trim();
    const slug = source.source_identifier.trim().toLowerCase();

    const jobUrl =
      raw.url ||
      raw.job_url ||
      `https://apply.workable.com/${slug}/j/${shortcode}`;

    const applyUrl =
      raw.application_url ||
      `${jobUrl.replace(/\/$/, "")}/apply`;

    // Extract location fields
    const city = raw.city || raw.location?.city || null;
    const region = raw.state || raw.region || raw.location?.region || null;
    const country = raw.country || raw.location?.country || null;
    const locationParts = [city, region, country].filter(Boolean);
    const locationName = locationParts.length > 0 ? locationParts.join(", ") : (raw.telecommuting ? "Remote" : "Unspecified");

    const descriptionHtml = sanitizeHtml(raw.description || raw.description_html || "");
    const descriptionPlain = htmlToPlainText(descriptionHtml) || raw.description_plain || "";

    const remoteType = classifyRemoteType(locationName, undefined, raw.telecommuting || raw.remote, `${title} ${descriptionPlain}`);
    const employmentType = classifyEmploymentType(raw.employment_type || raw.type, title);

    const locationsJson: string[] = [];
    if (locationName) locationsJson.push(locationName);

    // Salary parsing if present
    let salaryMin: number | null = null;
    let salaryMax: number | null = null;
    let salaryCurrency: string | null = null;
    let salaryInterval: "yearly" | "monthly" | "hourly" | null = null;

    if (raw.salary) {
      if (typeof raw.salary.min === "number") salaryMin = raw.salary.min;
      if (typeof raw.salary.max === "number") salaryMax = raw.salary.max;
      if (raw.salary.currency) salaryCurrency = String(raw.salary.currency);
      if (raw.salary.interval) salaryInterval = raw.salary.interval;
    }

    let department: string | null = null;
    if (Array.isArray(raw.department)) {
      department = raw.department.filter(Boolean).join(", ");
    } else if (typeof raw.department === "string") {
      department = raw.department.trim();
    }

    return {
      source: this.source,
      source_job_id: shortcode,
      company_name: source.company_name,
      company_logo: source.company_logo || `/platforms/Workable.png`,
      title,
      description: descriptionPlain,
      description_html: descriptionHtml,
      location: locationName,
      locations_json: locationsJson,
      country,
      region,
      city,
      remote_type: remoteType,
      employment_type: employmentType,
      department: department || null,
      team: null,
      salary_min: salaryMin,
      salary_max: salaryMax,
      salary_currency: salaryCurrency,
      salary_interval: salaryInterval,
      job_url: jobUrl,
      apply_url: applyUrl,
      posted_at: normalizeIsoDate(raw.published_on || raw.published || raw.created_at),
      updated_at_source: normalizeIsoDate(raw.updated_at || raw.published_on || raw.published),
      raw_payload: raw,
    };
  }

  /**
   * Health check for Workable board
   */
  async healthCheck(source: JobSourceRecord): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      const slug = source.source_identifier.trim().toLowerCase();
      const url = `https://apply.workable.com/api/v1/widget/accounts/${slug}`;
      const res = await resilientFetch(url, { method: "HEAD" });
      const latencyMs = Date.now() - startTime;
      return {
        healthy: res.ok,
        latencyMs,
        message: res.ok ? "Workable widget API online" : `Status ${res.status}: ${res.statusText}`,
      };
    } catch (err: any) {
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
        message: err?.message || "Workable health check failed",
      };
    }
  }
}
