import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { jobSearchService } from "@/lib/job-providers";
import { getFullProfileData } from "./user-profile-loader";
import {
  JobRecord,
  UserProfileData,
  PlatformConfig,
  SUPPORTED_PLATFORMS,
} from "./jobs-constants";

export type { JobRecord, UserProfileData, PlatformConfig };
export { SUPPORTED_PLATFORMS };

/**
 * Normalizes any raw source string to a canonical platform ID
 */
export function normalizeSourceToPlatform(source?: string | null): string {
  const p = (source || "greenhouse").toLowerCase();
  if (p.includes("linkedin")) return "linkedin";
  if (p.includes("glassdoor") || p === "salary-enricher") return "glassdoor";
  if (p.includes("google")) return "google-jobs";
  if (p.includes("indeed")) return "indeed";
  if (p.includes("workday")) return "workday";
  if (p.includes("yc") || p.includes("ycombinator")) return "ycombinator";
  if (p.includes("internship")) return "internships";
  if (p.includes("freelancer")) return "freelancer";
  if (p.includes("remote") || p === "remoteok" || p === "remotive") return "remote-jobs";
  if (p.includes("jobicy")) return "jobicy";
  if (p.includes("smartrecruiter")) return "smartrecruiters";
  if (p.includes("wellfound")) return "wellfound";
  if (p.includes("greenhouse")) return "greenhouse";
  if (p.includes("lever")) return "lever";
  if (p.includes("ashby")) return "ashby";
  if (p.includes("workable")) return "workable";
  if (p.includes("adzuna")) return "adzuna";
  if (p.includes("jsearch")) return "jsearch";
  return "greenhouse";
}

/**
 * Extract tags, country, job type, remote type, experience level, salary from job data and text
 */
