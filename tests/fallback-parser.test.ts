import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FallbackParser } from "../src/lib/ingestion/adapters/fallback";
import { JobSourceRecord } from "../src/lib/ingestion/types";

describe("FallbackParser", () => {
  const parser = new FallbackParser();
  const mockSource: JobSourceRecord = {
    id: "src-custom-1",
    source: "custom",
    source_name: "Acme Corp",
    source_identifier: "acme.org",
    company_name: "Acme Corp",
    source_url: "https://acme.org/careers",
    enabled: true,
    consecutive_failures: 0,
  };

  it("should extract and normalize JSON-LD JobPosting from HTML document", () => {
    const html = readFileSync(join(__dirname, "fixtures/jsonld-sample.html"), "utf-8");
    const extractedJobs = parser.extractJobsFromHtml(html, "https://acme.org/careers", mockSource);

    expect(extractedJobs.length).toBe(1);
    const raw = extractedJobs[0];

    const normalized = parser.normalize(raw, mockSource);
    expect(normalized.source).toBe("custom");
    expect(normalized.source_job_id).toBe("ACME-JOB-101");
    expect(normalized.title).toBe("Senior AI Engineer");
    expect(normalized.company_name).toBe("Acme Corp");
    expect(normalized.remote_type).toBe("remote");
    expect(normalized.employment_type).toBe("full-time");
    expect(normalized.location).toBe("Austin, TX, US");
    expect(normalized.salary_min).toBe(160000);
    expect(normalized.salary_max).toBe(210000);
    expect(normalized.salary_currency).toBe("USD");
    expect(normalized.salary_interval).toBe("yearly");
    expect(normalized.apply_url).toBe("https://acme.org/careers/apply/101");
  });
});
