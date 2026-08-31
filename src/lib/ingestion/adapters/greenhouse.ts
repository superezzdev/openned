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
  sanitizeHtml,
} from "../normalizer";

export class GreenhouseAdapter implements JobSourceAdapter {
  readonly source = "greenhouse" as const;

  /**
   * Fetch published jobs from Greenhouse Board API
   */
  async fetchJobs(source: JobSourceRecord): Promise<RawJob[]> {
    const slug = source.source_identifier.trim().toLowerCase();
    const url = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`;

    const data = await fetchJson<{ jobs: RawJob[] }>(url);
    if (!data || !Array.isArray(data.jobs)) {
      return [];
    }

    return data.jobs;
  }

  /**
   * Normalize a raw Greenhouse job into the canonical schema
   */
  normalize(raw: RawJob, source: JobSourceRecord): NormalizedJob {
    const rawId = String(raw.id || "").trim();
    const title = String(raw.title || "").trim();
    const boardSlug = source.source_identifier.trim().toLowerCase();

    const jobUrl =
      raw.absolute_url ||
      `https://boards.greenhouse.io/${boardSlug}/jobs/${rawId}`;

    const applyUrl =
      jobUrl.includes("#app")
        ? jobUrl
        : `https://boards.greenhouse.io/${boardSlug}/jobs/${rawId}#app`;

    const locationName = raw.location?.name ? String(raw.location.name).trim() : "";
    const descriptionHtml = sanitizeHtml(raw.content || "");
    const descriptionPlain = htmlToPlainText(raw.content || "");

    // Extract department / team
    let department = "";
    if (Array.isArray(raw.departments) && raw.departments.length > 0) {
      department = raw.departments.map((d: any) => d.name).filter(Boolean).join(", ");
    }

    // Extract office locations
    const locationsJson: string[] = [];
    if (locationName) locationsJson.push(locationName);
    if (Array.isArray(raw.offices)) {
      for (const office of raw.offices) {
        if (office.name && !locationsJson.includes(office.name)) {
          locationsJson.push(office.name);
        }
      }
    }

    // Classify remote and employment types
    const remoteType = classifyRemoteType(locationName, undefined, undefined, `${title} ${descriptionPlain}`);
    const employmentType = classifyEmploymentType(undefined, title);

    // Look for salary in metadata if available
    let salaryMin: number | null = null;
    let salaryMax: number | null = null;
    let salaryCurrency: string | null = null;
    let salaryInterval: "yearly" | "monthly" | "hourly" | null = null;

    if (Array.isArray(raw.metadata)) {
      for (const meta of raw.metadata) {
        const name = (meta.name || "").toLowerCase();
        if (name.includes("salary") || name.includes("compensation")) {
          const val = String(meta.value || "");
          const match = val.match(/\$?\s*(\d{2,3}(?:,\d{3})*(?:\.\d+)?)\s*(?:-|to)\s*\$?\s*(\d{2,3}(?:,\d{3})*(?:\.\d+)?)/i);
          if (match) {
            salaryMin = parseFloat(match[1].replace(/,/g, ""));
            salaryMax = parseFloat(match[2].replace(/,/g, ""));
            salaryCurrency = "USD";
            salaryInterval = "yearly";
          }
        }
      }
    }

    return {
      source: this.source,
      source_job_id: rawId,
      company_name: source.company_name,
      company_logo: source.company_logo || `/platforms/Greenhouse.png`,
      title,
      description: descriptionPlain,
      description_html: descriptionHtml,
      location: locationName || "Remote / Unspecified",
      locations_json: locationsJson,
      country: null,
      region: null,
      city: null,
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
      posted_at: normalizeIsoDate(raw.updated_at),
      updated_at_source: normalizeIsoDate(raw.updated_at),
      raw_payload: raw,
    };
  }

  /**
   * Health check for Greenhouse board
   */
  async healthCheck(source: JobSourceRecord): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      const slug = source.source_identifier.trim().toLowerCase();
      const url = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`;
      const res = await resilientFetch(url, { method: "HEAD" });
      const latencyMs = Date.now() - startTime;
      return {
        healthy: res.ok,
        latencyMs,
        message: res.ok ? "Greenhouse board online" : `Status ${res.status}: ${res.statusText}`,
      };
    } catch (err: any) {
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
        message: err?.message || "Health check failed",
      };
    }
  }
}