export function extractJobMetadata(
  title: string,
  description: string,
  userSkills: string[],
  rawLocation?: string | null,
  rawCountry?: string | null,
  rawRemoteType?: string | null,
  rawJobType?: string | null
): {
  tags: string[];
  jobType: string;
  experienceLevel: string;
  remoteType: "remote" | "hybrid" | "onsite";
  country: string;
  countryCode: string;
  salary: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  location: string;
} {
  const combined = `${title} ${description} ${rawLocation || ""}`.toLowerCase();

  // 1. Experience level
  let experienceLevel = "Mid-Level";
  if (
    combined.includes("lead") ||
    combined.includes("principal") ||
    combined.includes("staff") ||
    combined.includes("director") ||
    combined.includes("head of") ||
    combined.includes("vp ") ||
    combined.includes("chief")
  ) {
    experienceLevel = "Lead / Staff";
  } else if (
    combined.includes("senior") ||
    combined.includes("sr.") ||
    combined.includes("sr ") ||
    combined.includes("staff") ||
    combined.includes("expert")
  ) {
    experienceLevel = "Senior";
  } else if (
    combined.includes("junior") ||
    combined.includes("entry") ||
    combined.includes("intern") ||
    combined.includes("graduate") ||
    combined.includes("associate") ||
    combined.includes("jr.") ||
    combined.includes("jr ")
  ) {
    experienceLevel = "Junior / Entry";
  }

  // 2. Job type
  let jobType = rawJobType || "Full-time";
  const jobTypeLower = jobType.toLowerCase();
  if (
    jobTypeLower.includes("contract") ||
    jobTypeLower.includes("freelance") ||
    combined.includes("contract") ||
    combined.includes("freelance") ||
    combined.includes("contractor")
  ) {
    jobType = "Contract";
  } else if (
    jobTypeLower.includes("part") ||
    combined.includes("part-time") ||
    combined.includes("part time")
  ) {
    jobType = "Part-time";
  } else if (
    jobTypeLower.includes("intern") ||
    combined.includes("internship") ||
    combined.includes("intern ")
  ) {
    jobType = "Internship";
  } else {
    jobType = "Full-time";
  }

  // 3. Workplace / Remote Type
  let remoteType: "remote" | "hybrid" | "onsite" = "remote";
  const rTypeLower = (rawRemoteType || "").toLowerCase();
  if (
    rTypeLower.includes("hybrid") ||
    combined.includes("hybrid") ||
    combined.includes("flexible remote")
  ) {
    remoteType = "hybrid";
  } else if (
    rTypeLower.includes("onsite") ||
    rTypeLower.includes("on-site") ||
    rTypeLower.includes("office") ||
    combined.includes("on-site") ||
    combined.includes("onsite") ||
    combined.includes("in-office") ||
    combined.includes("in office")
  ) {
    remoteType = "onsite";
  } else {
    remoteType = "remote";
  }

  // 4. Country & Location
  let country = "Worldwide";
  let countryCode = "remote";
  let location = rawLocation || "Remote";

  const rawCountryLower = (rawCountry || "").toLowerCase().trim();
  if (
    rawCountryLower === "us" ||
    rawCountryLower === "usa" ||
    rawCountryLower.includes("united states")
  ) {
    country = "United States";
    countryCode = "US";
  } else if (
    rawCountryLower === "gb" ||
    rawCountryLower === "uk" ||
    rawCountryLower.includes("united kingdom") ||
    rawCountryLower.includes("great britain")
  ) {
    country = "United Kingdom";
    countryCode = "GB";
  } else if (
    rawCountryLower === "in" ||
    rawCountryLower === "ind" ||
    rawCountryLower.includes("india")
  ) {
    country = "India";
    countryCode = "IN";
  } else if (
    rawCountryLower === "ca" ||
    rawCountryLower === "can" ||
    rawCountryLower.includes("canada")
  ) {
    country = "Canada";
    countryCode = "CA";
  } else if (
    rawCountryLower === "de" ||
    rawCountryLower === "deu" ||
    rawCountryLower.includes("germany") ||
    rawCountryLower.includes("deutschland")
  ) {
    country = "Germany";
    countryCode = "DE";
  } else if (
    rawCountryLower === "fr" ||
    rawCountryLower === "fra" ||
    rawCountryLower.includes("france")
  ) {
    country = "France";
    countryCode = "FR";
  } else if (
    rawCountryLower === "au" ||
    rawCountryLower === "aus" ||
    rawCountryLower.includes("australia")
  ) {
    country = "Australia";
    countryCode = "AU";
  } else if (
    rawCountryLower === "nl" ||
    rawCountryLower === "nld" ||
    rawCountryLower.includes("netherlands")
  ) {
    country = "Netherlands";
    countryCode = "NL";
  } else if (
    rawCountryLower === "sg" ||
    rawCountryLower === "sgp" ||
    rawCountryLower.includes("singapore")
  ) {
    country = "Singapore";
    countryCode = "SG";
  } else {
    // Detect from combined text and location
    if (
      combined.includes("united states") ||
      combined.includes("usa") ||
      combined.includes("u.s.") ||
      combined.includes("san francisco") ||
      combined.includes("new york") ||
      combined.includes("seattle") ||
      combined.includes("austin") ||
      combined.includes("chicago") ||
      combined.includes("los angeles") ||
      combined.includes("boston") ||
      combined.includes("denver") ||
      combined.includes(", ca") ||
      combined.includes(", ny") ||
      combined.includes(", tx") ||
      combined.includes(", wa")
    ) {
      country = "United States";
      countryCode = "US";
      if (!rawLocation) location = "United States (Remote Friendly)";
    } else if (
      combined.includes("united kingdom") ||
      combined.includes("london") ||
      combined.includes("uk") ||
      combined.includes("u.k.") ||
      combined.includes("manchester") ||
      combined.includes("cambridge") ||
      combined.includes("edinburgh")
    ) {
      country = "United Kingdom";
      countryCode = "GB";
      if (!rawLocation) location = "United Kingdom (Remote Friendly)";
    } else if (
      combined.includes("india") ||
      combined.includes("bengaluru") ||
      combined.includes("bangalore") ||
      combined.includes("mumbai") ||
      combined.includes("delhi") ||
      combined.includes("hyderabad") ||
      combined.includes("pune") ||
      combined.includes("chennai") ||
      combined.includes("noida") ||
      combined.includes("gurgaon")
    ) {
      country = "India";
      countryCode = "IN";
      if (!rawLocation) location = "India (Remote / Hybrid)";
    } else if (
      combined.includes("canada") ||
      combined.includes("toronto") ||
      combined.includes("vancouver") ||
      combined.includes("montreal") ||
      combined.includes("ottawa") ||
      combined.includes("waterloo")
    ) {
      country = "Canada";
      countryCode = "CA";
      if (!rawLocation) location = "Canada (Remote Friendly)";
    } else if (
      combined.includes("germany") ||
      combined.includes("berlin") ||
      combined.includes("munich") ||
      combined.includes("münchen") ||
      combined.includes("frankfurt") ||
      combined.includes("hamburg")
    ) {
      country = "Germany";
      countryCode = "DE";
      if (!rawLocation) location = "Germany (Remote / Hybrid)";
    } else if (
      combined.includes("france") ||
      combined.includes("paris") ||
      combined.includes("lyon")
    ) {
      country = "France";
      countryCode = "FR";
      if (!rawLocation) location = "France (Remote Friendly)";
    } else if (
      combined.includes("australia") ||
      combined.includes("sydney") ||
      combined.includes("melbourne") ||
      combined.includes("brisbane")
    ) {
      country = "Australia";
      countryCode = "AU";
      if (!rawLocation) location = "Australia (Remote / Hybrid)";
    } else if (
      combined.includes("netherlands") ||
      combined.includes("amsterdam") ||
      combined.includes("rotterdam")
    ) {
      country = "Netherlands";
      countryCode = "NL";
      if (!rawLocation) location = "Netherlands (Remote Friendly)";
    } else if (combined.includes("singapore")) {
      country = "Singapore";
      countryCode = "SG";
      if (!rawLocation) location = "Singapore (Remote Friendly)";
    } else if (
      combined.includes("remote") ||
      combined.includes("worldwide") ||
      combined.includes("anywhere")
    ) {
      country = "Worldwide";
      countryCode = "remote";
      if (!rawLocation) location = "Remote (Worldwide)";
    }
  }

  // 5. Salary
  let salary = "Competitive Compensation";
  let salaryMin: number | null = null;
  let salaryMax: number | null = null;

  const salaryMatch = combined.match(
    /\$\s*(\d{2,3}(?:,\d{3})?)\s*k?\s*(?:-|to)\s*\$?\s*(\d{2,3}(?:,\d{3})?)\s*k?/i
  );
  if (salaryMatch) {
    const rawMin = parseInt(salaryMatch[1].replace(/,/g, ""), 10);
    const rawMax = parseInt(salaryMatch[2].replace(/,/g, ""), 10);
    salaryMin = rawMin < 1000 ? rawMin * 1000 : rawMin;
    salaryMax = rawMax < 1000 ? rawMax * 1000 : rawMax;
    salary = `$${salaryMatch[1]}k - $${salaryMatch[2]}k • Equity`;
  } else if (experienceLevel === "Senior" || experienceLevel === "Lead / Staff") {
    salary = "$140k - $190k • Equity";
    salaryMin = 140000;
    salaryMax = 190000;
  } else if (experienceLevel === "Junior / Entry") {
    salary = "$80k - $110k • Benefits";
    salaryMin = 80000;
    salaryMax = 110000;
  } else {
    salary = "$115k - $150k • Equity";
    salaryMin = 115000;
    salaryMax = 150000;
  }

  // 6. Extract Tech Tags
  const knownTech = [
    "React", "TypeScript", "JavaScript", "Next.js", "Node.js", "Python", "FastAPI",
    "TailwindCSS", "PostgreSQL", "Supabase", "GraphQL", "AWS", "Docker", "Kubernetes",
    "AI/ML", "LLM", "RAG", "PyTorch", "TensorFlow", "Golang", "Rust", "Vue", "Angular",
    "GCP", "C++", "Java", "Redis", "Kafka", "SQL", "OpenAI", "LangChain", "Spring", "Django"
  ];

  const matchedTags = new Set<string>();

  for (const tech of knownTech) {
    if (combined.includes(tech.toLowerCase())) {
      matchedTags.add(tech);
    }
  }

  for (const skill of userSkills) {
    if (combined.includes(skill.toLowerCase())) {
      matchedTags.add(skill);
    }
  }

  if (matchedTags.size === 0) {
    userSkills.slice(0, 4).forEach((s) => matchedTags.add(s));
  }
  if (matchedTags.size === 0) {
    matchedTags.add("React");
    matchedTags.add("TypeScript");
    matchedTags.add("Full Stack");
  }

  return {
    tags: Array.from(matchedTags).slice(0, 6),
    jobType,
    experienceLevel,
    remoteType,
    country,
    countryCode,
    salary,
    salaryMin,
    salaryMax,
    location,
  };
}

