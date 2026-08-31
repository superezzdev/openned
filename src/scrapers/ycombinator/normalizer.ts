import { createHash } from "node:crypto";
import {
  classifyEmploymentType,
  classifyRemoteType,
  htmlToPlainText,
  normalizeIsoDate,
  parseSalaryInterval,
  sanitizeHtml,
} from "../../lib/ingestion/normalizer";
import { NormalizedJob } from "../../lib/ingestion/types";
import { SOURCE_NAME } from "./constants";
import { YCJobRaw, YCScrapedJob } from "./types";

/**
 * Computes deterministic SHA-256 content hash from core semantic job fields
 */
export function computeYcContentHash(
  companyName?: string | null,
  title?: string | null,
  location?: string | string[] | null,
  description?: string | null,
  applyUrl?: string | null
): string {
  const locStr = Array.isArray(location) ? location.join(", ") : location || "";
  const sanitize = (s?: string | null) =>
    (s || "")
      .toLowerCase()
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const rawInput = [
    sanitize(companyName),
    sanitize(title),
    sanitize(locStr),
    sanitize(description),
    (applyUrl || "").trim().toLowerCase(),
  ].join(":::");

  return createHash("sha256").update(rawInput).digest("hex");
}

/**
 * Normalizes raw parsed YC job data into user-specified YCScrapedJob format
 */
export function normalizeYcJobToScrapedJob(
  raw: YCJobRaw,
  scrapedAt: Date = new Date()
): YCScrapedJob {
  const cleanTitle = (raw.title || "Untitled Position").trim();
  const cleanCompany = (raw.company_name || "YC Startup").trim();
  const locationsArray = Array.isArray(raw.location)
    ? raw.location.filter(Boolean)
    : raw.location
    ? [String(raw.location).trim()]
    : undefined;

  const locString = locationsArray ? locationsArray.join(", ") : undefined;
  const descriptionPlain = raw.description
    ? htmlToPlainText(raw.description)
    : undefined;
  const descriptionHtml = raw.description_html
    ? sanitizeHtml(raw.description_html)
    : raw.description
    ? `<p>${raw.description}</p>`
    : undefined;

  const contentHash = computeYcContentHash(
    cleanCompany,
    cleanTitle,
    locString,
    descriptionPlain,
    raw.apply_url || raw.job_url
  );

  let postedDate: Date | null = null;
  if (raw.posted_at) {
    const d = new Date(raw.posted_at);
    if (!isNaN(d.getTime())) {
      postedDate = d;
    }
  }

  return {
    source: SOURCE_NAME,
    source_job_id: raw.source_job_id,
    title: cleanTitle,
    company_name: cleanCompany,
    company_logo_url: raw.company_logo_url || null,
    company_url: raw.company_url || null,
    job_url: raw.job_url,
    apply_url: raw.apply_url || raw.job_url,
    description: descriptionPlain || null,
    description_html: descriptionHtml || null,
    location: locationsArray && locationsArray.length > 0 ? locationsArray : null,
    remote: raw.remote ?? Boolean(locString?.toLowerCase().includes("remote")),
    employment_type: raw.employment_type || null,
    salary_min: raw.salary_min || null,
    salary_max: raw.salary_max || null,
    salary_currency: raw.salary_currency || null,
    job_category: raw.job_category || null,
    experience_level: raw.experience_level || null,
    yc_batch: raw.yc_batch || null,
    company_description: raw.company_description || null,
    posted_at: postedDate,
    scraped_at: scrapedAt,
    content_hash: contentHash,
    raw_payload: raw.raw_payload || null,
  };
}

/**
 * Normalizes raw parsed YC job data into core application NormalizedJob schema for PostgreSQL/Supabase insertion
 */
export function normalizeYcJobToCanonical(
  raw: YCJobRaw,
  sourceRecord?: { id?: string; company_name?: string; company_logo?: string | null }
): NormalizedJob {
  const scraped = normalizeYcJobToScrapedJob(raw);
  const locString = scraped.location && scraped.location.length > 0 ? scraped.location.join(", ") : "Unspecified";

  const remoteType = classifyRemoteType(
    locString,
    undefined,
    scraped.remote,
    `${scraped.title} ${scraped.description || ""}`
  );

  const employmentType = classifyEmploymentType(
    scraped.employment_type,
    scraped.title
  );

  const salaryInterval = parseSalaryInterval(raw.salary_interval || (scraped.salary_min ? "yearly" : null));

  return {
    source: "ycombinator",
    source_job_id: scraped.source_job_id,
    company_name: sourceRecord?.company_name || scraped.company_name,
    company_logo: scraped.company_logo_url || sourceRecord?.company_logo || "/platforms/ycombinator.png",
    title: scraped.title,
    description: scraped.description || `Position at ${scraped.company_name}`,
    description_html: scraped.description_html || `<p>Position at ${scraped.company_name}</p>`,
    location: locString || (remoteType === "remote" ? "Remote" : "Unspecified"),
    locations_json: scraped.location || [],
    country: null,
    region: null,
    city: null,
    remote_type: remoteType,
    employment_type: employmentType,
    department: scraped.job_category || null,
    team: null,
    salary_min: scraped.salary_min || null,
    salary_max: scraped.salary_max || null,
    salary_currency: scraped.salary_currency || (scraped.salary_min ? "USD" : null),
    salary_interval: salaryInterval,
    job_url: scraped.job_url,
    apply_url: scraped.apply_url || scraped.job_url,
    posted_at: scraped.posted_at ? normalizeIsoDate(scraped.posted_at.toISOString()) : null,
    updated_at_source: null,
    raw_payload: {
      ...raw.raw_payload,
      yc_batch: scraped.yc_batch,
      company_description: scraped.company_description,
      experience_level: scraped.experience_level,
      job_category: scraped.job_category,
      company_url: scraped.company_url,
    },
  };
}
