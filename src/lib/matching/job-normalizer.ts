import { NormalizedJob, JobSeniority } from "./types";

/**
 * Tech Skills Dictionary for deterministic extraction from job postings
 */
const KNOWN_TECH_SKILLS = [
  // Languages
  "javascript", "typescript", "python", "java", "c++", "c#", "c", "golang", "go",
  "rust", "ruby", "php", "swift", "kotlin", "scala", "sql", "html", "css", "html5", "css3",
  // Frontend
  "react", "react.js", "reactjs", "next.js", "nextjs", "vue", "vue.js", "vuejs",
  "angular", "svelte", "tailwind", "tailwindcss", "bootstrap", "redux", "graphql",
  // Backend & APIs
  "node", "node.js", "nodejs", "express", "express.js", "expressjs", "fastapi", "flask",
  "django", "spring", "spring boot", "nest.js", "nestjs", "ruby on rails", "asp.net",
  "rest", "rest api", "grpc", "microservices",
  // Databases
  "mongodb", "postgresql", "postgres", "mysql", "redis", "dynamodb", "supabase",
  "firebase", "cassandra", "elasticsearch", "sqlite", "oracle", "prisma", "sequelize",
  // Cloud & DevOps
  "aws", "amazon web services", "gcp", "google cloud", "azure", "docker", "kubernetes",
  "k8s", "terraform", "ci/cd", "jenkins", "github actions", "linux", "shell", "bash",
  // Concepts & Practices
  "data structures", "algorithms", "dsa", "oop", "system design", "operating systems",
  "networking", "git", "github", "testing", "jest", "cypress", "agile", "scrum",
];

/**
 * Section Header Detectors
 */
const REQUIREMENT_HEADERS = [
  "requirements", "basic qualifications", "minimum qualifications",
  "what you'll need", "what you need", "what we're looking for",
  "who you are", "must have", "qualifications", "required skills",
  "what you should have", "skills required"
];

const PREFERRED_HEADERS = [
  "preferred qualifications", "preferred skills", "nice to have",
  "bonus points", "bonus qualifications", "good to have",
  "plus", "would be great if", "desirable", "additional skills"
];

const RESPONSIBILITY_HEADERS = [
  "responsibilities", "what you'll do", "what you will do",
  "the role", "role overview", "duties", "your day-to-day",
  "key responsibilities"
];

/**
 * Parse job description into structured sections
 */
