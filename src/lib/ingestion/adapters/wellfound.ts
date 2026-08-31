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
  parseSalaryInterval,
  sanitizeHtml,
} from "../normalizer";

export class WellfoundAdapter implements JobSourceAdapter {
  readonly source = "wellfound" as const;

  /**
   * Fetch published jobs from Wellfound company endpoint with pagination support
   */
  async fetchJobs(source: JobSourceRecord): Promise<RawJob[]> {
    const slug = source.source_identifier.trim().toLowerCase();
    const allJobs: RawJob[] = [];
    const maxPages = 5; // Safety ceiling: up to 5 pages per source run

    // Primary: Wellfound public company API endpoint with page pagination
    try {
      for (let page = 1; page <= maxPages; page++) {
        const apiUrl = `https://wellfound.com/api/v1/companies/${encodeURIComponent(slug)}/jobs?page=${page}`;
        const res = await resilientFetch(apiUrl, {
          headers: {
            "Accept": "application/json, text/plain, */*",
          },
        });

        if (!res.ok) {
          break;
        }

        const data = await res.json().catch(() => null);
        if (!data) break;

        const pageJobs: RawJob[] = Array.isArray(data)
          ? data
          : Array.isArray(data.jobs)
          ? data.jobs
          : Array.isArray(data.results)
          ? data.results
          : Array.isArray(data.listings)
          ? data.listings
          : Array.isArray(data.data)
          ? data.data
          : [];

        if (pageJobs.length > 0) {
          allJobs.push(...pageJobs);
        }

        // Check if there are more pages
        const hasNextPage =
          data.has_more === true ||
          data.next_page !== null && data.next_page !== undefined ||
          (typeof data.total_pages === "number" && page < data.total_pages) ||
          pageJobs.length >= 20;

        if (!hasNextPage || pageJobs.length === 0) {
          break;
        }
      }

      if (allJobs.length > 0) {
        return allJobs;
      }
    } catch {
      // Fallback to syndication / embed endpoint
    }

    // Secondary: Wellfound syndication feed endpoint
    try {
      const feedUrl = `https://wellfound.com/company/${encodeURIComponent(slug)}/jobs.json`;
      const data = await fetchJson<{ jobs?: RawJob[]; results?: RawJob[] }>(feedUrl);
      const jobs = data?.jobs || data?.results;
      if (Array.isArray(jobs) && jobs.length > 0) {
        return jobs;
      }
    } catch {
      // Fallback handling completed
    }

    return allJobs;
  }

  /**
   * Optionally fetch detailed job description if the listing only returned brief summary
   */
  async fetchJobDetails(source: JobSourceRecord, job: RawJob): Promise<RawJobDetails> {
    const rawId = job.id || job.job_id || job.listing_id || job.slug;
    if (!rawId || (job.description && job.description.length >= 100)) {
      return job;
    }

    const slug = source.source_identifier.trim().toLowerCase();
    try {
      const detailUrl = `https://wellfound.com/api/v1/companies/${slug}/jobs/${rawId}`;
      const detail = await fetchJson<RawJobDetails>(detailUrl);
      return { ...job, ...detail };
    } catch {
      return job;
    }
  }

