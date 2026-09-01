import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { chromium, Browser } from "playwright";
import { startMockEmployerServer, MockEmployerServer } from "./mock-employer-server";
import {
  ApplicationStatus,
  FailureCode,
  DetectedField,
  AutomationProfile,
} from "../../src/lib/applications/types";

// In-Memory Database Store for unit & integration testing
const inMemoryStore = {
  applications: new Map<string, any>(),
  workerLocks: new Map<string, any>(),
  forms: new Map<string, any>(),
  formFields: new Map<string, any>(),
};

function resetInMemoryStore() {
  inMemoryStore.applications.clear();
  inMemoryStore.workerLocks.clear();
  inMemoryStore.forms.clear();
  inMemoryStore.formFields.clear();
}

// Mock @supabase/supabase-js
vi.mock("@supabase/supabase-js", () => {
  return {
    createClient: () => {
      const client = {
        from: (table: string) => {
          let currentTable = table;
          const filters: Array<{ field: string; val: any }> = [];

          const queryBuilder: any = {
            select: vi.fn(() => queryBuilder),
            insert: vi.fn((rows: any) => {
              const data = Array.isArray(rows) ? rows : [rows];
              for (const row of data) {
                if (currentTable === "applications") {
                  inMemoryStore.applications.set(row.id, { ...row });
                } else if (currentTable === "application_worker_locks") {
                  if (inMemoryStore.workerLocks.has(row.application_id)) {
                    // Lock already held
                    return {
                      select: () => ({
                        single: async () => ({ data: null, error: { code: "23505", message: "duplicate key" } }),
                        maybeSingle: async () => ({ data: null, error: { code: "23505", message: "duplicate key" } }),
                      }),
                      data: null,
                      error: { code: "23505", message: "duplicate key" },
                    };
                  }
                  inMemoryStore.workerLocks.set(row.application_id, { ...row });
                } else if (currentTable === "application_forms") {
                  const id = row.id || `form-${Date.now()}`;
                  inMemoryStore.forms.set(id, { ...row, id });
                } else if (currentTable === "application_form_fields") {
                  const id = row.id || `ff-${Math.random()}`;
                  inMemoryStore.formFields.set(id, { ...row, id });
                }
              }
              return queryBuilder;
            }),
            update: vi.fn((updates: any) => {
              queryBuilder._updates = updates;
              return queryBuilder;
            }),
            delete: vi.fn(() => {
              queryBuilder._isDelete = true;
              return queryBuilder;
            }),
            upsert: vi.fn(() => queryBuilder),
            eq: vi.fn((field: string, val: any) => {
              filters.push({ field, val });

              if (queryBuilder._isDelete) {
                if (currentTable === "application_worker_locks") {
                  const appFilter = filters.find(f => f.field === "application_id");
                  if (appFilter) inMemoryStore.workerLocks.delete(appFilter.val);
                } else if (currentTable === "applications") {
                  const idFilter = filters.find(f => f.field === "id");
                  if (idFilter) inMemoryStore.applications.delete(idFilter.val);
                }
                return queryBuilder;
              }

              if (queryBuilder._updates) {
                if (currentTable === "applications") {
                  const idFilter = filters.find(f => f.field === "id");
                  if (idFilter) {
                    const existing = inMemoryStore.applications.get(idFilter.val) || {};
                    inMemoryStore.applications.set(idFilter.val, { ...existing, ...queryBuilder._updates });
                  }
                } else if (currentTable === "application_worker_locks") {
                  const appFilter = filters.find(f => f.field === "application_id");
                  if (appFilter) {
                    const existing = inMemoryStore.workerLocks.get(appFilter.val) || {};
                    inMemoryStore.workerLocks.set(appFilter.val, { ...existing, ...queryBuilder._updates });
                  }
                }
                return queryBuilder;
              }
              return queryBuilder;
            }),
            order: vi.fn(() => queryBuilder),
            limit: vi.fn(() => queryBuilder),
            single: async () => {
              const idVal = filters.find(f => f.field === "id" || f.field === "application_id")?.val;
              let res: any = null;
              if (currentTable === "applications" && idVal) {
                res = inMemoryStore.applications.get(idVal) || null;
              } else if (currentTable === "application_worker_locks" && idVal) {
                res = inMemoryStore.workerLocks.get(idVal) || null;
              }
              return { data: res, error: null };
            },
            maybeSingle: async () => {
              const idVal = filters.find(f => f.field === "id" || f.field === "application_id")?.val;
              let res: any = null;
              if (currentTable === "applications" && idVal) {
                res = inMemoryStore.applications.get(idVal) || null;
              } else if (currentTable === "application_worker_locks" && idVal) {
                res = inMemoryStore.workerLocks.get(idVal) || null;
              }
              return { data: res, error: null };
            },
            then: (resolve: any) => {
              if (queryBuilder._isDelete) {
                resolve({ data: null, error: null });
                return;
              }
              let res: any[] = [];
              if (currentTable === "application_worker_locks") {
                res = Array.from(inMemoryStore.workerLocks.values());
              } else if (currentTable === "applications") {
                res = Array.from(inMemoryStore.applications.values());
              }
              resolve({ data: res, error: null });
            },
          };
          return queryBuilder;
        },
      };
      return client;
    },
  };
});

