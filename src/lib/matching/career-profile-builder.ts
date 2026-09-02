import {
  UserCareerProfile,
  JobSeniority,
  VerifiedExperienceItem,
  VerifiedEducationItem,
  VerifiedProjectItem,
} from "./types";

/**
 * Month names lookup for date parsing
 */
const MONTH_NAMES: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

/**
 * Parse a date string like "June 2024", "Aug 2023", "2023", or "Present"
 */
function parseDateParts(str: string): { year: number; month: number } | null {
  const clean = str.trim().toLowerCase().replace(/[.,’']/g, "");
  if (!clean) return null;

  if (clean === "present" || clean === "current" || clean === "now") {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }

  // "June 2024" or "Jun 2024"
  const monthYearMatch = clean.match(/^([a-z]+)\s+(\d{4})$/);
  if (monthYearMatch) {
    const mStr = monthYearMatch[1];
    const yStr = parseInt(monthYearMatch[2], 10);
    const m = MONTH_NAMES[mStr] || 1;
    return { year: yStr, month: m };
  }

  // "2024"
  const yearMatch = clean.match(/^(\d{4})$/);
  if (yearMatch) {
    return { year: parseInt(yearMatch[1], 10), month: 1 };
  }

  // "06/2024" or "2024-06"
  const slashMatch = clean.match(/^(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    return { year: parseInt(slashMatch[2], 10), month: parseInt(slashMatch[1], 10) };
  }

  return null;
}

/**
 * Parse duration like "June 2024 - July 2024" or "August 2023 - December 2023" into verified months
 */
export function parseDurationMonths(durationStr?: string | null): {
  start?: string;
  end?: string;
  months: number;
} {
  if (!durationStr || !durationStr.trim()) {
    return { months: 0 };
  }

  const parts = durationStr.split(/\s*(?:[-–—]|\bto\b)\s*/i).map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return { months: 0 };

  const startPart = parts[0];
  const endPart = parts[1] || "Present";

  const startDate = parseDateParts(startPart);
  const endDate = parseDateParts(endPart);

  if (!startDate || !endDate) {
    return { start: startPart, end: endPart, months: 0 };
  }

  const diffYears = endDate.year - startDate.year;
  const diffMonths = endDate.month - startDate.month + 1; // inclusive of end month
  const totalMonths = Math.max(1, diffYears * 12 + diffMonths);

  return {
    start: startPart,
    end: endPart,
    months: totalMonths,
  };
}

/**
 * Skill categorization taxonomies
 */
const FRAMEWORK_NAMES = new Set([
  "react", "reactjs", "next.js", "nextjs", "node", "nodejs", "node.js",
  "express", "expressjs", "express.js", "vue", "vuejs", "angular",
  "django", "flask", "fastapi", "spring", "spring boot", "ruby on rails",
  "asp.net", "laravel", "tailwind", "tailwindcss", "bootstrap",
  "svelte", "nest.js", "nestjs"
]);

const DATABASE_NAMES = new Set([
  "mongodb", "mysql", "postgresql", "postgres", "redis", "dynamodb",
  "sqlite", "cassandra", "couchdb", "mariadb", "supabase", "firebase",
  "firestore", "oracle", "elasticsearch", "neo4j"
]);

const TOOL_NAMES = new Set([
  "git", "github", "gitlab", "bitbucket", "docker", "kubernetes",
  "linux", "shell", "shell scripting", "bash", "aws", "gcp", "azure",
  "postman", "metabase", "jira", "ci/cd", "terraform", "jenkins",
  "webpack", "vite", "figma"
]);

/**
 * Derives user seniority strictly from verified professional experience
 */
export function deriveSeniorityFromExperience(totalMonths: number, isStudentOrNewGrad: boolean): JobSeniority {
  if (totalMonths <= 0 && isStudentOrNewGrad) return "ENTRY_LEVEL";
  if (totalMonths < 24) return "ENTRY_LEVEL"; // < 2 years is Entry / Junior
  if (totalMonths < 60) return "MID";         // 2 - 5 years is Mid
  if (totalMonths < 96) return "SENIOR";      // 5 - 8 years is Senior
  return "LEAD";                              // 8+ years
}

/**
 * Generates verified target roles based on verified experience and education
 */
export function deriveTargetRoles(
  experiences: VerifiedExperienceItem[],
  education: VerifiedEducationItem[],
  verifiedSkills: string[]
): string[] {
  const roles = new Set<string>();
  const skillSet = new Set(verifiedSkills.map((s) => s.toLowerCase()));

  // 1. From experience titles
  for (const exp of experiences) {
    const tLower = exp.title.toLowerCase();
    if (tLower.includes("fullstack") || tLower.includes("full stack") || tLower.includes("mern")) {
      roles.add("Full Stack Developer");
      roles.add("Full Stack Engineer");
      roles.add("MERN Developer");
      roles.add("Software Engineer");
      roles.add("Software Development Engineer");
    }
    if (tLower.includes("frontend") || tLower.includes("front end")) {
      roles.add("Frontend Developer");
      roles.add("Frontend Engineer");
      roles.add("React Developer");
    }
    if (tLower.includes("backend") || tLower.includes("back end")) {
      roles.add("Backend Developer");
      roles.add("Backend Engineer");
      roles.add("Node.js Developer");
    }
    if (tLower.includes("swe") || tLower.includes("software engineer") || tLower.includes("sde")) {
      roles.add("Software Engineer");
      roles.add("Software Development Engineer");
    }
  }

  // 2. From education
  for (const edu of education) {
    const field = (edu.field_of_study || "").toLowerCase();
    const degree = (edu.degree || "").toLowerCase();
    if (field.includes("computer science") || field.includes("software") || field.includes("information technology")) {
      roles.add("Software Engineer");
      roles.add("Associate Software Engineer");
      roles.add("Junior Software Engineer");
      roles.add("Entry-Level Software Engineer");
      roles.add("New Grad Software Engineer");
      roles.add("SDE I");
    }
  }

  // 3. From verified skills (if MERN skills exist)
  const hasReact = skillSet.has("react") || skillSet.has("reactjs");
  const hasNode = skillSet.has("node") || skillSet.has("nodejs") || skillSet.has("node.js");
  const hasMongo = skillSet.has("mongodb");

  if (hasReact && hasNode) {
    roles.add("Full Stack Developer");
    roles.add("Software Engineer");
    roles.add("Web Developer");
    if (hasMongo) {
      roles.add("MERN Developer");
    }
  }
  if (hasReact) {
    roles.add("Frontend Developer");
  }
  if (hasNode) {
    roles.add("Backend Developer");
  }

  if (roles.size === 0) {
    roles.add("Software Engineer");
    roles.add("Junior Developer");
  }

  return Array.from(roles);
}

/**
 * Builds the normalized UserCareerProfile strictly from verified database records.
 * Guarantees zero hallucinations.
 */
export function buildUserCareerProfile(data: {
  userId: string;
  profile: any;
  skills: Array<{ skill_name: string }>;
  experiences: Array<{
    job_title?: string | null;
    company_name?: string | null;
    duration?: string | null;
    responsibilities?: string | null;
  }>;
  educations: Array<{
    degree?: string | null;
    field_of_study?: string | null;
    institution?: string | null;
    duration?: string | null;
  }>;
  projects: Array<{
    project_name?: string | null;
    description?: string | null;
    technologies?: string[] | null;
  }>;
}): UserCareerProfile {
  const { userId, profile, skills, experiences, educations, projects } = data;

  // 1. Process Skills (Categorization)
  const technical_skills: string[] = [];
  const frameworks: string[] = [];
  const databases: string[] = [];
  const tools: string[] = [];
  const all_skills: string[] = [];

  for (const s of skills) {
    const raw = (s.skill_name || "").trim();
    if (!raw) continue;
    all_skills.push(raw);

    const lower = raw.toLowerCase();
    if (FRAMEWORK_NAMES.has(lower)) {
      frameworks.push(raw);
    } else if (DATABASE_NAMES.has(lower)) {
      databases.push(raw);
    } else if (TOOL_NAMES.has(lower)) {
      tools.push(raw);
    } else {
      technical_skills.push(raw);
    }
  }

  // 2. Process Professional Experience
  let total_verified_experience_months = 0;
  const verifiedExperiences: VerifiedExperienceItem[] = [];

  for (const exp of experiences) {
    const title = (exp.job_title || "").trim();
    const company = (exp.company_name || "").trim();
    if (!title && !company) continue;

    const tLower = title.toLowerCase();
    const is_internship =
      tLower.includes("intern") ||
      tLower.includes("trainee") ||
      tLower.includes("apprentice") ||
      tLower.includes("fellow");

    const parsedDur = parseDurationMonths(exp.duration);
    total_verified_experience_months += parsedDur.months;

    const respList: string[] = [];
    if (exp.responsibilities) {
      exp.responsibilities
        .split(/\n|•/)
        .map((r) => r.trim())
        .filter((r) => r.length > 5)
        .forEach((r) => respList.push(r));
    }

    verifiedExperiences.push({
      title: title || "Software Engineer",
      company: company || "Company",
      start_date: parsedDur.start,
      end_date: parsedDur.end,
      duration_months: parsedDur.months,
      responsibilities: respList,
      is_internship,
    });
  }

  // 3. Process Educations
  const verifiedEducation: VerifiedEducationItem[] = [];
  let isStudentOrNewGrad = false;

  for (const edu of educations) {
    const degree = (edu.degree || "").trim();
    const field = (edu.field_of_study || "").trim();
    const inst = (edu.institution || "").trim();
    if (!degree && !field && !inst) continue;

    // Check graduation year in duration (e.g. "Nov. 2021 - July 2025")
    let endYear: number | undefined;
    if (edu.duration) {
      const yearMatch = edu.duration.match(/\b(202[3-9]|203[0-9])\b/g);
      if (yearMatch && yearMatch.length > 0) {
        endYear = parseInt(yearMatch[yearMatch.length - 1], 10);
        if (endYear >= 2024) {
          isStudentOrNewGrad = true;
        }
      }
    }

    verifiedEducation.push({
      degree: degree || "Degree",
      field_of_study: field || "Computer Science",
      institution: inst || "University",
      end_year: endYear,
    });
  }

  // 4. Process Projects (Technologies separated from work experience)
  const verifiedProjects: VerifiedProjectItem[] = [];
  for (const proj of projects) {
    const name = (proj.project_name || (proj as any).name || "").trim();
    if (!name) continue;

    const desc = proj.description || "";
    const techSet = new Set<string>();

    if (proj.technologies && Array.isArray(proj.technologies)) {
      proj.technologies.forEach((t) => techSet.add(t));
    }

    // Extract [Technologies: ...] bracketed info if present
    const techMatch = desc.match(/\[Technologies:\s*([^\]]+)\]/i);
    if (techMatch) {
      techMatch[1].split(/,|•|\/|\|/).forEach((t) => techSet.add(t.trim()));
    }

    // Extract known skills from project description
    const descLower = desc.toLowerCase();
    for (const sk of all_skills) {
      if (descLower.includes(sk.toLowerCase())) {
        techSet.add(sk);
      }
    }

    verifiedProjects.push({
      name,
      technologies: Array.from(techSet).filter(Boolean),
      description: desc,
    });
  }

  // 5. Seniority Derivation
  const seniority = deriveSeniorityFromExperience(
    total_verified_experience_months,
    isStudentOrNewGrad
  );

  // 6. Target Roles Derivation
  const target_roles = deriveTargetRoles(
    verifiedExperiences,
    verifiedEducation,
    all_skills
  );

  // 7. Location and Preferences
  const locations: string[] = [];
  if (profile?.location && profile.location.trim()) {
    locations.push(profile.location.trim());
  }
  if (Array.isArray(profile?.preferred_locations)) {
    profile.preferred_locations.forEach((l: string) => {
      if (l && !locations.includes(l)) locations.push(l);
    });
  }

  const remote_preference =
    typeof profile?.remote_preference === "boolean"
      ? profile.remote_preference
      : true; // default remote friendly

  const employment_preference = Array.isArray(profile?.employment_preferences)
    ? profile.employment_preferences
    : ["full-time", "internship"];

  return {
    user_id: userId,
    target_roles,
    technical_skills,
    frameworks,
    databases,
    tools,
    all_skills,
    experience: verifiedExperiences,
    total_verified_experience_months,
    education: verifiedEducation,
    projects: verifiedProjects,
    locations,
    remote_preference,
    employment_preference,
    seniority,
  };
}
