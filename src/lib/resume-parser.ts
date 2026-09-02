import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { parseResumeStrict, strictHeuristicFallback } from "./resume/parser-engine";
import { ResumeProfileValidator } from "./resume/validator";
import { StrictResumeExtraction, EvidenceField } from "./resume/types";

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
  strict?: StrictResumeExtraction;
}

/**
 * Checks if text appears to be unreadable binary data or PDF binary streams.
 */
export function isBinaryOrUnreadableText(text: string): boolean {
  if (!text) return true;
  if (text.startsWith("%PDF-")) return true;
  const nonPrintableCount = (text.match(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\uFFFD]/g) || []).length;
  return nonPrintableCount / text.length > 0.05;
}

/**
 * Checks if extracted text indicates a scanned/image-only document or unreadable binary stream.
 */
export function isLikelyScannedDocument(text: string, mimeType: string, fileName: string): boolean {
  const isPdf = mimeType.includes("pdf") || fileName.toLowerCase().endsWith(".pdf");
  if (!isPdf) return false;
  if (!text || isBinaryOrUnreadableText(text)) return true;
  return text.trim().length < 150;
}

/**
 * Normalizes Unicode bullets, control characters, and line endings.
 */
export function cleanExtractedResumeText(raw: string): string {
  if (!raw) return "";
  return raw
    .replace(/[\u2022\u2023\u25E6\u2043\u2219\u25CB\u25CF\u25AA\u25AB\u0107]/g, " • ")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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
      try {
        const path = await import("path");
        const fs = await import("fs");
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const candidatePaths = [
          path.resolve(process.cwd(), "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"),
          path.resolve(process.cwd(), "node_modules/pdf-parse/dist/worker/pdf.worker.mjs"),
        ];
        for (const p of candidatePaths) {
          if (fs.existsSync(/*turbopackIgnore: true*/ p)) {
            pdfjs.GlobalWorkerOptions.workerSrc = p;
            break;
          }
        }
      } catch {}

      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      let text = cleanExtractedResumeText(result.text || "");

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

      if (isBinaryOrUnreadableText(text)) {
        console.warn("Extracted PDF text is binary/unreadable; delegating to multimodal vision.");
        return "";
      }

      return text;
    } catch (err) {
      console.warn("Failed to parse PDF with PDFParse, delegating to multimodal vision:", err);
      // Return empty string to reliably trigger multimodal vision fallback for scanned/complex PDFs
      return "";
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
      return cleanExtractedResumeText(result.value || "");
    } catch (err) {
      console.warn("Failed to parse DOCX using mammoth:", err);
      return cleanExtractedResumeText(buffer.toString("utf-8"));
    }
  }

  // Plain text / markdown
  return cleanExtractedResumeText(buffer.toString("utf-8"));
}

/**
 * Converts StrictResumeExtraction to the legacy ParsedResumeData format
 * while ensuring ZERO hallucination and strict authentication separation.
 * Email is derived ONLY from the resume, NEVER from auth accounts.
 */
export function convertStrictToLegacy(
  strict: StrictResumeExtraction,
  _ignoredFallbackEmail?: string
): ParsedResumeData {
  // Collect all valid skills
  const skillsSet = new Set<string>();
  Object.values(strict.skills).forEach((group: Array<EvidenceField<string>>) => {
    group.forEach((s: EvidenceField<string>) => {
      if (s.value && s.value.trim().length > 0) {
        skillsSet.add(s.value.trim());
      }
    });
  });

  // Convert experiences
  const experiences: ParsedExperience[] = strict.experience
    .filter((exp) => exp.company.value || exp.title.value)
    .map((exp) => {
      const duration = [exp.start_date.value, exp.end_date.value].filter(Boolean).join(" - ");
      const responsibilities = exp.achievements.map((a) => a.value).join("\n• ") || exp.description.value || "";
      return {
        company_name: exp.company.value || "",
        job_title: exp.title.value || "",
        duration,
        responsibilities: responsibilities ? (responsibilities.startsWith("•") ? responsibilities : `• ${responsibilities}`) : "",
      };
    });

  // Convert educations
  const educations: ParsedEducation[] = strict.education
    .filter((edu) => edu.institution.value || edu.degree.value)
    .map((edu) => {
      const duration = [edu.start_date.value, edu.end_date.value].filter(Boolean).join(" - ");
      let fieldOfStudy = edu.field_of_study.value || "";
      if (edu.grade.value) {
        fieldOfStudy += fieldOfStudy ? ` (CGPA / Grade: ${edu.grade.value})` : `Grade: ${edu.grade.value}`;
      }
      return {
        institution: edu.institution.value || "",
        degree: edu.degree.value || "",
        field_of_study: fieldOfStudy,
        duration,
      };
    });

  // Convert projects
  const projects: ParsedProject[] = strict.projects
    .filter((proj) => proj.name.value)
    .map((proj) => {
      const techStr = proj.technologies.map((t) => t.value).filter(Boolean).join(", ");
      let desc = proj.description.value || "";
      if (techStr) {
        desc = `[Technologies: ${techStr}]\n${desc}`.trim();
      }
      return {
        project_name: proj.name.value || "",
        description: desc,
        link: proj.links[0]?.value || "",
      };
    });

  // Convert certifications
  const certifications: ParsedCertification[] = strict.certifications.map((cert) => ({
    certification_name: cert.certification_name,
    issuer: cert.issuer || "",
  }));

  // Convert links
  const links: ParsedLink[] = [];
  if (strict.links.linkedin?.url) links.push({ url_type: "LinkedIn", url: strict.links.linkedin.url });
  if (strict.links.github?.url) links.push({ url_type: "GitHub", url: strict.links.github.url });
  if (strict.links.leetcode?.url) links.push({ url_type: "LeetCode", url: strict.links.leetcode.url });
  if (strict.links.codeforces?.url) links.push({ url_type: "CodeForces", url: strict.links.codeforces.url });
  if (strict.links.codechef?.url) links.push({ url_type: "CodeChef", url: strict.links.codechef.url });
  if (strict.links.portfolio?.url) links.push({ url_type: "Portfolio", url: strict.links.portfolio.url });

  return {
    profile: {
      first_name: strict.personal.first_name.value || "",
      last_name: strict.personal.last_name.value || "",
      email: strict.personal.email.value || "", // STRICT: Never default to auth email
      phone: strict.personal.phone.value || "",
      location: strict.personal.location.value || "",
      summary: "", // Do not generate a fake summary
    },
    skills: Array.from(skillsSet),
    experiences,
    educations,
    projects,
    certifications,
    links,
    strict,
  };
}

/**
 * Heuristic fallback parser without ANY fake or hardcoded mock defaults.
 */
export function heuristicResumeParser(
  rawText: string
): ParsedResumeData {
  const strict = strictHeuristicFallback(rawText);
  return convertStrictToLegacy(strict);
}

/**
 * Main parser entry point: Runs strict zero-hallucination multi-model extraction
 * validated by ResumeProfileValidator.
 */
export async function parseResumeText(
  rawText: string,
  options?: { fileBuffer?: Buffer; mimeType?: string; isScannedPdf?: boolean }
): Promise<ParsedResumeData> {
  const strict = await parseResumeStrict(rawText, options);
  const validation = ResumeProfileValidator.validate(rawText, strict);
  return convertStrictToLegacy(validation.verifiedData);
}
