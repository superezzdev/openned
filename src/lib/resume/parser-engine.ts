import { GoogleGenAI } from "@google/genai";
import {
  StrictResumeExtraction,
  StrictLink,
  EvidenceField,
} from "./types";

export const PARSER_VERSION = "resume_parser_v2";

/**
 * Deterministic link normalizer for profiles and competitive programming platforms.
 */
export function normalizePlatformUrl(
  platform: string,
  username: string | null,
  rawUrl: string | null
): { username: string | null; url: string | null } {
  const p = platform.toLowerCase().trim();

  // If rawUrl already starts with http, keep it cleaned
  if (rawUrl && /^https?:\/\//i.test(rawUrl.trim())) {
    const cleanUrl = rawUrl.trim();
    return { username: username || extractUsernameFromUrl(cleanUrl), url: cleanUrl };
  }

  // If username exists or rawUrl contains username pattern (e.g. "// Kavya2719")
  let cleanUser = (username || "").replace(/^[/:#\s]+/, "").trim();
  if (!cleanUser && rawUrl) {
    cleanUser = rawUrl.replace(/^(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9.-]+\/[a-zA-Z0-9_-]+\/?/, "").replace(/^[/:#\s]+/, "").trim();
    if (!cleanUser) {
      cleanUser = rawUrl.replace(/^[/:#\s]+/, "").trim();
    }
  }

  if (!cleanUser) {
    return { username: null, url: null };
  }

  switch (p) {
    case "github":
      return { username: cleanUser, url: `https://github.com/${cleanUser}` };
    case "linkedin":
      return { username: cleanUser, url: `https://www.linkedin.com/in/${cleanUser}` };
    case "codeforces":
      return { username: cleanUser, url: `https://codeforces.com/profile/${cleanUser}` };
    case "codechef":
      return { username: cleanUser, url: `https://codechef.com/users/${cleanUser}` };
    case "leetcode":
      return { username: cleanUser, url: `https://leetcode.com/${cleanUser}` };
    case "portfolio":
    case "website":
      return {
        username: cleanUser,
        url: cleanUser.startsWith("http") ? cleanUser : `https://${cleanUser}`,
      };
    default:
      return { username: cleanUser, url: rawUrl || null };
  }
}

function extractUsernameFromUrl(url: string): string | null {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || null;
  } catch {
    return null;
  }
}

/**
 * Strict System Instruction for Gemini.
 */
const STRICT_EXTRACTION_SYSTEM_INSTRUCTION = `You are a resume data extraction engine.
Extract only information explicitly present in the provided resume.
You MUST NOT:
- invent information
- infer missing dates
- assume skills
- assume job responsibilities
- assume seniority
- assume location (company work location is NOT candidate home location)
- assume years of experience
- assume degree specialization
- assume employment type
- convert unknown information into plausible values

If information is not explicitly supported by the resume, return null or [].
Every extracted value must have evidence from the source text.
Confidence levels: HIGH (directly written in resume), MEDIUM (minor normalization), LOW (ambiguous).
Prioritize PRECISION > COMPLETENESS.`;

const STRICT_EXTRACTION_PROMPT_TEMPLATE = (rawText: string) => `Extract all data from this resume text into strict structured JSON.

RESUME SOURCE TEXT:
"""
${rawText}
"""

INSTRUCTIONS:
1. Extract ALL explicitly stated information with evidence directly from the text.
2. SKILLS: Extract EVERY listed skill under sections like "TECHNICAL SKILLS", "Skills", "Backend", "Frontend", "Databases", "DevOps & Tools", "Core Competencies", "Technologies". Map each skill into the most appropriate category (programming_languages, frameworks, databases, tools, cloud, devops, concepts). NEVER return empty skill arrays if the resume text lists skills or technologies!
3. PROFILES & LINKS: Extract LinkedIn, GitHub, Portfolio links and handles accurately.
4. HONESTY: Return null for missing fields (e.g. location, dates). Do not invent data.

SCHEMA:
{
  "personal": {
    "full_name": { "value": string | null, "confidence": "HIGH"|"MEDIUM"|"LOW", "evidence": string | null },
    "first_name": { "value": string | null, "confidence": "HIGH"|"MEDIUM"|"LOW", "evidence": string | null },
    "last_name": { "value": string | null, "confidence": "HIGH"|"MEDIUM"|"LOW", "evidence": string | null },
    "email": { "value": string | null, "confidence": "HIGH"|"MEDIUM"|"LOW", "evidence": string | null },
    "phone": { "value": string | null, "confidence": "HIGH"|"MEDIUM"|"LOW", "evidence": string | null },
    "location": { "value": string | null, "confidence": "HIGH"|"MEDIUM"|"LOW", "evidence": string | null }
  },
  "education": [
    {
      "institution": { "value": string | null, "confidence": "HIGH"|"MEDIUM"|"LOW", "evidence": string | null },
      "degree": { "value": string | null, "confidence": "HIGH"|"MEDIUM"|"LOW", "evidence": string | null },
      "field_of_study": { "value": string | null, "confidence": "HIGH"|"MEDIUM"|"LOW", "evidence": string | null },
      "start_date": { "value": string | null, "confidence": "HIGH"|"MEDIUM"|"LOW", "evidence": string | null },
      "end_date": { "value": string | null, "confidence": "HIGH"|"MEDIUM"|"LOW", "evidence": string | null },
      "grade": { "value": string | null, "confidence": "HIGH"|"MEDIUM"|"LOW", "evidence": string | null }
    }
  ],
  "experience": [
    {
      "company": { "value": string | null, "confidence": "HIGH"|"MEDIUM"|"LOW", "evidence": string | null },
      "title": { "value": string | null, "confidence": "HIGH"|"MEDIUM"|"LOW", "evidence": string | null },
      "employment_type": { "value": string | null, "confidence": "HIGH"|"MEDIUM"|"LOW", "evidence": string | null },
      "location": { "value": string | null, "confidence": "HIGH"|"MEDIUM"|"LOW", "evidence": string | null },
      "start_date": { "value": string | null, "confidence": "HIGH"|"MEDIUM"|"LOW", "evidence": string | null },
      "end_date": { "value": string | null, "confidence": "HIGH"|"MEDIUM"|"LOW", "evidence": string | null },
      "description": { "value": string | null, "confidence": "HIGH"|"MEDIUM"|"LOW", "evidence": string | null },
      "achievements": [ { "value": string, "evidence": string } ]
    }
  ],
  "projects": [
    {
      "name": { "value": string | null, "confidence": "HIGH"|"MEDIUM"|"LOW", "evidence": string | null },
      "technologies": [ { "value": string, "evidence": string } ],
      "description": { "value": string | null, "confidence": "HIGH"|"MEDIUM"|"LOW", "evidence": string | null },
      "start_date": { "value": string | null, "confidence": "HIGH"|"MEDIUM"|"LOW", "evidence": string | null },
      "end_date": { "value": string | null, "confidence": "HIGH"|"MEDIUM"|"LOW", "evidence": string | null },
      "links": [ { "value": string, "evidence": string } ]
    }
  ],
  "skills": {
    "programming_languages": [ { "value": string, "evidence": string, "confidence": "HIGH"|"MEDIUM"|"LOW" } ],
    "frameworks": [ { "value": string, "evidence": string, "confidence": "HIGH"|"MEDIUM"|"LOW" } ],
    "databases": [ { "value": string, "evidence": string, "confidence": "HIGH"|"MEDIUM"|"LOW" } ],
    "tools": [ { "value": string, "evidence": string, "confidence": "HIGH"|"MEDIUM"|"LOW" } ],
    "cloud": [ { "value": string, "evidence": string, "confidence": "HIGH"|"MEDIUM"|"LOW" } ],
    "devops": [ { "value": string, "evidence": string, "confidence": "HIGH"|"MEDIUM"|"LOW" } ],
    "concepts": [ { "value": string, "evidence": string, "confidence": "HIGH"|"MEDIUM"|"LOW" } ],
    "soft_skills": [ { "value": string, "evidence": string, "confidence": "HIGH"|"MEDIUM"|"LOW" } ]
  },
  "achievements": [
    { "value": string, "confidence": "HIGH"|"MEDIUM"|"LOW", "evidence": string }
  ],
  "certifications": [
    { "certification_name": string, "issuer": string | null, "confidence": "HIGH"|"MEDIUM"|"LOW", "evidence": string }
  ],
  "links": {
    "linkedin": { "platform": "linkedin", "username": string | null, "url": string | null, "evidence": string | null },
    "github": { "platform": "github", "username": string | null, "url": string | null, "evidence": string | null },
    "portfolio": { "platform": "portfolio", "username": string | null, "url": string | null, "evidence": string | null },
    "codeforces": { "platform": "codeforces", "username": string | null, "url": string | null, "evidence": string | null },
    "codechef": { "platform": "codechef", "username": string | null, "url": string | null, "evidence": string | null },
    "leetcode": { "platform": "leetcode", "username": string | null, "url": string | null, "evidence": string | null }
  }
}

Return ONLY valid JSON matching this schema with no markdown backticks or commentary.`;

/**
 * Deterministically extracts skills from resume text if AI model fails to populate skills section.
 */
export function extractSkillsDeterministically(rawText: string): Array<EvidenceField<string>> {
  if (!rawText) return [];
  const startIdx = rawText.search(/\b(?:TECHNICAL\s+SKILLS|SKILLS|TECHNOLOGIES)\b/i);
  if (startIdx === -1) return [];
  const afterStart = rawText.slice(startIdx);
  const nextSectionMatch = afterStart.slice(20).search(/\n\s*(?:EDUCATION|EXPERIENCE|PROJECTS|CERTIFICATIONS|ACHIEVEMENTS|LANGUAGES)\b/i);
  const sectionText = nextSectionMatch !== -1 ? afterStart.slice(0, 20 + nextSectionMatch) : afterStart;
  
  const lines = sectionText.split("\n").slice(1);
  const skills: Array<EvidenceField<string>> = [];
  const subheaders = new Set([
    "backend", "frontend", "databases & caching", "databases", "devops & tools",
    "tools", "core competencies", "languages", "technical skills", "skills", "technologies"
  ]);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || subheaders.has(trimmed.toLowerCase())) continue;
    const tokens = trimmed.split(/[•|,]/).map((s) => s.trim()).filter(Boolean);
    for (const t of tokens) {
      if (t.length > 1 && !subheaders.has(t.toLowerCase())) {
        skills.push({
          value: t,
          confidence: "HIGH",
          evidence: t,
        });
      }
    }
  }
  return skills;
}

/**
 * Normalizes raw LLM output into validated StrictResumeExtraction structure,
 * applying deterministic link resolution and source grounding.
 */
export function normalizeExtractedJson(parsed: any, rawText?: string): StrictResumeExtraction {
  // Normalize links
  const normalizeLinkObj = (platform: string, rawObj: any): StrictLink | null => {
    if (!rawObj) return null;
    const { username, url } = normalizePlatformUrl(
      platform,
      rawObj.username || null,
      rawObj.url || null
    );
    return {
      platform,
      username,
      url,
      evidence: rawObj.evidence || null,
    };
  };

  const toEvidenceField = (item: any): EvidenceField<string> => {
    if (!item) return { value: null, confidence: "LOW", evidence: null };
    if (typeof item === "string") {
      return { value: item.trim(), confidence: "HIGH", evidence: item.trim() };
    }
    return {
      value: item.value ?? null,
      confidence: (item.confidence as any) || "HIGH",
      evidence: item.evidence ?? (typeof item.value === "string" ? item.value : null),
      source_section: item.source_section,
    };
  };

  const defaultField = (f: any) => {
    if (typeof f === "string") {
      return { value: f.trim(), confidence: "HIGH" as const, evidence: f.trim() };
    }
    return {
      value: f?.value ?? null,
      confidence: (f?.confidence as any) || "HIGH",
      evidence: f?.evidence ?? (typeof f?.value === "string" ? f.value : null),
      source_section: f?.source_section,
    };
  };

  const personalObj = parsed?.personal || parsed?.contact || parsed?.candidate || {};
  const fullNameField = defaultField(personalObj.full_name || personalObj.name || parsed?.name);
  const firstNameField = defaultField(personalObj.first_name);
  const lastNameField = defaultField(personalObj.last_name);

  // If first/last name are missing but full name exists, split cleanly
  if (fullNameField.value && (!firstNameField.value || !lastNameField.value)) {
    const parts = String(fullNameField.value).trim().split(/\s+/);
    if (!firstNameField.value && parts[0]) {
      firstNameField.value = parts[0];
      firstNameField.evidence = fullNameField.evidence;
    }
    if (!lastNameField.value && parts.length > 1) {
      lastNameField.value = parts.slice(1).join(" ");
      lastNameField.evidence = fullNameField.evidence;
    }
  }

  // Normalize education array (handle single object or array)
  const rawEdu = parsed?.education || parsed?.educations || parsed?.academic_background || [];
  const eduArray = Array.isArray(rawEdu) ? rawEdu : typeof rawEdu === "object" && rawEdu !== null ? [rawEdu] : [];

  // Normalize experience array
  const rawExp = parsed?.experience || parsed?.experiences || parsed?.work_experience || parsed?.employment || [];
  const expArray = Array.isArray(rawExp) ? rawExp : typeof rawExp === "object" && rawExp !== null ? [rawExp] : [];

  // Normalize projects array
  const rawProj = parsed?.projects || parsed?.project_experience || [];
  const projArray = Array.isArray(rawProj) ? rawProj : typeof rawProj === "object" && rawProj !== null ? [rawProj] : [];

  // Semantic skill mapping across models and schemas
  const skillsSources = [parsed?.skills, parsed?.technical_skills, parsed?.competencies, parsed?.technologies].filter(
    (s) => s && typeof s === "object"
  );

  const progLangs: Array<EvidenceField<string>> = [];
  const frameworks: Array<EvidenceField<string>> = [];
  const databases: Array<EvidenceField<string>> = [];
  const tools: Array<EvidenceField<string>> = [];
  const cloud: Array<EvidenceField<string>> = [];
  const devops: Array<EvidenceField<string>> = [];
  const concepts: Array<EvidenceField<string>> = [];
  const softSkills: Array<EvidenceField<string>> = [];

  const addSkill = (target: Array<EvidenceField<string>>, item: any) => {
    const ef = toEvidenceField(item);
    if (ef.value && !target.some((x) => x.value?.toLowerCase() === ef.value?.toLowerCase())) {
      target.push(ef);
    }
  };

  for (const src of skillsSources) {
    if (Array.isArray(src)) {
      src.forEach((item) => addSkill(progLangs, item));
    } else {
      for (const [key, val] of Object.entries(src)) {
        const k = key.toLowerCase();
        const items = Array.isArray(val) ? val : typeof val === "string" ? val.split(/[•,\n|]/) : [val];
        for (const item of items) {
          if (!item) continue;
          if (/database|caching|sql|storage/i.test(k)) {
            addSkill(databases, item);
          } else if (/cloud|aws|gcp|azure/i.test(k)) {
            addSkill(cloud, item);
          } else if (/devops|ci[_-]?cd|docker|k8s|kubernetes/i.test(k)) {
            addSkill(devops, item);
          } else if (/concept|competenc|architecture|methodolog|practice/i.test(k)) {
            addSkill(concepts, item);
          } else if (/soft|interpersonal/i.test(k)) {
            addSkill(softSkills, item);
          } else if (/framework|library|frontend|front_end|backend|back_end/i.test(k)) {
            addSkill(frameworks, item);
          } else if (/language|coding|scripting/i.test(k)) {
            addSkill(progLangs, item);
          } else {
            addSkill(tools, item);
          }
        }
      }
    }
  }

  // If specialized skill section was not present or empty, deterministically extract from rawText if available
  if (progLangs.length === 0 && frameworks.length === 0 && databases.length === 0 && tools.length === 0) {
    if (rawText) {
      const deterministicSkills = extractSkillsDeterministically(rawText);
      deterministicSkills.forEach((s) => addSkill(tools, s));
    }
    projArray.forEach((p: any) => {
      if (Array.isArray(p.technologies)) {
        p.technologies.forEach((t: any) => addSkill(tools, t));
      }
    });
  }

  return {
    personal: {
      full_name: fullNameField,
      first_name: firstNameField,
      last_name: lastNameField,
      email: defaultField(personalObj.email),
      phone: defaultField(personalObj.phone),
      location: defaultField(personalObj.location),
    },
    education: eduArray.map((edu: any) => ({
      institution: defaultField(edu.institution || edu.school || edu.university || edu.college),
      degree: defaultField(edu.degree || edu.qualification),
      field_of_study: defaultField(edu.field_of_study || edu.major || edu.specialization),
      start_date: defaultField(edu.start_date),
      end_date: defaultField(edu.end_date || edu.expected_graduation || edu.graduation_year),
      grade: defaultField(edu.grade || edu.gpa || edu.cgpa),
    })),
    experience: expArray.map((exp: any) => {
      const rawAch = exp.achievements || exp.responsibilities || [];
      const achievements = Array.isArray(rawAch)
        ? rawAch.map((ach: any) => {
            if (typeof ach === "string") {
              return { value: ach.trim(), evidence: ach.trim() };
            }
            return {
              value: String(ach?.value || ""),
              evidence: String(ach?.evidence || ach?.value || ""),
            };
          })
        : [];

      return {
        company: defaultField(exp.company || exp.company_name || exp.employer),
        title: defaultField(exp.title || exp.role || exp.position || exp.job_title),
        employment_type: defaultField(exp.employment_type),
        location: defaultField(exp.location),
        start_date: defaultField(exp.start_date),
        end_date: defaultField(exp.end_date),
        description: defaultField(exp.description),
        achievements,
      };
    }),
    projects: projArray.map((proj: any) => {
      const rawTech = proj.technologies || [];
      const technologies = Array.isArray(rawTech)
        ? rawTech.map((t: any) => {
            if (typeof t === "string") return { value: t.trim(), evidence: t.trim() };
            return { value: String(t?.value || ""), evidence: String(t?.evidence || t?.value || "") };
          })
        : [];

      const rawLinks = proj.links || (proj.url ? [{ value: proj.url, evidence: proj.url }] : []);
      const links = Array.isArray(rawLinks)
        ? rawLinks.map((l: any) => {
            if (typeof l === "string") return { value: l.trim(), evidence: l.trim() };
            return { value: String(l?.value || ""), evidence: String(l?.evidence || l?.value || "") };
          })
        : [];

      return {
        name: defaultField(proj.name || proj.title || proj.project_name),
        technologies,
        description: defaultField(Array.isArray(proj.description) ? proj.description.join(" ") : proj.description),
        start_date: defaultField(proj.start_date),
        end_date: defaultField(proj.end_date),
        links,
      };
    }),
    skills: {
      programming_languages: progLangs,
      frameworks,
      databases,
      tools,
      cloud,
      devops,
      concepts,
      soft_skills: softSkills,
    },
    achievements: Array.isArray(parsed?.achievements || parsed?.certifications_achievements)
      ? (parsed.achievements || parsed.certifications_achievements).map((ach: any) => {
          if (typeof ach === "string") return { value: ach.trim(), confidence: "HIGH" as const, evidence: ach.trim() };
          return {
            value: String(ach?.value || ""),
            confidence: ach?.confidence || "HIGH",
            evidence: String(ach?.evidence || ach?.value || ""),
          };
        })
      : [],
    certifications: Array.isArray(parsed?.certifications)
      ? parsed.certifications.map((cert: any) => {
          if (typeof cert === "string") {
            return { certification_name: cert.trim(), issuer: null, confidence: "HIGH" as const, evidence: cert.trim() };
          }
          return {
            certification_name: String(cert?.certification_name || cert?.name || ""),
            issuer: cert?.issuer || null,
            confidence: cert?.confidence || "HIGH",
            evidence: String(cert?.evidence || cert?.certification_name || ""),
          };
        })
      : [],
    links: {
      linkedin: normalizeLinkObj("linkedin", parsed?.links?.linkedin),
      github: normalizeLinkObj("github", parsed?.links?.github),
      portfolio: normalizeLinkObj("portfolio", parsed?.links?.portfolio),
      codeforces: normalizeLinkObj("codeforces", parsed?.links?.codeforces),
      codechef: normalizeLinkObj("codechef", parsed?.links?.codechef),
      leetcode: normalizeLinkObj("leetcode", parsed?.links?.leetcode),
    },
  };
}

/**
 * Strict Heuristic Fallback Parser
 * Extract ONLY explicit regex matches without inventing or assuming ANY data.
 * No mock strings, no "Software Developer", no "Company", no "2021-2025", no "SIES".
 */
export function strictHeuristicFallback(rawText: string): StrictResumeExtraction {
  const cleanText = rawText.replace(/\r\n/g, "\n");
  const lines = cleanText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // 1. Email extraction
  const emailMatch = cleanText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch ? emailMatch[0] : null;

  // 2. Phone extraction
  const phoneMatch = cleanText.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\b\d{10}\b/);
  const phone = phoneMatch ? phoneMatch[0] : null;

  // 3. Name extraction (first line with only characters)
  let fullName: string | null = null;
  let firstName: string | null = null;
  let lastName: string | null = null;

  for (let i = 0; i < Math.min(lines.length, 4); i++) {
    const line = lines[i];
    if (
      !line.includes("@") &&
      !line.includes("http") &&
      !line.includes("+") &&
      line.length < 50 &&
      /^[A-Za-z\s.'-]+$/.test(line) &&
      !/^(education|experience|skills|projects|achievements|links)/i.test(line)
    ) {
      fullName = line;
      const parts = line.split(/\s+/);
      firstName = parts[0] || null;
      lastName = parts.slice(1).join(" ") || null;
      break;
    }
  }

  // 4. Links extraction
  let linkedinUser: string | null = null;
  let githubUser: string | null = null;
  let codeforcesUser: string | null = null;
  let codechefUser: string | null = null;
  let leetcodeUser: string | null = null;

  lines.forEach((line) => {
    const liMatch = line.match(/linkedin[:\s/]+([a-zA-Z0-9_-]+)/i);
    if (liMatch && !linkedinUser) linkedinUser = liMatch[1];

    const ghMatch = line.match(/github[:\s/]+([a-zA-Z0-9_-]+)/i);
    if (ghMatch && !githubUser) githubUser = ghMatch[1];

    const cfMatch = line.match(/codeforces[:\s/]+([a-zA-Z0-9_-]+)/i);
    if (cfMatch && !codeforcesUser) codeforcesUser = cfMatch[1];

    const ccMatch = line.match(/codechef[:\s/]+([a-zA-Z0-9_-]+)/i);
    if (ccMatch && !codechefUser) codechefUser = ccMatch[1];

    const lcMatch = line.match(/leetcode[:\s/]+([a-zA-Z0-9_-]+)/i);
    if (lcMatch && !leetcodeUser) leetcodeUser = lcMatch[1];
  });

  return {
    personal: {
      full_name: { value: fullName, confidence: "HIGH", evidence: fullName },
      first_name: { value: firstName, confidence: "HIGH", evidence: fullName },
      last_name: { value: lastName, confidence: "HIGH", evidence: fullName },
      email: { value: email, confidence: "HIGH", evidence: email },
      phone: { value: phone, confidence: "HIGH", evidence: phone },
      location: { value: null, confidence: "LOW", evidence: null },
    },
    education: [],
    experience: [],
    projects: [],
    skills: {
      programming_languages: [],
      frameworks: [],
      databases: [],
      tools: extractSkillsDeterministically(cleanText),
      cloud: [],
      devops: [],
      concepts: [],
      soft_skills: [],
    },
    achievements: [],
    certifications: [],
    links: {
      linkedin: linkedinUser
        ? {
            platform: "linkedin",
            username: linkedinUser,
            url: `https://www.linkedin.com/in/${linkedinUser}`,
            evidence: linkedinUser,
          }
        : null,
      github: githubUser
        ? {
            platform: "github",
            username: githubUser,
            url: `https://github.com/${githubUser}`,
            evidence: githubUser,
          }
        : null,
      portfolio: null,
      codeforces: codeforcesUser
        ? {
            platform: "codeforces",
            username: codeforcesUser,
            url: `https://codeforces.com/profile/${codeforcesUser}`,
            evidence: codeforcesUser,
          }
        : null,
      codechef: codechefUser
        ? {
            platform: "codechef",
            username: codechefUser,
            url: `https://www.codechef.com/users/${codechefUser}`,
            evidence: codechefUser,
          }
        : null,
      leetcode: leetcodeUser
        ? {
            platform: "leetcode",
            username: leetcodeUser,
            url: `https://leetcode.com/u/${leetcodeUser}`,
            evidence: leetcodeUser,
          }
        : null,
    },
  };
}

export interface ParseResumeOptions {
  fileBuffer?: Buffer;
  mimeType?: string;
  isScannedPdf?: boolean;
}

export interface ParserModelConfig {
  geminiPrimary: string;
  geminiFallbacks: string[];
  groqPrimary: string;
  groqFallbacks: string[];
}

import fs from "fs";
import path from "path";

/**
 * Robust environment variable reader that falls back to reading .env.local
 * if the Next.js dev server was started before new keys were added.
 */
export function getEnvVar(key: string, defaultValue = ""): string {
  if (process.env[key]) return process.env[key]!;
  try {
    const envPath = path.resolve(process.cwd(), ".env.local");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const idx = trimmed.indexOf("=");
        if (idx > 0 && trimmed.slice(0, idx).trim() === key) {
          const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
          process.env[key] = val;
          return val;
        }
      }
    }
  } catch {}
  return defaultValue;
}

export function getParserModelConfig(): ParserModelConfig {
  return {
    geminiPrimary: getEnvVar("GEMINI_PRIMARY_MODEL", "gemini-3.5-flash-lite"),
    geminiFallbacks: getEnvVar("GEMINI_FALLBACK_MODELS", "gemini-3.5-flash,gemini-flash-latest,gemini-3.1-flash-lite")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    groqPrimary: getEnvVar("GROQ_PRIMARY_MODEL", "openai/gpt-oss-120b"),
    groqFallbacks: getEnvVar("GROQ_FALLBACK_MODELS", "qwen/qwen3.8-27b,openai/gpt-oss-20b,groq/compound-mini")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

export function isTransientError(error: any): boolean {
  if (!error) return false;
  const status = error.status || error.statusCode || error.code;
  const msg = String(error.message || "").toLowerCase();

  if (status === 429 || status === 503 || status === 500 || status === 502 || status === 504) return true;
  if (
    msg.includes("exhausted") ||
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("too many requests") ||
    msg.includes("temporarily unavailable") ||
    msg.includes("high demand") ||
    msg.includes("timeout") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout")
  ) {
    return true;
  }
  return false;
}

async function callGeminiModelWithRetry(
  ai: GoogleGenAI,
  model: string,
  prompt: string,
  systemInstruction: string
): Promise<any> {
  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          temperature: 0.0,
        },
      });

      let jsonStr = response.text || "";
      jsonStr = jsonStr.replace(/```(?:json)?\n?/g, "").trim();
      return JSON.parse(jsonStr);
    } catch (err: any) {
      if (attempt < maxAttempts && isTransientError(err)) {
        console.warn(`[ResumeParser] Gemini model ${model} transient failure (attempt ${attempt}/${maxAttempts}): ${err.message}. Retrying in 1s...`);
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      throw err;
    }
  }
}

async function callGeminiVisionWithRetry(
  ai: GoogleGenAI,
  model: string,
  fileBuffer: Buffer,
  mimeType: string,
  systemInstruction: string
): Promise<any> {
  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: mimeType || "application/pdf",
              data: fileBuffer.toString("base64"),
            },
          },
          {
            text: STRICT_EXTRACTION_PROMPT_TEMPLATE("[Read all text and structure strictly from the attached document]"),
          },
        ],
      },
    ],
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      temperature: 0.0,
    },
  });

  let jsonStr = response.text || "";
  jsonStr = jsonStr.replace(/```(?:json)?\n?/g, "").trim();
  return JSON.parse(jsonStr);
}

