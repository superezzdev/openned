import { describe, it, expect } from "vitest";
import {
  ApplicationStatus,
  FailureCode,
  APPLICATION_STATUS_CONFIG,
  ACTIVE_APPLICATION_STATUSES,
  TERMINAL_APPLICATION_STATUSES,
  PAUSED_APPLICATION_STATUSES,
  FAILURE_CODE_MESSAGES,
} from "../../src/lib/applications/types";

describe("Application Automation Lifecycle & Enums", () => {
  it("defines all required application statuses", () => {
    const expectedStatuses = [
      "QUEUED",
      "DETECTING_PLATFORM",
      "DETECTING_FORM",
      "MAPPING_FIELDS",
      "MISSING_PROFILE_INFO",
      "READY_TO_APPLY",
      "FILLING_FORM",
      "AWAITING_USER_REVIEW",
      "AWAITING_USER_ACTION",
      "AWAITING_USER_INPUT",
      "SUBMITTING",
      "SUBMITTED",
      "SUBMISSION_UNCONFIRMED",
      "FAILED",
      "CANCELLED",
      "MANUAL_APPLY_STARTED",
    ];

    for (const status of expectedStatuses) {
      expect(ApplicationStatus[status as keyof typeof ApplicationStatus]).toBe(status);
    }
  });

  it("provides status UI configuration for all statuses", () => {
    for (const status of Object.values(ApplicationStatus)) {
      const config = APPLICATION_STATUS_CONFIG[status];
      expect(config).toBeDefined();
      expect(config.label).toBeTruthy();
      expect(config.color).toBeTruthy();
      expect(config.bgColor).toBeTruthy();
      expect(config.borderColor).toBeTruthy();
      expect(config.description).toBeTruthy();
    }
  });

  it("correctly partitions active, paused, and terminal statuses", () => {
    // Queued and filling are active
    expect(ACTIVE_APPLICATION_STATUSES).toContain(ApplicationStatus.QUEUED);
    expect(ACTIVE_APPLICATION_STATUSES).toContain(ApplicationStatus.FILLING_FORM);
    expect(ACTIVE_APPLICATION_STATUSES).toContain(ApplicationStatus.SUBMITTING);

    // Submitted, failed, cancelled are terminal
    expect(TERMINAL_APPLICATION_STATUSES).toContain(ApplicationStatus.SUBMITTED);
    expect(TERMINAL_APPLICATION_STATUSES).toContain(ApplicationStatus.FAILED);
    expect(TERMINAL_APPLICATION_STATUSES).toContain(ApplicationStatus.CANCELLED);

    // Missing profile info and awaiting review are paused
    expect(PAUSED_APPLICATION_STATUSES).toContain(ApplicationStatus.MISSING_PROFILE_INFO);
    expect(PAUSED_APPLICATION_STATUSES).toContain(ApplicationStatus.AWAITING_USER_REVIEW);

    // Active and terminal sets are completely disjoint
    for (const active of ACTIVE_APPLICATION_STATUSES) {
      expect(TERMINAL_APPLICATION_STATUSES).not.toContain(active);
    }
  });

  it("provides friendly user messages for all failure codes", () => {
    for (const code of Object.values(FailureCode)) {
      const msg = FAILURE_CODE_MESSAGES[code];
      expect(msg).toBeDefined();
      expect(typeof msg).toBe("string");
      expect(msg.length).toBeGreaterThan(10);
    }
  });

  it("ensures AUTH_REQUIRED and CAPTCHA_REQUIRED have actionable messages", () => {
    expect(FAILURE_CODE_MESSAGES[FailureCode.AUTH_REQUIRED]).toContain("manually");
    expect(FAILURE_CODE_MESSAGES[FailureCode.CAPTCHA_REQUIRED]).toContain("verification");
  });
});
