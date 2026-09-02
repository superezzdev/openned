/**
 * Utility functions for parsing, validating, and formatting job posting timestamps.
 * Accurately handles relative time ("2h ago"), exact clock time ("10:30 AM"),
 * calendar dates ("Sep 2"), and accessible tooltips.
 */

export interface FormattedPostingTime {
  /** Clean display string for metadata rows with clock icon (e.g., "2h ago • 10:30 AM", "Yesterday • 4:15 PM", "Aug 30 • 2:15 PM", "3d ago") */
  display: string;
  /** Compact display string for badges (e.g., "2h ago (10:30 AM)", "yesterday at 4:15 PM", "3d ago") */
  badgeText: string;
  /** Relative time only (e.g., "2h ago", "1d ago", "just now", "recently") */
  relativeText: string;
  /** Formatted time-of-day if available (e.g., "10:30 AM"), or null if timestamp is date-only */
  timeOnlyText: string | null;
  /** Formatted calendar date (e.g., "Sep 2" or "Sep 2, 2025") */
  dateOnlyText: string;
  /** Full localized tooltip string for title attributes (e.g., "Posted on Wednesday, September 2, 2026 at 10:30 AM") */
  tooltip: string;
  /** Whether the original source timestamp contained specific hours/minutes */
  hasSpecificTime: boolean;
  /** Whether this reflects the original job post time (true) or fallback discovery/creation time (false) */
  isOriginal: boolean;
  /** Whether the job was posted within the last 24 hours */
  isFresh: boolean;
  /** Relative or date prefix before the clock time (e.g. "2h ago", "Yesterday", "3d ago") */
  displayPrefix: string;
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const FULL_MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const WEEKDAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
];

/**
 * Checks if a date string represents a date-only string (e.g. "2026-09-01")
 * or a date-only timestamp padded to midnight UTC ("2026-09-01T00:00:00.000Z")
 * with no specific hour/minute provided by the upstream job board.
 */
export function hasSpecificTime(dateStr?: string | null): boolean {
  if (!dateStr || typeof dateStr !== "string") return false;
  const trimmed = dateStr.trim();

  // Pure date format: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return false;
  }

  // Padded midnight UTC string without real time
  if (/T00:00:00(?:\.000)?(?:Z|\+00:00)?$/i.test(trimmed)) {
    return false;
  }

  // Space-delimited midnight string
  if (/\s+00:00:00$/i.test(trimmed)) {
    return false;
  }

  // If string contains non-midnight time (e.g. 14:30 or 08:15)
  if (/[T\s]\d{2}:\d{2}/.test(trimmed)) {
    try {
      const d = new Date(trimmed);
      if (isNaN(d.getTime())) return false;
      // If UTC hours, minutes, and seconds are all zero, treat as date-only
      if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Formats time of day as "10:30 AM" or "2:15 PM" consistently
 * without locale variations or hydration mismatches.
 */
export function formatTimeOfDay(date: Date): string {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const minutesStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
  return `${hours}:${minutesStr} ${ampm}`;
}

/**
 * Formats short calendar date (e.g., "Sep 2" or "Sep 2, 2025").
 */
export function formatMonthDay(date: Date, includeYear = false): string {
  const month = MONTH_NAMES[date.getMonth()] || "";
  const day = date.getDate();
  if (includeYear) {
    return `${month} ${day}, ${date.getFullYear()}`;
  }
  return `${month} ${day}`;
}

/**
 * Formats full human-readable date & time for accessible tooltips.
 * e.g., "Wednesday, September 2, 2026 at 10:30 AM"
 */
export function formatFullDateTime(date: Date, includeTime = true): string {
  const weekday = WEEKDAY_NAMES[date.getDay()] || "";
  const month = FULL_MONTH_NAMES[date.getMonth()] || "";
  const day = date.getDate();
  const year = date.getFullYear();

  if (includeTime) {
    const timeStr = formatTimeOfDay(date);
    return `${weekday}, ${month} ${day}, ${year} at ${timeStr}`;
  }
  return `${weekday}, ${month} ${day}, ${year}`;
}

/**
 * Standard relative time string ("just now", "25m ago", "2h ago", "1d ago", "3d ago", "2w ago", "3mo ago").
 */
export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - date.getTime();
  if (isNaN(diffMs) || diffMs < 0) return "just now";

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
}

/**
 * Backward-compatible helper that matches the previous function signature:
 * formatPostedTime(postedAt, fetchedAt, createdAt) -> "2h ago" | "1d ago" | "recently"
 */
export function formatPostedTime(
  postedAt?: string | null,
  fetchedAt?: string | null,
  createdAt?: string | null,
  nowInput?: Date
): string {
  const dateStr = postedAt || fetchedAt || createdAt;
  if (!dateStr) return "recently";

  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "recently";
    return formatRelativeTime(d, nowInput || new Date());
  } catch {
    return "recently";
  }
}

