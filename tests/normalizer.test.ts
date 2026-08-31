import { describe, it, expect } from "vitest";
import {
  classifyEmploymentType,
  classifyRemoteType,
  htmlToPlainText,
  normalizeIsoDate,
  normalizeUrl,
  parseSalaryInterval,
  sanitizeHtml,
} from "../src/lib/ingestion/normalizer";

describe("Normalizer Utilities", () => {
  it("should strip HTML and convert to clean plain text", () => {
    const raw = "<p>Hello <strong>World</strong>&nbsp;&amp; welcome to &lt;AI&gt;!</p>";
    expect(htmlToPlainText(raw)).toBe("Hello World & welcome to <AI>!");
  });

  it("should sanitize dangerous HTML tags", () => {
    const malicious = '<p>Normal text</p><script>alert("xss")</script><iframe src="evil.com"></iframe><span onclick="hack()">Safe</span>';
    const clean = sanitizeHtml(malicious);
    expect(clean).not.toContain("<script>");
    expect(clean).not.toContain("<iframe>");
    expect(clean).not.toContain("onclick");
    expect(clean).toContain("<p>Normal text</p>");
  });

  it("should classify remote, hybrid, and onsite roles", () => {
    expect(classifyRemoteType("San Francisco, CA", "remote")).toBe("remote");
    expect(classifyRemoteType("San Francisco, CA", "hybrid")).toBe("hybrid");
    expect(classifyRemoteType("San Francisco, CA", "onsite")).toBe("onsite");
    expect(classifyRemoteType("Remote - Worldwide")).toBe("remote");
    expect(classifyRemoteType("New York (Hybrid)")).toBe("hybrid");
  });

  it("should classify employment types correctly", () => {
    expect(classifyEmploymentType("FullTime", "Software Engineer")).toBe("full-time");
    expect(classifyEmploymentType("Contractor", "Frontend Dev")).toBe("contract");
    expect(classifyEmploymentType(null, "Summer ML Intern")).toBe("internship");
    expect(classifyEmploymentType("Part-time", "Support Agent")).toBe("part-time");
  });

  it("should parse salary intervals correctly", () => {
    expect(parseSalaryInterval("per year")).toBe("yearly");
    expect(parseSalaryInterval("per-hour")).toBe("hourly");
    expect(parseSalaryInterval("monthly")).toBe("monthly");
  });

  it("should validate and normalize URLs", () => {
    expect(normalizeUrl("https://boards.greenhouse.io/stripe/jobs/123")).toBe("https://boards.greenhouse.io/stripe/jobs/123");
    expect(normalizeUrl("ftp://invalid.scheme")).toBeNull();
    expect(normalizeUrl("not a url")).toBeNull();
  });
});
