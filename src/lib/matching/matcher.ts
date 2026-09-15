import {
  UserCareerProfile,
  NormalizedJob,
  JobRecommendationScore,
} from "./types";

/**
 * Multi-Stage Tailored Job Matching Engine
 * Strictly evidence-based, zero-hallucination, explainable matching.
 */

export interface MatchOptions {
  userInteractions?: Map<string, { saved_status?: boolean; applied_status?: boolean; not_relevant?: boolean; hidden?: boolean }>;
  minThreshold?: number; // default 45
  maxPerCompany?: number; // default 4
}

/**
 * Checks hard filters before scoring.
 * Prevents junior users from being inundated with Senior/Staff roles,
 * and filters out completely irrelevant role families (e.g. Finance, Marketing).
 */
export function evaluateHardFilters(
  user: UserCareerProfile,
  job: NormalizedJob,
  interaction?: { not_relevant?: boolean; hidden?: boolean }
): { passed: boolean; reason?: string } {
  // 1. User Feedback Filter
  if (interaction?.hidden || interaction?.not_relevant) {
    return { passed: false, reason: "User marked as not relevant or hidden" };
  }

  // 2. Role Family Filter
  // If user is technical software/full-stack engineer, exclude non-engineering families
  const isSoftwareCandidate = user.target_roles.some((r) =>
    r.toLowerCase().includes("software") ||
    r.toLowerCase().includes("developer") ||
    r.toLowerCase().includes("full stack") ||
    r.toLowerCase().includes("engineer")
  );

  if (isSoftwareCandidate) {
    const nonTechFamilies = [
      "finance_accounting",
      "marketing_sales",
      "hr_recruiting",
      "operations_support",
      "ui_ux_design",
    ];
    if (nonTechFamilies.includes(job.role_family)) {
      return {
        passed: false,
        reason: `Role family (${job.role_family}) does not match software engineering profile`,
      };
    }
  }

  // 3. Entry-Level Protection & Seniority Hard Filter
  // Early career (< 24 months verified experience):
  if (user.seniority === "ENTRY_LEVEL" || user.seniority === "INTERN") {
    const seniorLevels = ["SENIOR", "LEAD", "MANAGER", "STAFF", "PRINCIPAL"];
    if (seniorLevels.includes(job.seniority)) {
      return {
        passed: false,
        reason: `Seniority mismatch: Role is ${job.seniority}, candidate is early-career`,
      };
    }

    // Explicit minimum experience ceiling (e.g. requires >= 36 months)
    if (job.minimum_experience_months >= 36) {
      return {
        passed: false,
        reason: `Experience mismatch: Role requires ${Math.round(job.minimum_experience_months / 12)}+ years, candidate has ${Math.round(user.total_verified_experience_months / 12 * 10) / 10} years`,
      };
    }
  }

  // 4. Education Hard Filter
  // If job explicitly mandates a PhD and candidate has only Bachelor's:
  const userHasPhD = user.education.some((e) => e.degree.toLowerCase().includes("phd") || e.degree.toLowerCase().includes("doctorate"));
  if (job.education_requirements.includes("PhD") && !userHasPhD) {
    return {
      passed: false,
      reason: "Job explicitly requires a PhD degree",
    };
  }

  return { passed: true };
}

/**
 * Calculate role similarity score (0 to 100)
 */
