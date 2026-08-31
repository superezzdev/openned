import { describe, it, expect } from "vitest";
import { AshbyAdapter } from "../src/lib/ingestion/adapters/ashby";
import { JobSourceRecord } from "../src/lib/ingestion/types";
import sampleData from "./fixtures/ashby-sample.json";

describe("AshbyAdapter", () => {
  const adapter = new AshbyAdapter();
  const mockSource: JobSourceRecord = {
    id: "src-ashby-1",
    source: "ashby",
    source_name: "OpenAI",
    source_identifier: "openai",
    company_name: "OpenAI",
    source_url: "https://jobs.ashbyhq.com/openai",
    enabled: true,
    consecutive_failures: 0,
  };

  it("should normalize an Ashby job with compensation tiers and secondary locations", () => {
    const rawJob = sampleData.jobs[0];
    const normalized = adapter.normalize(rawJob, mockSource);

    expect(normalized.source).toBe("ashby");
    expect(normalized.source_job_id).toBe("e30291ba-4491-4921-b0e2-c48192a01928");
    expect(normalized.title).toBe("Research Engineer, Post-Training Alignment");
    expect(normalized.department).toBe("Applied Research");
    expect(normalized.team).toBe("Frontier Models");
    expect(normalized.location).toBe("San Francisco, CA");
    expect(normalized.locations_json).toContain("San Francisco, CA");
    expect(normalized.locations_json).toContain("New York, NY");
    expect(normalized.locations_json).toContain("London, UK");
    expect(normalized.salary_min).toBe(245000);
    expect(normalized.salary_max).toBe(385000);
    expect(normalized.salary_currency).toBe("USD");
    expect(normalized.apply_url).toBe("https://jobs.ashbyhq.com/openai/e30291ba-4491-4921-b0e2-c48192a01928/application");
  });
});
