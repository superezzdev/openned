import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  CircuitBreaker,
  canonicalizeJobUrl,
  deduplicateJobs,
  normalizeCompanyName,
  normalizeJobTitle,
  normalizeJobLocation,
  computeSemanticFingerprint,
  rankJobs,
  normalizeJSearchJob,
  normalizeActiveJobsDbJob,
  normalizeJobPostingFeedJob,
  normalizeLinkedInJob,
  normalizeJobicyJob,
  normalizeWorkdayJob,
  normalizeGoogleJob,
  normalizeFreeYcJob,
  normalizeInternshipJob,
  normalizeIndeedJob,
  normalizeFreelancerJob,
  JobSearchService,
  JobProviderRegistry,
  JobProvider,
  MergedJobRecord,
} from "../src/lib/job-providers";
import { NormalizedJob } from "../src/lib/ingestion/types";


describe("Job Providers Framework Unit Tests", () => {
  // --------------------------------------------------------------------------
  // 1. URL Canonicalization
  // --------------------------------------------------------------------------
  describe("URL Canonicalizer", () => {
    it("strips marketing & tracking parameters while keeping essential query tokens", () => {
      const dirtyUrl =
        "https://jobs.example.com/view/12345?utm_source=google&utm_medium=cpc&utm_campaign=hiring_2026&fbclid=IwAR123&ref=linkedin&job_id=9876&category=engineering/";
      const cleaned = canonicalizeJobUrl(dirtyUrl);

      expect(cleaned).toContain("https://jobs.example.com/view/12345");
      expect(cleaned).toContain("category=engineering");
      expect(cleaned).toContain("job_id=9876");
      expect(cleaned).not.toContain("utm_source");
      expect(cleaned).not.toContain("utm_campaign");
      expect(cleaned).not.toContain("fbclid");
      expect(cleaned).not.toContain("ref=");
    });

    it("normalizes hostname case, trims trailing slashes, and strips fragments", () => {
      const url = "HTTPS://WWW.Google.COM/about/careers/role123/#apply";
      const cleaned = canonicalizeJobUrl(url);
      expect(cleaned).toBe("https://www.google.com/about/careers/role123");
    });

    it("rejects non-http / invalid URLs", () => {
      expect(canonicalizeJobUrl("javascript:alert(1)")).toBeNull();
      expect(canonicalizeJobUrl("data:text/html,abc")).toBeNull();
      expect(canonicalizeJobUrl("not a url")).toBeNull();
      expect(canonicalizeJobUrl(null)).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // 2. Normalization & Fingerprinting
  // --------------------------------------------------------------------------
  describe("Semantic Normalization & Fingerprinting", () => {
    it("normalizes company names by stripping corporate suffixes and punctuation", () => {
      expect(normalizeCompanyName("Google, Inc.")).toBe("google");
      expect(normalizeCompanyName("Stripe Inc")).toBe("stripe");
      expect(normalizeCompanyName("Razorpay Pvt. Ltd.")).toBe("razorpay");
      expect(normalizeCompanyName("OpenAI, LLC")).toBe("openai");
    });

    it("normalizes job titles by removing fluff keywords and bracketed tags", () => {
      expect(normalizeJobTitle("[Remote] Senior Software Engineer (Full Time)")).toBe("senior software engineer");
      expect(normalizeJobTitle("Staff Backend Developer - Remote / Urgent")).toBe("staff backend developer");
    });

    it("normalizes locations and handles common city aliases", () => {
      expect(normalizeJobLocation("Bangalore, Karnataka")).toBe("bengaluru karnataka");
      expect(normalizeJobLocation("Bengaluru, India")).toBe("bengaluru india");
      expect(normalizeJobLocation("SF, CA")).toBe("san francisco ca");
      expect(normalizeJobLocation("New York, NY")).toBe("new york");
    });

    it("generates identical semantic fingerprints for equivalent job postings", () => {
      const job1: Partial<NormalizedJob> = {
        company_name: "Google, Inc.",
        title: "Senior Software Engineer (Remote)",
        location: "Bangalore, India",
      };
      const job2: Partial<NormalizedJob> = {
        company_name: "Google LLC",
        title: "[Hiring] Senior Software Engineer",
        location: "Bengaluru, India",
      };
      expect(computeSemanticFingerprint(job1)).toBe(computeSemanticFingerprint(job2));
    });
  });

  // --------------------------------------------------------------------------
  // 3. Multi-Level Deduplication & Result Merging
  // --------------------------------------------------------------------------
  describe("Deduplicator & Result Merger", () => {
    it("deduplicates identical jobs from multiple providers and merges best information", () => {
      const jobFromJSearch: NormalizedJob = {
        source: "jsearch",
        source_job_id: "js-101",
        company_name: "Stripe",
        company_logo: "/platforms/stripe.png",
        title: "Senior Full Stack Engineer",
        description: "Short desc from JSearch",
        description_html: "<p>Short desc</p>",
        location: "San Francisco, CA",
        job_url: "https://stripe.com/jobs/101?utm_source=jsearch",
        apply_url: "https://stripe.com/jobs/101/apply",
        salary_min: 160000,
        salary_max: 220000,
        salary_currency: "USD",
        salary_interval: "yearly",
        posted_at: "2026-08-20T10:00:00.000Z",
      };

      const jobFromActiveJobs: NormalizedJob = {
        source: "active-jobs-db",
        source_job_id: "aj-999",
        company_name: "Stripe, Inc.",
        title: "Senior Full Stack Engineer (Remote)",
        description: "Much more comprehensive description with requirements, responsibilities, and benefits details.",
        description_html: "<p>Much more comprehensive description...</p>",
        location: "San Francisco, CA",
        job_url: "https://stripe.com/jobs/101",
        apply_url: "https://stripe.com/jobs/101/apply",
        posted_at: "2026-08-19T09:00:00.000Z",
      };

      const { mergedJobs, duplicatesCount } = deduplicateJobs([jobFromJSearch, jobFromActiveJobs]);

      expect(mergedJobs).toHaveLength(1);
      expect(duplicatesCount).toBe(1);

      const merged = mergedJobs[0];
      // Attributions
      expect(merged.matched_sources).toContain("jsearch");
      expect(merged.matched_sources).toContain("active-jobs-db");
      // Picked richer description
      expect(merged.description).toContain("Much more comprehensive description");
      // Preserved salary from JSearch
      expect(merged.salary_min).toBe(160000);
      expect(merged.salary_max).toBe(220000);
      // Preserved earlier posted date
      expect(merged.posted_at).toBe("2026-08-19T09:00:00.000Z");
    });
  });

  // --------------------------------------------------------------------------
  // 4. Deterministic Ranking
  // --------------------------------------------------------------------------
  describe("Deterministic Job Ranker", () => {
    it("ranks exact keyword and location matches higher than distant or partial matches", () => {
      const jobA: MergedJobRecord = {
        source: "jsearch",
        source_job_id: "1",
        company_name: "Tech Corp",
        title: "Staff Python Engineer",
        description: "Python backend services with FastAPI and PostgreSQL in Bangalore",
        location: "Bengaluru, India",
        job_url: "https://example.com/1",
        apply_url: "https://example.com/1",
        posted_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        salary_min: 150000,
        salary_max: 200000,
      };

      const jobB: MergedJobRecord = {
        source: "adzuna",
        source_job_id: "2",
        company_name: "Other Corp",
        title: "Frontend React Developer",
        description: "React and UI development",
        location: "London, UK",
        job_url: "https://example.com/2",
        apply_url: "https://example.com/2",
        posted_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
      };

      const ranked = rankJobs([jobB, jobA], { query: "Python Engineer", location: "Bengaluru" });
      expect(ranked[0].source_job_id).toBe("1");
      expect(ranked[0].relevance_score).toBeGreaterThan(ranked[1].relevance_score || 0);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Individual Provider Normalizers
  // --------------------------------------------------------------------------
  describe("Provider Normalization Adapters", () => {
    it("normalizes JSearch jobs", () => {
      const raw = {
        job_id: "js-test-1",
        job_title: "Cloud Architect",
        employer_name: "AWS Partner",
        job_apply_link: "https://example.com/apply/1",
        job_city: "Seattle",
        job_state: "WA",
        job_country: "US",
        job_is_remote: true,
        job_min_salary: 180000,
        job_max_salary: 240000,
        job_salary_currency: "USD",
        job_salary_period: "YEAR",
        job_posted_at_datetime_utc: "2026-08-25T12:00:00.000Z",
      };
      const norm = normalizeJSearchJob(raw);
      expect(norm).not.toBeNull();
      expect(norm!.source).toBe("jsearch");
      expect(norm!.salary_min).toBe(180000);
      expect(norm!.remote_type).toBe("remote");
    });

    it("normalizes ActiveJobsDB jobs", () => {
      const raw = {
        id: "aj-test-1",
        title: "Data Platform Engineer",
        organization: "Databricks",
        url: "https://databricks.com/job/1",
        locations_derived: ["San Francisco, CA, US"],
        remote_derived: true,
        date_posted: "2026-08-25T00:00:00Z",
      };
      const norm = normalizeActiveJobsDbJob(raw);
      expect(norm).not.toBeNull();
      expect(norm!.company_name).toBe("Databricks");
      expect(norm!.remote_type).toBe("remote");
    });

    it("normalizes JobPostingFeed jobs", () => {
      const raw = {
        id: "jpf-1",
        title: "DevOps Specialist",
        organization: "CloudCo",
        url: "https://cloudco.com/jobs/1",
        locations_derived: ["Austin, Texas, United States"],
        ai_salary_min_value: 130000,
        ai_salary_max_value: 170000,
        ai_salary_currency: "USD",
        ai_work_arrangement: "remote",
        date_posted: "2026-08-24T12:00:00Z",
      };
      const norm = normalizeJobPostingFeedJob(raw);
      expect(norm).not.toBeNull();
      expect(norm!.salary_min).toBe(130000);
      expect(norm!.remote_type).toBe("remote");
    });

    it("normalizes LinkedIn Jobs", () => {
      const raw = {
        id: "li-1",
        title: "Machine Learning Researcher",
        organization: "DeepMind",
        url: "https://linkedin.com/jobs/view/123",
        locations_derived: ["London, UK"],
        date_posted: "2026-08-25T08:00:00Z",
      };
      const norm = normalizeLinkedInJob(raw);
      expect(norm).not.toBeNull();
      expect(norm!.company_name).toBe("DeepMind");
    });

    it("normalizes Jobicy jobs", () => {
      const raw = {
        id: 9988,
        jobTitle: "Senior Frontend Engineer",
        companyName: "RemoteFirst",
        url: "https://jobicy.com/jobs/9988",
        jobGeo: "Worldwide",
        salaryMin: 120000,
        salaryMax: 150000,
        salaryCurrency: "USD",
        salaryPeriod: "annual",
        pubDate: "2026-08-25T00:00:00Z",
      };
      const norm = normalizeJobicyJob(raw);
      expect(norm).not.toBeNull();
      expect(norm!.remote_type).toBe("remote");
      expect(norm!.salary_interval).toBe("yearly");
    });

    it("normalizes Workday jobs", () => {
      const raw = {
        id: "wd-1",
        title: "Enterprise Solutions Architect",
        organization: "Salesforce",
        url: "https://salesforce.wd1.myworkdayjobs.com/job/1",
        locations_derived: ["Chicago, IL, US"],
        date_posted: "2026-08-25T00:00:00Z",
      };
      const norm = normalizeWorkdayJob(raw);
      expect(norm).not.toBeNull();
      expect(norm!.company_name).toBe("Salesforce");
    });

    it("normalizes Google Jobs, Free YC Jobs, Internships, Indeed, and Freelancer", () => {
      const gj = normalizeGoogleJob({ title: "Site Reliability Engineer", company: "Meta", link: "https://meta.com/job/1" }, 0);
      expect(gj).not.toBeNull();
      expect(gj!.company_name).toBe("Meta");

      const ycj = normalizeFreeYcJob({ id: "yc-1", title: "Founding Engineer", organization: "SupaStartup", url: "https://ycombinator.com/job/1" });
      expect(ycj).not.toBeNull();
      expect(ycj!.company_name).toBe("SupaStartup");

      const ij = normalizeInternshipJob({ id: "intern-1", title: "Software Engineer Intern", organization: "Apple", url: "https://apple.com/jobs/1" });
      expect(ij).not.toBeNull();
      expect(ij!.employment_type).toBe("internship");

      const ind = normalizeIndeedJob({ id: "ind-1", title: "Java Developer", company: "Oracle", url: "https://oracle.com/jobs/1" });
      expect(ind).not.toBeNull();

      const fl = normalizeFreelancerJob({ id: "fl-1", title: "Build Next.js Dashboard", budgetMin: 500, budgetMax: 1000, currency: "USD", url: "https://freelancer.com/projects/1" });
      expect(fl).not.toBeNull();
      expect(fl!.employment_type).toBe("contract");
    });
  });

  // --------------------------------------------------------------------------
  // 6. Circuit Breaker State Transitions
  // --------------------------------------------------------------------------
  describe("Circuit Breaker Protection", () => {
    it("transitions from CLOSED to OPEN after consecutive failures and enters HALF_OPEN on cooldown", () => {
      const cb = new CircuitBreaker({ failureThreshold: 3, cooldownMs: 50 });
      const pId = "test-provider";

      expect(cb.canExecute(pId)).toBe(true);

      // Record 3 failures
      cb.recordFailure(pId, { message: "Error 1" });
      cb.recordFailure(pId, { message: "Error 2" });
      expect(cb.canExecute(pId)).toBe(true);

      cb.recordFailure(pId, { message: "Error 3" });

      // Circuit should now be OPEN
      expect(cb.canExecute(pId)).toBe(false);
      const healthOpen = cb.getHealth(pId);
      expect(healthOpen.circuitState).toBe("OPEN");
      expect(healthOpen.status).toBe("down");

      // Wait for cooldown
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          // After cooldown, should allow a trial probe (HALF_OPEN)
          expect(cb.canExecute(pId)).toBe(true);
          const healthHalf = cb.getHealth(pId);
          expect(healthHalf.circuitState).toBe("HALF_OPEN");

          // Successful probe closes the circuit
          cb.recordSuccess(pId, 100);
          expect(cb.canExecute(pId)).toBe(true);
          const healthClosed = cb.getHealth(pId);
          expect(healthClosed.circuitState).toBe("CLOSED");
          expect(healthClosed.status).toBe("healthy");
          resolve();
        }, 60);
      });
    });

    it("trips immediately on 429 rate limit error with configured retry-after cooldown", () => {
      const cb = new CircuitBreaker();
      const pId = "rate-limited-provider";

      cb.recordFailure(pId, { is429: true, retryAfterMs: 5000, message: "Too many requests" });
      expect(cb.canExecute(pId)).toBe(false);
      const health = cb.getHealth(pId);
      expect(health.circuitState).toBe("OPEN");
      expect(health.status).toBe("down");
    });
  });

  // --------------------------------------------------------------------------
  // 7. Search Service Fallback & Aggregation
  // --------------------------------------------------------------------------
  describe("JobSearchService Fallback Engine", () => {
    let mockRegistry: JobProviderRegistry;
    let searchService: JobSearchService;

    const dummyJob = (source: NormalizedJob["source"], id: string, title: string): NormalizedJob => ({
      source,
      source_job_id: id,
      company_name: "Acme",
      title,
      job_url: `https://example.com/${source}/${id}`,
      apply_url: `https://example.com/${source}/${id}`,
      posted_at: "2026-08-25T00:00:00Z",
    });


    beforeEach(() => {
      mockRegistry = new JobProviderRegistry();
      // Remove defaults for controlled test
      for (const p of mockRegistry.getAll()) {
        mockRegistry.setEnabled(p.id, false);
      }
      searchService = new JobSearchService(mockRegistry);
    });

    it("automatically falls back to Provider B when Provider A fails with timeout/error", async () => {
      const providerA: JobProvider = {
        id: "mock-a",
        name: "Mock A",
        priority: 1,
        enabled: true,
        timeoutMs: 1000,
        maxRetries: 0,
        supports: () => true,
        search: vi.fn().mockResolvedValue({
          providerId: "mock-a",
          providerName: "Mock A",
          jobs: [],
          latencyMs: 100,
          status: "timeout",
          errorMessage: "Timed out",
        }),
      };

      const providerB: JobProvider = {
        id: "mock-b",
        name: "Mock B",
        priority: 2,
        enabled: true,
        timeoutMs: 1000,
        maxRetries: 0,
        supports: () => true,
        search: vi.fn().mockResolvedValue({
          providerId: "mock-b",
          providerName: "Mock B",
          jobs: [dummyJob("mock-b", "b1", "Senior Engineer")],
          total: 1,
          latencyMs: 150,
          status: "success",
        }),
      };

      mockRegistry.register(providerA);
      mockRegistry.register(providerB);

      const response = await searchService.search({ query: "developer", mode: "sequential", persist: false });

      expect(response.jobs).toHaveLength(1);
      expect(response.jobs[0].source_job_id).toBe("b1");
      expect(response.sources["mock-a"].status).toBe("timeout");
      expect(response.sources["mock-b"].status).toBe("success");
      expect(providerA.search).toHaveBeenCalled();
      expect(providerB.search).toHaveBeenCalled();
    });

    it("supplements results from next provider when primary provider returns insufficient results", async () => {
      const providerA: JobProvider = {
        id: "mock-a",
        name: "Mock A",
        priority: 1,
        enabled: true,
        timeoutMs: 1000,
        maxRetries: 0,
        minResultsThreshold: 5,
        supports: () => true,
        search: vi.fn().mockResolvedValue({
          providerId: "mock-a",
          providerName: "Mock A",
          jobs: [dummyJob("mock-a", "a1", "Engineer 1"), dummyJob("mock-a", "a2", "Engineer 2")], // Only 2 returned (< 5 threshold)
          total: 2,
          latencyMs: 100,
          status: "success",
        }),
      };

      const providerB: JobProvider = {
        id: "mock-b",
        name: "Mock B",
        priority: 2,
        enabled: true,
        timeoutMs: 1000,
        maxRetries: 0,
        supports: () => true,
        search: vi.fn().mockResolvedValue({
          providerId: "mock-b",
          providerName: "Mock B",
          jobs: [dummyJob("mock-b", "b1", "Engineer 3"), dummyJob("mock-b", "b2", "Engineer 4")],
          total: 2,
          latencyMs: 120,
          status: "success",
        }),
      };

      mockRegistry.register(providerA);
      mockRegistry.register(providerB);

      const response = await searchService.search({ query: "developer", limit: 10, mode: "sequential", persist: false });

      expect(response.jobs).toHaveLength(4);
      expect(providerA.search).toHaveBeenCalled();
      expect(providerB.search).toHaveBeenCalled();
    });

    it("runs parallel aggregation across all providers and merges their outputs", async () => {
      const providerA: JobProvider = {
        id: "mock-a",
        name: "Mock A",
        priority: 1,
        enabled: true,
        timeoutMs: 1000,
        maxRetries: 0,
        supports: () => true,
        search: vi.fn().mockResolvedValue({
          providerId: "mock-a",
          providerName: "Mock A",
          jobs: [dummyJob("mock-a", "a1", "React Developer")],
          total: 1,
          latencyMs: 50,
          status: "success",
        }),
      };

      const providerB: JobProvider = {
        id: "mock-b",
        name: "Mock B",
        priority: 2,
        enabled: true,
        timeoutMs: 1000,
        maxRetries: 0,
        supports: () => true,
        search: vi.fn().mockResolvedValue({
          providerId: "mock-b",
          providerName: "Mock B",
          jobs: [dummyJob("mock-b", "b1", "Vue Developer")],
          total: 1,
          latencyMs: 60,
          status: "success",
        }),
      };

      mockRegistry.register(providerA);
      mockRegistry.register(providerB);

      const response = await searchService.search({ query: "developer", mode: "parallel", persist: false });

      expect(response.jobs).toHaveLength(2);
      expect(response.stats.mode).toBe("parallel");
      expect(response.sources["mock-a"].returned).toBe(1);
      expect(response.sources["mock-b"].returned).toBe(1);
    });

    it("handles total failure gracefully without throwing unhandled exceptions", async () => {
      const failingProvider: JobProvider = {
        id: "mock-fail",
        name: "Mock Fail",
        priority: 1,
        enabled: true,
        timeoutMs: 1000,
        maxRetries: 0,
        supports: () => true,
        search: vi.fn().mockRejectedValue(new Error("Fatal API Down")),
      };

      mockRegistry.register(failingProvider);

      const response = await searchService.search({ query: "developer", mode: "sequential", persist: false });
      expect(response.jobs).toEqual([]);
      expect(response.pagination.total).toBe(0);
    });
  });
});
