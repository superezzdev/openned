import { NormalizedJob } from "../ingestion/types";
import { MergedJobRecord } from "./types";
import { canonicalizeJobUrl } from "./url-canonicalizer";

/**
 * Standardize company name for cross-provider semantic matching
 */
export function normalizeCompanyName(company?: string | null): string {
  if (!company) return "";
  return company
    .toLowerCase()
    .replace(/\b(inc\.?|incorporated|llc\.?|ltd\.?|limited|corp\.?|corporation|gmbh|co\.?|pvt\.?|private)\b/gi, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Standardize job title for cross-provider matching
 */
export function normalizeJobTitle(title?: string | null): string {
  if (!title) return "";
  return title
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, "") // strip [Remote], [Hiring], etc.
    .replace(/\([^\)]*\)/g, "") // strip (Remote), (Full Time), etc.
    .replace(/\b(remote|hybrid|onsite|full-time|part-time|contract|urgent|immediate)\b/gi, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Standardize location for cross-provider matching (e.g. Bengaluru / Bangalore)
 */
export function normalizeJobLocation(loc?: string | null): string {
  if (!loc) return "";
  let l = loc.toLowerCase().trim();

  // Alias replacements
  const aliases: [RegExp, string][] = [
    [/\b(bangalore|bengaluru)\b/g, "bengaluru"],
    [/\b(san francisco|sf|bay area)\b/g, "san francisco"],
    [/\b(new york city|nyc|new york, ny)\b/g, "new york"],
    [/\b(united states of america|united states|usa)\b/g, "us"],
    [/\b(united kingdom|great britain|uk)\b/g, "uk"],
  ];

  for (const [pattern, replacement] of aliases) {
    l = l.replace(pattern, replacement);
  }

  return l
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Computes semantic fingerprint: company + title + location
 */
export function computeSemanticFingerprint(job: Partial<NormalizedJob>): string {
  const c = normalizeCompanyName(job.company_name);
  const t = normalizeJobTitle(job.title);
  const l = normalizeJobLocation(job.location || job.city || job.country);
  return `${c}:::${t}:::${l}`;
}

/**
 * Merges two duplicate jobs, preserving the richest available metadata
 */
export function mergeJobRecords(existing: MergedJobRecord, incoming: NormalizedJob): MergedJobRecord {
  const existingSources = existing.matched_sources || [existing.source];
  const newSources = Array.from(new Set([...existingSources, incoming.source]));

  // Pick richest description
  const existingDescLen = (existing.description || "").length;
  const incomingDescLen = (incoming.description || "").length;
  const preferredDesc = incomingDescLen > existingDescLen ? incoming.description : existing.description;
  const preferredHtml = incoming.description_html || existing.description_html;

  // Pick salary if incoming has it and existing does not
  const salaryMin = existing.salary_min ?? incoming.salary_min ?? null;
  const salaryMax = existing.salary_max ?? incoming.salary_max ?? null;
  const salaryCurrency = existing.salary_currency || incoming.salary_currency || null;
  const salaryInterval = existing.salary_interval || incoming.salary_interval || null;

  // Pick logo if available
  const companyLogo = existing.company_logo || incoming.company_logo || null;

  // Pick best location
  const location = (existing.location && existing.location !== "Remote" ? existing.location : incoming.location) || existing.location;
  const locationsJson = existing.locations_json || incoming.locations_json;


  // Pick earlier posted date if both available
  let postedAt = existing.posted_at || incoming.posted_at;
  if (existing.posted_at && incoming.posted_at) {
    const d1 = new Date(existing.posted_at).getTime();
    const d2 = new Date(incoming.posted_at).getTime();
    if (!isNaN(d1) && !isNaN(d2)) {
      postedAt = d1 < d2 ? existing.posted_at : incoming.posted_at;
    }
  }

  return {
    ...existing,
    matched_sources: newSources,
    description: preferredDesc,
    description_html: preferredHtml,
    salary_min: salaryMin,
    salary_max: salaryMax,
    salary_currency: salaryCurrency,
    salary_interval: salaryInterval,
    company_logo: companyLogo,
    location,
    locations_json: locationsJson,
    apply_url: existing.apply_url || incoming.apply_url,

    job_url: existing.job_url || incoming.job_url,
    posted_at: postedAt,
  };
}

/**
 * Deduplicates a collection of normalized jobs using 3 layers:
 * 1. Source + SourceJobID
 * 2. Canonical Job URL
 * 3. Semantic Cross-Provider Fingerprint
 */
export function deduplicateJobs(jobs: NormalizedJob[]): {
  mergedJobs: MergedJobRecord[];
  duplicatesCount: number;
} {
  const resultMap = new Map<string, MergedJobRecord>();
  const urlIndex = new Map<string, string>(); // canonicalUrl -> key in resultMap
  const semanticIndex = new Map<string, string>(); // fingerprint -> key in resultMap
  let duplicatesCount = 0;

  for (const job of jobs) {
    if (!job || !job.title || !job.job_url) continue;

    const exactKey = `${job.source}:::${job.source_job_id}`;
    const canonicalUrl = canonicalizeJobUrl(job.job_url) || job.job_url.trim().toLowerCase();
    const fingerprint = computeSemanticFingerprint(job);

    // Level 1: Exact ID match
    if (resultMap.has(exactKey)) {
      duplicatesCount++;
      const existing = resultMap.get(exactKey)!;
      resultMap.set(exactKey, mergeJobRecords(existing, job));
      continue;
    }

    // Level 2: Canonical URL match
    const existingKeyByUrl = urlIndex.get(canonicalUrl);
    if (existingKeyByUrl && resultMap.has(existingKeyByUrl)) {
      duplicatesCount++;
      const existing = resultMap.get(existingKeyByUrl)!;
      resultMap.set(existingKeyByUrl, mergeJobRecords(existing, job));
      continue;
    }

    // Level 3: Semantic Fingerprint match (only when company and title are substantial)
    const normCompany = normalizeCompanyName(job.company_name);
    const normTitle = normalizeJobTitle(job.title);
    if (normCompany.length > 2 && normTitle.length > 3 && semanticIndex.has(fingerprint)) {
      const existingKeyByFingerprint = semanticIndex.get(fingerprint);
      if (existingKeyByFingerprint && resultMap.has(existingKeyByFingerprint)) {
        duplicatesCount++;
        const existing = resultMap.get(existingKeyByFingerprint)!;
        resultMap.set(existingKeyByFingerprint, mergeJobRecords(existing, job));
        continue;
      }
    }

    // New unique job
    const mergedRecord: MergedJobRecord = {
      ...job,
      matched_sources: [job.source],
    };

    resultMap.set(exactKey, mergedRecord);
    urlIndex.set(canonicalUrl, exactKey);
    if (normCompany.length > 2 && normTitle.length > 3) {
      semanticIndex.set(fingerprint, exactKey);
    }
  }

  return {
    mergedJobs: Array.from(resultMap.values()),
    duplicatesCount,
  };
}
