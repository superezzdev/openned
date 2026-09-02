import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// Load .env.local for live integration tests
const envLocalPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx > 0) {
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^['\"]|['\"]$/g, "");
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

import {
  parseResumeStrict,
  normalizeExtractedJson,
  isTransientError,
  getParserModelConfig,
} from "../../src/lib/resume/parser-engine";
import { ResumeProfileValidator } from "../../src/lib/resume/validator";
import { convertStrictToLegacy, isLikelyScannedDocument, cleanExtractedResumeText } from "../../src/lib/resume-parser";
import { StrictResumeExtraction } from "../../src/lib/resume/types";

describe("Multi-Model AI Fallback & Router", () => {
  it("loads configured primary and fallback models from environment or defaults", () => {
    const config = getParserModelConfig();
    expect(config.geminiPrimary).toBeTruthy();
    expect(config.geminiFallbacks.length).toBeGreaterThan(0);
    expect(config.groqPrimary).toBeTruthy();
    expect(config.groqFallbacks.length).toBeGreaterThan(0);
  });

  it("accurately classifies transient errors for retry/fallback", () => {
    expect(isTransientError({ status: 429 })).toBe(true);
    expect(isTransientError({ status: 503 })).toBe(true);
    expect(isTransientError({ message: "Resource has been exhausted (e.g. check quota)." })).toBe(true);
    expect(isTransientError({ message: "This model is currently experiencing high demand." })).toBe(true);
    expect(isTransientError({ message: "connect ETIMEDOUT" })).toBe(true);

    // Permanent errors should NOT be treated as transient
    expect(isTransientError({ status: 400, message: "Invalid JSON schema" })).toBe(false);
    expect(isTransientError({ status: 401, message: "Invalid API key" })).toBe(false);
  });

  it("semantically normalizes various AI response shapes (flat arrays, string skills, alternative keys)", () => {
    const diverseAiOutput = {
      name: "Jane Smith",
      contact: {
        email: "jane.smith@example.com",
        phone: "+1 555-0199",
      },
      work_experience: [
        {
          employer: "Stripe",
          role: "Staff Software Engineer",
          start_date: "2022",
          end_date: "Present",
          responsibilities: [
            "Built distributed payment orchestration pipeline",
            "Improved 99.999% SLA availability",
          ],
        },
      ],
      academic_background: {
        school: "MIT",
        degree: "B.S. in Computer Science",
        end_date: "2021",
      },
      technical_skills: {
        backend: ["Go", "Node.js", "PostgreSQL"],
        devops_tools: ["Kubernetes", "Terraform", "Docker"],
      },
      projects: [
        {
          title: "High-Throughput Queue",
          technologies: ["Go", "Redis"],
          description: ["Engineered low latency message queue with Raft consensus"],
          url: "https://github.com/janesmith/queue",
        },
      ],
    };

    const normalized = normalizeExtractedJson(diverseAiOutput);

    // Identity
    expect(normalized.personal.full_name.value).toBe("Jane Smith");
    expect(normalized.personal.first_name.value).toBe("Jane");
    expect(normalized.personal.last_name.value).toBe("Smith");
    expect(normalized.personal.email.value).toBe("jane.smith@example.com");
    expect(normalized.personal.phone.value).toBe("+1 555-0199");

    // Experience
    expect(normalized.experience.length).toBe(1);
    expect(normalized.experience[0].company.value).toBe("Stripe");
    expect(normalized.experience[0].title.value).toBe("Staff Software Engineer");
    expect(normalized.experience[0].achievements.length).toBe(2);

    // Education
    expect(normalized.education.length).toBe(1);
    expect(normalized.education[0].institution.value).toBe("MIT");
    expect(normalized.education[0].degree.value).toBe("B.S. in Computer Science");

    // Skills
    const allSkills = [
      ...normalized.skills.programming_languages.map((s) => s.value),
      ...normalized.skills.frameworks.map((s) => s.value),
      ...normalized.skills.databases.map((s) => s.value),
      ...normalized.skills.tools.map((s) => s.value),
      ...normalized.skills.devops.map((s) => s.value),
    ];
    expect(allSkills).toContain("Go");
    expect(allSkills).toContain("PostgreSQL");
    expect(allSkills).toContain("Kubernetes");
    expect(allSkills).toContain("Docker");

    // Projects
    expect(normalized.projects.length).toBe(1);
    expect(normalized.projects[0].name.value).toBe("High-Throughput Queue");
    expect(normalized.projects[0].links[0].value).toBe("https://github.com/janesmith/queue");
  });
});

describe("Deterministic Cleaning & Scanned Document Detection", () => {
  it("cleans Unicode bullets and non-standard symbols", () => {
    const dirty = "• Point 1\n▪ Point 2\n● Point 3\r\n\r\n\r\n· Point 4";
    const cleaned = cleanExtractedResumeText(dirty);
    expect(cleaned).toContain("• Point 1");
    expect(cleaned).toContain("• Point 2");
    expect(cleaned).toContain("• Point 3");
    expect(cleaned).not.toContain("\r");
  });

  it("detects scanned/image-only PDFs with very low text length", () => {
    expect(isLikelyScannedDocument("Short text", "application/pdf", "scanned.pdf")).toBe(true);
    expect(isLikelyScannedDocument("This is a full text resume with hundreds of characters describing experience and education in detail across multiple engineering roles and universities...".repeat(2), "application/pdf", "resume.pdf")).toBe(false);
    expect(isLikelyScannedDocument("", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "resume.docx")).toBe(false);
  });
});

describe("Strict Authentication Separation & Profile Safety", () => {
  it("never injects user auth email into candidate profile if resume has no email", () => {
    const extractionWithoutEmail: StrictResumeExtraction = {
      personal: {
        full_name: { value: "Alex Doe", confidence: "HIGH", evidence: "Alex Doe" },
        first_name: { value: "Alex", confidence: "HIGH", evidence: "Alex Doe" },
        last_name: { value: "Doe", confidence: "HIGH", evidence: "Alex Doe" },
        email: { value: null, confidence: "LOW", evidence: null }, // No email in resume!
        phone: { value: "+1 555-1234", confidence: "HIGH", evidence: "+1 555-1234" },
        location: { value: null, confidence: "LOW", evidence: null },
      },
      education: [],
      experience: [],
      projects: [],
      skills: {
        programming_languages: [{ value: "TypeScript", confidence: "HIGH", evidence: "TypeScript" }],
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
        linkedin: null,
        github: null,
        portfolio: null,
        codeforces: null,
        codechef: null,
        leetcode: null,
      },
    };

    // Even if an auth email "login-account@gmail.com" is passed to convertStrictToLegacy
    const legacy = convertStrictToLegacy(extractionWithoutEmail, "login-account@gmail.com");

    // Profile email MUST remain empty!
    expect(legacy.profile.email).toBe("");
    expect(legacy.profile.email).not.toBe("login-account@gmail.com");
  });

  it("evaluates quality gate on substantial documents with zero core entities", () => {
    const rawText = "A".repeat(500); // Substantial text > 300 characters
    const emptyExtraction: StrictResumeExtraction = {
      personal: {
        full_name: { value: null, confidence: "LOW", evidence: null },
        first_name: { value: null, confidence: "LOW", evidence: null },
        last_name: { value: null, confidence: "LOW", evidence: null },
        email: { value: null, confidence: "LOW", evidence: null },
        phone: { value: null, confidence: "LOW", evidence: null },
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
        linkedin: null,
        github: null,
        portfolio: null,
        codeforces: null,
        codechef: null,
        leetcode: null,
      },
    };

    const validation = ResumeProfileValidator.validate(rawText, emptyExtraction);
    expect(validation.isSufficientQuality).toBe(false);
    expect(validation.warnings.some((w) => w.includes("suspiciously low"))).toBe(true);
  });
});

describe("Live Resume Parsing Integration (Ritik Kumar & Kavya Gupta)", () => {
  it("extracts and validates real candidate resume accurately without hallucinating", async () => {
    // Read Ritik Kumar resume text
    const fs = await import("fs");
    const path = await import("path");
    const ritikPath = path.resolve(__dirname, "../fixtures/ritik_extracted_text.txt");
    if (!fs.existsSync(ritikPath)) return;

    const rawText = fs.readFileSync(ritikPath, "utf8");
    const extraction = await parseResumeStrict(rawText);

    expect(extraction.personal.full_name.value?.toUpperCase()).toBe("RITIK KUMAR");
    expect(extraction.personal.email.value).toBe("ritik.iit21@gmail.com");
    expect(extraction.personal.phone.value).toBe("+91 8968995156");

    // Must have extracted real skills
    const totalSkills = Object.values(extraction.skills).reduce((acc, arr) => acc + arr.length, 0);
    expect(totalSkills).toBeGreaterThan(5);

    // Must have extracted experience
    expect(extraction.experience.length).toBeGreaterThanOrEqual(1);
    const companies = extraction.experience.map((e) => e.company.value);
    expect(companies).toContain("Myorbit.ai");

    // Verify grounding
    const validation = ResumeProfileValidator.validate(rawText, extraction);
    expect(validation.isValid).toBe(true);
    expect(validation.isSufficientQuality).toBe(true);

    // Convert to legacy and verify no auth email injection
    const legacy = convertStrictToLegacy(validation.verifiedData, "some-auth-email@gmail.com");
    expect(legacy.profile.email).toBe("ritik.iit21@gmail.com");
    expect(legacy.profile.email).not.toBe("some-auth-email@gmail.com");
    expect(legacy.skills.length).toBeGreaterThan(5);
    expect(legacy.experiences.length).toBeGreaterThanOrEqual(1);
  }, 45000);

  it("successfully fails over to Groq when Gemini is unavailable", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const ritikPath = path.resolve(__dirname, "../fixtures/ritik_extracted_text.txt");
    if (!fs.existsSync(ritikPath)) return;

    const rawText = fs.readFileSync(ritikPath, "utf8");

    // Set invalid key to simulate Gemini failure and trigger Groq failover
    const origGeminiKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "DISABLED_GEMINI_KEY";

    try {
      const extraction = await parseResumeStrict(rawText);

      expect(extraction.meta?.provider).toBe("groq");
      expect(extraction.personal.full_name.value).toBe("RITIK KUMAR");
      expect(extraction.personal.email.value).toBe("ritik.iit21@gmail.com");

      // Verify Groq extracted skills and experience
      const totalSkills = Object.values(extraction.skills).reduce((acc, arr) => acc + arr.length, 0);
      expect(totalSkills).toBeGreaterThanOrEqual(1);
      expect(extraction.experience.length).toBeGreaterThanOrEqual(1);

      // Validate grounding
      const validation = ResumeProfileValidator.validate(rawText, extraction);
      expect(validation.isValid).toBe(true);
      expect(validation.isSufficientQuality).toBe(true);
    } finally {
      process.env.GEMINI_API_KEY = origGeminiKey;
    }
  }, 45000);
});

