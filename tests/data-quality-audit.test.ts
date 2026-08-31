import { describe, it, expect } from "vitest";
import { GreenhouseAdapter } from "../src/lib/ingestion/adapters/greenhouse";
import { LeverAdapter } from "../src/lib/ingestion/adapters/lever";
import { AshbyAdapter } from "../src/lib/ingestion/adapters/ashby";
import { WorkableAdapter } from "../src/lib/ingestion/adapters/workable";
import { WellfoundAdapter } from "../src/lib/ingestion/adapters/wellfound";
import { FallbackParser } from "../src/lib/ingestion/adapters/fallback";
import { validateNormalizedJob } from "../src/lib/ingestion/validator";
import { computeJobContentHash } from "../src/lib/ingestion/hasher";
import { JobSourceRecord, NormalizedJob } from "../src/lib/ingestion/types";

describe("Data Quality Audit Across ATS Adapters", () => {
  function verifyJobDataQuality(job: NormalizedJob, sourceRecord: JobSourceRecord) {
    // 1. Source & IDs
    expect(job.source).toBe(sourceRecord.source);
    expect(job.source_job_id).toBeTruthy();
    expect(typeof job.source_job_id).toBe("string");
    expect(job.source_job_id.trim().length).toBeGreaterThan(0);

    // 2. Company & Title
    expect(job.company_name).toBeTruthy();
    expect(job.title).toBeTruthy();
    expect(typeof job.title).toBe("string");
    expect(job.title.trim().length).toBeGreaterThan(0);

    // 3. Location & Classifications
    expect(job.location).toBeDefined();
    expect(Array.isArray(job.locations_json)).toBe(true);
    expect(["remote", "hybrid", "onsite"]).toContain(job.remote_type);
    expect(["full-time", "part-time", "contract", "internship"]).toContain(job.employment_type);

    // 4. Description
    expect(typeof job.description === "string" || job.description === null).toBe(true);

    // 5. URLs
    expect(job.job_url).toMatch(/^https?:\/\//);
    expect(job.apply_url).toMatch(/^https?:\/\//);

    // 6. Schema Validation
    const validation = validateNormalizedJob(job);
    expect(validation.valid).toBe(true);
    expect(validation.sanitizedJob).toBeDefined();

    // 7. Hash Stability
    const hash1 = computeJobContentHash(job);
    const hash2 = computeJobContentHash(job);
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64); // SHA-256
  }

  it("inspects 20-50 Greenhouse jobs for data quality", async () => {
    const adapter = new GreenhouseAdapter();
    const source: JobSourceRecord = {
      id: "gh-stripe",
      source: "greenhouse",
      source_name: "Stripe",
      source_identifier: "stripe",
      company_name: "Stripe",
      source_url: "https://boards.greenhouse.io/stripe",
      enabled: true,
      consecutive_failures: 0,
    };

    const rawJobs = await adapter.fetchJobs(source);
    expect(rawJobs.length).toBeGreaterThanOrEqual(20);

    const sample = rawJobs.slice(0, 30);
    for (const raw of sample) {
      const normalized = adapter.normalize(raw, source);
      verifyJobDataQuality(normalized, source);
    }
  }, 25000);

  it("inspects 20-50 Lever jobs for data quality", async () => {
    const adapter = new LeverAdapter();
    const source: JobSourceRecord = {
      id: "lv-spotify",
      source: "lever",
      source_name: "Spotify",
      source_identifier: "spotify",
      company_name: "Spotify",
      source_url: "https://jobs.lever.co/spotify",
      enabled: true,
      consecutive_failures: 0,
    };

    const rawJobs = await adapter.fetchJobs(source);
    expect(rawJobs.length).toBeGreaterThanOrEqual(20);

    const sample = rawJobs.slice(0, 30);
    for (const raw of sample) {
      const normalized = adapter.normalize(raw, source);
      verifyJobDataQuality(normalized, source);
    }
  }, 25000);

  it("inspects 20-50 Ashby jobs for data quality", async () => {
    const adapter = new AshbyAdapter();
    const source: JobSourceRecord = {
      id: "as-openai",
      source: "ashby",
      source_name: "OpenAI",
      source_identifier: "openai",
      company_name: "OpenAI",
      source_url: "https://jobs.ashbyhq.com/openai",
      enabled: true,
      consecutive_failures: 0,
    };

    const rawJobs = await adapter.fetchJobs(source);
    expect(rawJobs.length).toBeGreaterThanOrEqual(20);

    const sample = rawJobs.slice(0, 30);
    for (const raw of sample) {
      const normalized = adapter.normalize(raw, source);
      verifyJobDataQuality(normalized, source);
    }
  }, 25000);

  it("inspects 20-50 Workable jobs for data quality", async () => {
    const adapter = new WorkableAdapter();
    const source: JobSourceRecord = {
      id: "wk-starling",
      source: "workable",
      source_name: "Starling Bank",
      source_identifier: "starling-bank",
      company_name: "Starling Bank",
      source_url: "https://apply.workable.com/starling-bank",
      enabled: true,
      consecutive_failures: 0,
    };

    const rawJobs = await adapter.fetchJobs(source);
    expect(rawJobs.length).toBeGreaterThanOrEqual(20);

    const sample = rawJobs.slice(0, 30);
    for (const raw of sample) {
      const normalized = adapter.normalize(raw, source);
      verifyJobDataQuality(normalized, source);
    }
  }, 25000);

  it("inspects Fallback Parser JSON-LD jobs for data quality", () => {
    const adapter = new FallbackParser();
    const source: JobSourceRecord = {
      id: "custom-tech",
      source: "custom",
      source_name: "Acme Tech",
      source_identifier: "acme.tech",
      company_name: "Acme Tech",
      source_url: "https://acme.tech/careers",
      enabled: true,
      consecutive_failures: 0,
    };

    // Generate 25 synthetic JSON-LD job postings
    for (let i = 1; i <= 25; i++) {
      const raw = {
        "@type": "JobPosting",
        title: `Staff Distributed Systems Engineer ${i}`,
        description: `<p>We are building global distributed databases. Role ${i}.</p>`,
        identifier: { value: `acme-dist-${i}` },
        datePosted: new Date(Date.now() - i * 86400000).toISOString(),
        employmentType: i % 2 === 0 ? "FULL_TIME" : "CONTRACTOR",
        jobLocationType: i % 3 === 0 ? "TELECOMMUTE" : undefined,
        jobLocation: {
          address: {
            addressLocality: "San Francisco",
            addressRegion: "CA",
            addressCountry: "US",
          },
        },
        baseSalary: {
          currency: "USD",
          value: {
            minValue: 160000 + i * 1000,
            maxValue: 220000 + i * 1000,
            unitText: "YEAR",
          },
        },
        url: `https://acme.tech/jobs/dist-${i}`,
        directApply: `https://acme.tech/apply/dist-${i}`,
      };

      const normalized = adapter.normalize(raw, source);
      verifyJobDataQuality(normalized, source);
    }
  });

  it("inspects 25 Wellfound jobs for data quality and schema conformity", () => {
    const adapter = new WellfoundAdapter();
    const source: JobSourceRecord = {
      id: "wf-modal",
      source: "wellfound",
      source_name: "Modal Labs",
      source_identifier: "modal-labs",
      company_name: "Modal Labs",
      source_url: "https://wellfound.com/company/modal-labs",
      enabled: true,
      consecutive_failures: 0,
    };

    // Generate 25 synthetic Wellfound job postings
    for (let i = 1; i <= 25; i++) {
      const raw = {
        id: 990000 + i,
        slug: `distributed-systems-engineer-${i}`,
        title: `Distributed Systems Engineer ${i}`,
        job_type: i % 2 === 0 ? "full-time" : "contract",
        department: "Core Engineering",
        remote: i % 2 === 0,
        remote_type: i % 2 === 0 ? "remote" : "hybrid",
        location: "San Francisco, CA",
        locations: [{ name: "San Francisco, CA" }, { name: "New York, NY" }],
        salary_min: 180000 + i * 2000,
        salary_max: 240000 + i * 2000,
        salary_currency: "USD",
        salary_interval: "yearly",
        url: `https://wellfound.com/company/modal-labs/jobs/${990000 + i}-distributed-systems-engineer-${i}`,
        apply_url: `https://wellfound.com/company/modal-labs/jobs/${990000 + i}-distributed-systems-engineer-${i}?action=apply`,
        posted_at: new Date(Date.now() - i * 86400000).toISOString(),
        description: `<p>Build high-performance cloud runtime systems. Engineer #${i}.</p>`,
        skills: ["Rust", "Python", "Kubernetes"],
      };

      const normalized = adapter.normalize(raw, source);
      verifyJobDataQuality(normalized, source);
    }
  });
});
