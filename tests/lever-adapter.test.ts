import { describe, it, expect } from "vitest";
import { LeverAdapter } from "../src/lib/ingestion/adapters/lever";
import { JobSourceRecord } from "../src/lib/ingestion/types";
import sampleData from "./fixtures/lever-sample.json";

describe("LeverAdapter", () => {
  const adapter = new LeverAdapter();
  const mockSource: JobSourceRecord = {
    id: "src-lever-1",
    source: "lever",
    source_name: "LangChain",
    source_identifier: "langchain",
    company_name: "LangChain",
    source_url: "https://jobs.lever.co/langchain",
    enabled: true,
    consecutive_failures: 0,
  };

  it("should normalize a Lever posting with full categories and salary range", () => {
    const rawJob = sampleData[0];
    const normalized = adapter.normalize(rawJob, mockSource);

    expect(normalized.source).toBe("lever");
    expect(normalized.source_job_id).toBe("873b281f-99ab-4172-b7e1-87261a849201");
    expect(normalized.company_name).toBe("LangChain");
    expect(normalized.title).toBe("Senior Full-Stack Engineer, AI Agents");
    expect(normalized.remote_type).toBe("remote");
    expect(normalized.employment_type).toBe("full-time");
    expect(normalized.department).toBe("Engineering");
    expect(normalized.team).toBe("Core Platform");
    expect(normalized.salary_min).toBe(170000);
    expect(normalized.salary_max).toBe(220000);
    expect(normalized.salary_currency).toBe("USD");
    expect(normalized.salary_interval).toBe("yearly");
    expect(normalized.apply_url).toBe("https://jobs.lever.co/langchain/873b281f-99ab-4172-b7e1-87261a849201/apply");
  });

  it("should classify hybrid workplace correctly", () => {
    const rawJob = sampleData[1];
    const normalized = adapter.normalize(rawJob, mockSource);

    expect(normalized.remote_type).toBe("hybrid");
    expect(normalized.department).toBe("Marketing");
    expect(normalized.salary_min).toBeNull();
  });
});
