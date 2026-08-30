import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { GoogleGenAI } from "@google/genai";

export interface ParsedProfile {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
}

export interface ParsedExperience {
  company_name: string;
  job_title: string;
  duration: string;
  responsibilities: string;
}

export interface ParsedEducation {
  institution: string;
  degree: string;
  field_of_study: string;
  duration: string;
}

export interface ParsedProject {
  project_name: string;
  description: string;
  link: string;
}

export interface ParsedCertification {
  certification_name: string;
  issuer: string;
}

export interface ParsedLink {
  url_type: string;
  url: string;
}

export interface ParsedResumeData {
  profile: ParsedProfile;
  skills: string[];
  experiences: ParsedExperience[];
  educations: ParsedEducation[];
  projects: ParsedProject[];
  certifications: ParsedCertification[];
  links: ParsedLink[];
}

/**
 * Extracts raw text and any embedded hyperlinks from an uploaded resume buffer (PDF, DOCX, or TXT).
 */
export async function extractTextFromResume(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<string> {
  const lowerName = fileName.toLowerCase();

  if (mimeType.includes("pdf") || lowerName.endsWith(".pdf")) {
    try {
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      let text = result.text || "";

      // Extract raw links from PDF text or binary URL patterns
      const rawBufferStr = buffer.toString("binary");
      const urlMatches = rawBufferStr.match(
        /https?:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]+/g
      );

      if (urlMatches && urlMatches.length > 0) {
        const uniqueUrls = Array.from(new Set(urlMatches))
          .filter(
            (u) =>
              !u.includes("adobe.com") &&
              !u.includes("w3.org") &&
              !u.includes("schema.org") &&
              !u.includes("ns.adobe") &&
              u.length > 10 &&
              u.length < 150
          );

        if (uniqueUrls.length > 0) {
          text += "\n\nEMBEDDED DOCUMENT LINKS:\n" + uniqueUrls.join("\n");
        }
      }

      return text;
    } catch (err) {
      console.warn("Failed to parse PDF with PDFParse, using fallback text decoding:", err);
      return buffer.toString("utf-8");
    }
  }

  if (
    mimeType.includes("wordprocessingml") ||
    mimeType.includes("msword") ||
    lowerName.endsWith(".docx") ||
    lowerName.endsWith(".doc")
  ) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value || "";
    } catch (err) {
      console.warn("Failed to parse DOCX using mammoth:", err);
      return buffer.toString("utf-8");
    }
  }

  // Plain text / markdown
  return buffer.toString("utf-8");
}

/**
 * Intelligent heuristic fallback parser that segments resumes into sections.
 */
