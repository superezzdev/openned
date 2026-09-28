/**
 * Inngest Route Handler
 *
 * Registers Inngest functions with the Inngest platform.
 * This endpoint is called by Inngest to execute background jobs.
 * Deploy this on OCI where Playwright can run (no serverless timeout).
 */

import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { inngestFunctions } from "@/lib/inngest/application-worker";

export const maxDuration = 300; // Maximum allowed serverless duration for Inngest step processing

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: inngestFunctions,
});