/**
 * Calculate match percentage based on profile overlap
 */
export function calculateJobMatchScore(
  profile: UserProfileData,
  job: { title: string; description?: string | null; tags: string[]; location?: string | null }
): number {
  let score = 55; // baseline

  const userRole = (profile.experiences[0]?.job_title || profile.summary || "").toLowerCase();
  const jobTitleLower = job.title.toLowerCase();
  const jobDescLower = (job.description || "").toLowerCase();

  // Role keyword match (up to 20 pts)
  const roleKeywords = [
    "developer", "engineer", "full stack", "fullstack", "frontend",
    "backend", "ai", "ml", "machine learning", "software"
  ];
  for (const kw of roleKeywords) {
    if (userRole.includes(kw) && jobTitleLower.includes(kw)) {
      score += 4;
    }
  }

  // Skills overlap (up to 20 pts)
  const userSkillsSet = new Set(profile.skills.map((s) => s.toLowerCase()));
  let skillMatches = 0;
  for (const tag of job.tags) {
    if (userSkillsSet.has(tag.toLowerCase()) || jobDescLower.includes(tag.toLowerCase())) {
      skillMatches++;
    }
  }
  score += Math.min(20, skillMatches * 4);

  // Location / Remote match (up to 5 pts)
  if (
    job.location?.toLowerCase().includes("remote") ||
    (profile.location && job.location?.toLowerCase().includes(profile.location.toLowerCase()))
  ) {
    score += 5;
  }

  // Experience level alignment (up to 5 pts)
  if (profile.experiences.length >= 2 && (jobTitleLower.includes("senior") || jobTitleLower.includes("lead"))) {
    score += 5;
  } else if (profile.experiences.length <= 1 && !jobTitleLower.includes("lead") && !jobTitleLower.includes("staff")) {
    score += 5;
  }

  const jitter = (job.title.length % 7) - 3;
  return Math.min(98, Math.max(72, score + jitter));
}

