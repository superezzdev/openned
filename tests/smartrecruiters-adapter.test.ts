import { describe, it, expect } from "vitest";
import { SmartRecruitersAdapter } from "../src/lib/ingestion/adapters/smartrecruiters";
import { JobSourceRecord } from "../src/lib/ingestion/types";
import { validateNormalizedJob } from "../src/lib/ingestion/validator";
import { computeJobContentHash } from "../src/lib/ingestion/hasher";
import sampleData from "./fixtures/smartrecruiters-sample.json";

describe("SmartRecruitersAdapter", () => {
  const adapter = new SmartRecruitersAdapter();
  const mockSource: JobSourceRecord = {
    id: "src-smartrecruiters-1",
    source: "smartrecruiters",
    source_name: "SmartRecruiters Inc",
    source_identifier: "smartrecruiters",
    company_name: "SmartRecruiters Inc",
    source_url: "https://jobs.smartrecruiters.com/smartrecruiters",
    enabled: true,
    consecutive_failures: 0,
  };

  it("should normalize a SmartRecruiters job with jobAd sections, salary, remote status, and URL preservation", () => {
    const rawJob = sampleData.content[0];
    const normalized = adapter.normalize(rawJob, mockSource);

    expect(normalized.source).toBe("smartrecruiters");
    expect(normalized.source_job_id).toBe("744000143115219");
    expect(normalized.company_name).toBe("SmartRecruiters Inc");
    expect(normalized.title).toBe("Senior Information Security Engineer");
    expect(normalized.department).toBe("Engineering");
    expect(normalized.team).toBe("Security Engineering");
    expect(normalized.location).toBe("San Francisco, CA, United States");
    expect(normalized.locations_json).toContain("San Francisco, CA, United States");
    expect(normalized.remote_type).toBe("remote");
    expect(normalized.employment_type).toBe("full-time");
    expect(normalized.salary_min).toBe(175000);
    expect(normalized.salary_max).toBe(230000);
    expect(normalized.salary_currency).toBe("USD");
    expect(normalized.salary_interval).toBe("yearly");
    expect(normalized.job_url).toBe("https://jobs.smartrecruiters.com/smartrecruiters/744000143115219");
    expect(normalized.apply_url).toBe("https://jobs.smartrecruiters.com/smartrecruiters/744000143115219/apply");
    expect(normalized.posted_at).toBe("2026-08-12T14:04:56.128Z");
    expect(normalized.description_html).toContain("Company Description");
    expect(normalized.description_html).toContain("Job Description");
    expect(normalized.description_html).toContain("Qualifications");
    expect(normalized.description).toContain("Senior Information Security Engineer");
    expect(normalized.raw_payload).toBeDefined();

    // Verify it passes validation schema
    const validation = validateNormalizedJob(normalized);
    expect(validation.valid).toBe(true);

    // Verify content hash is deterministic
    const hash1 = computeJobContentHash(normalized);
    const hash2 = computeJobContentHash(normalized);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it("should normalize a hybrid SmartRecruiters job with customField compensation extraction", () => {
    const rawJob = sampleData.content[1];
    const normalized = adapter.normalize(rawJob, mockSource);

    expect(normalized.source).toBe("smartrecruiters");
    expect(normalized.source_job_id).toBe("744000146519330");
    expect(normalized.title).toBe("Staff Platform Infrastructure Engineer");
    expect(normalized.remote_type).toBe("hybrid");
    expect(normalized.employment_type).toBe("contract");
    expect(normalized.location).toBe("Austin, TX, United States");
    expect(normalized.salary_min).toBe(190000);
    expect(normalized.salary_max).toBe(240000);
    expect(normalized.salary_currency).toBe("USD");
    expect(normalized.salary_interval).toBe("yearly");
    expect(normalized.job_url).toBe("https://jobs.smartrecruiters.com/smartrecruiters/744000146519330");
    expect(normalized.apply_url).toBe("https://jobs.smartrecruiters.com/smartrecruiters/744000146519330/apply");

    const validation = validateNormalizedJob(normalized);
    expect(validation.valid).toBe(true);
  });

  it("should sanitize dangerous HTML tags and event handlers from raw descriptions", () => {
    const rawJob = {
      id: "sr-xss-1",
      name: "Security Analyst",
      description_html: '<p>Standard text</p><script>alert("hack")</script><img src="x" onerror="steal()" /><a href="javascript:alert(1)">Click</a>',
      location: { city: "New York", country: "US" },
    };

    const normalized = adapter.normalize(rawJob, mockSource);
    expect(normalized.description_html).not.toContain("<script>");
    expect(normalized.description_html).not.toContain("onerror");
    expect(normalized.description_html).not.toContain("javascript:");
    expect(normalized.description_html).toContain("<p>Standard text</p>");

    const validation = validateNormalizedJob(normalized);
    expect(validation.valid).toBe(true);
  });

  it("should extract salary from text regex fallback when compensation object is not present", () => {
    const rawJob = {
      id: "sr-salary-regex",
      name: "Backend Lead",
      description: "Competitive pay of $160,000 to $210,000 per year with equity.",
      location: { city: "Seattle", region: "WA", country: "US" },
    };

    const normalized = adapter.normalize(rawJob, mockSource);
    expect(normalized.salary_min).toBe(160000);
    expect(normalized.salary_max).toBe(210000);
    expect(normalized.salary_currency).toBe("USD");
    expect(normalized.salary_interval).toBe("yearly");
  });
});
