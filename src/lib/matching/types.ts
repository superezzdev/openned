/**
 * Core Types for Tailored Job Matching Engine
 * Guarantees zero-hallucination and evidence-based matching.
 */

export type JobSeniority =
  | "INTERN"
  | "ENTRY_LEVEL"
  | "JUNIOR"
  | "MID"
  | "SENIOR"
  | "LEAD"
  | "MANAGER"
  | "STAFF"
  | "PRINCIPAL"
  | "UNKNOWN";

export interface VerifiedExperienceItem {
  title: string;
  company: string;
  start_date?: string;
  end_date?: string;
  duration_months: number;
  responsibilities: string[];
  is_internship: boolean;
}

export interface VerifiedEducationItem {
  degree: string;
  field_of_study: string;
  institution: string;
  grade?: string;
  start_year?: number;
  end_year?: number;
}

export interface VerifiedProjectItem {
  name: string;
  technologies: string[];
  description: string;
}

export interface UserCareerProfile {
  user_id: string;
  target_roles: string[];
  technical_skills: string[];
  frameworks: string[];
  databases: string[];
  tools: string[];
  all_skills: string[];
  experience: VerifiedExperienceItem[];
  total_verified_experience_months: number;
  education: VerifiedEducationItem[];
  projects: VerifiedProjectItem[];
  locations: string[];
  remote_preference: boolean | null;
  employment_preference: string[];
  seniority: JobSeniority;
}

export interface NormalizedJob {
  id: string;
  title: string;
  company: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  required_skills: string[];
  preferred_skills: string[];
  minimum_experience_months: number;
  maximum_experience_months: number | null;
  education_requirements: string[];
  location: string;
  country?: string | null;
  remote_type: "remote" | "hybrid" | "onsite";
  employment_type: string;
  visa_requirements?: string | null;
  seniority: JobSeniority;
  role_family: string;
  source: string;
  job_url: string;
  apply_url: string;
  posted_at?: string | null;
  salary?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string | null;
  company_logo?: string | null;
}

export interface JobRecommendationScore {
  job_id: string;
  score: number;
  match_level: "Excellent" | "Strong" | "Good" | "Fair";
  reasons: string[];
  missing_requirements: string[];
  matched_skills: string[];
  experience_match: number;
  role_match: number;
  location_match: number;
  education_match: number;
  explanation?: string;
  passed_hard_filter: boolean;
  filter_reason?: string;
}

export interface AIRerankResult {
  role_relevance: number;
  skill_match: number;
  experience_match: number;
  education_match: number;
  overall_match: number;
  matched_requirements: string[];
  missing_requirements: string[];
  reason: string;
}
