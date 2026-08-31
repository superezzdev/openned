import { createHash } from "node:crypto";
import {
  BASE_URL,
  DEFAULT_HEADERS,
  DEFAULT_MAX_RETRIES,
  DEFAULT_REQUEST_DELAY_MS,
  DEFAULT_ROLE_PATHS,
  DEFAULT_TIMEOUT_MS,
  RELATIVE_JOB_URL_REGEX,
  YC_JOB_URL_REGEX,
} from "./constants";
import { ScraperOptions } from "./types";

/**
 * Calculates exponential backoff with full jitter
 */
export function calculateBackoff(attempt: number, baseDelay = 500, maxDelay = 8000): number {
  const exponential = Math.min(maxDelay, baseDelay * Math.pow(2, attempt));
  const jitter = (Math.random() - 0.5) * exponential * 0.5;
  return Math.max(100, Math.floor(exponential + jitter));
}

/**
 * Delay execution for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Checks if a URL represents a YC job listing URL
 */
export function isYcJobUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  return YC_JOB_URL_REGEX.test(trimmed) || RELATIVE_JOB_URL_REGEX.test(trimmed);
}

/**
 * Canonicalizes a YC job URL:
 * - Resolves relative paths to absolute YC URLs
 * - Strips unnecessary query parameters and tracking tokens
 * - Normalizes protocol and domain
 * - Strips trailing slashes and hashes
 * - Validates path structure (/companies/[company]/jobs/[job-id-slug])
 */
export function canonicalizeJobUrl(url: string | null | undefined, baseUrl = BASE_URL): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const parsed = trimmed.startsWith("http") ? new URL(trimmed) : new URL(trimmed, baseUrl);

    // Normalize protocol & hostname
    if (parsed.hostname !== "www.ycombinator.com" && parsed.hostname !== "ycombinator.com") {
      return null;
    }

    // Check path matches /companies/:slug/jobs/:jobId
    const pathParts = parsed.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
    if (pathParts.length !== 4 || pathParts[0] !== "companies" || pathParts[2] !== "jobs") {
      return null;
    }

    const companySlug = pathParts[1].toLowerCase();
    const jobSlug = pathParts[3];

    if (!companySlug || !jobSlug) {
      return null;
    }

    return `https://www.ycombinator.com/companies/${encodeURIComponent(companySlug)}/jobs/${jobSlug}`;
  } catch {
    return null;
  }
}

/**
 * Extracts a stable source job ID from a canonical YC job URL.
 * Extracts the primary ID prefix if present (e.g. 'GjO3enf' from 'GjO3enf-backend-engineer-go')
 * or falls back to sha256(canonicalJobUrl).
 */
export function extractJobIdFromUrl(canonicalUrl: string): string {
  try {
    const parsed = new URL(canonicalUrl);
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    const jobSegment = pathParts[3]; // e.g. "GjO3enf-backend-engineer-go"

    if (jobSegment) {
      const parts = jobSegment.split("-");
      if (parts[0] && parts[0].length >= 5) {
        return parts[0];
      }
      return jobSegment;
    }
  } catch {
    // Fall back to hash
  }

  return createHash("sha256").update(canonicalUrl.toLowerCase().trim()).digest("hex").slice(0, 24);
}

/**
 * Robust HTTP fetch for HTML content with retries, exponential backoff, jitter, timeouts, and rate-limit handling
 */
export async function fetchHtmlWithRetry(
  url: string,
  options: {
    timeoutMs?: number;
    maxRetries?: number;
    headers?: Record<string, string>;
  } = {}
): Promise<string> {
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const headers = { ...DEFAULT_HEADERS, ...(options.headers || {}) };

  let attempt = 0;

  while (attempt <= maxRetries) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle 429 Too Many Requests
      if (response.status === 429) {
        if (attempt < maxRetries) {
          const retryAfterHeader = response.headers.get("Retry-After");
          let delayMs = 1500;
          if (retryAfterHeader) {
            const parsedSeconds = parseInt(retryAfterHeader, 10);
            if (!isNaN(parsedSeconds)) {
              delayMs = parsedSeconds * 1000;
            }
          } else {
            delayMs = calculateBackoff(attempt, 1000, 10000);
          }
          console.warn(`[YC Scraper 429] Rate limited on ${url}. Retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})`);
          await sleep(delayMs);
          attempt++;
          continue;
        }
        throw new Error(`HTTP 429 Too Many Requests on ${url}`);
      }

      // Handle 5xx Server Errors
      if (response.status >= 500 && response.status <= 504) {
        if (attempt < maxRetries) {
          const delayMs = calculateBackoff(attempt, 1000, 8000);
          console.warn(`[YC Scraper ${response.status}] Server error on ${url}. Retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})`);
          await sleep(delayMs);
          attempt++;
          continue;
        }
        throw new Error(`HTTP ${response.status} Server Error on ${url}`);
      }

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        throw new Error(`HTTP Error ${response.status} (${response.statusText}) on ${url}: ${errText.slice(0, 150)}`);
      }

      return await response.text();
    } catch (err: any) {
      clearTimeout(timeoutId);

      const isTimeout = err.name === "AbortError";
      const isNetworkError = err.message?.includes("fetch failed") || err.code === "ECONNRESET" || isTimeout;

      if (isNetworkError && attempt < maxRetries) {
        const delayMs = calculateBackoff(attempt, 800, 6000);
        console.warn(`[YC Scraper Network Error] ${isTimeout ? "Timeout" : err.message} on ${url}. Retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})`);
        await sleep(delayMs);
        attempt++;
        continue;
      }

      throw err;
    }
  }

  throw new Error(`Failed to fetch ${url} after ${maxRetries} retries`);
}

