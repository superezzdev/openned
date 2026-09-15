import { describe, it, expect } from "vitest";
import {
  hasSpecificTime,
  formatTimeOfDay,
  formatMonthDay,
  formatFullDateTime,
  formatRelativeTime,
  formatPostedTime,
  formatJobPostingTime,
} from "../src/lib/posting-time";

describe("Job Posting Time Formatting & Detection", () => {
  const referenceNow = new Date("2026-09-02T12:00:00Z");

  describe("hasSpecificTime", () => {
    it("returns false for undefined, null, or empty strings", () => {
      expect(hasSpecificTime(undefined)).toBe(false);
      expect(hasSpecificTime(null)).toBe(false);
      expect(hasSpecificTime("")).toBe(false);
    });

    it("returns false for date-only format (YYYY-MM-DD)", () => {
      expect(hasSpecificTime("2026-09-02")).toBe(false);
      expect(hasSpecificTime("2026-08-15")).toBe(false);
    });

    it("returns false for midnight UTC padded timestamps", () => {
      expect(hasSpecificTime("2026-09-02T00:00:00.000Z")).toBe(false);
      expect(hasSpecificTime("2026-09-02T00:00:00Z")).toBe(false);
      expect(hasSpecificTime("2026-09-02 00:00:00")).toBe(false);
    });

    it("returns true when timestamp has non-midnight hours or minutes", () => {
      expect(hasSpecificTime("2026-09-02T14:30:00.000Z")).toBe(true);
      expect(hasSpecificTime("2026-09-02T08:15:00Z")).toBe(true);
      expect(hasSpecificTime("2026-09-02 16:45:00")).toBe(true);
      expect(hasSpecificTime("2026-09-02T10:00:00+05:30")).toBe(true);
    });
  });

  describe("formatTimeOfDay", () => {
    it("formats morning hours correctly with AM", () => {
      const date = new Date(2026, 8, 2, 9, 5); // 9:05 AM
      expect(formatTimeOfDay(date)).toBe("9:05 AM");
    });

    it("formats noon correctly as 12:00 PM", () => {
      const date = new Date(2026, 8, 2, 12, 0);
      expect(formatTimeOfDay(date)).toBe("12:00 PM");
    });

    it("formats afternoon/evening hours correctly with PM", () => {
      const date = new Date(2026, 8, 2, 15, 45); // 3:45 PM
      expect(formatTimeOfDay(date)).toBe("3:45 PM");
    });

    it("formats midnight correctly as 12:00 AM", () => {
      const date = new Date(2026, 8, 2, 0, 0);
      expect(formatTimeOfDay(date)).toBe("12:00 AM");
    });
  });

  describe("formatRelativeTime and backward-compatible formatPostedTime", () => {
    it("computes relative durations accurately", () => {
      const now = new Date(2026, 8, 2, 12, 0, 0);

      // Just now (< 1 min)
      const justNow = new Date(now.getTime() - 30 * 1000);
      expect(formatPostedTime(justNow.toISOString(), null, null, now)).toBe("just now");

      // 45 minutes ago
      const fortyFiveMins = new Date(now.getTime() - 45 * 60 * 1000);
      expect(formatPostedTime(fortyFiveMins.toISOString(), null, null, now)).toBe("45m ago");

      // 3 hours ago
      const threeHours = new Date(now.getTime() - 3 * 3600 * 1000);
      expect(formatPostedTime(threeHours.toISOString(), null, null, now)).toBe("3h ago");

      // 1 day ago
      const oneDay = new Date(now.getTime() - 25 * 3600 * 1000);
      expect(formatPostedTime(oneDay.toISOString(), null, null, now)).toBe("1d ago");

      // 4 days ago
      const fourDays = new Date(now.getTime() - 4 * 24 * 3600 * 1000);
      expect(formatPostedTime(fourDays.toISOString(), null, null, now)).toBe("4d ago");

      // Null fallback
      expect(formatPostedTime(null, null, null)).toBe("recently");
    });
  });

  describe("formatJobPostingTime rich display", () => {
    it("includes the time of day when timestamp has specific time", () => {
      const now = new Date(2026, 8, 2, 14, 0, 0); // 2:00 PM
      const posted = new Date(2026, 8, 2, 11, 30, 0); // 11:30 AM (2.5h ago)

      const result = formatJobPostingTime(posted.toISOString(), null, null, now);
      expect(result.hasSpecificTime).toBe(true);
      expect(result.timeOnlyText).toBe("11:30 AM");
      expect(result.display).toContain("11:30 AM");
      expect(result.display).toContain("2h ago");
      expect(result.badgeText).toContain("11:30 AM");
      expect(result.tooltip).toContain("Posted on");
      expect(result.tooltip).toContain("11:30 AM");
    });

    it("displays yesterday with time when posted on previous day", () => {
      const now = new Date(2026, 8, 2, 10, 0, 0);
      const yesterday = new Date(2026, 8, 1, 16, 15, 0); // Yesterday 4:15 PM

      const result = formatJobPostingTime(yesterday.toISOString(), null, null, now);
      expect(result.hasSpecificTime).toBe(true);
      expect(result.display).toBe("Yesterday • 4:15 PM");
      expect(result.badgeText).toBe("yesterday at 4:15 PM");
      expect(result.tooltip).toContain("September 1, 2026");
      expect(result.tooltip).toContain("4:15 PM");
    });

    it("displays days ago with time when posted 3 days ago", () => {
      const now = new Date(2026, 8, 5, 12, 0, 0);
      const threeDaysAgo = new Date(2026, 8, 2, 9, 20, 0);

      const result = formatJobPostingTime(threeDaysAgo.toISOString(), null, null, now);
      expect(result.hasSpecificTime).toBe(true);
      expect(result.display).toBe("3d ago • 9:20 AM");
      expect(result.badgeText).toBe("3d ago (9:20 AM)");
    });

    it("omits time gracefully when timestamp is date-only", () => {
      const now = new Date(2026, 8, 5, 12, 0, 0);
      const dateOnly = "2026-09-02";

      const result = formatJobPostingTime(dateOnly, null, null, now);
      expect(result.hasSpecificTime).toBe(false);
      expect(result.timeOnlyText).toBeNull();
      expect(result.display).toBe("3d ago (Sep 2)");
      expect(result.badgeText).toBe("3d ago");
      expect(result.tooltip).not.toContain("at ");
    });

    it("falls back to fetched_at / created_at with Discovered prefix", () => {
      const now = new Date(2026, 8, 2, 14, 0, 0);
      const fetched = new Date(2026, 8, 2, 13, 10, 0);

      const result = formatJobPostingTime(null, fetched.toISOString(), null, now);
      expect(result.isOriginal).toBe(false);
      expect(result.tooltip).toContain("Discovered on");
      expect(result.display).toContain("1:10 PM");
    });

    it("identifies isFresh and displayPrefix for jobs posted within 24 hours", () => {
      const now = new Date(2026, 8, 2, 14, 0, 0);
      const twoHoursAgo = new Date(2026, 8, 2, 12, 0, 0);
      const res1 = formatJobPostingTime(twoHoursAgo.toISOString(), null, null, now);
      expect(res1.isFresh).toBe(true);
      expect(res1.displayPrefix).toBe("2h ago");

      const fiveDaysAgo = new Date(2026, 8, 2 - 5, 12, 0, 0);
      const res2 = formatJobPostingTime(fiveDaysAgo.toISOString(), null, null, now);
      expect(res2.isFresh).toBe(false);
      expect(res2.displayPrefix).toBe("5d ago");
    });

    it("handles completely empty date fields gracefully", () => {
      const result = formatJobPostingTime(null, null, null);
      expect(result.display).toBe("Recently");
      expect(result.badgeText).toBe("recently");
      expect(result.tooltip).toBe("Job posted recently");
      expect(result.isFresh).toBe(false);
      expect(result.displayPrefix).toBe("Recently");
    });
  });
});
