import { createClient as createServerClient } from "@/lib/supabase/server";

export interface JobRecord {
  id: string;
  user_id: string;
  platform: "greenhouse" | "lever" | "ashby" | "workable" | "wellfound" | "custom" | string;
  title: string;
  company: string;
  company_logo?: string | null;
  location?: string | null;
  salary?: string | null;
  job_type?: string | null;
  experience_level?: string | null;
  description?: string | null;
  tags: string[];
  match_score: number;
  job_url: string;
  source_url?: string | null;
  applied_status: boolean;
  saved_status: boolean;
  fetched_at: string;
  created_at: string;
}

export interface UserProfileData {
  userId: string;
  firstName?: string;
  lastName?: string;
  location?: string;
  summary?: string;
  skills: string[];
  experiences: Array<{
    job_title?: string | null;
    company_name?: string | null;
    responsibilities?: string | null;
    duration?: string | null;
  }>;
  educations: Array<{
    degree?: string | null;
    field_of_study?: string | null;
    institution?: string | null;
  }>;
}

export interface PlatformConfig {
  id: "greenhouse" | "lever" | "ashby" | "workable" | "wellfound";
  name: string;
  siteQuery: string;
  badgeClass: string;
  color: string;
}

export const SUPPORTED_PLATFORMS: PlatformConfig[] = [
  {
    id: "greenhouse",
    name: "Greenhouse",
    siteQuery: "site:boards.greenhouse.io OR site:greenhouse.io/jobs",
    badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    color: "#10B981",
  },
  {
    id: "lever",
    name: "Lever",
    siteQuery: "site:jobs.lever.co OR site:lever.co/jobs",
    badgeClass: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    color: "#6366F1",
  },
  {
    id: "ashby",
    name: "Ashby",
    siteQuery: "site:jobs.ashbyhq.com",
    badgeClass: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    color: "#8B5CF6",
  },
  {
    id: "workable",
    name: "Workable",
    siteQuery: "site:apply.workable.com OR site:workable.com/jobs",
    badgeClass: "bg-teal-500/10 text-teal-400 border-teal-500/20",
    color: "#14B8A6",
  },
  {
    id: "wellfound",
    name: "Wellfound",
    siteQuery: "site:wellfound.com/jobs",
    badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    color: "#F59E0B",
  },
];

/**
 * Extract tags, job type, experience level, salary from text
 */
