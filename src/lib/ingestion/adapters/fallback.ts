import {
  HealthCheckResult,
  JobSourceAdapter,
  JobSourceRecord,
  NormalizedJob,
  RawJob,
} from "../types";
import { fetchText, resilientFetch } from "../http-client";
import {
  classifyEmploymentType,
  classifyRemoteType,
  htmlToPlainText,
  normalizeIsoDate,
  parseSalaryInterval,
  sanitizeHtml,
} from "../normalizer";

export class FallbackParser implements JobSourceAdapter {
  readonly source = "custom" as const;

  /**
   * Fetch and parse job postings from a public career page URL
   */
  async fetchJobs(source: JobSourceRecord): Promise<RawJob[]> {
    const pageUrl = source.source_url;
    const html = await fetchText(pageUrl);
    const jobs = this.extractJobsFromHtml(html, pageUrl, source);
    return jobs;
  }

  /**
   * Extracts JSON-LD JobPosting objects, OpenGraph tags, or semantic elements from HTML
   */
  extractJobsFromHtml(html: string, pageUrl: string, source: JobSourceRecord): RawJob[] {
    const extractedJobs: RawJob[] = [];

    // 1. Try parsing JSON-LD scripts
    const jsonLdRegex = /<script\s+[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match: RegExpExecArray | null;

    while ((match = jsonLdRegex.exec(html)) !== null) {
      try {
        const jsonContent = match[1].trim();
        if (!jsonContent) continue;
        const parsed = JSON.parse(jsonContent);

        // Can be a single object or an array or @graph
        const items = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed["@graph"])
          ? parsed["@graph"]
          : [parsed];

        for (const item of items) {
          if (
            item &&
            (item["@type"] === "JobPosting" ||
              (Array.isArray(item["@type"]) && item["@type"].includes("JobPosting")))
          ) {
            extractedJobs.push(item);
          }
        }
      } catch {
        // Ignore JSON parse errors in individual script tags
      }
    }

    if (extractedJobs.length > 0) {
      return extractedJobs;
    }

    // 2. If no JSON-LD, try OpenGraph metadata fallback for single-job pages
    const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
    const ogDescMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
    const ogUrlMatch = html.match(/<meta\s+property=["']og:url["']\s+content=["']([^"']+)["']/i);

    if (ogTitleMatch && ogTitleMatch[1]) {
      extractedJobs.push({
        "@type": "JobPosting",
        title: ogTitleMatch[1],
        description: ogDescMatch ? ogDescMatch[1] : "",
        url: ogUrlMatch ? ogUrlMatch[1] : pageUrl,
        datePosted: new Date().toISOString(),
        hiringOrganization: { name: source.company_name },
      });
    }

    return extractedJobs;
  }

  /**
   * Normalize a JSON-LD / HTML extracted job into canonical format
   */
  normalize(raw: RawJob, source: JobSourceRecord): NormalizedJob {
    const title = String(raw.title || "").trim();
    const jobUrl = raw.url || raw.directApply || source.source_url;
    const applyUrl = raw.directApply || raw.url || jobUrl;

    // Generate stable fallback source_job_id from URL or title
    let sourceJobId = raw.identifier?.value || raw.identifier || raw.id;
    if (!sourceJobId) {
      try {
        const u = new URL(jobUrl);
        const segments = u.pathname.split("/").filter(Boolean);
        sourceJobId = segments[segments.length - 1] || title.toLowerCase().replace(/[^a-z0-9]/g, "-");
      } catch {
        sourceJobId = title.toLowerCase().replace(/[^a-z0-9]/g, "-");
      }
    }

    const descriptionHtml = sanitizeHtml(raw.description || "");
    const descriptionPlain = htmlToPlainText(raw.description || "");

    // Extract location
    let locationName = "";
    let city: string | null = null;
    let region: string | null = null;
    let country: string | null = null;

    if (raw.jobLocation) {
      const loc = Array.isArray(raw.jobLocation) ? raw.jobLocation[0] : raw.jobLocation;
      if (loc?.address) {
        const addr = typeof loc.address === "string" ? loc.address : loc.address;
        if (typeof addr === "object") {
          city = addr.addressLocality || null;
          region = addr.addressRegion || null;
          country = addr.addressCountry || null;
          locationName = [city, region, country].filter(Boolean).join(", ");
        } else {
          locationName = String(addr);
        }
      }
    }

    const isRemote =
      raw.jobLocationType === "TELECOMMUTE" ||
      raw.applicantLocationRequirements !== undefined;

    const remoteType = classifyRemoteType(locationName, undefined, isRemote, `${title} ${descriptionPlain}`);
    const employmentType = classifyEmploymentType(raw.employmentType, title);

    // Salary from baseSalary
    let salaryMin: number | null = null;
    let salaryMax: number | null = null;
    let salaryCurrency: string | null = null;
    let salaryInterval: "yearly" | "monthly" | "hourly" | null = null;

    if (raw.baseSalary) {
      const val = raw.baseSalary.value || raw.baseSalary;
      if (val) {
        if (typeof val.minValue === "number") salaryMin = val.minValue;
        if (typeof val.maxValue === "number") salaryMax = val.maxValue;
        if (typeof val.value === "number") {
          salaryMin = val.value;
          salaryMax = val.value;
        }
        if (val.unitText) {
          salaryInterval = parseSalaryInterval(val.unitText);
        }
      }
      if (raw.baseSalary.currency) {
        salaryCurrency = raw.baseSalary.currency;
      }
    }

    return {
      source: this.source,
      source_job_id: String(sourceJobId),
      company_name: source.company_name,
      company_logo: source.company_logo || null,
      title,
      description: descriptionPlain,
      description_html: descriptionHtml,
      location: locationName || (remoteType === "remote" ? "Remote" : "Unspecified"),
      locations_json: locationName ? [locationName] : [],
      country,
      region,
      city,
      remote_type: remoteType,
      employment_type: employmentType,
      department: raw.department || raw.occupationalCategory || null,
      team: null,
      salary_min: salaryMin,
      salary_max: salaryMax,
      salary_currency: salaryCurrency,
      salary_interval: salaryInterval,
      job_url: jobUrl,
      apply_url: applyUrl,
      posted_at: normalizeIsoDate(raw.datePosted),
      updated_at_source: normalizeIsoDate(raw.datePosted),
      raw_payload: raw,
    };
  }

  /**
   * Health check for custom career page
   */
  async healthCheck(source: JobSourceRecord): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      const res = await resilientFetch(source.source_url, { method: "HEAD" });
      const latencyMs = Date.now() - startTime;
      return {
        healthy: res.ok,
        latencyMs,
        message: res.ok ? "Career page online" : `Status ${res.status}: ${res.statusText}`,
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
