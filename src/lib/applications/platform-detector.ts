/**
 * Platform Detector
 *
 * Detects the ATS platform behind a job application URL using multiple signals:
 * - Hostname patterns
 * - URL path patterns
 * - Known platform markers
 * - HTTP response metadata (no full Playwright at this stage)
 *
 * Supported: Greenhouse, Lever, Ashby, Workable, Teamtailor, Recruitee,
 *            SmartRecruiters, generic career page
 */

import { PlatformDetectionResult } from "./types";

// Minimum confidence threshold below which we fall back to "generic"
const CONFIDENCE_THRESHOLD = 0.65;

interface PlatformSignal {
  platform: string;
  confidence: number;
  method: PlatformDetectionResult["detection_method"];
}

// ---------------------------------------------------------------------------
// Hostname-based signals (highest confidence)
// ---------------------------------------------------------------------------
const HOSTNAME_PATTERNS: Array<{ pattern: RegExp; platform: string }> = [
  { pattern: /boards\.greenhouse\.io/i, platform: "greenhouse" },
  { pattern: /greenhouse\.io/i, platform: "greenhouse" },
  { pattern: /jobs\.lever\.co/i, platform: "lever" },
  { pattern: /lever\.co/i, platform: "lever" },
  { pattern: /jobs\.ashbyhq\.com/i, platform: "ashby" },
  { pattern: /ashbyhq\.com/i, platform: "ashby" },
  { pattern: /apply\.workable\.com/i, platform: "workable" },
  { pattern: /workable\.com/i, platform: "workable" },
  { pattern: /teamtailor\.com/i, platform: "teamtailor" },
  { pattern: /recruitee\.com/i, platform: "recruitee" },
  { pattern: /jobs\.smartrecruiters\.com/i, platform: "smartrecruiters" },
  { pattern: /smartrecruiters\.com/i, platform: "smartrecruiters" },
];

// ---------------------------------------------------------------------------
// URL path-based signals (high confidence)
// ---------------------------------------------------------------------------
const PATH_PATTERNS: Array<{ pattern: RegExp; platform: string }> = [
  { pattern: /\/jobs\/\w+\/applications\/new/i, platform: "greenhouse" },
  { pattern: /\/careers\/\w+/i, platform: "generic" },
  { pattern: /\/job-application/i, platform: "generic" },
  { pattern: /\/apply\/\w+/i, platform: "lever" },
];

// ---------------------------------------------------------------------------
// Query parameter signals (medium confidence)
// ---------------------------------------------------------------------------
const QUERY_PATTERNS: Array<{ pattern: RegExp; platform: string }> = [
  { pattern: /gh_jid=/i, platform: "greenhouse" },
  { pattern: /lever-source=/i, platform: "lever" },
  { pattern: /ashby_jid=/i, platform: "ashby" },
];

/**
 * Main platform detection function.
 * Uses URL-only signals (no browser/DOM needed at this stage).
 * Browser-based signals are added by the FormDetector after page load.
 */
export async function detectApplicationPlatform(
  url: string
): Promise<PlatformDetectionResult> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return { platform: "generic", confidence: 0.3, detection_method: "heuristic" };
  }

  const signals: PlatformSignal[] = [];

  // 1. Hostname check (most reliable)
  for (const { pattern, platform } of HOSTNAME_PATTERNS) {
    if (pattern.test(parsedUrl.hostname)) {
      signals.push({ platform, confidence: 0.98, method: "hostname" });
      break;
    }
  }

  // 2. URL path check
  for (const { pattern, platform } of PATH_PATTERNS) {
    if (pattern.test(parsedUrl.pathname)) {
      signals.push({ platform, confidence: 0.80, method: "url_pattern" });
    }
  }

  // 3. Query parameter check
  const queryStr = parsedUrl.search;
  for (const { pattern, platform } of QUERY_PATTERNS) {
    if (pattern.test(queryStr)) {
      signals.push({ platform, confidence: 0.85, method: "url_pattern" });
    }
  }

  // 4. Pick the highest-confidence signal
  if (signals.length === 0) {
    return { platform: "generic", confidence: 0.40, detection_method: "heuristic" };
  }

  signals.sort((a, b) => b.confidence - a.confidence);
  const best = signals[0];

  if (best.confidence < CONFIDENCE_THRESHOLD) {
    return { platform: "generic", confidence: best.confidence, detection_method: "heuristic" };
  }

  return {
    platform: best.platform,
    confidence: best.confidence,
    detection_method: best.method,
  };
}

/**
 * Enhance detection using DOM signals from a loaded Playwright page.
 * Call this after the browser has loaded the page.
 */
export async function enhancePlatformDetectionFromPage(
  page: any, // playwright Page
  currentResult: PlatformDetectionResult
): Promise<PlatformDetectionResult> {
  try {
    // Check for known platform DOM markers
    const platformMarkers = await page.evaluate(() => {
      const markers: string[] = [];

      // Greenhouse markers
      if (document.querySelector("[data-greenhouse-job-application]") ||
          document.querySelector(".application-form") ||
          document.querySelector("#greenhouse-form") ||
          document.querySelector("[class*='greenhouse']") ||
          (window as any).__greenhouse) {
        markers.push("greenhouse");
      }

      // Lever markers
      if (document.querySelector(".lever-job-application") ||
          document.querySelector("[data-lever]") ||
          document.querySelector("[class*='lever-']")) {
        markers.push("lever");
      }

      // Ashby markers
      if (document.querySelector("[data-testid='ashby-application-form']") ||
          document.querySelector(".ashby-application") ||
          (window as any).__ashby_job_posting_id) {
        markers.push("ashby");
      }

      // Workable markers
      if (document.querySelector("[data-ui='workable-application']") ||
          document.querySelector(".whr-apply") ||
          document.querySelector("[class*='workable']")) {
        markers.push("workable");
      }

      // SmartRecruiters markers
      if (document.querySelector("[data-smartrecruiters]") ||
          document.querySelector(".sr-application-form") ||
          document.querySelector("[class*='smartrecruiters']")) {
        markers.push("smartrecruiters");
      }

      // Teamtailor markers
      if (document.querySelector("[data-teamtailor]") ||
          document.querySelector(".teamtailor-apply")) {
        markers.push("teamtailor");
      }

      // Recruitee markers
      if (document.querySelector("[class*='recruitee']") ||
          document.querySelector("[data-recruitee]")) {
        markers.push("recruitee");
      }

      return markers;
    });

    if (platformMarkers.length > 0 && currentResult.confidence < 0.95) {
      const dominantMarker = platformMarkers[0];
      return {
        platform: dominantMarker,
        confidence: 0.92,
        detection_method: "dom",
      };
    }

    // Check meta tags
    const metaPlatform = await page.evaluate(() => {
      const generator = document.querySelector('meta[name="generator"]')?.getAttribute("content") || "";
      const appMeta = document.querySelector('meta[name="application-name"]')?.getAttribute("content") || "";
      const combined = `${generator} ${appMeta}`.toLowerCase();
      if (combined.includes("greenhouse")) return "greenhouse";
      if (combined.includes("lever")) return "lever";
      if (combined.includes("ashby")) return "ashby";
      if (combined.includes("workable")) return "workable";
      if (combined.includes("smartrecruiters")) return "smartrecruiters";
      return null;
    });

    if (metaPlatform && currentResult.confidence < 0.90) {
      return { platform: metaPlatform, confidence: 0.88, detection_method: "meta" };
    }
  } catch (err) {
    // DOM check failed — fallback to existing result
    console.warn("[PlatformDetector] DOM enhancement failed:", err);
  }

  return currentResult;
}
