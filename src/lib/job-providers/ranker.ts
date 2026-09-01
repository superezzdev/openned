import { JobSearchParams, MergedJobRecord } from "./types";

/**
 * Deterministically scores and ranks merged jobs according to relevance, location, freshness, and completeness
 */
export function rankJobs(jobs: MergedJobRecord[], params: JobSearchParams): MergedJobRecord[] {
  const queryTokens = (params.query || "")
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1);

  const locToken = (params.location || "").toLowerCase().trim();
  const countryToken = (params.country || "").toLowerCase().trim();
  const wantsRemote = params.remote === true;

  const scoredJobs = jobs.map((job) => {
    let score = 50; // Baseline score

    const titleLower = (job.title || "").toLowerCase();
    const descLower = (job.description || "").toLowerCase();
    const locLower = (job.location || "").toLowerCase();
    const companyLower = (job.company_name || "").toLowerCase();

    // 1. Query Keyword Relevance (up to +40 pts)
    if (queryTokens.length > 0) {
      let titleHits = 0;
      let descHits = 0;
      for (const token of queryTokens) {
        if (titleLower.includes(token)) titleHits++;
        if (companyLower.includes(token)) titleHits++;
        if (descLower.includes(token)) descHits++;
      }
      const tokenMatchRatio = titleHits / queryTokens.length;
      score += Math.round(tokenMatchRatio * 30);
      score += Math.min(10, descHits * 2);
    }

    // 2. Location Relevance (up to +20 pts)
    if (locToken) {
      if (locLower.includes(locToken) || (job.city && job.city.toLowerCase().includes(locToken))) {
        score += 20;
      } else if (job.country && job.country.toLowerCase().includes(locToken)) {
        score += 10;
      }
    }
    if (countryToken && job.country && job.country.toLowerCase() === countryToken) {
      score += 10;
    }

    // 3. Remote Alignment (up to +15 pts)
    if (wantsRemote) {
      if (job.remote_type === "remote") {
        score += 15;
      } else if (job.remote_type === "hybrid") {
        score += 5;
      }
    }

    // 4. Freshness (up to +15 pts)
    if (job.posted_at) {
      try {
        const postedMs = new Date(job.posted_at).getTime();
        const nowMs = Date.now();
        const ageHours = (nowMs - postedMs) / (1000 * 60 * 60);

        if (ageHours <= 24) {
          score += 15; // Posted in last 24h
        } else if (ageHours <= 72) {
          score += 10; // Last 3 days
        } else if (ageHours <= 168) {
          score += 6; // Last 7 days
        } else if (ageHours <= 720) {
          score += 2; // Last 30 days
        }
      } catch {
        // Ignore date parse issues
      }
    }

    // 5. Metadata Completeness (+10 pts)
    if (job.salary_min !== null || job.salary_max !== null) score += 4;
    if (job.company_logo) score += 2;
    if (job.description && job.description.length > 200) score += 2;
    if (job.apply_url) score += 2;

    // 6. Cross-Provider Multi-Source Boost (+5 pts for verified jobs across 2+ platforms)
    if (job.matched_sources && job.matched_sources.length > 1) {
      score += Math.min(10, (job.matched_sources.length - 1) * 3);
    }

    return {
      ...job,
      relevance_score: score,
    };
  });

  // Sort descending by relevance score, tie-break by posted_at descending
  scoredJobs.sort((a, b) => {
    if (b.relevance_score !== a.relevance_score) {
      return (b.relevance_score || 0) - (a.relevance_score || 0);
    }
    const tA = a.posted_at ? new Date(a.posted_at).getTime() : 0;
    const tB = b.posted_at ? new Date(b.posted_at).getTime() : 0;
    return tB - tA;
  });

  return scoredJobs;
}
