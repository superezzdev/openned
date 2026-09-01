/**
 * Provider Selection, Error Classification & Fallback Engine Test Suite
 *
 * Tests the complete decision matrix for browser execution providers,
 * fallback eligibility, max fallback attempt ceilings, and double-submission safeguards.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  AutomationProvider,
  AutomationPreference,
  FallbackReason,
} from "../../src/lib/automation/types";
import { selectBrowserProvider } from "../../src/lib/automation/browser-provider-selector";
import {
  classifyAutomationError,
  shouldFallbackToBrowserbase,
} from "../../src/lib/automation/failure-classifier";
import { revalidateFieldSelectors } from "../../src/lib/automation/state-manager";
import { ApplicationStatus, FailureCode } from "../../src/lib/applications/types";


describe("Browser Provider Selection & Fallback Engine", () => {
  describe("1. selectBrowserProvider", () => {
    it("selects LOCAL provider for AUTO preference when fallback is unused", () => {
      const app = {
        id: "app-1",
        automation_preference: AutomationPreference.AUTO,
        fallback_used: false,
      };
      const provider = selectBrowserProvider(app);
      expect(provider.providerType).toBe(AutomationProvider.LOCAL);
    });

    it("selects BROWSERBASE provider when preference is BROWSERBASE_ONLY", () => {
      const app = {
        id: "app-2",
        automation_preference: AutomationPreference.BROWSERBASE_ONLY,
        fallback_used: false,
      };
      const provider = selectBrowserProvider(app);
      expect(provider.providerType).toBe(AutomationProvider.BROWSERBASE);
    });

    it("selects LOCAL provider when preference is LOCAL_ONLY even if fallback_used is set", () => {
      const app = {
        id: "app-3",
        automation_preference: AutomationPreference.LOCAL_ONLY,
        fallback_used: true,
      };
      const provider = selectBrowserProvider(app);
      expect(provider.providerType).toBe(AutomationProvider.LOCAL);
    });

    it("selects BROWSERBASE provider when AUTO preference has fallback_used = true", () => {
      const app = {
        id: "app-4",
        automation_preference: AutomationPreference.AUTO,
        fallback_used: true,
      };
      const provider = selectBrowserProvider(app);
      expect(provider.providerType).toBe(AutomationProvider.BROWSERBASE);
    });
  });

  describe("2. Error Classification", () => {
    it("classifies Playwright browser crash as INFRASTRUCTURE / BROWSER_CRASH", () => {
      const error = new Error("Target page, context or browser has been closed");
      const classified = classifyAutomationError(error);

      expect(classified.category).toBe("INFRASTRUCTURE");
      expect(classified.fallbackEligible).toBe(true);
      expect(classified.fallbackReason).toBe(FallbackReason.BROWSER_CRASH);
    });

    it("classifies navigation timeout as TIMEOUT", () => {
      const error = new Error("page.goto: Timeout 30000ms exceeded");
      const classified = classifyAutomationError(error);

      expect(classified.category).toBe("INFRASTRUCTURE");
      expect(classified.fallbackEligible).toBe(true);
      expect(classified.fallbackReason).toBe(FallbackReason.TIMEOUT);
    });

    it("classifies missing DOM field as DOM_FAILURE", () => {
      const error = new Error("Execution context was destroyed, most likely because of a navigation");
      const classified = classifyAutomationError(error);

      expect(classified.category).toBe("INFRASTRUCTURE");
      expect(classified.fallbackEligible).toBe(true);
      expect(classified.fallbackReason).toBe(FallbackReason.DOM_FAILURE);
    });

    it("classifies CAPTCHA as WORKFLOW_PAUSE (strictly NOT eligible for fallback)", () => {
      const error = new Error("CAPTCHA detected on application page");
      const classified = classifyAutomationError(error);

      expect(classified.category).toBe("WORKFLOW_PAUSE");
      expect(classified.fallbackEligible).toBe(false);
      expect(classified.fallbackReason).toBeUndefined();
      expect(classified.failureCode).toBe(FailureCode.CAPTCHA_REQUIRED);
    });

    it("classifies missing profile data as USER_INPUT_REQUIRED (NOT eligible for fallback)", () => {
      const error = new Error("Missing required profile information for phone number");
      const classified = classifyAutomationError(error);

      expect(classified.category).toBe("USER_INPUT_REQUIRED");
      expect(classified.fallbackEligible).toBe(false);
      expect(classified.failureCode).toBe(FailureCode.PROFILE_DATA_MISSING);
    });
  });

  describe("3. Fallback Decision Matrix (shouldFallbackToBrowserbase)", () => {
    const baseApp = {
      id: "app-matrix-test",
      automation_preference: AutomationPreference.AUTO,
      automation_attempts: 1,
      fallback_used: false,
      status: ApplicationStatus.FILLING_FORM,
      debug_info: {},
    };

    it("allows fallback on infrastructure error under AUTO preference", () => {
      const error = new Error("net::ERR_CONNECTION_RESET at https://boards.greenhouse.io");
      const decision = shouldFallbackToBrowserbase(error, baseApp, "FILLING_FORM");

      expect(decision.shouldFallback).toBe(true);
      expect(decision.reason).toBe(FallbackReason.NETWORK_ERROR);
    });

    it("blocks fallback if user selected LOCAL_ONLY", () => {
      const localOnlyApp = {
        ...baseApp,
        automation_preference: AutomationPreference.LOCAL_ONLY,
      };
      const error = new Error("Target closed");
      const decision = shouldFallbackToBrowserbase(error, localOnlyApp, "FILLING_FORM");

      expect(decision.shouldFallback).toBe(false);
      expect(decision.blockReason).toContain("LOCAL_ONLY");
    });

    it("blocks fallback if already fallen back once (Max fallback ceiling = 1)", () => {
      const alreadyFallenBackApp = {
        ...baseApp,
        fallback_used: true,
      };
      const error = new Error("Target closed");
      const decision = shouldFallbackToBrowserbase(error, alreadyFallenBackApp, "FILLING_FORM");

      expect(decision.shouldFallback).toBe(false);
      expect(decision.blockReason).toContain("already_used");
    });

    it("blocks fallback if application was already submitted (idempotency safeguard)", () => {
      const submittedApp = {
        ...baseApp,
        status: ApplicationStatus.SUBMITTED,
      };
      const error = new Error("Navigation error");
      const decision = shouldFallbackToBrowserbase(error, submittedApp, "SUBMITTING");

      expect(decision.shouldFallback).toBe(false);
      expect(decision.blockReason).toContain("terminal_or_submitting");
    });

    it("blocks fallback if submission was already clicked/attempted (double-submit prevention)", () => {
      const submitAttemptedApp = {
        ...baseApp,
        debug_info: { submit_attempted: true },
      };
      const error = new Error("Navigation timeout after clicking submit");
      const decision = shouldFallbackToBrowserbase(error, submitAttemptedApp, "SUBMITTING");

      expect(decision.shouldFallback).toBe(false);
      expect(decision.blockReason).toContain("submit_attempted");
    });

    it("blocks fallback on CAPTCHA or Auth requirements", () => {
      const captchaError = new Error("A CAPTCHA appeared on step 2");
      const decision = shouldFallbackToBrowserbase(captchaError, baseApp, "FILLING_FORM");

      expect(decision.shouldFallback).toBe(false);
      expect(decision.blockReason).toContain("not_eligible");
    });
  });

  describe("4. Selector Revalidation on Fresh Page", () => {
    it("revalidates and updates selectors for existing fields", async () => {
      const mockProvider: any = {
        findElement: vi.fn().mockImplementation(async (_page, selector) => {
          if (selector === "input[name='first_name']") return { id: "fn" };
          if (selector === "input[name='email']") return null; // Old selector failed
          if (selector === "#email") return { id: "email-el" }; // New selector found
          return null;
        }),
      };

      const mockPage: any = {};
      const savedFields: any[] = [
        { field_id: "first_name", selector: "input[name='first_name']" },
        { field_id: "email", selector: "input[name='email']" },
      ];
      const freshDomFields: any[] = [
        { field_id: "email", selector: "#email" },
      ];

      const revalidated = await revalidateFieldSelectors(
        mockProvider,
        mockPage,
        savedFields,
        freshDomFields
      );

      expect(revalidated).toHaveLength(2);
      expect(revalidated.find((f) => f.field_id === "first_name")?.selector).toBe("input[name='first_name']");
      expect(revalidated.find((f) => f.field_id === "email")?.selector).toBe("#email");
    });
  });
});