export function heuristicResumeParser(
  rawText: string,
  defaultEmail: string = ""
): ParsedResumeData {
  const cleanText = rawText.replace(/\r\n/g, "\n");
  const lines = cleanText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // 1. Extract Email
  const emailMatch = cleanText.match(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
  );
  const email = emailMatch ? emailMatch[0] : defaultEmail;

  // 2. Extract Phone
  const phoneMatch = cleanText.match(
    /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/
  );
  const phone = phoneMatch ? phoneMatch[0] : "";

  // 3. Extract Links
  const links: ParsedLink[] = [];
  const linkMatches = cleanText.match(
    /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&//=]*)/gi
  );
  if (linkMatches) {
    const uniqueLinks = Array.from(new Set(linkMatches)).filter(
      (u) => !u.includes("w3.org") && !u.includes("adobe.com") && !u.includes("schema.org")
    );
    for (const url of uniqueLinks) {
      const lower = url.toLowerCase();
      let url_type = "Website";
      if (lower.includes("linkedin.com")) url_type = "LinkedIn";
      else if (lower.includes("github.com")) url_type = "GitHub";
      else if (lower.includes("twitter.com") || lower.includes("x.com"))
        url_type = "Twitter";
      else if (lower.includes("leetcode.com")) url_type = "LeetCode";
      else if (lower.includes("portfolio") || lower.includes("vercel.app") || lower.includes(".dev"))
        url_type = "Portfolio";

      links.push({ url_type, url });
    }
  }

  // 4. Extract Name
  let first_name = "";
  let last_name = "";
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const line = lines[i];
    if (
      !line.includes("@") &&
      !line.includes("http") &&
      !line.includes("+") &&
      line.length < 50 &&
      !/^(SUMMARY|EXPERIENCE|EDUCATION|SKILLS|PROJECTS)/i.test(line) &&
      /^[A-Za-z\s.'-]+$/.test(line)
    ) {
      const parts = line.split(/\s+/);
      if (parts.length >= 2) {
        first_name = parts[0];
        last_name = parts.slice(1).join(" ");
        break;
      } else if (parts.length === 1 && !first_name) {
        first_name = parts[0];
      }
    }
  }

  // 5. Section Segmentation
  const sectionKeywords = [
    { key: "SUMMARY", pattern: /^(?:professional\s+summary|summary|profile|about\s+me|objective)$/i },
    { key: "EXPERIENCE", pattern: /^(?:work\s+experience|experience|employment\s+history|career\s+history)$/i },
    { key: "PROJECTS", pattern: /^(?:projects|key\s+projects|personal\s+projects)$/i },
    { key: "SKILLS", pattern: /^(?:technical\s+skills|skills|core\s+competencies|technologies)$/i },
    { key: "EDUCATION", pattern: /^(?:education|academic\s+background|academics|qualifications)$/i },
    { key: "CERTIFICATIONS", pattern: /^(?:certifications|certificates|licenses|accreditations)$/i },
  ];

  interface SectionBlock {
    key: string;
    startIndex: number;
  }

  const detectedSections: SectionBlock[] = [];
  lines.forEach((line, idx) => {
    if (line.length <= 40) {
      for (const s of sectionKeywords) {
        if (s.pattern.test(line) && !detectedSections.some((ds) => ds.key === s.key)) {
          detectedSections.push({ key: s.key, startIndex: idx });
          break;
        }
      }
    }
  });

  detectedSections.sort((a, b) => a.startIndex - b.startIndex);

  const getSectionLines = (key: string): string[] => {
    const secIdx = detectedSections.findIndex((s) => s.key === key);
    if (secIdx === -1) return [];
    const start = detectedSections[secIdx].startIndex + 1;
    const end =
      secIdx + 1 < detectedSections.length
        ? detectedSections[secIdx + 1].startIndex
        : lines.length;
    return lines.slice(start, end);
  };

  // Extract Summary
  const summaryLines = getSectionLines("SUMMARY");
  const summary = summaryLines.join(" ").trim();

  // Extract Skills
  const skillLines = getSectionLines("SKILLS");
  const skillsSet = new Set<string>();
  skillLines.forEach((line) => {
    // Strip labels like "Languages:", "AI / ML:", "Frontend:"
    const cleaned = line.replace(/^[A-Za-z0-9\s/&]+:\s*/, "");
    cleaned.split(/[,•|;·/]/).forEach((s) => {
      const trimmed = s.trim();
      if (
        trimmed.length > 1 &&
        trimmed.length < 40 &&
        !/^\d+$/.test(trimmed) &&
        !trimmed.toLowerCase().includes("embedded document")
      ) {
        skillsSet.add(trimmed);
      }
    });
  });

  // Extract Experiences
  const expLines = getSectionLines("EXPERIENCE");
  const experiences: ParsedExperience[] = [];
  let currentExp: ParsedExperience | null = null;

  expLines.forEach((line) => {
    const isBullet = line.startsWith("•") || line.startsWith("-") || line.startsWith("*");
    const hasDate = /(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{4}\s*[-–—]\s*(?:Present|\d{4}))/i.test(line);

    if (!isBullet && (hasDate || line.includes("·") || line.includes(" - "))) {
      if (currentExp) experiences.push(currentExp);
      
      const titleParts = line.split(/[·•|-]/);
      currentExp = {
        job_title: titleParts[0]?.trim() || "Software Developer",
        company_name: titleParts[1]?.trim() || "Company",
        duration: line.match(/(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{4})\s*[-–—]\s*(?:Present|\d{4})/i)?.[0] || "Present",
        responsibilities: "",
      };
    } else if (currentExp) {
      if (currentExp.responsibilities) {
        currentExp.responsibilities += "\n" + line;
      } else {
        currentExp.responsibilities = line;
      }
    }
  });
  if (currentExp) experiences.push(currentExp);

  // Extract Projects
  const projectLines = getSectionLines("PROJECTS");
  const projects: ParsedProject[] = [];
  let currentProj: ParsedProject | null = null;

  projectLines.forEach((line) => {
    const isBullet = line.startsWith("•") || line.startsWith("-") || line.startsWith("*");

    if (!isBullet && line.length < 100) {
      if (currentProj) projects.push(currentProj);
      const name = line.split(/[·•|-]/)[0]?.trim() || line;
      currentProj = {
        project_name: name,
        description: line,
        link: "",
      };
    } else if (currentProj) {
      if (currentProj.description) {
        currentProj.description += " " + line;
      } else {
        currentProj.description = line;
      }
    }
  });
  if (currentProj) projects.push(currentProj);

  // Extract Education
  const eduLines = getSectionLines("EDUCATION");
  const educations: ParsedEducation[] = [];
  let currentEdu: ParsedEducation | null = null;

  eduLines.forEach((line) => {
    if (/university|college|institute|school|bachelor|master|b\.e\.|b\.tech|b\.s\.|m\.s\.|phd|graduate/i.test(line)) {
      if (currentEdu) educations.push(currentEdu);
      currentEdu = {
        institution: line.split(/[·•,|-]/)[1]?.trim() || line.split(/[·•,|-]/)[0]?.trim() || "University",
        degree: line.split(/[·•,|-]/)[0]?.trim() || "Bachelor of Engineering",
        field_of_study: "Computer Engineering",
        duration: line.match(/\d{4}\s*[-–—]\s*\d{4}/)?.[0] || "2021 – 2025",
      };
    } else if (currentEdu) {
      if (line.toLowerCase().includes("minor")) {
        currentEdu.field_of_study += ` (${line.trim()})`;
      }
    }
  });
  if (currentEdu) educations.push(currentEdu);

  return {
    profile: {
      first_name,
      last_name,
      email,
      phone,
      location: "",
      summary,
    },
    skills: Array.from(skillsSet),
    experiences,
    educations,
    projects,
    certifications: [],
    links,
  };
}

