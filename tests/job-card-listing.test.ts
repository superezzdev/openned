import { describe, it, expect } from "vitest";

describe("Job Card Listing UI Logic & Sanitization", () => {
  // Test Match Score Sanitization Logic
  const sanitizeMatchScore = (rawInput: any): number => {
    const rawScore =
      typeof rawInput === "string"
        ? parseInt(rawInput.replace(/[^0-9]/g, ""), 10)
        : typeof rawInput === "number"
        ? Math.round(rawInput)
        : 85;

    return isNaN(rawScore) || rawScore <= 0 ? 85 : Math.min(100, rawScore);
  };

  const formatMatchText = (score: any): string => {
    const cleanScore = sanitizeMatchScore(score);
    return `${cleanScore}% Match`;
  };

  it("should sanitize numeric match scores accurately", () => {
    expect(sanitizeMatchScore(95)).toBe(95);
    expect(formatMatchText(95)).toBe("95% Match");
  });

  it("should strip existing % signs to eliminate double %% display bug", () => {
    expect(sanitizeMatchScore("95%")).toBe(95);
    expect(formatMatchText("95%")).toBe("95% Match");

    expect(sanitizeMatchScore("88%%")).toBe(88);
    expect(formatMatchText("88%%")).toBe("88% Match");

    expect(sanitizeMatchScore("Match: 92%")).toBe(92);
    expect(formatMatchText("Match: 92%")).toBe("92% Match");
  });

  it("should handle null, undefined, or empty values with fallback", () => {
    expect(sanitizeMatchScore(null)).toBe(85);
    expect(formatMatchText(null)).toBe("85% Match");

    expect(sanitizeMatchScore(undefined)).toBe(85);
    expect(formatMatchText(undefined)).toBe("85% Match");

    expect(sanitizeMatchScore("")).toBe(85);
    expect(formatMatchText("")).toBe("85% Match");
  });

  it("should cap scores at 100", () => {
    expect(sanitizeMatchScore(150)).toBe(100);
    expect(sanitizeMatchScore("110%")).toBe(100);
  });

  // Test Relative Posted Time Logic
  const formatPostedTime = (dateStr?: string | null): string => {
    if (!dateStr) return "recently";
    try {
      const diffMs = Date.now() - new Date(dateStr).getTime();
      if (isNaN(diffMs) || diffMs < 0) return "recently";

      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      if (diffMinutes < 60) {
        return diffMinutes <= 1 ? "just now" : `${diffMinutes}m ago`;
      }

      const diffHours = Math.floor(diffMinutes / 60);
      if (diffHours < 24) {
        return `${diffHours}h ago`;
      }

      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return "1d ago";
      if (diffDays < 7) return `${diffDays}d ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
      return `${Math.floor(diffDays / 30)}mo ago`;
    } catch {
      return "recently";
    }
  };

  it("should compute relative posted time correctly", () => {
    const now = Date.now();
    const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000).toISOString();
    expect(formatPostedTime(twoHoursAgo)).toBe("2h ago");

    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    expect(formatPostedTime(oneDayAgo)).toBe("1d ago");

    const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatPostedTime(threeDaysAgo)).toBe("3d ago");

    expect(formatPostedTime(null)).toBe("recently");
  });

  // Test Tags Parsing and Pill counts
  const parseTags = (rawTags: any) => {
    let list: string[] = [];
    if (Array.isArray(rawTags)) {
      list = rawTags.filter(Boolean);
    } else if (typeof rawTags === "string") {
      try {
        const parsed = JSON.parse(rawTags);
        if (Array.isArray(parsed)) list = parsed.filter(Boolean);
      } catch {
        list = rawTags.split(",").map((s: string) => s.trim()).filter(Boolean);
      }
    }
    return {
      visibleTags: list.slice(0, 3),
      remainingCount: Math.max(0, list.length - 3),
    };
  };

  it("should split tags into visible pills and +N remaining count", () => {
    const tags = ["Product Strategy", "Roadmapping", "Analytics", "Growth", "Agile", "SaaS"];
    const result = parseTags(tags);
    expect(result.visibleTags).toEqual(["Product Strategy", "Roadmapping", "Analytics"]);
    expect(result.remainingCount).toBe(3);
  });

  it("should handle JSON stringified tags", () => {
    const jsonTags = JSON.stringify(["React", "TypeScript", "Next.js", "GraphQL"]);
    const result = parseTags(jsonTags);
    expect(result.visibleTags).toEqual(["React", "TypeScript", "Next.js"]);
    expect(result.remainingCount).toBe(1);
  });
});
