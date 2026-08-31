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

export class SmartRecruitersAdapter implements JobSourceAdapter {
  readonly source = "smartrecruiters" as const;

  /**
   * Fetch published jobs from SmartRecruiters Posting API with offset-based pagination
   */
  async fetchJobs(source: JobSourceRecord): Promise<RawJob[]> {
    const slug = source.source_identifier.trim();
    const allJobs: RawJob[] = [];
    const limit = 100;
    const maxPages = 10; // Safety ceiling: up to 1,000 jobs per source run

    for (let page = 0; page < maxPages; page++) {
      const offset = page * limit;
      const apiUrl = `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(slug)}/postings?limit=${limit}&offset=${offset}`;

      try {
        const res = await resilientFetch(apiUrl, {
          headers: {
            Accept: "application/json, text/plain, */*",
          },
        });

        if (!res.ok) {
          // If 404 or non-ok on subsequent pages, stop pagination
          if (page > 0) break;
          const errText = await res.text().catch(() => "");
          throw new Error(`HTTP Error ${res.status} (${res.statusText}) for SmartRecruiters company "${slug}": ${errText.slice(0, 200)}`);
        }

        const data = await res.json().catch(() => null);
        if (!data) break;

        const pageJobs: RawJob[] = Array.isArray(data)
          ? data
          : Array.isArray(data.content)
          ? data.content
          : Array.isArray(data.postings)
          ? data.postings
          : Array.isArray(data.jobs)
          ? data.jobs
          : [];

        if (pageJobs.length > 0) {
          allJobs.push(...pageJobs);
        }

        const totalFound = typeof data.totalFound === "number" ? data.totalFound : null;
        if (totalFound !== null && allJobs.length >= totalFound) {
          break;
        }

        if (pageJobs.length < limit) {
          break;
        }
      } catch (err: any) {
        if (page === 0) {
          throw err;
        }
        console.warn(`[SmartRecruiters] Pagination stopped at offset ${offset} for "${slug}": ${err?.message || err}`);
        break;
      }
    }

    return allJobs;
  }

  /**
   * Fetch detailed job description and ad sections if summary only was returned
   */
  async fetchJobDetails(source: JobSourceRecord, job: RawJob): Promise<RawJobDetails> {
    const rawId = job.id || job.uuid || job.refNumber;
    // If jobAd sections are already present and non-empty, avoid redundant HTTP call
    if (job.jobAd?.sections?.jobDescription?.text || (job.description && job.description.length >= 100)) {
      return job;
    }

    if (!rawId) {
      return job;
    }

    const slug = source.source_identifier.trim();
    try {
      const detailUrl = `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(slug)}/postings/${encodeURIComponent(rawId)}`;
      const detail = await fetchJson<RawJobDetails>(detailUrl);
      return { ...job, ...detail };
    } catch {
      return job;
    }
  }

