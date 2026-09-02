/**
 * Strict Resume Extraction & Verification Types
 * Enforces Zero-Hallucination and Evidence-Based Extraction.
 */

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

export interface EvidenceField<T> {
  value: T | null;
  confidence: ConfidenceLevel;
  evidence: string | null;
  source_section?: string;
}

export interface StrictPersonal {
  full_name: EvidenceField<string>;
  first_name: EvidenceField<string>;
  last_name: EvidenceField<string>;
  email: EvidenceField<string>;
  phone: EvidenceField<string>;
  location: EvidenceField<string>; // ONLY user's home/current location, NOT job locations
}

export interface StrictEducation {
  institution: EvidenceField<string>;
  degree: EvidenceField<string>;
  field_of_study: EvidenceField<string>;
  start_date: EvidenceField<string>;
  end_date: EvidenceField<string>;
  grade: EvidenceField<string>;
}

export interface StrictExperience {
  company: EvidenceField<string>;
  title: EvidenceField<string>;
  employment_type: EvidenceField<string>;
  location: EvidenceField<string>; // Work/office location
  start_date: EvidenceField<string>;
  end_date: EvidenceField<string>;
  description: EvidenceField<string>;
  achievements: Array<{ value: string; evidence: string }>;
}

export interface StrictProject {
  name: EvidenceField<string>;
  technologies: Array<{ value: string; evidence: string }>;
  description: EvidenceField<string>;
  start_date: EvidenceField<string>;
  end_date: EvidenceField<string>;
  links: Array<{ value: string; evidence: string }>;
}

export interface StrictSkills {
  programming_languages: Array<EvidenceField<string>>;
  frameworks: Array<EvidenceField<string>>;
  databases: Array<EvidenceField<string>>;
  tools: Array<EvidenceField<string>>;
  cloud: Array<EvidenceField<string>>;
  devops: Array<EvidenceField<string>>;
  concepts: Array<EvidenceField<string>>;
  soft_skills: Array<EvidenceField<string>>;
}

export interface StrictLink {
  platform: string;
  username: string | null;
  url: string | null;
  evidence: string | null;
}

export interface StrictLinks {
  linkedin: StrictLink | null;
  github: StrictLink | null;
  portfolio: StrictLink | null;
  codeforces: StrictLink | null;
  codechef: StrictLink | null;
  leetcode: StrictLink | null;
}

export interface StrictAchievement {
  value: string;
  confidence: ConfidenceLevel;
  evidence: string;
}

export interface StrictCertification {
  certification_name: string;
  issuer: string | null;
  confidence: ConfidenceLevel;
  evidence: string;
}

export interface StrictResumeExtraction {
  personal: StrictPersonal;
  education: StrictEducation[];
  experience: StrictExperience[];
  projects: StrictProject[];
  skills: StrictSkills;
  achievements: StrictAchievement[];
  certifications: StrictCertification[];
  links: StrictLinks;
  meta?: {
    provider: "gemini" | "groq" | "heuristic";
    model: string;
    durationMs: number;
    attempts: number;
  };
}

export interface RejectedField {
  field: string;
  value: unknown;
  reason: string;
}

export interface ValidationResult {
  isValid: boolean;
  isSufficientQuality?: boolean;
  errors: string[];
  warnings: string[];
  rejectedFields: RejectedField[];
  verifiedData: StrictResumeExtraction;
}

export interface ResumeAuditEntry {
  resume_id?: string;
  profile_id: string;
  parser_version: string;
  field: string;
  old_value: unknown;
  new_value: unknown;
  source_evidence?: string | null;
  confidence?: string;
}
