/**
 * Inngest Client
 *
 * Shared Inngest client for the application.
 * Zero-cost queue using Inngest's free tier.
 */

import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "openned-app",
  name: "Openned Job Application Tracker",
});

// Event types
export type Events = {
  "application/start": {
    data: {
      application_id: string;
      user_id: string;
    };
  };
  "application/resume": {
    data: {
      application_id: string;
      user_id: string;
      reason: "missing_fields_filled" | "review_approved";
    };
  };
};
