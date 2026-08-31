import {
  HealthCheckResult,
  JobSourceAdapter,
  JobSourceRecord,
  NormalizedJob,
  RawJob,
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

export class AshbyAdapter implements JobSourceAdapter {
  readonly source = "ashby" as const;

  /**
   * Fetch published jobs from Ashby Job Board API
   */
  async fetchJobs(source: JobSourceRecord): Promise<RawJob[]> {
    const slug = source.source_identifier.trim();
    const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}?includeCompensation=true`;

    const data = await fetchJson<{ jobs: RawJob[] }>(url);
    if (!data || !Array.isArray(data.jobs)) {
      return [];
    }

    // Only return publicly listed jobs
    return data.jobs.filter((j) => j.isListed !== false);
  }

  /**
   * Normalize a raw Ashby job into canonical format
   */
  normalize(raw: RawJob, source: JobSourceRecord): NormalizedJob {
    const rawId = String(raw.id || "").trim();
    const title = String(raw.title || "").trim();
    const slug = source.source_identifier.trim();

    const jobUrl =
      raw.jobUrl ||
      `https://jobs.ashbyhq.com/${slug}/${rawId}`;

    const applyUrl =
      raw.applyUrl ||
      `${jobUrl}/application`;

    const locationName = raw.locationName ? String(raw.locationName).trim() : "";
    const descriptionHtml = sanitizeHtml(raw.descriptionHtml || "");
    const descriptionPlain = raw.descriptionPlain || htmlToPlainText(raw.descriptionHtml);

    // Locations list
    const locationsJson: string[] = [];
    if (locationName) locationsJson.push(locationName);
    if (Array.isArray(raw.secondaryLocations)) {
      for (const sec of raw.secondaryLocations) {
        const secLoc = typeof sec === "string" ? sec : sec?.locationName;
        if (secLoc && !locationsJson.includes(secLoc)) {
          locationsJson.push(secLoc);
        }
      }
    }

    // Classifications
    const remoteType = classifyRemoteType(locationName, undefined, raw.isRemote, `${title} ${descriptionPlain}`);
    const employmentType = classifyEmploymentType(raw.employmentType, title);

    // Compensation & Salary
    let salaryMin: number | null = null;
    let salaryMax: number | null = null;
    let salaryCurrency: string | null = null;
    let salaryInterval: "yearly" | "monthly" | "hourly" | null = null;

    if (raw.compensation) {
      const comp = raw.compensation;
      const target = comp.targetSalary || (comp.compensationTiers && comp.compensationTiers[0]);

      if (target) {
        if (typeof target.min === "number") salaryMin = target.min;
        if (typeof target.max === "number") salaryMax = target.max;
        if (target.currency) salaryCurrency = String(target.currency);
        if (target.interval) salaryInterval = parseSalaryInterval(target.interval);
      } else if (comp.compensationTierSummary) {
        const match = comp.compensationTierSummary.match(/\$?\s*(\d{2,3}(?:,\d{3})*)\s*(?:-|to)\s*\$?\s*(\d{2,3}(?:,\d{3})*)/i);
        if (match) {
          salaryMin = parseFloat(match[1].replace(/,/g, ""));
          salaryMax = parseFloat(match[2].replace(/,/g, ""));
          salaryCurrency = "USD";
          salaryInterval = "yearly";
        }
      }
    }

    return {
      source: this.source,
      source_job_id: rawId,
      company_name: source.company_name,
      company_logo: source.company_logo || `/platforms/Ashby.png`,
      title,
      description: descriptionPlain,
      description_html: descriptionHtml,
      location: locationName || (raw.isRemote ? "Remote" : "Unspecified"),
      locations_json: locationsJson,
      country: null,
      region: null,
      city: null,
      remote_type: remoteType,
      employment_type: employmentType,
      department: raw.department || null,
      team: raw.team || null,
      salary_min: salaryMin,
      salary_max: salaryMax,
      salary_currency: salaryCurrency,
      salary_interval: salaryInterval,
      job_url: jobUrl,
      apply_url: applyUrl,
      posted_at: normalizeIsoDate(raw.publishedAt),
      updated_at_source: normalizeIsoDate(raw.publishedAt),
      raw_payload: raw,
    };
  }

  /**
   * Health check for Ashby board
   */
  async healthCheck(source: JobSourceRecord): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      const slug = source.source_identifier.trim();
      const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}`;
      const res = await resilientFetch(url, { method: "HEAD" });
      const latencyMs = Date.now() - startTime;
      return {
        healthy: res.ok,
        latencyMs,
        message: res.ok ? "Ashby posting API online" : `Status ${res.status}: ${res.statusText}`,
      };
    } catch (err: any) {
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
        message: err?.message || "Ashby health check failed",
      };
    }
  }
}
