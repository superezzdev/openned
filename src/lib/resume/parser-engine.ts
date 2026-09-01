import { GoogleGenAI } from "@google/genai";
import {
  StrictResumeExtraction,
  StrictLink,
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
 * Normalizes raw LLM output into validated StrictResumeExtraction structure,
 * applying deterministic link resolution.
 */
export function normalizeExtractedJson(parsed: any): StrictResumeExtraction {
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

  const defaultField = (f: any) => ({
    value: f?.value ?? null,
    confidence: (f?.confidence as any) || "HIGH",
    evidence: f?.evidence ?? null,
    source_section: f?.source_section,
  });

  return {
    personal: {
      full_name: defaultField(parsed?.personal?.full_name),
      first_name: defaultField(parsed?.personal?.first_name),
      last_name: defaultField(parsed?.personal?.last_name),
      email: defaultField(parsed?.personal?.email),
      phone: defaultField(parsed?.personal?.phone),
      location: defaultField(parsed?.personal?.location),
    },
    education: Array.isArray(parsed?.education)
      ? parsed.education.map((edu: any) => ({
          institution: defaultField(edu.institution),
          degree: defaultField(edu.degree),
          field_of_study: defaultField(edu.field_of_study),
          start_date: defaultField(edu.start_date),
          end_date: defaultField(edu.end_date),
          grade: defaultField(edu.grade),
        }))
      : [],
    experience: Array.isArray(parsed?.experience)
      ? parsed.experience.map((exp: any) => ({
          company: defaultField(exp.company),
          title: defaultField(exp.title),
          employment_type: defaultField(exp.employment_type),
          location: defaultField(exp.location),
          start_date: defaultField(exp.start_date),
          end_date: defaultField(exp.end_date),
          description: defaultField(exp.description),
          achievements: Array.isArray(exp.achievements)
            ? exp.achievements.map((ach: any) => ({
                value: String(ach?.value || ""),
                evidence: String(ach?.evidence || ""),
              }))
            : [],
        }))
      : [],
    projects: Array.isArray(parsed?.projects)
      ? parsed.projects.map((proj: any) => ({
          name: defaultField(proj.name),
          technologies: Array.isArray(proj.technologies)
            ? proj.technologies.map((t: any) => ({
                value: String(t?.value || ""),
                evidence: String(t?.evidence || ""),
              }))
            : [],
          description: defaultField(proj.description),
          start_date: defaultField(proj.start_date),
          end_date: defaultField(proj.end_date),
          links: Array.isArray(proj.links)
            ? proj.links.map((l: any) => ({
                value: String(l?.value || ""),
                evidence: String(l?.evidence || ""),
              }))
            : [],
        }))
      : [],
    skills: {
      programming_languages: Array.isArray(parsed?.skills?.programming_languages)
        ? parsed.skills.programming_languages.map(defaultField)
        : [],
      frameworks: Array.isArray(parsed?.skills?.frameworks)
        ? parsed.skills.frameworks.map(defaultField)
        : [],
      databases: Array.isArray(parsed?.skills?.databases)
        ? parsed.skills.databases.map(defaultField)
        : [],
      tools: Array.isArray(parsed?.skills?.tools)
        ? parsed.skills.tools.map(defaultField)
        : [],
      cloud: Array.isArray(parsed?.skills?.cloud)
        ? parsed.skills.cloud.map(defaultField)
        : [],
      devops: Array.isArray(parsed?.skills?.devops)
        ? parsed.skills.devops.map(defaultField)
        : [],
      concepts: Array.isArray(parsed?.skills?.concepts)
        ? parsed.skills.concepts.map(defaultField)
        : [],
      soft_skills: Array.isArray(parsed?.skills?.soft_skills)
        ? parsed.skills.soft_skills.map(defaultField)
        : [],
    },
    achievements: Array.isArray(parsed?.achievements)
      ? parsed.achievements.map((ach: any) => ({
          value: String(ach?.value || ""),
          confidence: ach?.confidence || "HIGH",
          evidence: String(ach?.evidence || ""),
        }))
      : [],
    certifications: Array.isArray(parsed?.certifications)
      ? parsed.certifications.map((cert: any) => ({
          certification_name: String(cert?.certification_name || ""),
          issuer: cert?.issuer || null,
          confidence: cert?.confidence || "HIGH",
          evidence: String(cert?.evidence || ""),
        }))
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
      tools: [],
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
            url: `https://codechef.com/users/${codechefUser}`,
            evidence: codechefUser,
          }
        : null,
      leetcode: leetcodeUser
        ? {
            platform: "leetcode",
            username: leetcodeUser,
            url: `https://leetcode.com/${leetcodeUser}`,
            evidence: leetcodeUser,
          }
        : null,
    },
  };
}

/**
 * Main parser entry point.
 * Uses Gemini 3.6 Flash with strict negative instructions and schema enforcement.
 * Falls back to strict regex parser on API failure.
 */
export async function parseResumeStrict(rawText: string): Promise<StrictResumeExtraction> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = STRICT_EXTRACTION_PROMPT_TEMPLATE(rawText);

      const candidateModels = [
        "gemini-3.6-flash",
        "gemini-3.1-pro-preview",
        "gemini-2.5-flash",
      ];

      for (const model of candidateModels) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              systemInstruction: STRICT_EXTRACTION_SYSTEM_INSTRUCTION,
              responseMimeType: "application/json",
              temperature: 0.0,
            },
          });

          let jsonStr = response.text || "";
          jsonStr = jsonStr.replace(/```(?:json)?\n?/g, "").trim();

          const parsed = JSON.parse(jsonStr);
          if (parsed && parsed.personal) {
            return normalizeExtractedJson(parsed);
          }
        } catch (modelErr) {
          console.warn(`Model ${model} extraction failed:`, modelErr);
        }
      }
    } catch (err) {
      console.warn("AI generation failed, falling back to strict heuristic parser:", err);
    }
  }

  return strictHeuristicFallback(rawText);
}
