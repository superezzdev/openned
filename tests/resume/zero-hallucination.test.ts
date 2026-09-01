import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  ResumeProfileValidator,
  verifyTextGrounding,
  isValidEmail,
  isPlausiblePhone,
  parseDateToNumber,
} from "../../src/lib/resume/validator";
import { normalizePlatformUrl, strictHeuristicFallback } from "../../src/lib/resume/parser-engine";
import { StrictResumeExtraction } from "../../src/lib/resume/types";

describe("ResumeProfileValidator - Source Grounding & Anti-Hallucination Guard", () => {
  const sampleRawText = `
Kavya Gupta
kavyagupta2719@gmail.com | LinkedIn | 8979617352
EDUCATION
UIETH PANJAB UNIVERSITY
B.E. in Computer Science and Engineering
CGPA - 8.31 | Nov. 2021 - July 2025
SKILLS
LANGUAGES: C, C++, HTML, Javascript, SQL
FRAMEWORKS: ReactJs, NodeJs, ExpressJS, MongoDB, TailwindCSS, Bootstrap
EXPERIENCE
CISCO SYSTEMS | SWE Summer Intern’24
Bangalore, India | June 2024 - July 2024
REWORK.AI | FullStack Developer (MERN)
August 2023 - December 2023
PROJECTS
SPEAKINDIA | Live | MERN Stack
OS LAB SIMULATOR | Live | MERN Stack
LINKS
| LinkedIn: // Kavya2719
| Github: // Kavya2719
| LeetCode: // Kavya2719
`;

  it("verifies grounding when entity or evidence exists in source text", () => {
    expect(verifyTextGrounding(sampleRawText, "CISCO SYSTEMS")).toBe(true);
    expect(verifyTextGrounding(sampleRawText, "C++")).toBe(true);
    expect(verifyTextGrounding(sampleRawText, "UIETH PANJAB UNIVERSITY")).toBe(true);
    expect(verifyTextGrounding(sampleRawText, "8979617352")).toBe(true);
  });

  it("rejects hallucinated entities absent from source text", () => {
    expect(verifyTextGrounding(sampleRawText, "AI Solutions Inc.")).toBe(false);
    expect(verifyTextGrounding(sampleRawText, "SIES Graduate School of Technology")).toBe(false);
    expect(verifyTextGrounding(sampleRawText, "LangChain")).toBe(false);
    expect(verifyTextGrounding(sampleRawText, "GraphRAG")).toBe(false);
    expect(verifyTextGrounding(sampleRawText, "Neo4j")).toBe(false);
    expect(verifyTextGrounding(sampleRawText, "Docker")).toBe(false);
  });

  it("detects and flags suspicious placeholders", () => {
    expect(ResumeProfileValidator.isSuspiciousPlaceholder("AI Solutions Inc.", sampleRawText)).toBe(true);
    expect(ResumeProfileValidator.isSuspiciousPlaceholder("John Doe", sampleRawText)).toBe(true);
    expect(ResumeProfileValidator.isSuspiciousPlaceholder("SIES Graduate School", sampleRawText)).toBe(true);
  });

  it("validates email formats and ensures existence in text", () => {
    expect(isValidEmail("kavyagupta2719@gmail.com")).toBe(true);
    expect(isValidEmail("invalid-email")).toBe(false);
    expect(verifyTextGrounding(sampleRawText, "kavyagupta2719@gmail.com")).toBe(true);
    expect(verifyTextGrounding(sampleRawText, "fake@example.com")).toBe(false);
  });

  it("validates phone number plausibility and source presence", () => {
    expect(isPlausiblePhone("8979617352")).toBe(true);
    expect(isPlausiblePhone("123")).toBe(false);
    expect(verifyTextGrounding(sampleRawText, "8979617352")).toBe(true);
    expect(verifyTextGrounding(sampleRawText, "9999999999")).toBe(false);
  });

  it("compares dates and warns on chronological inconsistency", () => {
    const start = parseDateToNumber("June 2024");
    const end = parseDateToNumber("July 2024");
    expect(start).toBe(202406);
    expect(end).toBe(202407);
    expect(end! >= start!).toBe(true);

    const invalidStart = parseDateToNumber("Dec 2024");
    const invalidEnd = parseDateToNumber("Jan 2024");
    expect(invalidEnd! < invalidStart!).toBe(true);
  });
});