// Helper function to build flexible source filter for any platform
export const getSourceFilter = (platformId: string) => {
  const p = platformId.toLowerCase();
  const variants = new Set<string>([
    p,
    `${p}-jobs`,
    `${p}-rapid`,
    p.replace(/-/g, "_"),
    p.replace(/-/g, ""),
  ]);

  if (p === "glassdoor") variants.add("salary-enricher");
  if (p === "remote-jobs" || p === "remote") {
    variants.add("remoteok");
    variants.add("remotive");
    variants.add("remote-jobs");
    variants.add("remote_jobs");
  }
  if (p === "linkedin") variants.add("linkedin-jobs");
  if (p === "google-jobs") {
    variants.add("google_jobs");
    variants.add("googlejobs");
  }
  if (p === "indeed") variants.add("indeed-rapid");
  if (p === "ycombinator") {
    variants.add("yc");
    variants.add("y-combinator");
    variants.add("free-yc-jobs");
  }
  if (p === "internships") variants.add("internship");
  if (p === "smartrecruiters") variants.add("smart-recruiters");

  return Array.from(variants).map((v) => `source.eq.${v}`).join(",");
};

// Global in-memory cache for accurate platform counts across all platforms (5-min TTL)
let cachedPlatformCounts: { counts: Record<string, number>; timestamp: number } | null = null;

export async function getAccuratePlatformCounts(supabaseClient: any): Promise<Record<string, number>> {
  const now = Date.now();
  if (cachedPlatformCounts && now - cachedPlatformCounts.timestamp < 5 * 60 * 1000) {
    return { ...cachedPlatformCounts.counts };
  }

  const counts: Record<string, number> = { all: 0 };
  for (const p of SUPPORTED_PLATFORMS) {
    counts[p.id] = 0;
  }

  try {
    const results = await Promise.all(
      SUPPORTED_PLATFORMS.map((p) =>
        supabaseClient
          .from("canonical_jobs")
          .select("*", { count: "exact", head: true })
          .or(getSourceFilter(p.id))
          .eq("active", true)
      )
    );

    let total = 0;
    SUPPORTED_PLATFORMS.forEach((p, idx) => {
      const c = results[idx]?.count || 0;
      counts[p.id] = c;
      total += c;
    });
    counts.all = total;

    cachedPlatformCounts = {
      counts: { ...counts },
      timestamp: now,
    };
    return counts;
  } catch (err) {
    console.warn("[jobs-service] Error fetching platform counts:", err);
    return counts;
  }
}