function extractJobMetadata(
  title: string,
  description: string,
  userSkills: string[]
): {
  tags: string[];
  jobType: string;
  experienceLevel: string;
  salary: string;
  location: string;
} {
  const combined = `${title} ${description}`.toLowerCase();

  // Experience level
  let experienceLevel = "Mid-Level";
  if (combined.includes("lead") || combined.includes("principal") || combined.includes("staff")) {
    experienceLevel = "Lead / Staff";
  } else if (combined.includes("senior") || combined.includes("sr.") || combined.includes("sr ")) {
    experienceLevel = "Senior";
  } else if (combined.includes("junior") || combined.includes("entry") || combined.includes("intern")) {
    experienceLevel = "Junior / Entry";
  }

  // Job type
  let jobType = "Full-time";
  if (combined.includes("contract") || combined.includes("freelance")) {
    jobType = "Contract";
  } else if (combined.includes("part-time")) {
    jobType = "Part-time";
  } else if (combined.includes("internship")) {
    jobType = "Internship";
  }

  // Location
  let location = "Remote";
  if (combined.includes("san francisco") || combined.includes("sf, ca") || combined.includes("bay area")) {
    location = "San Francisco, CA (Remote Friendly)";
  } else if (combined.includes("new york") || combined.includes("nyc")) {
    location = "New York, NY (Hybrid/Remote)";
  } else if (combined.includes("london")) {
    location = "London, UK (Remote Friendly)";
  } else if (combined.includes("bengaluru") || combined.includes("bangalore") || combined.includes("mumbai")) {
    location = "India (Remote / Hybrid)";
  } else if (combined.includes("remote")) {
    location = "Remote (Worldwide / US)";
  }

  // Salary
  let salary = "Competitive Compensation";
  const salaryMatch = combined.match(/\$\s*(\d{2,3}(?:,\d{3})?)\s*k?\s*(?:-|to)\s*\$?\s*(\d{2,3}(?:,\d{3})?)\s*k?/i);
  if (salaryMatch) {
    salary = `$${salaryMatch[1]}k - $${salaryMatch[2]}k • Equity`;
  } else if (experienceLevel === "Senior" || experienceLevel === "Lead / Staff") {
    salary = "$140k - $190k • Equity";
  } else if (experienceLevel === "Junior / Entry") {
    salary = "$80k - $110k • Benefits";
  } else {
    salary = "$115k - $150k • Equity";
  }

  // Extract Tags
  const knownTech = [
    "React", "TypeScript", "JavaScript", "Next.js", "Node.js", "Python", "FastAPI",
    "TailwindCSS", "PostgreSQL", "Supabase", "GraphQL", "AWS", "Docker", "Kubernetes",
    "AI/ML", "LLM", "RAG", "PyTorch", "TensorFlow", "Golang", "Rust", "Vue", "Angular",
    "GCP", "C++", "Java", "Redis", "Kafka", "SQL", "OpenAI", "LangChain"
  ];

  const matchedTags = new Set<string>();

  for (const tech of knownTech) {
    const techLower = tech.toLowerCase();
    if (combined.includes(techLower)) {
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
    salary,
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
  const roleKeywords = ["developer", "engineer", "full stack", "fullstack", "frontend", "backend", "ai", "ml", "machine learning", "software"];
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
  if (job.location?.toLowerCase().includes("remote") || (profile.location && job.location?.toLowerCase().includes(profile.location.toLowerCase()))) {
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

/**
 * Main function to fetch cached or live canonical jobs for user
 */
export async function fetchCachedOrFreshJobs(
  userId: string,
  options: { forceRefresh?: boolean; platform?: string } = {}
): Promise<{
  jobs: JobRecord[];
  cached: boolean;
  lastFetched: string | null;
  platformCounts: Record<string, number>;
}> {
  const supabase = await createServerClient();

  // 1. Fetch user profile for scoring
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  let skills: string[] = [];
  let experiences: any[] = [];
  let educations: any[] = [];

  if (profile?.id) {
    const [skillsRes, expRes, eduRes] = await Promise.all([
      supabase.from("skills").select("skill_name").eq("profile_id", profile.id),
      supabase.from("experiences").select("*").eq("profile_id", profile.id).order("created_at", { ascending: false }),
      supabase.from("educations").select("*").eq("profile_id", profile.id).order("created_at", { ascending: false }),
    ]);

    skills = (skillsRes.data || []).map((s: any) => s.skill_name).filter(Boolean);
    experiences = expRes.data || [];
    educations = eduRes.data || [];
  }

  const userProfileData: UserProfileData = {
    userId,
    firstName: profile?.first_name || "",
    lastName: profile?.last_name || "",
    location: profile?.location || "",
    summary: profile?.summary || "",
    skills,
    experiences,
    educations,
  };

  // 2. Fetch user interactions for bookmarks and applied status
  const { data: userInteractions } = await supabase
    .from("user_job_interactions")
    .select("canonical_job_id, saved_status, applied_status")
    .eq("user_id", userId);

  const interactionMap = new Map<string, { saved_status: boolean; applied_status: boolean }>();
  if (userInteractions) {
    for (const ui of userInteractions) {
      interactionMap.set(ui.canonical_job_id, {
        saved_status: Boolean(ui.saved_status),
        applied_status: Boolean(ui.applied_status),
      });
    }
  }

  // 3. Query canonical_jobs table (Active jobs)
  let canonicalQuery = supabase
    .from("canonical_jobs")
    .select("*")
    .eq("active", true)
    .order("posted_at", { ascending: false })
    .limit(100);

  if (options.platform && options.platform !== "all") {
    canonicalQuery = canonicalQuery.eq("source", options.platform.toLowerCase());
  }

  const { data: canonicalJobs } = await canonicalQuery;

  // If canonical jobs exist, normalize & score them
  if (canonicalJobs && canonicalJobs.length > 0) {
    const platformCounts: Record<string, number> = {
      all: canonicalJobs.length,
      greenhouse: 0,
      lever: 0,
      ashby: 0,
      workable: 0,
      wellfound: 0,
    };

    const transformedJobs: JobRecord[] = canonicalJobs.map((cj) => {
      const interaction = interactionMap.get(cj.id);
      const metadata = extractJobMetadata(cj.title, cj.description || "", userProfileData.skills);
      const score = calculateJobMatchScore(userProfileData, {
        title: cj.title,
        description: cj.description,
        tags: metadata.tags,
        location: cj.location,
      });

      const p = (cj.source || "greenhouse").toLowerCase();
      if (platformCounts[p] !== undefined) {
        platformCounts[p]++;
      }

      // Format salary if min/max exists
      let salaryDisplay = metadata.salary;
      if (cj.salary_min && cj.salary_max) {
        const curr = cj.salary_currency === "USD" ? "$" : (cj.salary_currency || "$");
        salaryDisplay = `${curr}${Math.round(cj.salary_min / 1000)}k - ${curr}${Math.round(cj.salary_max / 1000)}k • Equity`;
      }

      return {
        id: cj.id,
        user_id: userId,
        platform: cj.source,
        title: cj.title,
        company: cj.company_name,
        company_logo: cj.company_logo,
        location: cj.location || metadata.location,
        salary: salaryDisplay,
        job_type: cj.employment_type || metadata.jobType,
        experience_level: metadata.experienceLevel,
        description: cj.description || `Position at ${cj.company_name}`,
        tags: metadata.tags,
        match_score: score,
        job_url: cj.job_url,
        source_url: cj.apply_url || cj.job_url,
        applied_status: interaction ? interaction.applied_status : false,
        saved_status: interaction ? interaction.saved_status : false,
        fetched_at: cj.scraped_at || cj.created_at,
        created_at: cj.created_at,
      };
    });

    // Sort by match score descending
    transformedJobs.sort((a, b) => b.match_score - a.match_score);

    return {
      jobs: transformedJobs,
      cached: true,
      lastFetched: canonicalJobs[0]?.scraped_at || new Date().toISOString(),
      platformCounts,
    };
  }

  // 4. Fallback if database has no canonical jobs yet: check old jobs table
  const { data: legacyJobs } = await supabase
    .from("jobs")
    .select("*")
    .eq("user_id", userId)
    .order("match_score", { ascending: false });

  if (legacyJobs && legacyJobs.length > 0) {
    const platformCounts: Record<string, number> = {
      all: legacyJobs.length,
      greenhouse: 0,
      lever: 0,
      ashby: 0,
      workable: 0,
      wellfound: 0,
    };
    for (const j of legacyJobs) {
      const p = j.platform?.toLowerCase();
      if (platformCounts[p] !== undefined) platformCounts[p]++;
    }

    return {
      jobs: legacyJobs as JobRecord[],
      cached: true,
      lastFetched: legacyJobs[0]?.fetched_at || null,
      platformCounts,
    };
  }

  return {
    jobs: [],
    cached: false,
    lastFetched: null,
    platformCounts: { all: 0, greenhouse: 0, lever: 0, ashby: 0, workable: 0, wellfound: 0 },
  };
}
