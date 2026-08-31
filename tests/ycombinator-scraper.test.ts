import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  canonicalizeJobUrl,
  extractJobIdFromUrl,
  extractJobUrlsFromHtml,
  isYcJobUrl,
} from "../src/scrapers/ycombinator/fetcher";
import {
  extractApplyUrl,
  extractCompany,
  extractDescription,
  extractEmbeddedJobData,
  extractJsonLd,
  extractLocation,
  extractSalary,
  parseJobPage,
} from "../src/scrapers/ycombinator/parser";
import {
  computeYcContentHash,
  normalizeYcJobToCanonical,
  normalizeYcJobToScrapedJob,
} from "../src/scrapers/ycombinator/normalizer";
import { validateNormalizedJob } from "../src/lib/ingestion/validator";
import { SOURCE_NAME } from "../src/scrapers/ycombinator/constants";

describe("Y Combinator Scraper & Adapter", () => {
  const sampleDetailHtml = fs.readFileSync(
    path.join(__dirname, "fixtures/ycombinator-sample.html"),
    "utf-8"
  );
  const sampleIndexHtml = fs.readFileSync(
    path.join(__dirname, "fixtures/ycombinator-index.html"),
    "utf-8"
  );

  const sampleJobUrl = "https://www.ycombinator.com/companies/porter/jobs/GjO3enf-backend-engineer-go";

  describe("URL Canonicalization & Detection", () => {
    it("should canonicalize relative and absolute YC job URLs and strip query params", () => {
      const relUrl = "/companies/porter/jobs/GjO3enf-backend-engineer-go?utm_source=jobs_page&ref=test#apply";
      const canonical = canonicalizeJobUrl(relUrl);
      expect(canonical).toBe("https://www.ycombinator.com/companies/porter/jobs/GjO3enf-backend-engineer-go");

      const absUrl = "https://www.ycombinator.com/companies/medplum/jobs/nAbajSt-software-engineer/?source=feed";
      expect(canonicalizeJobUrl(absUrl)).toBe("https://www.ycombinator.com/companies/medplum/jobs/nAbajSt-software-engineer");
    });

    it("should reject non-job URLs and non-YC domains", () => {
      expect(canonicalizeJobUrl("/jobs")).toBeNull();
      expect(canonicalizeJobUrl("/jobs/role/software-engineer")).toBeNull();
      expect(canonicalizeJobUrl("/companies/porter")).toBeNull();
      expect(canonicalizeJobUrl("/about")).toBeNull();
      expect(canonicalizeJobUrl("https://www.google.com/companies/porter/jobs/123")).toBeNull();
      expect(canonicalizeJobUrl("https://account.ycombinator.com/authenticate")).toBeNull();
    });

    it("should correctly identify YC job URLs with isYcJobUrl", () => {
      expect(isYcJobUrl("https://www.ycombinator.com/companies/porter/jobs/GjO3enf-backend-engineer-go")).toBe(true);
      expect(isYcJobUrl("/companies/porter/jobs/GjO3enf-backend-engineer-go")).toBe(true);
      expect(isYcJobUrl("/jobs/role/software-engineer")).toBe(false);
      expect(isYcJobUrl(null)).toBe(false);
    });

    it("should extract a stable source_job_id from canonical URL path", () => {
      expect(extractJobIdFromUrl("https://www.ycombinator.com/companies/porter/jobs/GjO3enf-backend-engineer-go")).toBe("GjO3enf");
      expect(extractJobIdFromUrl("https://www.ycombinator.com/companies/medplum/jobs/nAbajSt-software-engineer")).toBe("nAbajSt");
      expect(extractJobIdFromUrl("https://www.ycombinator.com/companies/feather-2/jobs/OGlm8aX-backend-ai-engineer")).toBe("OGlm8aX");
    });

    it("should extract and deduplicate job URLs from index HTML", () => {
      const extracted = extractJobUrlsFromHtml(sampleIndexHtml);
      expect(extracted).toContain("https://www.ycombinator.com/companies/porter/jobs/GjO3enf-backend-engineer-go");
      expect(extracted).toContain("https://www.ycombinator.com/companies/medplum/jobs/nAbajSt-software-engineer");
      expect(extracted).toContain("https://www.ycombinator.com/companies/feather-2/jobs/OGlm8aX-backend-ai-engineer");
      expect(extracted).toContain("https://www.ycombinator.com/companies/aviator/jobs/2fmcI6d-software-engineer-fullstack");

      // Non-job URLs must be filtered out
      expect(extracted.some((u) => u.includes("/role/"))).toBe(false);

      // Verify no duplicates
      const uniqueSet = new Set(extracted);
      expect(uniqueSet.size).toBe(extracted.length);
    });
  });

  describe("Structured Data & Page Parsing", () => {
    it("should extract JSON-LD JobPosting data accurately", () => {
      const jsonLd = extractJsonLd(sampleDetailHtml);
      expect(jsonLd).not.toBeNull();
      expect(jsonLd?.title).toBe("Backend Engineer (Go)");
      expect(jsonLd?.hiringOrganization?.name).toBe("Porter");
      expect(jsonLd?.employmentType).toBe("FULL_TIME");
      expect(jsonLd?.datePosted).toBe("2024-05-10T22:12:01Z");
    });

    it("should extract embedded Inertia data-page state accurately", () => {
      const embedded = extractEmbeddedJobData(sampleDetailHtml);
      expect(embedded).not.toBeNull();
      expect(embedded?.props?.job?.id).toBe(44501);
      expect(embedded?.props?.job?.companyBatchName).toBe("S20");
      expect(embedded?.props?.company?.website).toBe("https://porter.run");
    });

    it("should parse salary ranges, currencies, and intervals properly", () => {
      const jsonLd = extractJsonLd(sampleDetailHtml);
      const embedded = extractEmbeddedJobData(sampleDetailHtml);
      const salary = extractSalary(jsonLd, embedded, sampleDetailHtml);

      expect(salary.salaryMin).toBe(100000);
      expect(salary.salaryMax).toBe(200000);
      expect(salary.salaryCurrency).toBe("USD");
      expect(salary.salaryInterval).toBe("yearly");
    });

    it("should parse monthly and non-USD compensation strings from embedded data", () => {
      const monthlyEmb = {
        props: {
          job: {
            salaryRange: "$1.5K - $2.5K / monthly",
          },
        },
      };
      const monthlySal = extractSalary(null, monthlyEmb as any);
      expect(monthlySal.salaryMin).toBe(1500);
      expect(monthlySal.salaryMax).toBe(2500);
      expect(monthlySal.salaryCurrency).toBe("USD");
      expect(monthlySal.salaryInterval).toBe("monthly");

      const inrEmb = {
        props: {
          job: {
            salaryRange: "₹3M - ₹10M INR",
          },
        },
      };
      const inrSal = extractSalary(null, inrEmb as any);
      expect(inrSal.salaryMin).toBe(3000000);
      expect(inrSal.salaryMax).toBe(10000000);
      expect(inrSal.salaryCurrency).toBe("INR");
      expect(inrSal.salaryInterval).toBe("yearly");
    });

    it("should extract location, locations array, and detect remote status", () => {
      const jsonLd = extractJsonLd(sampleDetailHtml);
      const embedded = extractEmbeddedJobData(sampleDetailHtml);
      const location = extractLocation(jsonLd, embedded, sampleDetailHtml);

      expect(location.locations.length).toBeGreaterThan(0);
      expect(location.locations.some((l) => l.includes("New York"))).toBe(true);
      expect(location.country).toBe("US");
    });

    it("should extract company info including YC batch, logo, and website", () => {
      const jsonLd = extractJsonLd(sampleDetailHtml);
      const embedded = extractEmbeddedJobData(sampleDetailHtml);
      const company = extractCompany(jsonLd, embedded, sampleDetailHtml, "porter");

      expect(company.name).toBe("Porter");
      expect(company.batch).toBe("S20");
      expect(company.website).toBe("https://porter.run");
      expect(company.logoUrl).toContain("bookface-images");
    });

    it("should extract and sanitize description", () => {
      const jsonLd = extractJsonLd(sampleDetailHtml);
      const embedded = extractEmbeddedJobData(sampleDetailHtml);
      const desc = extractDescription(jsonLd, embedded, sampleDetailHtml);

      expect(desc.description.toLowerCase()).toContain("backend engineer");
      expect(desc.descriptionHtml).toContain("<h3>The Role:</h3>");
      expect(desc.descriptionHtml).not.toContain("<script");
    });

    it("should extract authentic apply URL from embedded state", () => {
      const embedded = extractEmbeddedJobData(sampleDetailHtml);
      const applyUrl = extractApplyUrl(embedded, sampleDetailHtml, sampleJobUrl);

      expect(applyUrl).toContain("https://account.ycombinator.com/authenticate");
      expect(applyUrl).toContain("44501");
    });
  });

  describe("End-to-End Parsing & Normalization", () => {
    it("should parse full job page into YCJobRaw and normalize to YCScrapedJob", () => {
      const rawJob = parseJobPage(sampleDetailHtml, sampleJobUrl);

      expect(rawJob.source_job_id).toBe("GjO3enf");
      expect(rawJob.title).toBe("Backend Engineer (Go)");
      expect(rawJob.company_name).toBe("Porter");
      expect(rawJob.yc_batch).toBe("S20");
      expect(rawJob.salary_min).toBe(100000);
      expect(rawJob.salary_max).toBe(200000);
      expect(rawJob.job_url).toBe(sampleJobUrl);

      const scrapedJob = normalizeYcJobToScrapedJob(rawJob, new Date("2026-09-01T00:00:00Z"));

      expect(scrapedJob.source).toBe(SOURCE_NAME);
      expect(scrapedJob.source_job_id).toBe("GjO3enf");
      expect(scrapedJob.title).toBe("Backend Engineer (Go)");
      expect(scrapedJob.company_name).toBe("Porter");
      expect(scrapedJob.company_logo_url).toContain("bookface-images");
      expect(scrapedJob.company_url).toBe("https://porter.run");
      expect(scrapedJob.job_url).toBe(sampleJobUrl);
      expect(scrapedJob.apply_url).toContain("44501");
      expect(scrapedJob.salary_min).toBe(100000);
      expect(scrapedJob.salary_max).toBe(200000);
      expect(scrapedJob.salary_currency).toBe("USD");
      expect(scrapedJob.yc_batch).toBe("S20");
      expect(scrapedJob.content_hash).toHaveLength(64);
    });

    it("should normalize into core NormalizedJob and pass schema validation", () => {
      const rawJob = parseJobPage(sampleDetailHtml, sampleJobUrl);
      const canonical = normalizeYcJobToCanonical(rawJob);

      expect(canonical.source).toBe("ycombinator");
      expect(canonical.source_job_id).toBe("GjO3enf");
      expect(canonical.company_name).toBe("Porter");
      expect(canonical.employment_type).toBe("full-time");
      expect(canonical.salary_min).toBe(100000);
      expect(canonical.salary_max).toBe(200000);
      expect(canonical.salary_interval).toBe("yearly");
      expect(canonical.job_url).toBe(sampleJobUrl);

      // Verify schema validation
      const validation = validateNormalizedJob(canonical);
      expect(validation.valid).toBe(true);
      expect(validation.sanitizedJob).toBeDefined();
    });

    it("should compute deterministic content hash for duplicate and change detection", () => {
      const hash1 = computeYcContentHash(
        "Porter",
        "Backend Engineer (Go)",
        "New York City, NY, US",
        "We are looking for a backend engineer",
        "https://account.ycombinator.com/apply"
      );
      const hash2 = computeYcContentHash(
        "Porter",
        "Backend Engineer (Go)",
        "New York City, NY, US",
        "We are looking for a backend engineer",
        "https://account.ycombinator.com/apply"
      );
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);

      // Changed compensation/title changes hash
      const hashChanged = computeYcContentHash(
        "Porter",
        "Senior Backend Engineer (Go)",
        "New York City, NY, US",
        "We are looking for a backend engineer",
        "https://account.ycombinator.com/apply"
      );
      expect(hashChanged).not.toBe(hash1);
    });

    it("should sanitize dangerous script tags and XSS in descriptions", () => {
      const xssRawHtml = `
        <script type="application/ld+json">
        {
          "@context": "https://schema.org/",
          "@type": "JobPosting",
          "title": "Security Engineer",
          "description": "<p>Safe text</p><script>alert('xss')</script><img src='x' onerror='steal()' /><a href='javascript:evil()'>Click</a>"
        }
        </script>
      `;
      const rawJob = parseJobPage(xssRawHtml, "https://www.ycombinator.com/companies/testco/jobs/xss123-security");
      const canonical = normalizeYcJobToCanonical(rawJob);

      expect(canonical.description_html).not.toContain("<script>");
      expect(canonical.description_html).not.toContain("onerror");
      expect(canonical.description_html).not.toContain("javascript:");
      expect(canonical.description_html).toContain("<p>Safe text</p>");

      const validation = validateNormalizedJob(canonical);
      expect(validation.valid).toBe(true);
    });
  });
});