export function calculateRoleMatch(user: UserCareerProfile, job: NormalizedJob): number {
  const titleLower = job.title.toLowerCase();
  let maxScore = 20; // baseline for other tech roles

  for (const role of user.target_roles) {
    const rLower = role.toLowerCase();
    if (titleLower === rLower) return 100;
    if (titleLower.includes(rLower) || rLower.includes(titleLower)) {
      maxScore = Math.max(maxScore, 95);
    }
  }

  // Role family checks
  if (
    job.role_family === "software_engineering_fullstack" &&
    user.target_roles.some((r) => r.toLowerCase().includes("full stack") || r.toLowerCase().includes("mern"))
  ) {
    maxScore = Math.max(maxScore, 95);
  } else if (
    job.role_family === "software_engineering_frontend" &&
    user.all_skills.some((s) => s.toLowerCase().includes("react"))
  ) {
    maxScore = Math.max(maxScore, 85);
  } else if (
    job.role_family === "software_engineering_backend" &&
    user.all_skills.some((s) => s.toLowerCase().includes("node"))
  ) {
    maxScore = Math.max(maxScore, 85);
  } else if (job.role_family === "software_engineering_general") {
    maxScore = Math.max(maxScore, 80);
  } else if (job.role_family === "data_science_ml") {
    const hasML = user.all_skills.some((s) => s.toLowerCase().includes("machine learning") || s.toLowerCase().includes("python"));
    maxScore = hasML ? 70 : 25;
  } else if (job.role_family === "devops_cloud") {
    const hasDevOps = user.tools.some((t) => t.toLowerCase().includes("docker") || t.toLowerCase().includes("kubernetes"));
    maxScore = hasDevOps ? 65 : 20;
  }

  return maxScore;
}

/**
 * Calculate skill overlap for required and preferred skills
 */
export function calculateSkillOverlap(
  userSkills: string[],
  jobSkills: string[]
): { matched: string[]; missing: string[]; matchRatio: number } {
  if (jobSkills.length === 0) {
    return { matched: [], missing: [], matchRatio: 1.0 };
  }

  const userSet = new Set(userSkills.map((s) => s.toLowerCase().trim()));
  const matched: string[] = [];
  const missing: string[] = [];

  for (const js of jobSkills) {
    const jsLower = js.toLowerCase().trim();
    // Match directly or via normalized prefix (e.g. react matches reactjs)
    let found = false;
    for (const us of userSet) {
      if (
        us === jsLower ||
        (jsLower === "react" && (us === "reactjs" || us === "react.js")) ||
        (jsLower === "node.js" && (us === "nodejs" || us === "node")) ||
        (jsLower === "express" && (us === "expressjs" || us === "express.js")) ||
        (jsLower === "c++" && us === "c++") ||
        (jsLower === "sql" && (us === "sql" || us === "mysql" || us === "postgresql"))
      ) {
        found = true;
        break;
      }
    }

    if (found) {
      matched.push(js);
    } else {
      missing.push(js);
    }
  }

  const matchRatio = matched.length / jobSkills.length;
  return { matched, missing, matchRatio };
}

/**
 * Score a single job for a user
 */
