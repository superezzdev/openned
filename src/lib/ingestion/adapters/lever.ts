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

export class LeverAdapter implements JobSourceAdapter {
  readonly source = "lever" as const;

  /**
   * Fetch published postings from Lever Postings API
   */
  async fetchJobs(source: JobSourceRecord): Promise<RawJob[]> {
    const slug = source.source_identifier.trim().toLowerCase();
    const url = `https://api.lever.co/v0/postings/${slug}?mode=json`;

    const data = await fetchJson<RawJob[]>(url);
    if (!Array.isArray(data)) {
      return [];
    }

    return data;
  }

  /**
   * Normalize a raw Lever posting into canonical format
   */
  normalize(raw: RawJob, source: JobSourceRecord): NormalizedJob {
    const rawId = String(raw.id || "").trim();
    const title = String(raw.text || raw.title || "").trim();
    const hostedUrl = String(raw.hostedUrl || "").trim();
    const applyUrl = String(raw.applyUrl || `${hostedUrl}/apply`).trim();

    const cats = raw.categories || {};
    const locationName = cats.location ? String(cats.location).trim() : "";
    const workplaceType = cats.workplaceType ? String(cats.workplaceType).trim() : "";
    const commitment = cats.commitment ? String(cats.commitment).trim() : "";
    const department = cats.department ? String(cats.department).trim() : "";
    const team = cats.team ? String(cats.team).trim() : "";

    const rawHtml = [raw.description, raw.additional].filter(Boolean).join("<br/><br/>");
    const descriptionHtml = sanitizeHtml(rawHtml);
    const descriptionPlain = [raw.descriptionPlain, raw.additionalPlain]
      .filter(Boolean)
      .join("\n\n") || htmlToPlainText(rawHtml);

    // Locations list
    const locationsJson: string[] = [];
    if (locationName) locationsJson.push(locationName);
    if (Array.isArray(cats.allLocations)) {
      for (const loc of cats.allLocations) {
        if (loc && !locationsJson.includes(loc)) {
          locationsJson.push(loc);
        }
      }
    }

    // Classifications
    const isRemote = workplaceType.toLowerCase() === "remote";
    const remoteType = classifyRemoteType(locationName, workplaceType, isRemote, `${title} ${descriptionPlain}`);
    const employmentType = classifyEmploymentType(commitment, title);

    // Salary parsing
    let salaryMin: number | null = null;
    let salaryMax: number | null = null;
    let salaryCurrency: string | null = null;
    let salaryInterval: "yearly" | "monthly" | "hourly" | null = null;

    if (raw.salaryRange) {
      if (typeof raw.salaryRange.min === "number") salaryMin = raw.salaryRange.min;
      if (typeof raw.salaryRange.max === "number") salaryMax = raw.salaryRange.max;
      if (raw.salaryRange.currency) salaryCurrency = String(raw.salaryRange.currency);
      if (raw.salaryRange.interval) {
        salaryInterval = parseSalaryInterval(raw.salaryRange.interval);
      }
    }

    return {
      source: this.source,
      source_job_id: rawId,
      company_name: source.company_name,
      company_logo: source.company_logo || `/platforms/Lever.png`,
      title,
      description: descriptionPlain,
      description_html: descriptionHtml,
      location: locationName || (remoteType === "remote" ? "Remote" : "Unspecified"),
      locations_json: locationsJson,
      country: null,
      region: null,
      city: null,
      remote_type: remoteType,
      employment_type: employmentType,
      department: department || null,
      team: team || null,
      salary_min: salaryMin,
      salary_max: salaryMax,
      salary_currency: salaryCurrency,
      salary_interval: salaryInterval,
      job_url: hostedUrl,
      apply_url: applyUrl,
      posted_at: normalizeIsoDate(raw.createdAt),
      updated_at_source: normalizeIsoDate(raw.createdAt),
      raw_payload: raw,
    };
  }

  /**
   * Health check for Lever board
   */
  async healthCheck(source: JobSourceRecord): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      const slug = source.source_identifier.trim().toLowerCase();
      const url = `https://api.lever.co/v0/postings/${slug}?mode=json`;
      const res = await resilientFetch(url, { method: "HEAD" });
      const latencyMs = Date.now() - startTime;
      return {
        healthy: res.ok,
        latencyMs,
        message: res.ok ? "Lever postings API online" : `Status ${res.status}: ${res.statusText}`,
      };
    } catch (err: any) {
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
        message: err?.message || "Lever health check failed",
      };
    }
  }
}