export function splitJobSections(description: string): {
  responsibilities: string[];
  requirements: string[];
  preferred: string[];
  generalLines: string[];
} {
  const lines = description
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  let currentSection: "general" | "responsibilities" | "requirements" | "preferred" = "general";

  const responsibilities: string[] = [];
  const requirements: string[] = [];
  const preferred: string[] = [];
  const generalLines: string[] = [];

  for (const line of lines) {
    const lower = line.toLowerCase().replace(/[:\-_#*]/g, "").trim();

    // Check if line is a header
    if (REQUIREMENT_HEADERS.some((h) => lower === h || lower.startsWith(h))) {
      currentSection = "requirements";
      continue;
    }
    if (PREFERRED_HEADERS.some((h) => lower === h || lower.startsWith(h))) {
      currentSection = "preferred";
      continue;
    }
    if (RESPONSIBILITY_HEADERS.some((h) => lower === h || lower.startsWith(h))) {
      currentSection = "responsibilities";
      continue;
    }

    // Clean bullet lines
    const cleanItem = line.replace(/^[•\-\*–—\d.)\s]+/, "").trim();
    if (!cleanItem || cleanItem.length < 5) continue;

    if (currentSection === "requirements") {
      requirements.push(cleanItem);
    } else if (currentSection === "preferred") {
      preferred.push(cleanItem);
    } else if (currentSection === "responsibilities") {
      responsibilities.push(cleanItem);
    } else {
      generalLines.push(cleanItem);
    }
  }

  return { responsibilities, requirements, preferred, generalLines };
}

/**
 * Extract technology skills matching our dictionary from a text block
 */
function extractSkillsFromText(text: string): string[] {
  const lower = ` ${text.toLowerCase().replace(/[,/()]/g, " ")} `;
  const found = new Set<string>();

  for (const skill of KNOWN_TECH_SKILLS) {
    // Exact word boundary matching for short words like "c", "go", "r"
    if (skill.length <= 2) {
      const regex = new RegExp(`\\b${skill}\\b`, "i");
      if (regex.test(lower)) {
        found.add(formatCanonicalSkill(skill));
      }
    } else {
      if (lower.includes(` ${skill} `) || lower.includes(` ${skill},`) || lower.includes(` ${skill}.`)) {
        found.add(formatCanonicalSkill(skill));
      }
    }
  }

  return Array.from(found);
}

/**
 * Format tech name canonically
 */
function formatCanonicalSkill(skill: string): string {
  const s = skill.toLowerCase();
  if (s === "react" || s === "react.js" || s === "reactjs") return "React";
  if (s === "node" || s === "node.js" || s === "nodejs") return "Node.js";
  if (s === "express" || s === "express.js" || s === "expressjs") return "Express";
  if (s === "javascript") return "JavaScript";
  if (s === "typescript") return "TypeScript";
  if (s === "mongodb") return "MongoDB";
  if (s === "postgresql" || s === "postgres") return "PostgreSQL";
  if (s === "mysql") return "MySQL";
  if (s === "c++") return "C++";
  if (s === "c#") return "C#";
  if (s === "c") return "C";
  if (s === "python") return "Python";
  if (s === "golang" || s === "go") return "Go";
  if (s === "html" || s === "html5") return "HTML";
  if (s === "css" || s === "css3") return "CSS";
  if (s === "tailwindcss" || s === "tailwind") return "TailwindCSS";
  if (s === "aws" || s === "amazon web services") return "AWS";
  if (s === "gcp" || s === "google cloud") return "GCP";
  if (s === "docker") return "Docker";
  if (s === "kubernetes" || s === "k8s") return "Kubernetes";
  if (s === "git" || s === "github") return "Git";
  if (s === "linux") return "Linux";
  if (s === "sql") return "SQL";
  return skill.charAt(0).toUpperCase() + skill.slice(1);
}

/**
 * Extract experience requirement in months from text
 */
export function extractExperienceMonths(text: string): { minMonths: number; maxMonths: number | null } {
  const lower = text.toLowerCase();

  // "5+ years", "5-7 years", "3 to 5 years", "minimum 3 years"
  const expMatch = lower.match(
    /(?:at\s+least|min|minimum|requires|requiring)?\s*(\d+)(?:\+|\s*(?:-|to)\s*(\d+))?\s*(?:years?|yrs?)(?:\s+of)?(?:\s+(?:relevant|hands-on|work|industry|software)?\s*experience)?/i
  );

  if (expMatch) {
    const minYears = parseInt(expMatch[1], 10);
    const maxYears = expMatch[2] ? parseInt(expMatch[2], 10) : null;

    if (!isNaN(minYears) && minYears <= 25) {
      return {
        minMonths: minYears * 12,
        maxMonths: maxYears ? maxYears * 12 : null,
      };
    }
  }

  // Check for explicit "entry level", "new grad", "0-1 years", "no experience required"
  if (
    lower.includes("entry level") ||
    lower.includes("new grad") ||
    lower.includes("recent graduate") ||
    lower.includes("0-1 year") ||
    lower.includes("0 to 1 year") ||
    lower.includes("0-2 year") ||
    lower.includes("no experience required")
  ) {
    return { minMonths: 0, maxMonths: 24 };
  }

  return { minMonths: 0, maxMonths: null };
}

/**
 * Extract education requirements (PhD, Master's, Bachelor's)
 */
export function extractEducationRequirements(text: string): string[] {
  const lower = text.toLowerCase();
  const degrees = new Set<string>();

  if (lower.includes("ph.d") || lower.includes("phd") || lower.includes("doctorate")) {
    degrees.add("PhD");
  }
  if (lower.includes("master's") || lower.includes("masters") || lower.includes("m.s.") || lower.includes("ms in")) {
    degrees.add("Master's");
  }
  if (
    lower.includes("bachelor's") ||
    lower.includes("bachelors") ||
    lower.includes("b.s.") ||
    lower.includes("bs in") ||
    lower.includes("b.tech") ||
    lower.includes("b.e.")
  ) {
    degrees.add("Bachelor's");
  }

  return Array.from(degrees);
}

/**
 * Classify role family
 */
export function classifyRoleFamily(title: string, description: string): string {
  const combined = `${title} ${description}`.toLowerCase();
  const titleLower = title.toLowerCase();

  // 1. Unrelated corporate role families (Hard exclusion targets)
  if (
    titleLower.includes("financial analyst") ||
    titleLower.includes("finance manager") ||
    titleLower.includes("accountant") ||
    titleLower.includes("controller") ||
    titleLower.includes("auditor") ||
    titleLower.includes("treasury")
  ) {
    return "finance_accounting";
  }

  if (
    titleLower.includes("marketing") ||
    titleLower.includes("growth marketing") ||
    titleLower.includes("social media") ||
    titleLower.includes("sales") ||
    titleLower.includes("account executive") ||
    titleLower.includes("business development")
  ) {
    return "marketing_sales";
  }

  if (
    titleLower.includes("recruiter") ||
    titleLower.includes("talent acquisition") ||
    titleLower.includes("hr manager") ||
    titleLower.includes("people partner")
  ) {
    return "hr_recruiting";
  }

  if (
    titleLower.includes("risk operations") ||
    titleLower.includes("user safety") ||
    titleLower.includes("content moderator") ||
    titleLower.includes("customer support") ||
    titleLower.includes("operations analyst")
  ) {
    return "operations_support";
  }

  if (
    titleLower.includes("ui/ux designer") ||
    titleLower.includes("product designer") ||
    titleLower.includes("graphic designer") ||
    titleLower.includes("visual designer")
  ) {
    return "ui_ux_design";
  }

  if (
    titleLower.includes("product manager") ||
    titleLower.includes("technical program manager") ||
    titleLower.includes("scrum master")
  ) {
    return "product_management";
  }

  // 2. Technical Engineering Role Families
  if (
    titleLower.includes("full stack") ||
    titleLower.includes("fullstack") ||
    titleLower.includes("mern") ||
    titleLower.includes("web developer") ||
    (combined.includes("react") && combined.includes("node"))
  ) {
    return "software_engineering_fullstack";
  }

  if (
    titleLower.includes("frontend") ||
    titleLower.includes("front-end") ||
    titleLower.includes("front end") ||
    titleLower.includes("ui developer") ||
    titleLower.includes("react developer")
  ) {
    return "software_engineering_frontend";
  }

  if (
    titleLower.includes("backend") ||
    titleLower.includes("back-end") ||
    titleLower.includes("back end") ||
    titleLower.includes("api engineer") ||
    titleLower.includes("node developer")
  ) {
    return "software_engineering_backend";
  }

  if (
    titleLower.includes("devops") ||
    titleLower.includes("sre") ||
    titleLower.includes("site reliability") ||
    titleLower.includes("cloud engineer") ||
    titleLower.includes("infrastructure engineer")
  ) {
    return "devops_cloud";
  }

  if (
    titleLower.includes("data scientist") ||
    titleLower.includes("machine learning") ||
    titleLower.includes("ai engineer") ||
    titleLower.includes("nlp") ||
    titleLower.includes("computer vision")
  ) {
    return "data_science_ml";
  }

  if (
    titleLower.includes("software engineer") ||
    titleLower.includes("software developer") ||
    titleLower.includes("sde") ||
    titleLower.includes("programmer")
  ) {
    return "software_engineering_general";
  }

  return "other";
}

/**
 * Determine job seniority from title, requirements, and experience months
 */
export function determineJobSeniority(
  title: string,
  minMonths: number,
  description: string
): JobSeniority {
  const tLower = title.toLowerCase();

  // 1. Intern
  if (tLower.includes("intern") || tLower.includes("internship") || tLower.includes("co-op")) {
    return "INTERN";
  }

  // 2. Staff / Principal
  if (tLower.includes("principal")) return "PRINCIPAL";
  if (tLower.includes("staff")) return "STAFF";

  // 3. Lead / Manager / Director
  if (
    tLower.includes("lead") ||
    tLower.includes("manager") ||
    tLower.includes("director") ||
    tLower.includes("head of") ||
    tLower.includes("architect") ||
    tLower.includes("vp ") ||
    tLower.includes("chief")
  ) {
    return "LEAD";
  }

  // 4. Senior
  if (
    tLower.includes("senior") ||
    tLower.includes("sr.") ||
    tLower.includes("sr ") ||
    tLower.includes("sde iii") ||
    tLower.includes("sde 3") ||
    tLower.includes("level 3") ||
    tLower.includes("l3") ||
    minMonths >= 60 // 5+ years explicit experience
  ) {
    return "SENIOR";
  }

  // 5. Entry Level / Junior
  if (
    tLower.includes("junior") ||
    tLower.includes("entry") ||
    tLower.includes("associate") ||
    tLower.includes("new grad") ||
    tLower.includes("graduate") ||
    tLower.includes("sde i") ||
    tLower.includes("sde 1") ||
    tLower.includes("level 1") ||
    tLower.includes("l1") ||
    tLower.includes("jr.") ||
    tLower.includes("jr ")
  ) {
    return "ENTRY_LEVEL";
  }

  // 6. Mid-Level (2-5 years experience or standard title without senior prefixes)
  if (minMonths >= 24 && minMonths < 60) {
    return "MID";
  }

  if (minMonths === 0) {
    // If no experience specified and title has no senior prefixes, default to ENTRY_LEVEL / JUNIOR
    return "ENTRY_LEVEL";
  }

  return "MID";
}

/**
 * Normalizes any raw or canonical job into NormalizedJob
 */
export function normalizeJob(rawJob: {
  id?: string;
  title: string;
  company_name?: string | null;
  company?: string | null;
  description?: string | null;
  location?: string | null;
  country?: string | null;
  remote_type?: string | null;
  employment_type?: string | null;
  source?: string | null;
  job_url?: string | null;
  apply_url?: string | null;
  posted_at?: string | null;
  salary?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string | null;
  company_logo?: string | null;
}): NormalizedJob {
  const id = rawJob.id || `job-${Math.random().toString(36).slice(2, 9)}`;
  const title = (rawJob.title || "Software Engineer").trim();
  const company = (rawJob.company_name || rawJob.company || "Company").trim();
  const description = (rawJob.description || "").trim();

  // 1. Split sections
  const sections = splitJobSections(description);

  // 2. Extract experience
  const expInfo = extractExperienceMonths(
    `${title} ${sections.requirements.join(" ")} ${description}`
  );

  // 3. Extract education
  const education_requirements = extractEducationRequirements(
    `${sections.requirements.join(" ")} ${description}`
  );

  // 4. Extract Required vs Preferred Skills
  const titleSkills = extractSkillsFromText(title);
  const reqSkillsFromText = extractSkillsFromText(sections.requirements.join(" "));
  const prefSkillsFromText = extractSkillsFromText(sections.preferred.join(" "));

  const required_skills_set = new Set<string>([...titleSkills, ...reqSkillsFromText]);
  const preferred_skills_set = new Set<string>();

  for (const s of prefSkillsFromText) {
    if (!required_skills_set.has(s)) {
      preferred_skills_set.add(s);
    }
  }

  // If no requirements section was explicitly marked, extract from general description
  if (required_skills_set.size === 0) {
    const generalSkills = extractSkillsFromText(description);
    generalSkills.forEach((s) => required_skills_set.add(s));
  }

  // 5. Determine Seniority & Role Family
  const seniority = determineJobSeniority(title, expInfo.minMonths, description);
  const role_family = classifyRoleFamily(title, description);

  // 6. Remote Type Normalization
  let remote_type: "remote" | "hybrid" | "onsite" = "remote";
  const rRaw = (rawJob.remote_type || "").toLowerCase();
  const locRaw = (rawJob.location || "").toLowerCase();
  if (rRaw.includes("hybrid") || locRaw.includes("hybrid")) {
    remote_type = "hybrid";
  } else if (rRaw.includes("onsite") || rRaw.includes("on-site") || locRaw.includes("on-site")) {
    remote_type = "onsite";
  } else {
    remote_type = "remote";
  }

  return {
    id,
    title,
    company,
    description,
    responsibilities: sections.responsibilities,
    requirements: sections.requirements,
    required_skills: Array.from(required_skills_set),
    preferred_skills: Array.from(preferred_skills_set),
    minimum_experience_months: expInfo.minMonths,
    maximum_experience_months: expInfo.maxMonths,
    education_requirements,
    location: rawJob.location || "Remote",
    country: rawJob.country || null,
    remote_type,
    employment_type: rawJob.employment_type || "full-time",
    seniority,
    role_family,
    source: rawJob.source || "canonical",
    job_url: rawJob.job_url || "",
    apply_url: rawJob.apply_url || rawJob.job_url || "",
    posted_at: rawJob.posted_at || null,
    salary: rawJob.salary || null,
    salary_min: rawJob.salary_min || null,
    salary_max: rawJob.salary_max || null,
    salary_currency: rawJob.salary_currency || "USD",
    company_logo: rawJob.company_logo || null,
  };
}