async function callGroqModelWithRetry(
  apiKey: string,
  model: string,
  prompt: string,
  systemInstruction: string
): Promise<any> {
  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.0,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        const err = new Error(errorJson.error?.message || `Groq API returned status ${res.status}`);
        (err as any).status = res.status;
        throw err;
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || "";
      const cleanJson = content.replace(/```(?:json)?\n?/g, "").trim();
      return JSON.parse(cleanJson);
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (attempt < maxAttempts && isTransientError(err)) {
        console.warn(`[ResumeParser] Groq model ${model} transient failure (attempt ${attempt}/${maxAttempts}): ${err.message}. Retrying in 1s...`);
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Main parser entry point.
 * Uses a resilient multi-model AI fallback architecture:
 * Gemini Primary -> Gemini Fallbacks -> Groq Primary -> Groq Fallbacks.
 * Preserves 100% source-bounded grounding.
 */
export async function parseResumeStrict(
  rawText: string,
  options?: ParseResumeOptions
): Promise<StrictResumeExtraction> {
  const t0 = Date.now();
  const config = getParserModelConfig();
  const geminiKey = getEnvVar("GEMINI_API_KEY");
  const groqKey = getEnvVar("GROQ_API_KEY");

  let attemptCount = 0;
  const attemptedModels = new Set<string>();

  // 1. Multimodal OCR/Vision fallback for scanned/image PDFs
  if (options?.isScannedPdf && options?.fileBuffer && geminiKey) {
    console.log("[ResumeParser] Detected scanned/image PDF, attempting Gemini Vision extraction...");
    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const visionModels = [config.geminiPrimary, ...config.geminiFallbacks].filter((m) => !attemptedModels.has(m));

      for (const model of visionModels) {
        attemptedModels.add(model);
        attemptCount++;
        try {
          console.log(`[ResumeParser] Attempt ${attemptCount}: Gemini Vision using ${model}`);
          const parsed = await callGeminiVisionWithRetry(
            ai,
            model,
            options.fileBuffer,
            options.mimeType || "application/pdf",
            STRICT_EXTRACTION_SYSTEM_INSTRUCTION
          );

          if (parsed && parsed.personal) {
            console.log(`[ResumeParser] Gemini Vision success with ${model} in ${Date.now() - t0}ms`);
            const normalized = normalizeExtractedJson(parsed, rawText);
            normalized.meta = {
              provider: "gemini",
              model: `${model}-vision`,
              durationMs: Date.now() - t0,
              attempts: attemptCount,
            };
            return normalized;
          }
        } catch (visionErr: any) {
          console.warn(`[ResumeParser] Gemini Vision model ${model} failed: ${visionErr.message}`);
        }
      }
    } catch (err: any) {
      console.warn(`[ResumeParser] Gemini Vision initialisation error: ${err.message}`);
    }
  }

  const prompt = STRICT_EXTRACTION_PROMPT_TEMPLATE(rawText);

  // 2. Gemini Multi-Model Fallback Chain
  if (geminiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const geminiChain = [config.geminiPrimary, ...config.geminiFallbacks];

      for (const model of geminiChain) {
        if (attemptedModels.has(model)) continue;
        attemptedModels.add(model);
        attemptCount++;

        try {
          console.log(`[ResumeParser] Attempt ${attemptCount}: Gemini using ${model}`);
          const parsed = await callGeminiModelWithRetry(
            ai,
            model,
            prompt,
            STRICT_EXTRACTION_SYSTEM_INSTRUCTION
          );

          if (parsed && parsed.personal) {
            console.log(`[ResumeParser] Gemini extraction succeeded with ${model} in ${Date.now() - t0}ms`);
            const normalized = normalizeExtractedJson(parsed, rawText);
            normalized.meta = {
              provider: "gemini",
              model,
              durationMs: Date.now() - t0,
              attempts: attemptCount,
            };
            return normalized;
          }
        } catch (modelErr: any) {
          console.warn(`[ResumeParser] Gemini model ${model} failed: ${modelErr.message}`);
        }
      }
    } catch (err: any) {
      console.warn(`[ResumeParser] Gemini client error: ${err.message}`);
    }
  }

  // 3. Groq Multi-Model Fallback Chain
  if (groqKey) {
    console.log("[ResumeParser] Gemini models exhausted/unavailable. Switching to Groq fallback...");
    const groqChain = [config.groqPrimary, ...config.groqFallbacks];

    for (const model of groqChain) {
      if (attemptedModels.has(model)) continue;
      attemptedModels.add(model);
      attemptCount++;

      try {
        console.log(`[ResumeParser] Attempt ${attemptCount}: Groq using ${model}`);
        const parsed = await callGroqModelWithRetry(
          groqKey,
          model,
          prompt,
          STRICT_EXTRACTION_SYSTEM_INSTRUCTION
        );

        if (parsed && parsed.personal) {
          console.log(`[ResumeParser] Groq extraction succeeded with ${model} in ${Date.now() - t0}ms`);
          const normalized = normalizeExtractedJson(parsed, rawText);
          normalized.meta = {
            provider: "groq",
            model,
            durationMs: Date.now() - t0,
            attempts: attemptCount,
          };
          return normalized;
        }
      } catch (groqErr: any) {
        console.warn(`[ResumeParser] Groq model ${model} failed: ${groqErr.message}`);
      }
    }
  } else {
    console.warn("[ResumeParser] GROQ_API_KEY is not configured; skipping Groq fallback.");
  }

  // 4. Fallback to strict heuristic parser if all AI models fail
  console.warn(`[ResumeParser] All AI providers exhausted after ${attemptCount} attempts. Falling back to strict heuristic parser.`);
  const fallbackResult = strictHeuristicFallback(rawText);
  fallbackResult.meta = {
    provider: "heuristic",
    model: "regex",
    durationMs: Date.now() - t0,
    attempts: attemptCount,
  };
  return fallbackResult;
}