/**
 * Main function to fetch cached or live canonical jobs for user.
 * Highly optimized to minimize database network roundtrips with 6-hour cache validation.
 */
export async function fetchCachedOrFreshJobs(
  userId: string,
  options: {
    forceRefresh?: boolean;
    platform?: string;
    query?: string;
    location?: string;
    country?: string;
    jobType?: string;
    remoteType?: string;
    experienceLevel?: string;
    salaryMin?: number;
    datePosted?: string;
  } = {},
  preloadedProfile?: UserProfileData
): Promise<{
  jobs: JobRecord[];
  cached: boolean;
  lastFetched: string | null;
  platformCounts: Record<string, number>;
}> {
  let supabase: any;
  try {
    supabase = await createServerClient();
  } catch {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "placeholder-key";
    supabase = createSupabaseClient(url, key);
  }

  // 1. Resolve user profile from resume / profile data for targeting and scoring
  let userProfileData: UserProfileData;
  if (preloadedProfile) {
    userProfileData = preloadedProfile;
  } else {
    const fullProfile = await getFullProfileData(userId);
    userProfileData = fullProfile.userProfileData;
  }

  const targetQuery =
    options.query ||
    userProfileData.experiences[0]?.job_title ||
    (userProfileData.summary?.toLowerCase().includes("frontend")
      ? "Frontend Developer"
      : userProfileData.summary?.toLowerCase().includes("full stack")
      ? "Full Stack Engineer"
      : userProfileData.summary?.toLowerCase().includes("ai")
      ? "AI Engineer"
      : userProfileData.skills.length > 0
      ? `${userProfileData.skills[0]} Developer`
      : "Software Engineer");

  const targetLocation = options.location || userProfileData.location || "US";

  // 2. 6-Hour Cache Validation: Check if canonical jobs have fresh data in the DB
  const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
  const now = new Date();

  const { data: latestJobRow } = await supabase
    .from("canonical_jobs")
    .select("scraped_at, created_at")
    .eq("active", true)
    .order("scraped_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const latestScrapedAt = latestJobRow?.scraped_at || latestJobRow?.created_at || null;
  const hasFreshCache = Boolean(
    latestScrapedAt && now.getTime() - new Date(latestScrapedAt).getTime() < SIX_HOURS_MS
  );

  // If force refresh is requested OR user specified search query OR cache is stale (>6 hours)
  const shouldSearchLive = options.forceRefresh || Boolean(options.query) || !hasFreshCache;

  if (shouldSearchLive) {
    try {
      console.log(
        `[jobs-service] Live job search for "${targetQuery}" on platform "${options.platform || "all"}" (stale: ${!hasFreshCache}, force: ${Boolean(options.forceRefresh)})...`
      );
      await jobSearchService.search({
        query: targetQuery,
        location: targetLocation,
        country: options.country,
        limit: 40,
        mode: "parallel",
        forceRefresh: true,
        platform: options.platform && options.platform !== "all" ? options.platform : undefined,
        persist: true,
      });
      // Invalidate counts cache on live search ingestion
      cachedPlatformCounts = null;
    } catch (searchErr) {
      console.warn("[jobs-service] Live job search warning:", searchErr);
    }
  }

  // 3. Fast Parallel Fetch: Query user interactions, platform-balanced canonical jobs, and global counts
  const isSpecificPlatform = Boolean(options.platform && options.platform !== "all");

  const [interactionsRes, jobsData, accurateCounts] = await Promise.all([
    supabase
      .from("user_job_interactions")
      .select("canonical_job_id, saved_status, applied_status")
      .eq("user_id", userId),
    isSpecificPlatform
      ? supabase
          .from("canonical_jobs")
          .select("*")
          .or(getSourceFilter(options.platform!))
          .eq("active", true)
          .order("posted_at", { ascending: false, nullsFirst: false })
          .limit(100)
          .then((r: any) => r.data || [])
      : Promise.all(
          SUPPORTED_PLATFORMS.map((p) =>
            supabase
              .from("canonical_jobs")
              .select("*")
              .or(getSourceFilter(p.id))
              .eq("active", true)
              .order("posted_at", { ascending: false, nullsFirst: false })
              .limit(15)
          )
        ).then((results: any[]) => {
          const combined: any[] = [];
          const seen = new Set<string>();
          for (const res of results) {
            if (res.data) {
              for (const j of res.data) {
                if (!seen.has(j.id)) {
                  seen.add(j.id);
                  combined.push(j);
                }
              }
            }
          }
          return combined;
        }),
    getAccuratePlatformCounts(supabase),
  ]);

  const interactionMap = new Map<string, { saved_status: boolean; applied_status: boolean }>();
  if (interactionsRes.data) {
    for (const ui of interactionsRes.data) {
      interactionMap.set(ui.canonical_job_id, {
        saved_status: Boolean(ui.saved_status),
        applied_status: Boolean(ui.applied_status),
      });
    }
  }

  let canonicalJobs: Array<Record<string, any>> = jobsData || [];

  // Fallback: If specific platform had 0 jobs in DB, trigger targeted search
  if (isSpecificPlatform && canonicalJobs.length === 0) {
    try {
      const targetP = options.platform!.toLowerCase();
      console.log(`[jobs-service] No jobs found for platform ${targetP}. Running targeted live search...`);
      const searchRes = await jobSearchService.search({
        query: targetQuery,
        location: targetLocation,
        platform: targetP,
        country: options.country,
        limit: 25,
        mode: "parallel",
        persist: true,
      });
      if (searchRes.jobs.length > 0) {
        canonicalJobs = searchRes.jobs as unknown as Array<Record<string, any>>;
      }
    } catch (targetedErr) {
      console.warn(`[jobs-service] Targeted platform search warning:`, targetedErr);
    }
  }

  // 4. Stable Platform Counts: Keep accurate counts across all platforms
  const platformCounts: Record<string, number> = { ...accurateCounts };
  // Ensure counts are non-zero for any platforms present in canonicalJobs
  for (const cj of canonicalJobs) {
    const norm = normalizeSourceToPlatform(cj.source);
    if (!platformCounts[norm] || platformCounts[norm] === 0) {
      platformCounts[norm] = (platformCounts[norm] || 0) + 1;
    }
  }
  if (!platformCounts.all || platformCounts.all === 0) {
    let sum = 0;
    for (const p of SUPPORTED_PLATFORMS) {
      sum += platformCounts[p.id] || 0;
    }
    platformCounts.all = sum;
  }

  // 5. Transform & Score Canonical Jobs
  if (canonicalJobs && canonicalJobs.length > 0) {
    const transformedJobs: JobRecord[] = canonicalJobs.map((cj) => {
      const interaction = interactionMap.get(cj.id);
      const metadata = extractJobMetadata(
        cj.title,
        cj.description || "",
        userProfileData.skills,
        cj.location,
        cj.country,
        cj.remote_type,
        cj.employment_type
      );
      const score = calculateJobMatchScore(userProfileData, {
        title: cj.title,
        description: cj.description,
        tags: metadata.tags,
        location: cj.location || metadata.location,
      });

      let salaryDisplay = metadata.salary;
      const salaryMin = cj.salary_min || metadata.salaryMin || null;
      const salaryMax = cj.salary_max || metadata.salaryMax || null;
      if (salaryMin && salaryMax) {
        const curr = cj.salary_currency === "USD" ? "$" : (cj.salary_currency || "$");
        salaryDisplay = `${curr}${Math.round(salaryMin / 1000)}k - ${curr}${Math.round(salaryMax / 1000)}k`;
      }

      const platform = normalizeSourceToPlatform(cj.source);

      return {
        id: cj.id || `job-${Math.random().toString(36).slice(2, 9)}`,
        user_id: userId,
        platform,
        title: cj.title,
        company: cj.company_name,
        company_logo: cj.company_logo,
        location: cj.location || metadata.location,
        country: cj.country || metadata.country,
        remote_type: cj.remote_type || metadata.remoteType,
        salary: salaryDisplay,
        salary_min: salaryMin,
        salary_max: salaryMax,
        salary_currency: cj.salary_currency || "USD",
        job_type: cj.employment_type || metadata.jobType,
        experience_level: metadata.experienceLevel,
        description: cj.description || `Position at ${cj.company_name}`,
        tags: metadata.tags,
        match_score: score,
        job_url: cj.job_url,
        apply_url: cj.apply_url || cj.job_url,
        source_url: cj.apply_url || cj.job_url,
        applied_status: interaction ? interaction.applied_status : false,
        saved_status: interaction ? interaction.saved_status : false,
        posted_at: cj.posted_at || null,
        fetched_at: cj.scraped_at || cj.created_at || new Date().toISOString(),
        created_at: cj.created_at || new Date().toISOString(),
      };
    });

    // Deduplicate by Company + Title in memory
    const seen = new Set<string>();
    const uniqueJobs: JobRecord[] = [];
    for (const j of transformedJobs) {
      const key = `${j.company.toLowerCase()}:::${j.title.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueJobs.push(j);
      }
    }

    // Sort by match score descending
    uniqueJobs.sort((a, b) => b.match_score - a.match_score);

    // Apply optional filter predicates
    let filteredJobs = uniqueJobs;

    if (options.country && options.country !== "all") {
      const c = options.country.toLowerCase();
      filteredJobs = filteredJobs.filter((j) => {
        const jc = (j.country || "").toLowerCase();
        const jl = (j.location || "").toLowerCase();
        if (c === "remote" || c === "worldwide")
          return jc.includes("remote") || jc.includes("worldwide") || jl.includes("remote");
        return (
          jc.includes(c) ||
          jl.includes(c) ||
          (c === "us" && (jc.includes("united states") || jl.includes("usa") || jl.includes(", us"))) ||
          (c === "in" && (jc.includes("india") || jl.includes("bengaluru") || jl.includes("bangalore"))) ||
          (c === "gb" && (jc.includes("united kingdom") || jl.includes("uk") || jl.includes("london"))) ||
          (c === "ca" && (jc.includes("canada") || jl.includes("toronto") || jl.includes("vancouver"))) ||
          (c === "de" && (jc.includes("germany") || jl.includes("berlin") || jl.includes("munich")))
        );
      });
    }

    if (options.jobType && options.jobType !== "all") {
      const jt = options.jobType.toLowerCase();
      filteredJobs = filteredJobs.filter((j) => (j.job_type || "").toLowerCase().includes(jt));
    }

    if (options.remoteType && options.remoteType !== "all") {
      const rt = options.remoteType.toLowerCase();
      filteredJobs = filteredJobs.filter((j) => (j.remote_type || "").toLowerCase().includes(rt));
    }

    if (options.experienceLevel && options.experienceLevel !== "all") {
      const exp = options.experienceLevel.toLowerCase();
      filteredJobs = filteredJobs.filter((j) => (j.experience_level || "").toLowerCase().includes(exp));
    }

    if (options.salaryMin && options.salaryMin > 0) {
      filteredJobs = filteredJobs.filter((j) => (j.salary_min || 0) >= options.salaryMin!);
    }

    if (options.datePosted && options.datePosted !== "all") {
      const now = Date.now();
      const maxAgeMs =
        options.datePosted === "24h"
          ? 24 * 60 * 60 * 1000
          : options.datePosted === "3d"
          ? 3 * 24 * 60 * 60 * 1000
          : options.datePosted === "7d"
          ? 7 * 24 * 60 * 60 * 1000
          : 30 * 24 * 60 * 60 * 1000;

      filteredJobs = filteredJobs.filter((j) => {
        if (!j.posted_at && !j.fetched_at) return true;
        const jobTime = new Date(j.posted_at || j.fetched_at).getTime();
        return now - jobTime <= maxAgeMs;
      });
    }

    return {
      jobs: filteredJobs,
      cached: hasFreshCache && !options.forceRefresh,
      lastFetched: latestScrapedAt || canonicalJobs[0]?.scraped_at || new Date().toISOString(),
      platformCounts,
    };
  }

  // Fallback: Check legacy jobs table if canonical jobs are empty
  const { data: legacyJobs } = await supabase
    .from("jobs")
    .select("*")
    .eq("user_id", userId)
    .order("match_score", { ascending: false });

  if (legacyJobs && legacyJobs.length > 0) {
    const legacyCounts: Record<string, number> = {
      all: legacyJobs.length,
    };
    for (const p of SUPPORTED_PLATFORMS) {
      legacyCounts[p.id] = 0;
    }
    for (const j of legacyJobs) {
      const p = j.platform?.toLowerCase();
      if (legacyCounts[p] !== undefined) legacyCounts[p]++;
    }

    return {
      jobs: legacyJobs as JobRecord[],
      cached: true,
      lastFetched: legacyJobs[0]?.fetched_at || null,
      platformCounts: legacyCounts,
    };
  }

  return {
    jobs: [],
    cached: false,
    lastFetched: null,
    platformCounts,
  };
}
