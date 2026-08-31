import { EmploymentType, RemoteType, SalaryInterval } from "./types";

/**
 * Strips HTML tags and entities to return clean text
 */
export function htmlToPlainText(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Robust HTML sanitizer to prevent malicious XSS while preserving structural tags (p, ul, ol, li, strong, em, b, i, br, h1-h6, span, a, blockquote)
 */
export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return "";
  let clean = html;

  // 1. Strip dangerous tags and their contents
  const dangerousTags = [
    "script",
    "style",
    "iframe",
    "object",
    "embed",
    "applet",
    "svg",
    "math",
    "form",
    "input",
    "button",
    "textarea",
    "select",
    "meta",
    "link",
    "base",
  ];

  for (const tag of dangerousTags) {
    const tagRegex = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi");
    clean = clean.replace(tagRegex, "");
    const selfClosingRegex = new RegExp(`<${tag}[^>]*\\/?>`, "gi");
    clean = clean.replace(selfClosingRegex, "");
  }

  // 2. Strip inline event handlers (on* attributes like onclick, onerror, onload, onmouseover, etc.)
  clean = clean.replace(/\s+on[a-zA-Z]+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, "");

  // 3. Strip javascript:, vbscript:, and data: URLs in attributes
  clean = clean.replace(/(?:href|src|action)\s*=\s*(?:'javascript:[^']*'|"javascript:[^"]*"|javascript:[^\s>]+)/gi, 'href="#"');
  clean = clean.replace(/(?:href|src|action)\s*=\s*(?:'vbscript:[^']*'|"vbscript:[^"]*"|vbscript:[^\s>]+)/gi, 'href="#"');
  clean = clean.replace(/(?:href|src|action)\s*=\s*(?:'data:text\/html[^']*'|"data:text\/html[^"]*"|data:text\/html[^\s>]+)/gi, 'href="#"');

  return clean.trim();
}

/**
 * Classifies remote work status from title, location, and description strings
 */
export function classifyRemoteType(
  location?: string | null,
  workplaceType?: string | null,
  isRemote?: boolean | null,
  textSnippet?: string | null
): RemoteType {
  if (isRemote === true) return "remote";

  const combined = `${location || ""} ${workplaceType || ""} ${textSnippet || ""}`.toLowerCase();

  if (combined.includes("remote") || combined.includes("anywhere") || combined.includes("work from home") || combined.includes("virtual")) {
    if (combined.includes("hybrid")) {
      return "hybrid";
    }
    return "remote";
  }

  if (combined.includes("hybrid") || combined.includes("flexible")) {
    return "hybrid";
  }

  return "onsite";
}

/**
 * Classifies employment type (full-time, part-time, contract, internship)
 */
export function classifyEmploymentType(
  rawType?: string | null,
  title?: string | null
): EmploymentType {
  const combined = `${rawType || ""} ${title || ""}`.toLowerCase();

  if (combined.includes("intern") || combined.includes("co-op")) {
    return "internship";
  }
  if (combined.includes("contract") || combined.includes("contractor") || combined.includes("freelance") || combined.includes("temp")) {
    return "contract";
  }
  if (combined.includes("part-time") || combined.includes("part time")) {
    return "part-time";
  }
  return "full-time";
}

/**
 * Parses salary interval from string
 */
export function parseSalaryInterval(raw?: string | null): SalaryInterval {
  if (!raw) return "yearly";
  const lower = raw.toLowerCase();
  if (lower.includes("hour") || lower.includes("hr")) return "hourly";
  if (lower.includes("month") || lower.includes("mo")) return "monthly";
  return "yearly";
}

/**
 * Normalizes ISO date string or returns null
 */
export function normalizeIsoDate(raw?: string | number | null): string | null {
  if (!raw) return null;
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

/**
 * Normalizes URL and validates scheme, optionally resolving relative paths against a baseUrl
 */
export function normalizeUrl(url?: string | null, baseUrl?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  try {
    const parsed = baseUrl ? new URL(trimmed, baseUrl) : new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}