export function scoreJob(
  user: UserCareerProfile,
  job: NormalizedJob,
  interaction?: { not_relevant?: boolean; hidden?: boolean }
): JobRecommendationScore {
  // 1. Evaluate Hard Filters
  const hardFilter = evaluateHardFilters(user, job, interaction);
  if (!hardFilter.passed) {
    return {
      job_id: job.id,
      score: 15,
      match_level: "Fair",
      reasons: hardFilter.reason ? [hardFilter.reason] : [],
      missing_requirements: job.required_skills,
      matched_skills: [],
      experience_match: 0,
      role_match: 0,
      location_match: 0,
      education_match: 0,
      passed_hard_filter: false,
      filter_reason: hardFilter.reason,
      explanation: hardFilter.reason,
    };
  }

  const reasons: string[] = [];

  // 2. Required Skills Match (50% weight)
  const requiredOverlap = calculateSkillOverlap(user.all_skills, job.required_skills);
  let requiredSkillScore = 70; // fallback baseline when job has no explicit required skills listed

  if (job.required_skills.length > 0) {
    requiredSkillScore = Math.round(requiredOverlap.matchRatio * 100);
  } else {
    // If job has no explicit required skills, search candidate skills in full description
    const descLower = job.description.toLowerCase();
    const hits = user.all_skills.filter((s) => descLower.includes(s.toLowerCase()));
    if (hits.length >= 3) {
      requiredSkillScore = 85;
      requiredOverlap.matched.push(...hits.slice(0, 4));
    } else if (hits.length > 0) {
      requiredSkillScore = 65;
      requiredOverlap.matched.push(...hits);
    } else {
      requiredSkillScore = 30;
    }
  }

  // 3. Role Match (20% weight)
  const roleScore = calculateRoleMatch(user, job);

  // 4. Preferred Skills Match (15% weight)
  // Section 12: Missing a preferred skill must NOT heavily penalize the score.
  const preferredOverlap = calculateSkillOverlap(user.all_skills, job.preferred_skills);
  let preferredSkillScore = Math.max(85, requiredSkillScore); // neutral/generous when no preferred skills
  if (job.preferred_skills.length > 0) {
    preferredSkillScore = Math.round(preferredOverlap.matchRatio * 100);
  }

  // 5. Experience & Seniority Match (10% weight)
  let experienceScore = 75;
  if (user.seniority === job.seniority) {
    experienceScore = 100;
  } else if (
    (user.seniority === "ENTRY_LEVEL" && (job.seniority === "INTERN" || job.seniority === "ENTRY_LEVEL")) ||
    (user.seniority === "MID" && job.seniority === "ENTRY_LEVEL")
  ) {
    experienceScore = 95;
  } else if (user.seniority === "ENTRY_LEVEL" && job.seniority === "MID") {
    // Junior candidate applying to Mid role with <= 3 yrs requirement
    experienceScore = job.minimum_experience_months <= 36 ? 70 : 40;
  } else {
    experienceScore = 50;
  }

  // 6. Education Match (5% weight)
  let educationScore = 80;
  const hasCSDegree = user.education.some((e) =>
    e.field_of_study.toLowerCase().includes("computer science") ||
    e.degree.toLowerCase().includes("b.e.") ||
    e.degree.toLowerCase().includes("b.tech")
  );
  if (hasCSDegree && job.role_family.startsWith("software_engineering")) {
    educationScore = 100;
  }

  // 7. Location & Remote Match
  let locationScore = 70;
  const jobLocLower = (job.location || "").toLowerCase();
  const jobCountryLower = (job.country || "").toLowerCase();

  if (job.remote_type === "remote" || jobLocLower.includes("remote")) {
    locationScore = 100;
  } else {
    const matchesUserLoc = user.locations.some((loc) => {
      const l = loc.toLowerCase();
      return jobLocLower.includes(l) || jobCountryLower.includes(l);
    });
    if (matchesUserLoc) {
      locationScore = 100;
    } else {
      locationScore = 50;
    }
  }

  // 8. Project Relevance Boost (+5 pts max)
  let projectBonus = 0;
  let relevantProjectName = "";
  for (const proj of user.projects) {
    const projTech = proj.technologies.map((t) => t.toLowerCase());
    const overlaps = job.required_skills.filter((rs) => projTech.includes(rs.toLowerCase()));
    if (overlaps.length >= 2 || (projTech.includes("mern") && job.role_family === "software_engineering_fullstack")) {
      projectBonus = 5;
      relevantProjectName = proj.name;
      break;
    }
  }

  // 9. Freshness Adjustment (+1 to +3 pts)
  let freshnessBonus = 0;
  if (job.posted_at) {
    try {
      const ageHours = (Date.now() - new Date(job.posted_at).getTime()) / (1000 * 60 * 60);
      if (ageHours <= 24) freshnessBonus = 3;
      else if (ageHours <= 72) freshnessBonus = 2;
      else if (ageHours <= 168) freshnessBonus = 1;
    } catch {}
  }

  // 10. Composite Score Calculation
  // Required Skills: 50%, Role: 20%, Preferred Skills: 15%, Experience: 10%, Education: 5%
  const baseScore =
    0.50 * requiredSkillScore +
    0.20 * roleScore +
    0.15 * preferredSkillScore +
    0.10 * experienceScore +
    0.05 * educationScore;

  let totalScore = Math.round(baseScore + projectBonus + freshnessBonus);
  totalScore = Math.max(0, Math.min(99, totalScore));

  // Determine Match Level
  let match_level: "Excellent" | "Strong" | "Good" | "Fair" = "Fair";
  if (totalScore >= 88) {
    match_level = "Excellent";
  } else if (totalScore >= 75) {
    match_level = "Strong";
  } else if (totalScore >= 55) {
    match_level = "Good";
  }

  // 11. Generate Human-Readable Reasons
  if (requiredOverlap.matched.length > 0) {
    reasons.push(
      `Strong match because your verified ${requiredOverlap.matched.slice(0, 4).join(", ")} skills align directly with the role requirements.`
    );
  }

  if (roleScore >= 85) {
    reasons.push(`Direct alignment with your verified background in ${user.target_roles[0] || "Software Engineering"}.`);
  }

  if (job.seniority === "ENTRY_LEVEL" || job.seniority === "INTERN") {
    reasons.push("Entry-level role matching your verified internship and academic experience.");
  }

  if (projectBonus > 0 && relevantProjectName) {
    reasons.push(`Relevant hands-on project experience with ${relevantProjectName}.`);
  }

  if (locationScore === 100) {
    reasons.push(job.remote_type === "remote" ? "Remote-friendly role matching your preferences." : `Location match for ${job.location}.`);
  }

  // Deduplicate matched skills
  const matched_skills = Array.from(new Set(requiredOverlap.matched));
  const missing_requirements = Array.from(new Set(requiredOverlap.missing));

  const explanation = reasons.join(" ");

  return {
    job_id: job.id,
    score: totalScore,
    match_level,
    reasons,
    missing_requirements,
    matched_skills,
    experience_match: experienceScore,
    role_match: roleScore,
    location_match: locationScore,
    education_match: educationScore,
    passed_hard_filter: true,
    explanation,
  };
}