  /**
   * Normalize a raw Wellfound job into canonical format
   */
  normalize(raw: RawJob, source: JobSourceRecord): NormalizedJob {
    const rawId = String(raw.id || raw.job_id || raw.listing_id || raw.slug || "").trim();
    const title = String(raw.title || raw.job_title || raw.role || "").trim();
    const slug = source.source_identifier.trim().toLowerCase();

    // Preserve original job URL & application URL
    const defaultJobUrl = `https://wellfound.com/company/${slug}/jobs/${rawId}${raw.slug && raw.slug !== rawId ? `-${raw.slug}` : ""}`;
    const jobUrl = String(raw.job_url || raw.url || raw.canonical_url || defaultJobUrl).trim();

    const applyUrl = String(
      raw.apply_url ||
      raw.applyUrl ||
      raw.application_url ||
      (jobUrl.includes("?") ? `${jobUrl}&action=apply` : `${jobUrl}#apply`)
    ).trim();

    // Extract location fields
    let locationName = "";
    const locationsJson: string[] = [];

    if (typeof raw.location === "string" && raw.location.trim()) {
      locationName = raw.location.trim();
      locationsJson.push(locationName);
    }

    if (Array.isArray(raw.locations)) {
      for (const loc of raw.locations) {
        const name = typeof loc === "string" ? loc : loc?.name || loc?.city;
        if (name && !locationsJson.includes(name)) {
          locationsJson.push(name);
        }
      }
      if (!locationName && locationsJson.length > 0) {
        locationName = locationsJson.join(", ");
      }
    }

    if (Array.isArray(raw.location_names)) {
      for (const name of raw.location_names) {
        if (name && !locationsJson.includes(name)) {
          locationsJson.push(name);
        }
      }
      if (!locationName && locationsJson.length > 0) {
        locationName = locationsJson.join(", ");
      }
    }

    if (!locationName && (raw.city || raw.region || raw.country)) {
      locationName = [raw.city, raw.region, raw.country].filter(Boolean).join(", ");
      if (locationName && !locationsJson.includes(locationName)) {
        locationsJson.push(locationName);
      }
    }

    // Extract description & sanitize HTML
    const rawHtml = raw.description_html || raw.descriptionHtml || raw.description || "";
    const descriptionHtml = sanitizeHtml(rawHtml);
    const descriptionPlain =
      raw.description_plain ||
      raw.descriptionPlain ||
      (raw.description && !raw.description.includes("<") ? raw.description.trim() : htmlToPlainText(descriptionHtml));

    // Classifications
    const isRemote =
      Boolean(raw.remote) ||
      Boolean(raw.is_remote) ||
      raw.remote_type === "remote" ||
      (typeof raw.location === "string" && raw.location.toLowerCase().includes("remote"));

    const remoteType = classifyRemoteType(
      locationName,
      raw.remote_type || raw.workplace_type,
      isRemote,
      `${title} ${descriptionPlain}`
    );

    const employmentType = classifyEmploymentType(
      raw.job_type || raw.jobType || raw.employment_type || raw.commitment,
      title
    );

    // Salary & Compensation parsing
    let salaryMin: number | null = null;
    let salaryMax: number | null = null;
    let salaryCurrency: string | null = null;
    let salaryInterval: "yearly" | "monthly" | "hourly" | null = null;

    if (typeof raw.salary_min === "number") salaryMin = raw.salary_min;
    else if (typeof raw.min_salary === "number") salaryMin = raw.min_salary;
    else if (typeof raw.minSalary === "number") salaryMin = raw.minSalary;
    else if (raw.compensation && typeof raw.compensation.min === "number") salaryMin = raw.compensation.min;

    if (typeof raw.salary_max === "number") salaryMax = raw.salary_max;
    else if (typeof raw.max_salary === "number") salaryMax = raw.max_salary;
    else if (typeof raw.maxSalary === "number") salaryMax = raw.maxSalary;
    else if (raw.compensation && typeof raw.compensation.max === "number") salaryMax = raw.compensation.max;

    if (raw.salary_currency) salaryCurrency = String(raw.salary_currency);
    else if (raw.currency) salaryCurrency = String(raw.currency);
    else if (raw.compensation?.currency) salaryCurrency = String(raw.compensation.currency);
    else if (salaryMin || salaryMax) salaryCurrency = "USD";

    if (raw.salary_interval) {
      salaryInterval = parseSalaryInterval(raw.salary_interval);
    } else if (raw.interval) {
      salaryInterval = parseSalaryInterval(raw.interval);
    } else if (raw.compensation?.interval) {
      salaryInterval = parseSalaryInterval(raw.compensation.interval);
    } else if (salaryMin || salaryMax) {
      salaryInterval = "yearly";
    }

    // Parse compensation string fallback (e.g. "$150k - $220k" or "$150,000 - $220,000")
    if (salaryMin === null && raw.compensation_string) {
      const match = String(raw.compensation_string).match(
        /\$?\s*(\d{2,3}(?:,\d{3})*(?:k)?)\s*(?:-|to)\s*\$?\s*(\d{2,3}(?:,\d{3})*(?:k)?)/i
      );
      if (match) {
        const parseVal = (v: string) => {
          const clean = v.toLowerCase().replace(/,/g, "");
          if (clean.endsWith("k")) return parseFloat(clean) * 1000;
          return parseFloat(clean);
        };
        salaryMin = parseVal(match[1]);
        salaryMax = parseVal(match[2]);
        salaryCurrency = "USD";
        salaryInterval = "yearly";
      }
    }

    // Department & team
    let department: string | null = null;
    if (raw.department) {
      department = String(raw.department).trim();
    } else if (raw.role_type) {
      department = String(raw.role_type).trim();
    } else if (Array.isArray(raw.skills) && raw.skills.length > 0) {
      department = String(raw.skills[0]).trim();
    }

    return {
      source: this.source,
      source_job_id: rawId,
      company_name: source.company_name,
      company_logo: source.company_logo || `/platforms/wellfound.png`,
      title,
      description: descriptionPlain,
      description_html: descriptionHtml,
      location: locationName || (remoteType === "remote" ? "Remote" : "Unspecified"),
      locations_json: locationsJson,
      country: raw.country || null,
      region: raw.region || raw.state || null,
      city: raw.city || null,
      remote_type: remoteType,
      employment_type: employmentType,
      department: department || null,
      team: raw.team || null,
      salary_min: salaryMin,
      salary_max: salaryMax,
      salary_currency: salaryCurrency,
      salary_interval: salaryInterval,
      job_url: jobUrl,
      apply_url: applyUrl,
      posted_at: normalizeIsoDate(raw.posted_at || raw.published_at || raw.publishedAt || raw.created_at || raw.live_at),
      updated_at_source: normalizeIsoDate(raw.updated_at || raw.updatedAt || raw.posted_at || raw.published_at),
      raw_payload: raw,
    };
  }

  /**
   * Health check for Wellfound company job board
   */
  async healthCheck(source: JobSourceRecord): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      const slug = source.source_identifier.trim().toLowerCase();
      const url = `https://wellfound.com/company/${encodeURIComponent(slug)}/jobs`;
      const res = await resilientFetch(url, { method: "HEAD" });
      const latencyMs = Date.now() - startTime;
      return {
        healthy: res.ok,
        latencyMs,
        message: res.ok ? "Wellfound company job board online" : `Status ${res.status}: ${res.statusText}`,
      };
    } catch (err: any) {
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
        message: err?.message || "Wellfound health check failed",
      };
    }
  }
}
