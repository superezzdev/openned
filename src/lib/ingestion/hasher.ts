import { createHash } from "node:crypto";
import { NormalizedJob } from "./types";

/**
 * Clean and standardize string for hashing
 */
function sanitizeForHash(val: string | null | undefined): string {
  if (!val) return "";
  return val
    .toLowerCase()
    .replace(/<[^>]*>/g, " ") // strip HTML tags
    .replace(/\s+/g, " ") // normalize whitespace
    .trim();
}

/**
 * Computes a SHA-256 fingerprint from the core semantic content of a normalized job.
 * Input tuple: company_name | title | location | description | apply_url
 */
export function computeJobContentHash(job: Partial<NormalizedJob>): string {
  const company = sanitizeForHash(job.company_name);
  const title = sanitizeForHash(job.title);
  const location = sanitizeForHash(job.location);
  const description = sanitizeForHash(job.description || job.description_html);
  const applyUrl = (job.apply_url || job.job_url || "").trim().toLowerCase();

  const rawInput = `${company}:::${title}:::${location}:::${description}:::${applyUrl}`;

  return createHash("sha256").update(rawInput).digest("hex");
}