/**
 * Filter, score, and rank a batch of jobs for a user career profile.
 * Enforces company diversity (max N per company) and minimum score threshold.
 */
export function rankJobsForUser(
  user: UserCareerProfile,
  jobs: NormalizedJob[],
  options: MatchOptions = {}
): Array<{ job: NormalizedJob; score: JobRecommendationScore }> {
  const minThreshold = options.minThreshold ?? 45;
  const maxPerCompany = options.maxPerCompany ?? 4;
  const interactions = options.userInteractions || new Map();

  const scored: Array<{ job: NormalizedJob; score: JobRecommendationScore }> = [];

  for (const job of jobs) {
    const inter = interactions.get(job.id);
    const scoreResult = scoreJob(user, job, inter);

    // Filter out low scores and hard filter failures
    if (scoreResult.passed_hard_filter && scoreResult.score >= minThreshold) {
      scored.push({ job, score: scoreResult });
    }
  }

  // Sort descending by score, tie-break by posted_at
  scored.sort((a, b) => {
    if (b.score.score !== a.score.score) {
      return b.score.score - a.score.score;
    }
    const tA = a.job.posted_at ? new Date(a.job.posted_at).getTime() : 0;
    const tB = b.job.posted_at ? new Date(b.job.posted_at).getTime() : 0;
    return tB - tA;
  });

  // Apply Company Diversity: Maximum maxPerCompany jobs per company
  const companyCounts = new Map<string, number>();
  const diverseResults: Array<{ job: NormalizedJob; score: JobRecommendationScore }> = [];

  for (const item of scored) {
    const compKey = item.job.company.toLowerCase().trim();
    const currentCount = companyCounts.get(compKey) || 0;
    if (currentCount < maxPerCompany) {
      companyCounts.set(compKey, currentCount + 1);
      diverseResults.push(item);
    }
  }

  return diverseResults;
}
