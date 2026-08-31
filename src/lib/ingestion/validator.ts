import { z } from "zod";
import { NormalizedJob } from "./types";

export const NormalizedJobSchema = z.object({
  source: z.enum(["greenhouse", "lever", "ashby", "workable", "wellfound", "custom"]),
  source_job_id: z.string().min(1, "source_job_id cannot be empty"),
  company_name: z.string().min(1, "company_name cannot be empty"),
  company_logo: z.string().nullable().optional(),
  title: z.string().min(1, "title cannot be empty"),
  description: z.string().nullable().optional(),
  description_html: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  locations_json: z.any().optional(),
  country: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  remote_type: z.enum(["remote", "hybrid", "onsite"]).nullable().optional(),
  employment_type: z.enum(["full-time", "part-time", "contract", "internship"]).nullable().optional(),
  department: z.string().nullable().optional(),
  team: z.string().nullable().optional(),
  salary_min: z.number().nullable().optional(),
  salary_max: z.number().nullable().optional(),
  salary_currency: z.string().nullable().optional(),
  salary_interval: z.enum(["yearly", "monthly", "hourly"]).nullable().optional(),
  job_url: z.string().url("job_url must be a valid URL"),
  apply_url: z.string().url("apply_url must be a valid URL"),
  posted_at: z.string().datetime().nullable().optional(),
  updated_at_source: z.string().datetime().nullable().optional(),
  raw_payload: z.record(z.string(), z.any()).nullable().optional(),
});

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  sanitizedJob?: NormalizedJob;
}

/**
 * Validates a normalized job against schema requirements.
 * Rejects invalid items (e.g. missing title, invalid URL, missing source_job_id).
 */
export function validateNormalizedJob(job: Partial<NormalizedJob>): ValidationResult {
  const result = NormalizedJobSchema.safeParse(job);

  if (!result.success) {
    const errorMessages = result.error.issues.map(
      (issue) => `[${issue.path.join(".")}] ${issue.message}`
    );
    return {
      valid: false,
      errors: errorMessages,
    };
  }

  return {
    valid: true,
    sanitizedJob: result.data as NormalizedJob,
  };
}