describe("Deterministic Platform Link Normalizer", () => {
  it("normalizes GitHub usernames into canonical URLs", () => {
    const res = normalizePlatformUrl("github", "Kavya2719", "// Kavya2719");
    expect(res.username).toBe("Kavya2719");
    expect(res.url).toBe("https://github.com/Kavya2719");
  });

  it("normalizes LinkedIn usernames into canonical URLs", () => {
    const res = normalizePlatformUrl("linkedin", "Kavya2719", null);
    expect(res.username).toBe("Kavya2719");
    expect(res.url).toBe("https://www.linkedin.com/in/Kavya2719");
  });

  it("normalizes LeetCode, CodeForces, and CodeChef links deterministically", () => {
    const lc = normalizePlatformUrl("leetcode", "Kavya2719", null);
    expect(lc.url).toBe("https://leetcode.com/Kavya2719");

    const cf = normalizePlatformUrl("codeforces", "Kavya2719", null);
    expect(cf.url).toBe("https://codeforces.com/profile/Kavya2719");

    const cc = normalizePlatformUrl("codechef", "kavya2719", null);
    expect(cc.url).toBe("https://codechef.com/users/kavya2719");
  });

  it("returns null when no username or url is provided", () => {
    const res = normalizePlatformUrl("portfolio", null, null);
    expect(res.url).toBeNull();
    expect(res.username).toBeNull();
  });
});

