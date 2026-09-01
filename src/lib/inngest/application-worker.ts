/**
 * Inngest Application Worker Functions
 *
 * Defines the background job functions that Inngest runs when triggered.
 * These functions run on OCI (long-running process) and use Playwright.
 *
 * Inngest guarantees:
 * - Retries with backoff
 * - Idempotency via step functions
 * - Concurrency control (one job per user at a time)
 */

import { inngest } from "./client";
import { runApplicationAutomation, resumeApplicationAfterMissingFields, submitAfterReview } from "@/lib/applications/application-orchestrator";
import { acquireApplicationLock, releaseApplicationLock } from "@/lib/applications/application-locking";
import { ApplicationStatus, FailureCode } from "@/lib/applications/types";
import { updateApplicationStatus } from "@/lib/applications/application-status-service";

/**
 * Start application automation job.
 * Triggered by "application/start" event.
 *
 * Concurrency: One job per user at a time (concurrencyKey: user_id).
 * Retries: Max 2 attempts (we don't want aggressive retries for browser automation).
 */
export const applicationStartFunction = inngest.createFunction(
  {
    id: "application-start",
    name: "Start Job Application Automation",
    triggers: [{ event: "application/start" }],
    concurrency: {
      limit: 1,
      key: "event.data.user_id",
    },
    retries: 2,
  },
  async ({ event, step }: any) => {
    const { application_id, user_id } = event.data;

    // Step 1: Acquire distributed lock
    const workerId = await step.run("acquire-lock", async () => {
      const lockId = await acquireApplicationLock(application_id);
      if (!lockId) {
        throw new Error(`Application ${application_id} is already being processed`);
      }
      return lockId;
    });

    // Step 2: Run automation orchestrator
    let result: any;
    try {
      result = await step.run("run-automation", async () => {
        return runApplicationAutomation(application_id, workerId);
      });
    } finally {
      // Step 3: Always release lock
      await step.run("release-lock", async () => {
        await releaseApplicationLock(application_id, workerId);
      });
    }

    return result;
  }
);

/**
 * Resume application automation after user provides missing info or approves review.
 * Triggered by "application/resume" event.
 */
export const applicationResumeFunction = inngest.createFunction(
  {
    id: "application-resume",
    name: "Resume Application Automation",
    triggers: [{ event: "application/resume" }],
    concurrency: {
      limit: 1,
      key: "event.data.user_id",
    },
    retries: 0, // CRITICAL: Never retry automatically — duplicate submissions must be prevented
  },
  async ({ event, step }: any) => {
    const { application_id, user_id, reason } = event.data;

    const workerId = await step.run("acquire-lock", async () => {
      const lockId = await acquireApplicationLock(application_id);
      if (!lockId) {
        throw new Error(`Application ${application_id} is already being processed`);
      }
      return lockId;
    });

    let result: any;
    try {
      result = await step.run("resume-automation", async () => {
        if (reason === "review_approved") {
          return submitAfterReview(application_id, workerId);
        }
        return resumeApplicationAfterMissingFields(application_id, workerId);
      });
    } finally {
      await step.run("release-lock", async () => {
        await releaseApplicationLock(application_id, workerId);
      });
    }

    return result;
  }
);

// Export all functions for registration in the route handler
export const inngestFunctions = [applicationStartFunction, applicationResumeFunction];