  /**
   * Normalize a raw SmartRecruiters job into canonical NormalizedJob format
   */
  normalize(raw: RawJob, source: JobSourceRecord): NormalizedJob {
    const rawId = String(raw.id || raw.uuid || raw.refNumber || "").trim();
    const title = String(raw.name || raw.title || raw.role || "").trim();
    const slug = source.source_identifier.trim();

    // Preserve original job URL & application URL
    const defaultJobUrl = `https://jobs.smartrecruiters.com/${slug}/${rawId}`;
    let jobUrl = String(raw.ref || raw.job_url || raw.url || raw.hostedUrl || defaultJobUrl).trim();
    if (jobUrl.startsWith("https://api.smartrecruiters.com/v1/companies/")) {
      // If ref is an API URL, convert to public careers URL
      jobUrl = `https://jobs.smartrecruiters.com/${slug}/${rawId}`;
    }

    const applyUrl = String(
      raw.apply_url ||
      raw.applyUrl ||
      raw.application_url ||
      `${jobUrl}/apply`
    ).trim();

    // Location parsing
    let locationName = "";
    const locationsJson: string[] = [];
    const locObj = raw.location;

    if (locObj) {
      if (typeof locObj === "string") {
        locationName = locObj.trim();
        locationsJson.push(locationName);
      } else if (typeof locObj === "object") {
        if (locObj.fullLocation && typeof locObj.fullLocation === "string") {
          locationName = locObj.fullLocation.trim();
          locationsJson.push(locationName);
        } else {
          const parts = [locObj.address, locObj.city, locObj.region, locObj.country].filter(Boolean);
          if (parts.length > 0) {
            locationName = parts.join(", ");
            locationsJson.push(locationName);
          }
        }
      }
    }

    if (!locationName && (raw.city || raw.region || raw.country)) {
      locationName = [raw.city, raw.region, raw.country].filter(Boolean).join(", ");
      if (locationName && !locationsJson.includes(locationName)) {
        locationsJson.push(locationName);
      }
    }

    // Build Description from jobAd sections or raw strings
    let rawHtml = "";
    if (raw.jobAd?.sections) {
      const sec = raw.jobAd.sections;
      const htmlSections: string[] = [];

      if (sec.companyDescription?.text) {
        const titleText = sec.companyDescription.title || "Company Description";
        htmlSections.push(`<h3>${titleText}</h3>${sec.companyDescription.text}`);
      }
      if (sec.jobDescription?.text) {
        const titleText = sec.jobDescription.title || "Job Description";
        htmlSections.push(`<h3>${titleText}</h3>${sec.jobDescription.text}`);
      }
      if (sec.qualifications?.text) {
        const titleText = sec.qualifications.title || "Qualifications";
        htmlSections.push(`<h3>${titleText}</h3>${sec.qualifications.text}`);
      }
      if (sec.additionalInformation?.text) {
        const titleText = sec.additionalInformation.title || "Additional Information";
        htmlSections.push(`<h3>${titleText}</h3>${sec.additionalInformation.text}`);
      }

      rawHtml = htmlSections.join("\n\n");
    }

    if (!rawHtml) {
      rawHtml = raw.description_html || raw.descriptionHtml || raw.description || raw.jobDescription || "";
    }

    const descriptionHtml = sanitizeHtml(rawHtml);
    const descriptionPlain =
      raw.description_plain ||
      raw.descriptionPlain ||
      (rawHtml.includes("<") ? htmlToPlainText(descriptionHtml) : rawHtml.trim());

    // Workplace / Remote Classification
    const isHybrid = Boolean(locObj?.hybrid);
    const isRemote =
      Boolean(locObj?.remote) ||
      (typeof locObj?.region === "string" && locObj.region.toUpperCase().includes("REMOTE")) ||
      (typeof locationName === "string" && locationName.toLowerCase().includes("remote"));

    let remoteType = classifyRemoteType(
      locationName,
      undefined,
      isRemote,
      `${title} ${descriptionPlain}`
    );

    if (isHybrid) {
      remoteType = "hybrid";
    }

    // Employment type
    const rawEmpType =
      raw.typeOfEmployment?.label ||
      raw.typeOfEmployment?.id ||
      raw.typeOfEmployment ||
      raw.employment_type ||
      raw.jobType;

    const employmentType = classifyEmploymentType(rawEmpType, title);

    // Department & Team
    let department: string | null = null;
    if (raw.department?.label) {
      department = String(raw.department.label).trim();
    } else if (typeof raw.department === "string") {
      department = raw.department.trim();
    } else if (raw.industry?.label) {
      department = String(raw.industry.label).trim();
    }

    let team: string | null = null;
    if (raw.function?.label) {
      team = String(raw.function.label).trim();
    } else if (typeof raw.function === "string") {
      team = raw.function.trim();
    }

    // Salary & Compensation Extraction
    let salaryMin: number | null = null;
    let salaryMax: number | null = null;
    let salaryCurrency: string | null = null;
    let salaryInterval: "yearly" | "monthly" | "hourly" | null = null;

    if (raw.compensation && typeof raw.compensation === "object") {
      if (typeof raw.compensation.min === "number") salaryMin = raw.compensation.min;
      if (typeof raw.compensation.max === "number") salaryMax = raw.compensation.max;
      if (raw.compensation.currency) salaryCurrency = String(raw.compensation.currency);
      if (raw.compensation.interval) salaryInterval = parseSalaryInterval(raw.compensation.interval);
    }

    // Look for salary in customField if available
    if (salaryMin === null && Array.isArray(raw.customField)) {
      for (const field of raw.customField) {
        const label = (field.fieldLabel || field.label || "").toLowerCase();
        if (label.includes("salary") || label.includes("compensation") || label.includes("pay")) {
          const val = String(field.valueLabel || field.value || "");
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

    // Text regex fallback for salary
    if (salaryMin === null && descriptionPlain) {
      const match = descriptionPlain.match(
        /\$\s*(\d{2,3}(?:,\d{3})*(?:\.\d+)?)\s*(?:-|to)\s*\$\s*(\d{2,3}(?:,\d{3})*(?:\.\d+)?)\s*(per year|a year|\/year|\/yr)?/i
      );
      if (match) {
        salaryMin = parseFloat(match[1].replace(/,/g, ""));
        salaryMax = parseFloat(match[2].replace(/,/g, ""));
        salaryCurrency = "USD";
        salaryInterval = "yearly";
      }
    }

    // Released date / updated date
    const postedAt = normalizeIsoDate(
      raw.releasedDate || raw.createdOn || raw.updated_at || raw.createdAt
    );
    const updatedAtSource = normalizeIsoDate(
      raw.updatedOn || raw.releasedDate || raw.updated_at
    );

    return {
      source: this.source,
      source_job_id: rawId,
      company_name: raw.company?.name || source.company_name,
      company_logo: source.company_logo || `/platforms/SmartRecruiters.png`,
      title,
      description: descriptionPlain || `Position at ${source.company_name}`,
      description_html: descriptionHtml || `<p>Position at ${source.company_name}</p>`,
      location: locationName || (remoteType === "remote" ? "Remote" : "Unspecified"),
      locations_json: locationsJson,
      country: (locObj?.country ? String(locObj.country) : raw.country) || null,
      region: (locObj?.region ? String(locObj.region) : raw.region) || null,
      city: (locObj?.city ? String(locObj.city) : raw.city) || null,
      remote_type: remoteType,
      employment_type: employmentType,
      department: department || null,
      team: team || null,
      salary_min: salaryMin,
      salary_max: salaryMax,
      salary_currency: salaryCurrency,
      salary_interval: salaryInterval,
      job_url: jobUrl,
      apply_url: applyUrl,
      posted_at: postedAt,
      updated_at_source: updatedAtSource,
      raw_payload: raw,
    };
  }

  /**
   * Fast health check for SmartRecruiters company job board endpoint
   */
  async healthCheck(source: JobSourceRecord): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      const slug = source.source_identifier.trim();
      const url = `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(slug)}/postings?limit=1`;
      const res = await resilientFetch(url, { method: "GET" });
      const latencyMs = Date.now() - startTime;
      return {
        healthy: res.ok,
        latencyMs,
        message: res.ok
          ? "SmartRecruiters posting API online"
          : `Status ${res.status}: ${res.statusText}`,
      };
    } catch (err: any) {
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
        message: err?.message || "SmartRecruiters health check failed",
      };
    }
  }
}
