import { describe, it, expect } from "vitest";
import { discoverSourceFromUrl, formatCompanyName } from "../src/lib/ingestion/discovery";

describe("Discovery Utility", () => {
  it("should auto-detect Greenhouse boards", () => {
    const res = discoverSourceFromUrl("https://boards.greenhouse.io/stripe");
    expect(res).not.toBeNull();
    expect(res?.source).toBe("greenhouse");
    expect(res?.source_identifier).toBe("stripe");
    expect(res?.company_name).toBe("Stripe");
  });

  it("should auto-detect Lever boards", () => {
    const res = discoverSourceFromUrl("https://jobs.lever.co/vercel");
    expect(res).not.toBeNull();
    expect(res?.source).toBe("lever");
    expect(res?.source_identifier).toBe("vercel");
    expect(res?.company_name).toBe("Vercel");
  });

  it("should auto-detect Ashby boards", () => {
    const res = discoverSourceFromUrl("https://jobs.ashbyhq.com/openai");
    expect(res).not.toBeNull();
    expect(res?.source).toBe("ashby");
    expect(res?.source_identifier).toBe("openai");
    expect(res?.company_name).toBe("Openai");
  });

  it("should auto-detect Workable boards", () => {
    const res = discoverSourceFromUrl("https://apply.workable.com/perplexity");
    expect(res).not.toBeNull();
    expect(res?.source).toBe("workable");
    expect(res?.source_identifier).toBe("perplexity");
    expect(res?.company_name).toBe("Perplexity");
  });

  it("should auto-detect Wellfound company URLs", () => {
    const res = discoverSourceFromUrl("https://wellfound.com/company/modal-labs");
    expect(res).not.toBeNull();
    expect(res?.source).toBe("wellfound");
    expect(res?.source_identifier).toBe("modal-labs");
    expect(res?.company_name).toBe("Modal Labs");
    expect(res?.company_logo).toBe("/platforms/wellfound.png");
  });

  it("should auto-detect AngelList legacy URLs", () => {
    const res = discoverSourceFromUrl("https://angel.co/company/replit/jobs");
    expect(res).not.toBeNull();
    expect(res?.source).toBe("wellfound");
    expect(res?.source_identifier).toBe("replit");
    expect(res?.company_name).toBe("Replit");
  });

  it("should format slug names nicely", () => {
    expect(formatCompanyName("scale-ai")).toBe("Scale Ai");
    expect(formatCompanyName("datadog_inc")).toBe("Datadog Inc");
  });
});
