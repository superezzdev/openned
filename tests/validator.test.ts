import { describe, it, expect } from "vitest";
import { validateNormalizedJob } from "../src/lib/ingestion/validator";
import { NormalizedJob } from "../src/lib/ingestion/types";

describe("Validator", () => {
  const baseJob: NormalizedJob = {
    source: "greenhouse",
    source_job_id: "job-101",
    company_name: "Stripe",
    title: "Software Engineer",
    job_url: "https://boards.greenhouse.io/stripe/jobs/101",
    apply_url: "https://boards.greenhouse.io/stripe/jobs/101#app",
    location: "San Francisco, CA",
    description: "Build payment systems.",
  };

  it("should validate a complete, well-formed job", () => {
    const res = validateNormalizedJob(baseJob);
    expect(res.valid).toBe(true);
    expect(res.errors).toBeUndefined();
    expect(res.sanitizedJob?.title).toBe("Software Engineer");
  });

  it("should reject jobs with missing title", () => {
    const invalid = { ...baseJob, title: "" };
    const res = validateNormalizedJob(invalid);
    expect(res.valid).toBe(false);
    expect(res.errors?.some((e) => e.includes("title"))).toBe(true);
  });

  it("should reject jobs with missing source_job_id", () => {
    const invalid = { ...baseJob, source_job_id: "" };
    const res = validateNormalizedJob(invalid);
    expect(res.valid).toBe(false);
    expect(res.errors?.some((e) => e.includes("source_job_id"))).toBe(true);
  });

  it("should reject jobs with invalid job_url or apply_url", () => {
    const invalid = { ...baseJob, job_url: "invalid-url", apply_url: "bad-apply" };
    const res = validateNormalizedJob(invalid);
    expect(res.valid).toBe(false);
    expect(res.errors?.length).toBeGreaterThanOrEqual(2);
  });

  it("should accept jobs with missing optional fields like salary and department", () => {
    const optionalMissing: NormalizedJob = {
      source: "ashby",
      source_job_id: "ashby-202",
      company_name: "OpenAI",
      title: "Member of Technical Staff",
      job_url: "https://jobs.ashbyhq.com/openai/202",
      apply_url: "https://jobs.ashbyhq.com/openai/202/application",
      salary_min: null,
      salary_max: null,
      department: null,
      location: null,
    };
    const res = validateNormalizedJob(optionalMissing);
    expect(res.valid).toBe(true);
  });
});
