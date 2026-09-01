const TRACKING_PARAM_REGEX = /^(utm_|ga_|fbclid|gclid|msclkid|twclid|ref|referrer|trk|trackingid|mc_eid|_hsenc|_hsmi|source_campaign|campaign_id)/i;

/**
 * Normalizes and canonicalizes a Job or Apply URL:
 * - Validates protocol (http / https)
 * - Strips marketing & click tracking parameters without breaking job identity
 * - Standardizes hostnames (lowercase, strip www or standardize)
 * - Trims trailing slash from pathnames
 * - Sorts remaining query parameters for deterministic hashing
 */
export function canonicalizeJobUrl(rawUrl?: string | null, baseUrl?: string | null): string | null {
  if (!rawUrl || typeof rawUrl !== "string") return null;

  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  try {
    const parsed = baseUrl ? new URL(trimmed, baseUrl) : new URL(trimmed);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    // Lowercase hostname
    parsed.hostname = parsed.hostname.toLowerCase();

    // Standardize pathname: remove trailing slash if not root
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }

    // Clean tracking query parameters
    const cleanedParams = new URLSearchParams();
    const sortedKeys = Array.from(parsed.searchParams.keys()).sort();

    for (const key of sortedKeys) {
      if (!TRACKING_PARAM_REGEX.test(key)) {
        for (const val of parsed.searchParams.getAll(key)) {
          cleanedParams.append(key, val);
        }
      }
    }

    const searchStr = cleanedParams.toString();
    parsed.search = searchStr ? `?${searchStr}` : "";
    parsed.hash = ""; // Strip URL fragments / anchor tags

    return parsed.toString();
  } catch {
    return null;
  }
}