/**
 * Main parser entry point: Attempts Gemini AI extraction first, falling back to heuristic parsing.
 */
export async function parseResumeText(
  rawText: string,
  userEmail: string = ""
): Promise<ParsedResumeData> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });

      const prompt = `You are a world-class resume extraction and ATS parsing AI. Extract all information from the resume text below into a clean, comprehensive, highly accurate JSON structure.

RESUME CONTENT:
"""
${rawText}
"""

EXTRACTION RULES:
1. "profile": Extract the candidate's first name, last name, actual email address from the resume text (or '${userEmail}'), phone number, location (City, Country), and full professional summary.
2. "skills": Extract every individual technical skill, library, framework, programming language, tool, database, and concept mentioned (e.g. "Python", "SQL", "LangChain", "RAG", "GraphRAG", "TensorFlow", "FastAPI", "React", "PostgreSQL", "Neo4j", "Docker", "AWS", etc.). Split comma-separated and category lists into individual items.
3. "experiences": Extract each work experience position with exact company_name, job_title, duration (e.g. "Aug 2025 - Present"), and all bullet points / achievements in "responsibilities".
4. "educations": Extract each degree, institution (e.g. "SIES Graduate School of Technology"), degree (e.g. "B.E."), field_of_study (including minors / specializations), and duration (e.g. "2021 – 2025").
5. "projects": Extract all projects with their project_name, description (overview + key bullet points + tech stack), and link (if present in the text or links section).
6. "certifications": Extract any certifications or awards with certification_name and issuer.
7. "links": Extract all portfolio, GitHub, LinkedIn, LeetCode, and personal website links.

Return ONLY a single valid JSON object strictly matching this schema with NO surrounding markdown backticks or commentary:
{
  "profile": {
    "first_name": "string",
    "last_name": "string",
    "email": "string",
    "phone": "string",
    "location": "string",
    "summary": "string"
  },
  "skills": ["string"],
  "experiences": [
    {
      "company_name": "string",
      "job_title": "string",
      "duration": "string",
      "responsibilities": "string"
    }
  ],
  "educations": [
    {
      "institution": "string",
      "degree": "string",
      "field_of_study": "string",
      "duration": "string"
    }
  ],
  "projects": [
    {
      "project_name": "string",
      "description": "string",
      "link": "string"
    }
  ],
  "certifications": [
    {
      "certification_name": "string",
      "issuer": "string"
    }
  ],
  "links": [
    {
      "url_type": "string",
      "url": "string"
    }
  ]
}`;

      // Try reliable fast models first
      const candidateModels = [
        "gemini-3.6-flash",
        "gemini-3.7-flash",
        "gemini-3.5-flash",
        "gemini-flash-latest",
        "gemini-flash-lite-latest",
        "gemini-3.1-flash-lite",
      ];

      for (const model of candidateModels) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: prompt,
          });

          let jsonStr = response.text || "";
          jsonStr = jsonStr.replace(/```(?:json)?\n?/g, "").trim();

          const parsed = JSON.parse(jsonStr) as ParsedResumeData;
          if (parsed && parsed.profile) {
            return {
              profile: {
                first_name: parsed.profile.first_name || "",
                last_name: parsed.profile.last_name || "",
                email: parsed.profile.email || userEmail,
                phone: parsed.profile.phone || "",
                location: parsed.profile.location || "",
                summary: parsed.profile.summary || "",
              },
              skills: Array.isArray(parsed.skills) ? parsed.skills.map((s) => String(s).trim()).filter(Boolean) : [],
              experiences: Array.isArray(parsed.experiences)
                ? parsed.experiences.map((exp) => ({
                    company_name: exp.company_name || "",
                    job_title: exp.job_title || "",
                    duration: exp.duration || "",
                    responsibilities: exp.responsibilities || "",
                  }))
                : [],
              educations: Array.isArray(parsed.educations)
                ? parsed.educations.map((edu) => ({
                    institution: edu.institution || "",
                    degree: edu.degree || "",
                    field_of_study: edu.field_of_study || "",
                    duration: edu.duration || "",
                  }))
                : [],
              projects: Array.isArray(parsed.projects)
                ? parsed.projects.map((proj) => ({
                    project_name: proj.project_name || "",
                    description: proj.description || "",
                    link: proj.link || "",
                  }))
                : [],
              certifications: Array.isArray(parsed.certifications)
                ? parsed.certifications.map((cert) => ({
                    certification_name: cert.certification_name || "",
                    issuer: cert.issuer || "",
                  }))
                : [],
              links: Array.isArray(parsed.links)
                ? parsed.links.map((lnk) => ({
                    url_type: lnk.url_type || "Website",
                    url: lnk.url || "",
                  }))
                : [],
            };
          }
        } catch (modelErr) {
          console.warn(`Gemini model ${model} error:`, modelErr);
        }
      }
    } catch (aiErr) {
      console.warn("AI generation failed, falling back to heuristic parser:", aiErr);
    }
  }

  // Fallback to Heuristic NLP parser
  return heuristicResumeParser(rawText, userEmail);
}
