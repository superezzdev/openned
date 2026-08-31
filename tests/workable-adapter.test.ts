import { describe, it, expect } from "vitest";
import { WorkableAdapter } from "../src/lib/ingestion/adapters/workable";
import { JobSourceRecord } from "../src/lib/ingestion/types";
import sampleData from "./fixtures/workable-sample.json";

describe("WorkableAdapter", () => {
  const adapter = new WorkableAdapter();
  const mockSource: JobSourceRecord = {
    id: "src-workable-1",
    source: "workable",
    source_name: "Perplexity AI",
    source_identifier: "perplexity",
    company_name: "Perplexity AI",
    source_url: "https://apply.workable.com/perplexity",
    enabled: true,
    consecutive_failures: 0,
  };

  it("should normalize a Workable job with shortcode identifier and remote status", () => {
    const rawJob = sampleData.results[0];
    const normalized = adapter.normalize(rawJob, mockSource);

    expect(normalized.source).toBe("workable");
    expect(normalized.source_job_id).toBe("PRPX9482A");
    expect(normalized.company_name).toBe("Perplexity AI");
    expect(normalized.title).toBe("Staff Backend Engineer, Search & Indexing");
    expect(normalized.location).toBe("San Francisco, CA, United States");
    expect(normalized.remote_type).toBe("remote");
    expect(normalized.employment_type).toBe("full-time");
    expect(normalized.salary_min).toBe(180000);
    expect(normalized.salary_max).toBe(240000);
    expect(normalized.salary_currency).toBe("USD");
    expect(normalized.job_url).toBe("https://apply.workable.com/perplexity/j/PRPX9482A/");
    expect(normalized.apply_url).toBe("https://apply.workable.com/perplexity/j/PRPX9482A/apply/");
  });
});
