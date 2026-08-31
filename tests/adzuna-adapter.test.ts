import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  AdzunaAdapter,
  normalizeAdzunaJob,
  getAdzunaCredentials,
  AdzunaError,
  fetchAdzunaJobs,
  searchAdzunaJobs,
} from "../src/lib/ingestion/adapters/adzuna";
import { JobSourceRecord } from "../src/lib/ingestion/types";
import { validateNormalizedJob } from "../src/lib/ingestion/validator";
import { computeJobContentHash } from "../src/lib/ingestion/hasher";
import sampleData from "./fixtures/adzuna-sample.json";

describe("AdzunaAdapter & Ingestion Service", () => {
  const adapter = new AdzunaAdapter();
  const mockSource: JobSourceRecord = {
    id: "src-adzuna-in-1",
    source: "adzuna",
    source_name: "Adzuna India Tech Jobs",
    source_identifier: "software engineer",
    company_name: "Adzuna (India)",
    source_url: "https://www.adzuna.in",
    enabled: true,
    consecutive_failures: 0,
    metadata: {
      country: "in",
      location: "India",
    },
  };

  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.ADZUNA_APP_ID = "test-app-id";
    process.env.ADZUNA_APP_KEY = "test-app-key";
    process.env.ADZUNA_COUNTRY = "in";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("should normalize a full Adzuna job payload with salary, location, and attribution", () => {
    const raw = sampleData.results[0];
    const normalized = adapter.normalize(raw, mockSource);

    expect(normalized.source).toBe("adzuna");
    expect(normalized.source_job_id).toBe("5392817201");
    expect(normalized.company_name).toBe("Razorpay");
    expect(normalized.title).toBe("Senior Software Engineer - Full Stack");
    expect(normalized.department).toBe("IT Jobs");
    expect(normalized.location).toBe("Bengaluru, Karnataka, India");
    expect(normalized.locations_json).toContain("Bengaluru, Karnataka, India");
    expect(normalized.locations_json).toContain("Bengaluru");
    expect(normalized.employment_type).toBe("full-time");
    expect(normalized.salary_min).toBe(1800000);
    expect(normalized.salary_max).toBe(2600000);
    expect(normalized.salary_currency).toBe("INR");
    expect(normalized.salary_interval).toBe("yearly");
    expect(normalized.job_url).toBe("https://www.adzuna.in/land/ad/5392817201?se=abc123xyz");
    expect(normalized.apply_url).toBe("https://www.adzuna.in/land/ad/5392817201?se=abc123xyz");
    expect(normalized.posted_at).toBe("2026-08-20T10:15:30.000Z");
    expect(normalized.description_html).toContain("Senior Software Engineer");
    expect(normalized.description).toContain("Requires 5+ years experience");
    expect(normalized.company_logo).toBe("/platforms/adzuna.svg");

    // Validation
    const validation = validateNormalizedJob(normalized);
    expect(validation.valid).toBe(true);

    // Hash stability
    const hash1 = computeJobContentHash(normalized);
    const hash2 = computeJobContentHash(normalized);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it("should classify remote contract jobs and sanitize malicious HTML", () => {
    const raw = sampleData.results[1];
    const normalized = normalizeAdzunaJob(raw, mockSource);

    expect(normalized.source).toBe("adzuna");
    expect(normalized.source_job_id).toBe("5392817202");
    expect(normalized.company_name).toBe("Postman");
    expect(normalized.remote_type).toBe("remote");
    expect(normalized.employment_type).toBe("contract");
    expect(normalized.department).toBe("Engineering Jobs");
    expect(normalized.salary_min).toBe(2200000);
    expect(normalized.salary_max).toBe(3200000);

    // XSS Sanitization
    expect(normalized.description_html).not.toContain("<script>");
    expect(normalized.description_html).not.toContain("onerror");
    expect(normalized.description).not.toContain("<script>");

    const validation = validateNormalizedJob(normalized);
    expect(validation.valid).toBe(true);
  });

  it("should classify internship roles correctly and handle partial compensation", () => {
    const raw = sampleData.results[2];
    const normalized = normalizeAdzunaJob(raw, mockSource);

    expect(normalized.source).toBe("adzuna");
    expect(normalized.source_job_id).toBe("5392817203");
    expect(normalized.company_name).toBe("Swiggy");
    expect(normalized.employment_type).toBe("internship");
    expect(normalized.salary_min).toBe(300000);
    expect(normalized.salary_max).toBe(450000);

    const validation = validateNormalizedJob(normalized);
    expect(validation.valid).toBe(true);
  });

  it("should handle missing optional fields safely", () => {
    const raw = {
      id: "adzuna-minimal-1",
      title: "DevOps Engineer",
      redirect_url: "https://www.adzuna.in/land/ad/minimal",
    };

    const normalized = normalizeAdzunaJob(raw, mockSource);
    expect(normalized.source).toBe("adzuna");
    expect(normalized.source_job_id).toBe("adzuna-minimal-1");
    expect(normalized.title).toBe("DevOps Engineer");
    expect(normalized.company_name).toBe("Adzuna (India)");
    expect(normalized.salary_min).toBeNull();
    expect(normalized.salary_max).toBeNull();
    expect(normalized.salary_currency).toBeNull();
    expect(normalized.department).toBeNull();

    const validation = validateNormalizedJob(normalized);
    expect(validation.valid).toBe(true);
  });

  it("should throw ADZUNA_CONFIGURATION_ERROR when environment credentials are not configured", () => {
    delete process.env.ADZUNA_APP_ID;
    delete process.env.ADZUNA_APP_KEY;

    expect(() => getAdzunaCredentials()).toThrowError(AdzunaError);
    try {
      getAdzunaCredentials();
    } catch (err: unknown) {
      const adzunaErr = err as AdzunaError;
      expect(adzunaErr.code).toBe("ADZUNA_CONFIGURATION_ERROR");
      expect(adzunaErr.message).toContain("ADZUNA_APP_ID");
    }
  });

  it("should handle 401/403 authentication errors without retrying", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    });
    globalThis.fetch = mockFetch;

    await expect(fetchAdzunaJobs({ query: "developer" })).rejects.toThrowError(AdzunaError);
    expect(mockFetch).toHaveBeenCalledTimes(1); // 401 is permanent, must not retry
  });

  it("should handle 429 rate limit error when retries are exhausted", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      headers: new Headers(),
    });
    globalThis.fetch = mockFetch;

    await expect(fetchAdzunaJobs({ query: "developer" }, { baseDelayMs: 1 })).rejects.toThrowError(AdzunaError);
    expect(mockFetch.mock.calls.length).toBeGreaterThan(1);
  });

  it("should successfully search and return normalized jobs with pagination", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => sampleData,
    });
    globalThis.fetch = mockFetch;

    const result = await searchAdzunaJobs({
      query: "software engineer",
      location: "Bengaluru",
      page: 1,
      resultsPerPage: 20,
    });

    expect(result.source).toBe("adzuna");
    expect(result.jobs).toHaveLength(3);
    expect(result.pagination.total).toBe(1450);
    expect(result.pagination.page).toBe(1);
    expect(result.pagination.resultsPerPage).toBe(20);
    expect(result.jobs[0].company_name).toBe("Razorpay");
  });

  it("should pass healthCheck when API responds with 200", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
    });
    globalThis.fetch = mockFetch;

    const health = await adapter.healthCheck(mockSource);
    expect(health.healthy).toBe(true);
    expect(health.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