/**
 * Primary rich formatter for job posting time.
 * Computes:
 * - display (for card metadata row with clock icon)
 * - badgeText (for right column match info)
 * - relativeText ("2h ago", "1d ago")
 * - timeOnlyText ("10:30 AM" or null)
 * - tooltip (full date & time string)
 */
export function formatJobPostingTime(
  postedAt?: string | null,
  fetchedAt?: string | null,
  createdAt?: string | null,
  nowInput?: Date
): FormattedPostingTime {
  const isOriginal = Boolean(postedAt && postedAt.trim());
  const dateStr = postedAt || fetchedAt || createdAt;

  if (!dateStr) {
    return {
      display: "Recently",
      badgeText: "recently",
      relativeText: "recently",
      timeOnlyText: null,
      dateOnlyText: "Recently",
      tooltip: "Job posted recently",
      hasSpecificTime: false,
      isOriginal: false,
      isFresh: false,
      displayPrefix: "Recently",
    };
  }

  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return {
        display: "Recently",
        badgeText: "recently",
        relativeText: "recently",
        timeOnlyText: null,
        dateOnlyText: "Recently",
        tooltip: "Job posted recently",
        hasSpecificTime: false,
        isOriginal: false,
        isFresh: false,
        displayPrefix: "Recently",
      };
    }

    const now = nowInput || new Date();
    const hasTime = hasSpecificTime(dateStr);
    const timeStr = hasTime ? formatTimeOfDay(date) : null;
    const diffMs = now.getTime() - date.getTime();
    const isFuture = diffMs < 0;

    const currentYear = now.getFullYear();
    const postYear = date.getFullYear();
    const isDiffYear = currentYear !== postYear;
    const dateOnly = formatMonthDay(date, isDiffYear);
    const relText = isFuture ? "just now" : formatRelativeTime(date, now);

    const diffHours = isFuture ? 0 : Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = isFuture ? 0 : Math.floor(diffHours / 24);

    const actionWord = isOriginal ? "Posted" : "Discovered";
    const fullTooltip = `${actionWord} on ${formatFullDateTime(date, hasTime)}`;

    let display = "";
    let badgeText = "";

    // 1. Posted today (< 24h ago or same calendar day)
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    const isFresh = isToday || diffHours < 24;
    let displayPrefix = relText;

    if (isToday || diffHours < 12) {
      displayPrefix = relText === "just now" ? "Just now" : relText;
      if (hasTime && timeStr) {
        display = `${relText} • ${timeStr}`;
        badgeText = `${relText} (${timeStr})`;
      } else {
        display = relText === "just now" ? "Just now" : `${relText}`;
        badgeText = relText;
      }
    } else if (isYesterday || (diffHours >= 12 && diffHours < 36 && diffDays === 1)) {
      displayPrefix = "Yesterday";
      if (hasTime && timeStr) {
        display = `Yesterday • ${timeStr}`;
        badgeText = `yesterday at ${timeStr}`;
      } else {
        display = "Yesterday (1d ago)";
        badgeText = "yesterday";
      }
    } else if (diffDays < 7) {
      displayPrefix = `${diffDays}d ago`;
      if (hasTime && timeStr) {
        display = `${diffDays}d ago • ${timeStr}`;
        badgeText = `${diffDays}d ago (${timeStr})`;
      } else {
        display = `${diffDays}d ago (${dateOnly})`;
        badgeText = `${diffDays}d ago`;
      }
    } else {
      // 7+ days ago
      displayPrefix = dateOnly;
      if (hasTime && timeStr) {
        display = `${dateOnly} • ${timeStr}`;
        badgeText = `${dateOnly} (${timeStr})`;
      } else {
        display = dateOnly;
        badgeText = dateOnly;
      }
    }

    return {
      display,
      badgeText,
      relativeText: relText,
      timeOnlyText: timeStr,
      dateOnlyText: dateOnly,
      tooltip: fullTooltip,
      hasSpecificTime: hasTime,
      isOriginal,
      isFresh,
      displayPrefix,
    };
  } catch {
    return {
      display: "Recently",
      badgeText: "recently",
      relativeText: "recently",
      timeOnlyText: null,
      dateOnlyText: "Recently",
      tooltip: "Job posted recently",
      hasSpecificTime: false,
      isOriginal: false,
      isFresh: false,
      displayPrefix: "Recently",
    };
  }
}