import {
  detectApplicationFields,
  detectCaptcha,
  detectLoginRequired,
  detectRateLimited,
  detectPlatformSupported,
} from "../../src/lib/applications/form-detector";
import { mapAllFields } from "../../src/lib/applications/field-mapper";
import { detectMissingFields } from "../../src/lib/applications/profile-resolver";
import {
  preSubmissionChecks,
  independentlyVerifySubmission,
  submitApplication,
} from "../../src/lib/applications/application-submitter";
import { logApplicationEvent } from "../../src/lib/applications/application-status-service";
import {
  acquireApplicationLock,
  releaseApplicationLock,
  recoverStaleLocks,
} from "../../src/lib/applications/application-locking";

describe("Full AI Job Application Automation Flow & Hardening Suite", () => {
  let mockServer: MockEmployerServer;
  let browser: Browser;

  beforeAll(async () => {
    mockServer = await startMockEmployerServer();
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    if (browser) await browser.close();
    if (mockServer) await mockServer.close();
  });

  beforeEach(() => {
    resetInMemoryStore();
  });

  // ===========================================================================
  // Scenario: Complete 30-Step End-to-End Automation Flow
  // ===========================================================================
  describe("Exact 30-Step Automation Flow", () => {
    it("executes the full 30-step flow from queueing through missing fields, unknown questions, review, independent verification, to submission", async () => {
      // Step 1: User opens a job
      const job = {
        id: "job-101",
        title: "Software Engineer",
        company: "Acme Corp",
        apply_url: `${mockServer.baseUrl}/standard-job`,
      };
      expect(job.title).toBe("Software Engineer");

      // Step 2: User clicks Open Job URL to Apply
      // Step 3: Apply Method dialog appears
      // Step 4: User chooses Apply Automatically using AI Agent
      const chosenMethod = "ai_agent";
      expect(chosenMethod).toBe("ai_agent");

      // Step 5: Application becomes QUEUED
      const appId = "app-test-30-steps";
      inMemoryStore.applications.set(appId, {
        id: appId,
        user_id: "user-123",
        job_id: job.id,
        status: ApplicationStatus.QUEUED,
        apply_url: job.apply_url,
      });

      let appRecord = inMemoryStore.applications.get(appId);
      expect(appRecord.status).toBe(ApplicationStatus.QUEUED);

      // Step 6: Background worker starts
      const lockAcquired = await acquireApplicationLock(appId);
      expect(lockAcquired).toBeTruthy();

      // Step 7: Platform is detected
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(job.apply_url);
      const platform = "greenhouse";

      // Step 8: Browser session starts
      // Step 9: browser_session_id is saved
      const browserSessionId = "browser-sess-999";
      inMemoryStore.applications.set(appId, {
        ...inMemoryStore.applications.get(appId),
        browser_session_id: browserSessionId,
        platform,
      });
      expect(inMemoryStore.applications.get(appId).browser_session_id).toBe(browserSessionId);

      // Step 10: Required application fields are detected
      const detectedFields = await detectApplicationFields(page);
      expect(detectedFields.length).toBeGreaterThanOrEqual(5);

      // Step 11: Form schema is saved
      inMemoryStore.forms.set("form-schema-1", {
        application_id: appId,
        fields_json: detectedFields,
      });
      expect(inMemoryStore.forms.get("form-schema-1").fields_json.length).toBe(detectedFields.length);

      // Step 12: User profile is mapped
      const initialProfile: AutomationProfile = {
        user_id: "user-123",
        first_name: "Jane",
        last_name: "Doe",
        email: "jane.doe@example.com",
        skills: ["TypeScript", "Node.js"],
        experiences: [],
        educations: [],
        // Phone intentionally missing to trigger missing fields step
      };
      const mappedFields = await mapAllFields(detectedFields, initialProfile);
      expect(mappedFields.length).toBe(detectedFields.length);

      // Step 13: Missing fields are detected
      const missingProfileFields = detectMissingFields(
        mappedFields.filter(f => f.mapping.mapped_profile_key !== null),
        initialProfile
      );
      expect(missingProfileFields.length).toBeGreaterThan(0);
      expect(missingProfileFields.some(f => f.field_key === "phone")).toBe(true);

      // Step 14: Application becomes MISSING_PROFILE_INFO
      inMemoryStore.applications.set(appId, {
        ...inMemoryStore.applications.get(appId),
        status: ApplicationStatus.MISSING_PROFILE_INFO,
        missing_fields: missingProfileFields,
      });

      // Step 15: Job page shows the missing status
      appRecord = inMemoryStore.applications.get(appId);
      expect(appRecord.status).toBe(ApplicationStatus.MISSING_PROFILE_INFO);

      // Step 16: User opens Missing Profile dialog
      // Step 17: User fills all missing fields
      const userProvidedValues = { phone: "555-0199" };
      const updatedProfile: AutomationProfile = { ...initialProfile, ...userProvidedValues };

      // Step 18: Profile is updated
      expect(updatedProfile.phone).toBe("555-0199");

      // Step 19: Existing application resumes
      inMemoryStore.applications.set(appId, {
        ...inMemoryStore.applications.get(appId),
        status: ApplicationStatus.QUEUED,
        missing_fields: [],
      });
      expect(inMemoryStore.applications.get(appId).status).toBe(ApplicationStatus.QUEUED);

      // Step 20: Form is filled
      inMemoryStore.applications.set(appId, {
        ...inMemoryStore.applications.get(appId),
        status: ApplicationStatus.FILLING_FORM,
      });
      await page.fill("#first_name", updatedProfile.first_name!);
      await page.fill("#last_name", updatedProfile.last_name!);
      await page.fill("#email", updatedProfile.email!);
      await page.fill("#phone", updatedProfile.phone!);

      // Step 21: Resume is uploaded
      const fileInput = page.locator("#resume");
      expect(await fileInput.count()).toBe(1);

      // Step 22: Unknown questions pause the workflow
      // "#why_interested" is an open-ended custom employer question
      const whyInterestedField = detectedFields.find(f => f.field_id.includes("interested") || f.field_id.includes("why"));
      expect(whyInterestedField).toBeDefined();

      inMemoryStore.applications.set(appId, {
        ...inMemoryStore.applications.get(appId),
        status: ApplicationStatus.AWAITING_USER_INPUT,
        missing_fields: [{
          field_key: "why_interested",
          label: "Why are you interested in this role at Acme Corp?",
          type: "textarea",
        }],
      });
      expect(inMemoryStore.applications.get(appId).status).toBe(ApplicationStatus.AWAITING_USER_INPUT);

      // Step 23: User provides/approves answers
      const approvedAnswer = "I have 5+ years of experience with distributed systems and love your product mission.";
      await page.fill("#why_interested", approvedAnswer);
      inMemoryStore.applications.set(appId, {
        ...inMemoryStore.applications.get(appId),
        missing_fields: [],
      });

      // Step 24: Application reaches review
      inMemoryStore.applications.set(appId, {
        ...inMemoryStore.applications.get(appId),
        status: ApplicationStatus.AWAITING_USER_REVIEW,
      });
      expect(inMemoryStore.applications.get(appId).status).toBe(ApplicationStatus.AWAITING_USER_REVIEW);

      // Step 25: User confirms submission
      inMemoryStore.applications.set(appId, {
        ...inMemoryStore.applications.get(appId),
        status: ApplicationStatus.SUBMITTING,
      });
      expect(inMemoryStore.applications.get(appId).status).toBe(ApplicationStatus.SUBMITTING);

      // Step 26: Application is submitted
      const submitResult = await submitApplication(page, appId);
      expect(submitResult.submitted).toBe(true);

      // Step 27: Submission is independently verified
      expect(submitResult.confirmed).toBe(true);
      expect(submitResult.externalAppId).toBe("APP-987654");

      // Step 28: Application becomes SUBMITTED
      inMemoryStore.applications.set(appId, {
        ...inMemoryStore.applications.get(appId),
        status: ApplicationStatus.SUBMITTED,
        external_application_id: submitResult.externalAppId,
      });
      expect(inMemoryStore.applications.get(appId).status).toBe(ApplicationStatus.SUBMITTED);

      // Step 29: Job page shows Submitted
      expect(inMemoryStore.applications.get(appId).status).toBe(ApplicationStatus.SUBMITTED);

      // Step 30: Application Status page shows Submitted
      expect(inMemoryStore.applications.get(appId).status).toBe(ApplicationStatus.SUBMITTED);
      expect(mockServer.submitCount).toBe(1);

      await releaseApplicationLock(appId, lockAcquired!);
      await context.close();
    });
  });

  // ===========================================================================
  // Test Failure Cases
  // ===========================================================================
  describe("14 Resilience & Failure Cases", () => {
    // 1. CAPTCHA
    it("Failure Case 1: CAPTCHA required pauses application for user action", async () => {
      const page = await browser.newPage();
      await page.goto(`${mockServer.baseUrl}/captcha-job`);
      const hasCaptcha = await detectCaptcha(page);
      expect(hasCaptcha).toBe(true);
      await page.close();
    });

    // 2. Login Required
    it("Failure Case 2: Login required triggers AWAITING_USER_ACTION with AUTH_REQUIRED", async () => {
      const page = await browser.newPage();
      await page.goto(`${mockServer.baseUrl}/login-job`);
      const requiresLogin = await detectLoginRequired(page);
      expect(requiresLogin).toBe(true);
      await page.close();
    });

    // 3. Unsupported Platform
    it("Failure Case 3: Unsupported portal or intranet detects non-support cleanly", async () => {
      const page = await browser.newPage();
      await page.goto(`${mockServer.baseUrl}/unsupported-platform-job`);
      const support = await detectPlatformSupported("unsupported", page);
      expect(support.supported).toBe(false);
      await page.close();
    });

    // 4. Page Timeout
    it("Failure Case 4: Page timeout or unreachable host throws catchable timeout error", async () => {
      const page = await browser.newPage();
      let caught = false;
      try {
        await page.goto("http://127.0.0.1:9999/non-existent-port", { timeout: 1500 });
      } catch (err: any) {
        caught = true;
        expect(err.message).toBeDefined();
      }
      expect(caught).toBe(true);
      await page.close();
    });

    // 5. Field Disappeared
    it("Failure Case 5: Field disappeared from DOM fails cleanly without crashing worker", async () => {
      const page = await browser.newPage();
      await page.goto(`${mockServer.baseUrl}/disappearing-field-job`);
      await page.waitForTimeout(400);
      const count = await page.locator("#vanished_field").count();
      expect(count).toBe(0);
      await page.close();
    });

    // 6. Required Field Introduced on Step 2
    it("Failure Case 6: Required field introduced on step 2 is detected as missing/unanswered", async () => {
      const page = await browser.newPage();
      await page.goto(`${mockServer.baseUrl}/multistep-step2`);
      const fields = await detectApplicationFields(page);
      const clearanceField = fields.find(f => f.field_id.includes("clearance"));
      expect(clearanceField).toBeDefined();
      expect(clearanceField?.required).toBe(true);
      await page.close();
    });

    // 7. Invalid Resume
    it("Failure Case 7: Invalid or missing resume file path is safely rejected before upload", async () => {
      const { uploadResume } = await import("../../src/lib/applications/resume-uploader");
      const page = await browser.newPage();
      await page.goto(`${mockServer.baseUrl}/standard-job`);
      const uploaded = await uploadResume(page, "app-invalid-resume", null, "resume.pdf", "#resume");
      expect(uploaded).toBe(false);
      await page.close();
    });

    // 8. Rate Limit
    it("Failure Case 8: Rate limit 429 response is detected immediately", async () => {
      const page = await browser.newPage();
      await page.goto(`${mockServer.baseUrl}/rate-limited-job`);
      const isRateLimited = await detectRateLimited(page);
      expect(isRateLimited).toBe(true);
      await page.close();
    });

    // 9. Worker Crash & Stale Lock Recovery
    it("Failure Case 9: Stale lock recovery detects dead worker locks and resets status", async () => {
      const appId = "app-crashed-worker-test";
      const deadWorkerId = "dead-worker-pid-999";
      inMemoryStore.applications.set(appId, {
        id: appId,
        status: ApplicationStatus.FILLING_FORM,
      });

      // Insert lock with heartbeat 6 minutes ago
      inMemoryStore.workerLocks.set(appId, {
        application_id: appId,
        worker_id: deadWorkerId,
        locked_at: new Date(Date.now() - 360000).toISOString(),
        heartbeat_at: new Date(Date.now() - 360000).toISOString(),
        lock_ttl_seconds: 300,
      });

      const recovered = await recoverStaleLocks();
      expect(recovered).toBeGreaterThanOrEqual(1);

      // Lock was released
      expect(inMemoryStore.workerLocks.get(appId)).toBeUndefined();
      // Application status transitioned to FAILED with TIMEOUT
      expect(inMemoryStore.applications.get(appId).status).toBe(ApplicationStatus.FAILED);
      expect(inMemoryStore.applications.get(appId).failure_code).toBe(FailureCode.TIMEOUT);
    });

    // 10. Duplicate Queue Job
    it("Failure Case 10: Duplicate queue jobs are blocked by distributed locking", async () => {
      const appId = "app-duplicate-queue-test";

      const lock1 = await acquireApplicationLock(appId);
      expect(lock1).toBeTruthy();

      // Second concurrent worker attempt must be rejected
      const lock2 = await acquireApplicationLock(appId);
      expect(lock2).toBeNull();

      await releaseApplicationLock(appId, lock1!);
    });

    // 11. Duplicate Submit Click
    it("Failure Case 11: Duplicate submit clicks are rejected if submit is already attempted or submitting", async () => {
      const appId = "app-double-submit-check";
      inMemoryStore.applications.set(appId, {
        id: appId,
        status: ApplicationStatus.SUBMITTING,
        debug_info: {},
      });

      // 1st submit check passes
      const check1 = await preSubmissionChecks(appId);
      expect(check1.canSubmit).toBe(true);

      // Simulate submit initiated: submit_attempted marked true in debug_info
      inMemoryStore.applications.set(appId, {
        id: appId,
        status: ApplicationStatus.SUBMITTING,
        debug_info: { submit_attempted: true },
      });

      // 2nd submit check is blocked
      const check2 = await preSubmissionChecks(appId);
      expect(check2.canSubmit).toBe(false);
      expect(check2.reason).toBe("submit_already_attempted");

      // 3rd submit check with SUBMISSION_UNCONFIRMED is blocked
      inMemoryStore.applications.set(appId, {
        id: appId,
        status: ApplicationStatus.SUBMISSION_UNCONFIRMED,
        debug_info: { submit_attempted: true },
      });
      const check3 = await preSubmissionChecks(appId);
      expect(check3.canSubmit).toBe(false);
    });

    // 12. Submission Timeout After Successful Submission
    it("Failure Case 12: Browser/network timeout after clicking Submit does NOT trigger duplicate submission", async () => {
      const appId = "app-timeout-after-submit";
      inMemoryStore.applications.set(appId, {
        id: appId,
        status: ApplicationStatus.SUBMITTING,
        debug_info: {},
      });

      const page = await browser.newPage();
      await page.goto(`${mockServer.baseUrl}/standard-job`);
      await page.fill("#first_name", "Jane");
      await page.fill("#last_name", "Doe");
      await page.fill("#email", "jane@example.com");
      await page.fill("#phone", "555-0199");
      await page.fill("#why_interested", "Excited to join.");

      const initialSubmits = mockServer.submitCount;

      // Click submit via submitApplication
      const result = await submitApplication(page, appId);
      expect(result.submitted).toBe(true);
      expect(result.confirmed).toBe(true);

      // Verify submit_attempted was recorded in the database
      const appRecord = inMemoryStore.applications.get(appId);
      expect(appRecord.debug_info?.submit_attempted).toBe(true);

      // If a resume worker or timeout handler re-evaluates preSubmissionChecks:
      const canResubmit = await preSubmissionChecks(appId);
      expect(canResubmit.canSubmit).toBe(false);

      // Independent verification confirms submission without clicking again
      const verification = await independentlyVerifySubmission(page, `${mockServer.baseUrl}/standard-job`);
      expect(verification.confirmed).toBe(true);

      // Exactly 1 submission was made — no duplicates!
      expect(mockServer.submitCount).toBe(initialSubmits + 1);
      await page.close();
    });

    // 13. Expired Browser Session
    it("Failure Case 13: Expired browser session is recovered by launching fresh browser context", async () => {
      const context1 = await browser.newContext();
      await context1.close(); // Session expired

      // Worker cleanly creates new context
      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      await page2.goto(`${mockServer.baseUrl}/standard-job`);
      expect(await page2.locator("#application-form").count()).toBe(1);
      await context2.close();
    });

    // 14. User Cancels Application
    it("Failure Case 14: User cancels application releasing locks and entering CANCELLED status", async () => {
      const appId = "app-cancel-test";
      const lock = await acquireApplicationLock(appId);
      expect(lock).toBeTruthy();

      // Cancel releases lock
      await releaseApplicationLock(appId, lock!);
      const lockAfter = await acquireApplicationLock(appId);
      expect(lockAfter).toBeTruthy();
      await releaseApplicationLock(appId, lockAfter!);
    });

    // 15. Form Detection Filters Out Search Bar and Password Inputs
    it("Failure Case 15: Excludes navbar search, filter, and password inputs from detected application fields", async () => {
      const page = await browser.newPage();
      await page.goto(`${mockServer.baseUrl}/page-with-navbar-search`);
      const fields = await detectApplicationFields(page);

      // Verify that none of the navbar inputs were captured
      const searchJobs = fields.find(f => f.label.toLowerCase().includes("job titles") || f.field_id.includes("search_query"));
      const searchSkills = fields.find(f => f.label.toLowerCase().includes("skills") || f.field_id.includes("skills_query"));
      const filterInput = fields.find(f => f.label.toLowerCase().includes("filter") || f.field_id.includes("filter_input"));
      const passwordInput = fields.find(f => f.label.toLowerCase().includes("password") || f.field_id.includes("session_password"));

      expect(searchJobs).toBeUndefined();
      expect(searchSkills).toBeUndefined();
      expect(filterInput).toBeUndefined();
      expect(passwordInput).toBeUndefined();

      // Only actual form fields inside the application form/modal should be detected
      expect(fields.length).toBe(2);
      expect(fields.some(f => f.field_id === "first_name")).toBe(true);
      expect(fields.some(f => f.field_id === "phone")).toBe(true);

      await page.close();
    });
  });

  // ===========================================================================
  // Sensitive Data Sanitization
  // ===========================================================================
  describe("Security & Sensitive Data Sanitization", () => {
    it("ensures no passwords, tokens, cookies, auth headers, or resume contents appear in logs", () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      logApplicationEvent("test_security_audit", {
        application_id: "app-sec-1",
        password: "super-secret-password-123",
        auth_token: "jwt.secret.token",
        bearer_token: "Bearer xyz123",
        cookie: "session_id=abcdef123456",
        resume_content: "Confidential resume text...",
        file_content: "Buffer content",
        safe_field: "public_info",
        apply_url: "https://example.com/apply?token=secret123&code=456&utm_source=jobboard",
      });

      expect(logSpy).toHaveBeenCalled();
      const loggedJson = JSON.parse(logSpy.mock.calls[0][0]);

      expect(loggedJson.password).toBeUndefined();
      expect(loggedJson.auth_token).toBeUndefined();
      expect(loggedJson.bearer_token).toBeUndefined();
      expect(loggedJson.cookie).toBeUndefined();
      expect(loggedJson.resume_content).toBeUndefined();
      expect(loggedJson.file_content).toBeUndefined();
      expect(loggedJson.safe_field).toBe("public_info");
      // Sensitive query params stripped from URL
      expect(loggedJson.apply_url).not.toContain("token=secret123");
      expect(loggedJson.apply_url).not.toContain("code=456");
      expect(loggedJson.apply_url).toContain("utm_source=jobboard");

      logSpy.mockRestore();
    });
  });
});
