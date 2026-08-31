import { describe, it, expect } from "vitest";
import { WellfoundAdapter } from "../src/lib/ingestion/adapters/wellfound";
import { JobSourceRecord } from "../src/lib/ingestion/types";
import { validateNormalizedJob } from "../src/lib/ingestion/validator";
import { computeJobContentHash } from "../src/lib/ingestion/hasher";
import sampleData from "./fixtures/wellfound-sample.json";

describe("WellfoundAdapter", () => {
  const adapter = new WellfoundAdapter();
  const mockSource: JobSourceRecord = {
    id: "src-wellfound-1",
    source: "wellfound",
    source_name: "Modal Labs",
    source_identifier: "modal-labs",
    company_name: "Modal Labs",
    source_url: "https://wellfound.com/company/modal-labs",
    enabled: true,
    consecutive_failures: 0,
  };

  it("should normalize a Wellfound job with salary, remote status, and URL preservation", () => {
    const rawJob = sampleData.jobs[0];
    const normalized = adapter.normalize(rawJob, mockSource);

    expect(normalized.source).toBe("wellfound");
    expect(normalized.source_job_id).toBe("982145");
    expect(normalized.company_name).toBe("Modal Labs");
    expect(normalized.title).toBe("Staff Distributed Systems Engineer");
    expect(normalized.department).toBe("Infrastructure");
    expect(normalized.location).toBe("San Francisco, CA");
    expect(normalized.locations_json).toContain("San Francisco, CA");
    expect(normalized.locations_json).toContain("New York, NY");
    expect(normalized.remote_type).toBe("remote");
    expect(normalized.employment_type).toBe("full-time");
    expect(normalized.salary_min).toBe(210000);
    expect(normalized.salary_max).toBe(280000);
    expect(normalized.salary_currency).toBe("USD");
    expect(normalized.salary_interval).toBe("yearly");
    expect(normalized.job_url).toBe("https://wellfound.com/company/modal-labs/jobs/982145-staff-distributed-systems-engineer");
    expect(normalized.apply_url).toBe("https://wellfound.com/company/modal-labs/jobs/982145-staff-distributed-systems-engineer?action=apply");
    expect(normalized.posted_at).toBe("2026-08-25T12:00:00.000Z");
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

  it("should normalize an onsite Wellfound job with clean HTML sanitization", () => {
    const rawJob = sampleData.jobs[1];
    const normalized = adapter.normalize(rawJob, mockSource);

    expect(normalized.source).toBe("wellfound");
    expect(normalized.source_job_id).toBe("982146");
    expect(normalized.title).toBe("Frontend Founding Engineer");
    expect(normalized.remote_type).toBe("onsite");
    expect(normalized.location).toBe("New York, NY");
    expect(normalized.description).toContain("Build high-performance interactive developer consoles");
    expect(normalized.description_html).toContain("<p>Build high-performance interactive developer consoles");
    expect(normalized.salary_min).toBe(170000);
    expect(normalized.salary_max).toBe(230000);
    expect(normalized.job_url).toBe("https://wellfound.com/company/modal-labs/jobs/982146-frontend-founding-engineer");
    expect(normalized.apply_url).toBe("https://wellfound.com/company/modal-labs/jobs/982146-frontend-founding-engineer#apply");

    const validation = validateNormalizedJob(normalized);
    expect(validation.valid).toBe(true);
  });

  it("should extract compensation from compensation_string when numeric values are omitted", () => {
    const rawJob = {
      id: "wf-custom-99",
      title: "AI Infrastructure Engineer",
      compensation_string: "$160,000 - $220,000 • 0.25% - 1.0%",
      url: "https://wellfound.com/jobs/99-ai-infrastructure",
      apply_url: "https://wellfound.com/jobs/99-ai-infrastructure/apply",
    };

    const normalized = adapter.normalize(rawJob, mockSource);
    expect(normalized.salary_min).toBe(160000);
    expect(normalized.salary_max).toBe(220000);
    expect(normalized.salary_currency).toBe("USD");
    expect(normalized.salary_interval).toBe("yearly");
  });
});
