import { describe, it, expect } from "vitest";
import { GreenhouseAdapter } from "../src/lib/ingestion/adapters/greenhouse";
import { JobSourceRecord } from "../src/lib/ingestion/types";
import sampleData from "./fixtures/greenhouse-sample.json";

describe("GreenhouseAdapter", () => {
  const adapter = new GreenhouseAdapter();
  const mockSource: JobSourceRecord = {
    id: "src-gh-1",
    source: "greenhouse",
    source_name: "Stripe",
    source_identifier: "stripe",
    company_name: "Stripe",
    source_url: "https://boards.greenhouse.io/stripe",
    enabled: true,
    consecutive_failures: 0,
  };

  it("should normalize a valid Greenhouse job payload", () => {
    const rawJob = sampleData.jobs[0];
    const normalized = adapter.normalize(rawJob, mockSource);

    expect(normalized.source).toBe("greenhouse");
    expect(normalized.source_job_id).toBe("4829102");
    expect(normalized.company_name).toBe("Stripe");
    expect(normalized.title).toBe("Staff Software Engineer, Platform Infrastructure");
    expect(normalized.job_url).toBe("https://boards.greenhouse.io/stripe/jobs/4829102");
    expect(normalized.apply_url).toBe("https://boards.greenhouse.io/stripe/jobs/4829102#app");
    expect(normalized.department).toBe("Engineering");
    expect(normalized.location).toBe("San Francisco, CA");
    expect(normalized.locations_json).toContain("San Francisco, CA");
    expect(normalized.locations_json).toContain("San Francisco HQ");
    expect(normalized.locations_json).toContain("Seattle Office");
    expect(normalized.salary_min).toBe(210000);
    expect(normalized.salary_max).toBe(260000);
    expect(normalized.salary_currency).toBe("USD");
    expect(normalized.salary_interval).toBe("yearly");
    expect(normalized.description).toContain("About Stripe");
  });

  it("should handle jobs with missing optional fields gracefully", () => {
    const rawJob = sampleData.jobs[1];
    const normalized = adapter.normalize(rawJob, mockSource);

    expect(normalized.source_job_id).toBe("4829103");
    expect(normalized.remote_type).toBe("remote");
    expect(normalized.department).toBe("Product Design");
    expect(normalized.salary_min).toBeNull();
    expect(normalized.salary_max).toBeNull();
  });
});
