import { describe, it, expect } from "vitest";
import { sanitizeHtml, normalizeUrl, htmlToPlainText } from "../src/lib/ingestion/normalizer";

describe("Security & Sanitization Audit", () => {
  it("strictly neutralizes script tags and inline event handlers", () => {
    const malicious = `
      <h1>Senior Software Engineer</h1>
      <script>alert('xss')</script>
      <img src="x" onerror="stealCookies()" />
      <a href="javascript:doEvil()">Click here</a>
      <p onclick="executeAttack()">Great company culture.</p>
      <iframe src="https://evil.com"></iframe>
    `;

    const sanitized = sanitizeHtml(malicious);

    expect(sanitized).not.toContain("<script");
    expect(sanitized).not.toContain("alert('xss')");
    expect(sanitized).not.toContain("onerror");
    expect(sanitized).not.toContain("stealCookies");
    expect(sanitized).not.toContain("javascript:");
    expect(sanitized).not.toContain("onclick");
    expect(sanitized).not.toContain("<iframe");
    expect(sanitized).toContain("Senior Software Engineer");
    expect(sanitized).toContain("Great company culture.");
  });

  it("neutralizes embedded objects, applets, svgs, and meta tags", () => {
    const malicious = `
      <object data="exploit.swf"></object>
      <embed src="exploit.pdf"></embed>
      <svg><g onload="alert(1)"></g></svg>
      <meta http-equiv="refresh" content="0;url=evil.com" />
      <p>Clean paragraph text.</p>
    `;

    const sanitized = sanitizeHtml(malicious);

    expect(sanitized).not.toContain("<object");
    expect(sanitized).not.toContain("<embed");
    expect(sanitized).not.toContain("<svg");
    expect(sanitized).not.toContain("<meta");
    expect(sanitized).toContain("Clean paragraph text.");
  });

  it("converts HTML to plain text without leaking tags or entities", () => {
    const html = `<div><p>We are seeking a <strong>Lead Architect</strong> &amp; Developer.</p></div>`;
    const text = htmlToPlainText(html);
    expect(text).toBe("We are seeking a Lead Architect & Developer.");
  });

  it("normalizes valid URLs and rejects malicious schemes", () => {
    expect(normalizeUrl("https://jobs.example.com/apply")).toBe("https://jobs.example.com/apply");
    expect(normalizeUrl("http://example.com")).toBe("http://example.com/");
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl("data:text/html,evil")).toBeNull();
    expect(normalizeUrl("vbscript:msgbox")).toBeNull();
    expect(normalizeUrl("")).toBeNull();
    expect(normalizeUrl(null)).toBeNull();
  });

  it("resolves relative URLs safely when baseUrl is provided", () => {
    const resolved = normalizeUrl("/jobs/123", "https://boards.greenhouse.io/stripe");
    expect(resolved).toBe("https://boards.greenhouse.io/jobs/123");
  });
});