describe("Zero-Hallucination Full Extraction Validation against Uploaded Resume", () => {
  const fixturePath = path.resolve(__dirname, "../fixtures/kavya_resume_extracted_text.txt");
  const rawText = fs.existsSync(fixturePath)
    ? fs.readFileSync(fixturePath, "utf-8")
    : "";

  it("strictly validates candidate data and rejects any injected hallucinations", () => {
    if (!rawText) return;

    // Simulate an extraction that contains both true data and injected hallucinations
    const testExtraction: StrictResumeExtraction = {
      personal: {
        full_name: { value: "Kavya Gupta", confidence: "HIGH", evidence: "Kavya Gupta" },
        first_name: { value: "Kavya", confidence: "HIGH", evidence: "Kavya Gupta" },
        last_name: { value: "Gupta", confidence: "HIGH", evidence: "Kavya Gupta" },
        email: { value: "kavyagupta2719@gmail.com", confidence: "HIGH", evidence: "kavyagupta2719@gmail.com" },
        phone: { value: "8979617352", confidence: "HIGH", evidence: "8979617352" },
        location: { value: null, confidence: "LOW", evidence: null }, // Candidate home location is unknown
      },
      education: [
        {
          institution: { value: "UIETH PANJAB UNIVERSITY", confidence: "HIGH", evidence: "UIETH PANJAB UNIVERSITY" },
          degree: { value: "B.E.", confidence: "HIGH", evidence: "B.E. in Computer Science" },
          field_of_study: { value: "Computer Science and Engineering", confidence: "HIGH", evidence: "Computer Science and Engineering" },
          start_date: { value: "Nov. 2021", confidence: "HIGH", evidence: "Nov. 2021" },
          end_date: { value: "July 2025", confidence: "HIGH", evidence: "July 2025" },
          grade: { value: "8.31", confidence: "HIGH", evidence: "CGPA - 8.31" },
        },
        // Injected hallucination that must be rejected:
        {
          institution: { value: "SIES Graduate School of Technology", confidence: "HIGH", evidence: "SIES Graduate School" },
          degree: { value: "B.E.", confidence: "HIGH", evidence: "B.E." },
          field_of_study: { value: "Computer Engineering", confidence: "HIGH", evidence: "Computer Engineering" },
          start_date: { value: "2021", confidence: "HIGH", evidence: "2021" },
          end_date: { value: "2025", confidence: "HIGH", evidence: "2025" },
          grade: { value: null, confidence: "LOW", evidence: null },
        },
      ],
      experience: [
        {
          company: { value: "CISCO SYSTEMS", confidence: "HIGH", evidence: "CISCO SYSTEMS" },
          title: { value: "SWE Summer Intern’24", confidence: "HIGH", evidence: "SWE Summer Intern’24" },
          employment_type: { value: null, confidence: "LOW", evidence: null },
          location: { value: "Bangalore, India", confidence: "HIGH", evidence: "Bangalore, India" },
          start_date: { value: "June 2024", confidence: "HIGH", evidence: "June 2024" },
          end_date: { value: "July 2024", confidence: "HIGH", evidence: "July 2024" },
          description: { value: "Enhanced Bugs Analytics Dashboard", confidence: "HIGH", evidence: "Enhanced Bugs Analytics Dashboard" },
          achievements: [],
        },
        // Injected hallucination that must be rejected:
        {
          company: { value: "AI Solutions Inc.", confidence: "HIGH", evidence: "AI Solutions Inc." },
          title: { value: "AI Engineer Intern", confidence: "HIGH", evidence: "AI Engineer Intern" },
          employment_type: { value: null, confidence: "LOW", evidence: null },
          location: { value: null, confidence: "LOW", evidence: null },
          start_date: { value: "Aug 2025", confidence: "HIGH", evidence: "Aug 2025" },
          end_date: { value: "Present", confidence: "HIGH", evidence: "Present" },
          description: { value: "Designed and deployed Advanced RAG", confidence: "HIGH", evidence: "Advanced RAG" },
          achievements: [],
        },
      ],
      projects: [
        {
          name: { value: "SPEAKINDIA", confidence: "HIGH", evidence: "SPEAKINDIA" },
          technologies: [{ value: "MERN Stack", evidence: "MERN Stack" }],
          description: { value: "Developed an Event Management Platform", confidence: "HIGH", evidence: "Event Management Platform" },
          start_date: { value: "April 2024", confidence: "HIGH", evidence: "April 2024" },
          end_date: { value: "May 2024", confidence: "HIGH", evidence: "May 2024" },
          links: [],
        },
      ],
      skills: {
        programming_languages: [
          { value: "C", confidence: "HIGH", evidence: "| C |" },
          { value: "C++", confidence: "HIGH", evidence: "| C++ |" },
          { value: "Javascript", confidence: "HIGH", evidence: "| Javascript |" },
          // Injected fake skill:
          { value: "Rust", confidence: "HIGH", evidence: "Rust" },
        ],
        frameworks: [
          { value: "ReactJs", confidence: "HIGH", evidence: "| ReactJs |" },
          // Injected fake skill:
          { value: "LangChain", confidence: "HIGH", evidence: "LangChain" },
        ],
        databases: [
          { value: "MongoDB", confidence: "HIGH", evidence: "| MongoDB |" },
          // Injected fake skill:
          { value: "Neo4j", confidence: "HIGH", evidence: "Neo4j" },
        ],
        tools: [{ value: "Git", confidence: "HIGH", evidence: "| Git |" }],
        cloud: [],
        devops: [{ value: "LINUX", confidence: "HIGH", evidence: "| LINUX |" }],
        concepts: [{ value: "Data Structures And Algorithms", confidence: "HIGH", evidence: "Data Structures And Algorithms" }],
        soft_skills: [{ value: "Leadership", confidence: "HIGH", evidence: "Leadership" }],
      },
      achievements: [],
      certifications: [],
      links: {
        linkedin: { platform: "linkedin", username: "Kavya2719", url: "https://www.linkedin.com/in/Kavya2719", evidence: "Kavya2719" },
        github: { platform: "github", username: "Kavya2719", url: "https://github.com/Kavya2719", evidence: "Kavya2719" },
        portfolio: null,
        codeforces: { platform: "codeforces", username: "Kavya2719", url: "https://codeforces.com/profile/Kavya2719", evidence: "Kavya2719" },
        codechef: { platform: "codechef", username: "kavya2719", url: "https://codechef.com/users/kavya2719", evidence: "kavya2719" },
        leetcode: { platform: "leetcode", username: "Kavya2719", url: "https://leetcode.com/Kavya2719", evidence: "Kavya2719" },
      },
    };

    const validation = ResumeProfileValidator.validate(rawText, testExtraction);

    // 1. Injected fake company "AI Solutions Inc." MUST be rejected!
    const rejectedFields = validation.rejectedFields.map((r) => r.field);
    expect(rejectedFields.some((f) => f.includes("AI Solutions Inc.") || f.includes("experience"))).toBe(true);

    // 2. Injected fake school "SIES Graduate School of Technology" MUST be rejected!
    expect(rejectedFields.some((f) => f.includes("SIES") || f.includes("education"))).toBe(true);

    // 3. Injected fake skills MUST be rejected!
    expect(rejectedFields.some((f) => f.includes("Rust"))).toBe(true);
    expect(rejectedFields.some((f) => f.includes("LangChain"))).toBe(true);
    expect(rejectedFields.some((f) => f.includes("Neo4j"))).toBe(true);

    // 4. Verified experiences should ONLY have genuine records:
    const verifiedCompanies = validation.verifiedData.experience.map((e) => e.company.value);
    expect(verifiedCompanies).toContain("CISCO SYSTEMS");
    expect(verifiedCompanies).not.toContain("AI Solutions Inc.");

    // 5. Verified education should ONLY have UIETH PANJAB UNIVERSITY:
    const verifiedInstitutions = validation.verifiedData.education.map((e) => e.institution.value);
    expect(verifiedInstitutions).toContain("UIETH PANJAB UNIVERSITY");
    expect(verifiedInstitutions).not.toContain("SIES Graduate School of Technology");

    // 6. Verified skills should NOT have Rust, LangChain, Neo4j:
    const verifiedSkillValues = [
      ...validation.verifiedData.skills.programming_languages.map((s) => s.value),
      ...validation.verifiedData.skills.frameworks.map((s) => s.value),
      ...validation.verifiedData.skills.databases.map((s) => s.value),
    ];
    expect(verifiedSkillValues).toContain("C");
    expect(verifiedSkillValues).toContain("ReactJs");
    expect(verifiedSkillValues).toContain("MongoDB");
    expect(verifiedSkillValues).not.toContain("Rust");
    expect(verifiedSkillValues).not.toContain("LangChain");
    expect(verifiedSkillValues).not.toContain("Neo4j");
  });
});
