import { describe, it, expect } from "vitest";
import { computeJobContentHash } from "../src/lib/ingestion/hasher";
import { NormalizedJob } from "../src/lib/ingestion/types";

describe("Hasher", () => {
  const sampleJob: Partial<NormalizedJob> = {
    company_name: "Stripe",
    title: "Backend Engineer",
    location: "San Francisco, CA",
    description: "Build robust distributed backend infrastructure.",
    apply_url: "https://boards.greenhouse.io/stripe/jobs/101#app",
  };

  it("should produce a deterministic 64-character SHA-256 hash", () => {
    const hash1 = computeJobContentHash(sampleJob);
    const hash2 = computeJobContentHash(sampleJob);

    expect(hash1).toHaveLength(64);
    expect(hash1).toBe(hash2);
  });

  it("should be resilient to case and whitespace differences", () => {
    const job1 = { ...sampleJob, title: "Backend Engineer  " };
    const job2 = { ...sampleJob, title: "backend engineer" };

    expect(computeJobContentHash(job1)).toBe(computeJobContentHash(job2));
  });

  it("should produce different hashes for meaningful changes", () => {
    const job1 = { ...sampleJob, title: "Backend Engineer" };
    const job2 = { ...sampleJob, title: "Senior Backend Engineer" };

    expect(computeJobContentHash(job1)).not.toBe(computeJobContentHash(job2));
  });
});