/**
 * Extracts all valid YC job URLs from an HTML document
 */
export function extractJobUrlsFromHtml(html: string, baseUrl = BASE_URL): string[] {
  const discovered = new Set<string>();

  // 1. Extract from href links
  const hrefMatches = html.matchAll(/href=["'](\/companies\/[^\/]+\/jobs\/[^\/"'#\?]+[^"']*)["']/gi);
  for (const m of hrefMatches) {
    const canonical = canonicalizeJobUrl(m[1], baseUrl);
    if (canonical) {
      discovered.add(canonical);
    }
  }

  const absoluteMatches = html.matchAll(/href=["'](https?:\/\/(?:www\.)?ycombinator\.com\/companies\/[^\/]+\/jobs\/[^\/"'#\?]+[^"']*)["']/gi);
  for (const m of absoluteMatches) {
    const canonical = canonicalizeJobUrl(m[1], baseUrl);
    if (canonical) {
      discovered.add(canonical);
    }
  }

  // 2. Extract from embedded data-page state
  const dataPageMatch = html.match(/data-page="([^"]+)"/i);
  if (dataPageMatch) {
    try {
      const rawJson = dataPageMatch[1]
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">");
      const parsed = JSON.parse(rawJson);

      if (Array.isArray(parsed?.props?.jobPostings)) {
        for (const jp of parsed.props.jobPostings) {
          const u = jp.url || (jp.companyUrl && jp.id ? `${jp.companyUrl}/jobs/${jp.id}` : null);
          const canonical = canonicalizeJobUrl(u, baseUrl);
          if (canonical) discovered.add(canonical);
        }
      }

      if (Array.isArray(parsed?.props?.relatedJobs)) {
        for (const rj of parsed.props.relatedJobs) {
          const canonical = canonicalizeJobUrl(rj.url, baseUrl);
          if (canonical) discovered.add(canonical);
        }
      }

      if (parsed?.props?.job?.url) {
        const canonical = canonicalizeJobUrl(parsed.props.job.url, baseUrl);
        if (canonical) discovered.add(canonical);
      }
    } catch {
      // Ignore JSON parse errors in data-page
    }
  }

  return Array.from(discovered);
}

/**
 * Discovers publicly accessible YC job URLs from index and role pages
 */
export async function discoverJobUrls(options: ScraperOptions = {}): Promise<string[]> {
  const visitedUrls = new Set<string>();
  const discoveredJobUrls = new Set<string>();
  const delayMs = options.requestDelayMs || DEFAULT_REQUEST_DELAY_MS;
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;

  // Determine discovery endpoints
  const pathsToCrawl = options.roles && options.roles.length > 0
    ? options.roles.map((r) => r.startsWith("/") ? r : `/jobs/role/${r}`)
    : [
        "/jobs",
        ...DEFAULT_ROLE_PATHS,
      ];

  console.log(`[ycombinator] Starting URL discovery across ${pathsToCrawl.length} listing pages...`);

  for (const relPath of pathsToCrawl) {
    const pageUrl = relPath.startsWith("http") ? relPath : `${BASE_URL}${relPath}`;
    if (visitedUrls.has(pageUrl)) continue;
    visitedUrls.add(pageUrl);

    try {
      const html = await fetchHtmlWithRetry(pageUrl, { timeoutMs });
      const jobUrls = extractJobUrlsFromHtml(html, BASE_URL);

      for (const ju of jobUrls) {
        discoveredJobUrls.add(ju);
      }

      console.log(`[ycombinator] Discovered ${jobUrls.length} jobs on "${relPath}" (Total unique: ${discoveredJobUrls.size})`);

      if (options.maxJobs && discoveredJobUrls.size >= options.maxJobs) {
        console.log(`[ycombinator] Reached maxJobs target limit (${options.maxJobs}). Ending discovery early.`);
        break;
      }

      if (delayMs > 0) {
        await sleep(delayMs);
      }
    } catch (err: any) {
      console.warn(`[ycombinator] Failed to fetch discovery page "${relPath}": ${err?.message || err}`);
    }
  }

  const allDiscovered = Array.from(discoveredJobUrls);
  console.log(`[ycombinator] URL discovery complete. Total unique job URLs discovered: ${allDiscovered.length}`);
  return options.maxJobs ? allDiscovered.slice(0, options.maxJobs) : allDiscovered;
}
