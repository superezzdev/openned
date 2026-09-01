import { describe, it, expect } from "vitest";
import { detectApplicationPlatform } from "../../src/lib/applications/platform-detector";

describe("detectApplicationPlatform", () => {
  it("detects Greenhouse from greenhouse.io hostname", async () => {
    const res = await detectApplicationPlatform("https://boards.greenhouse.io/airbnb/jobs/12345");
    expect(res.platform).toBe("greenhouse");
    expect(res.confidence).toBeGreaterThanOrEqual(0.9);
    expect(res.detection_method).toBe("hostname");
  });

  it("detects Greenhouse from URL path pattern", async () => {
    const res = await detectApplicationPlatform("https://careers.example.com/jobs/dev123/applications/new");
    expect(res.platform).toBe("greenhouse");
    expect(res.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("detects Greenhouse from query parameter", async () => {
    const res = await detectApplicationPlatform("https://company.com/apply?gh_jid=98765");
    expect(res.platform).toBe("greenhouse");
    expect(res.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("detects Lever from jobs.lever.co hostname", async () => {
    const res = await detectApplicationPlatform("https://jobs.lever.co/stripe/abc-123");
    expect(res.platform).toBe("lever");
    expect(res.confidence).toBeGreaterThanOrEqual(0.9);
    expect(res.detection_method).toBe("hostname");
  });

  it("detects Lever from lever-source query parameter", async () => {
    const res = await detectApplicationPlatform("https://careers.company.com/position?lever-source=linkedin");
    expect(res.platform).toBe("lever");
    expect(res.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("detects Ashby from jobs.ashbyhq.com hostname", async () => {
    const res = await detectApplicationPlatform("https://jobs.ashbyhq.com/openai/456");
    expect(res.platform).toBe("ashby");
    expect(res.confidence).toBeGreaterThanOrEqual(0.9);
    expect(res.detection_method).toBe("hostname");
  });

  it("detects Workable from apply.workable.com hostname", async () => {
    const res = await detectApplicationPlatform("https://apply.workable.com/vercel/j/789");
    expect(res.platform).toBe("workable");
    expect(res.confidence).toBeGreaterThanOrEqual(0.9);
    expect(res.detection_method).toBe("hostname");
  });

  it("detects SmartRecruiters from jobs.smartrecruiters.com hostname", async () => {
    const res = await detectApplicationPlatform("https://jobs.smartrecruiters.com/Acme/12345");
    expect(res.platform).toBe("smartrecruiters");
    expect(res.confidence).toBeGreaterThanOrEqual(0.9);
    expect(res.detection_method).toBe("hostname");
  });

  it("detects Teamtailor from teamtailor.com hostname", async () => {
    const res = await detectApplicationPlatform("https://careers.teamtailor.com/jobs/999");
    expect(res.platform).toBe("teamtailor");
    expect(res.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("detects Recruitee from recruitee.com hostname", async () => {
    const res = await detectApplicationPlatform("https://company.recruitee.com/o/developer");
    expect(res.platform).toBe("recruitee");
    expect(res.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("falls back to generic for unknown job board URLs", async () => {
    const res = await detectApplicationPlatform("https://example.com/careers/open-roles");
    expect(res.platform).toBe("generic");
    expect(res.confidence).toBeLessThan(0.9);
  });

  it("gracefully handles invalid URLs without crashing", async () => {
    const res = await detectApplicationPlatform("not-a-valid-url");
    expect(res.platform).toBe("generic");
    expect(res.confidence).toBeLessThan(0.5);
  });
});
