/**
 * CaseCard Utility Functions
 * Pure functions for formatting and display logic in CaseCard component.
 */

import { getDaysUntilDeadline } from "@/lib/status/urgency";

/**
 * Format closure reason for display.
 * Returns just the reason label (not the date).
 */
export function formatClosureReasonLabel(
  reason: string | undefined | null
): string {
  const reasonMap: Record<string, string> = {
    withdrawn: "Withdrawn",
    denied: "Denied",
    pwd_expired: "PWD expired",
    recruitment_window_missed: "Recruitment window missed",
    filing_window_missed: "Filing window missed",
    eta9089_expired: "ETA 9089 expired",
    manual: "",
    other: "",
  };
  return reason ? (reasonMap[reason] ?? "") : "";
}

/**
 * Parse ISO date string as local date (not UTC).
 * Appending T12:00:00 ensures the date stays the same regardless of timezone.
 */
function parseLocalDate(dateStr: string): Date {
  // If already has time component, parse as-is
  if (dateStr.includes("T")) {
    return new Date(dateStr);
  }
  // Date-only strings: append noon to avoid timezone shift
  return new Date(`${dateStr}T12:00:00`);
}

/** The deadline's date alone, e.g. "Oct 22, 2026". */
export function formatDeadlineDate(deadline: string): string {
  return parseLocalDate(deadline).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** How a deadline reads on a card: how long until it, or how late. */
export function countdownWords(daysUntil: number): string {
  if (daysUntil < 0) return `${Math.abs(daysUntil)} ${Math.abs(daysUntil) === 1 ? "day" : "days"} late`;
  if (daysUntil === 0) return "Today";
  return `In ${daysUntil} ${daysUntil === 1 ? "day" : "days"}`;
}

/** A countdown as its figure and unit, for the countdown block: 14 / "days", 3 / "days late", 0 / "today". */
export function countdownParts(daysUntil: number): { value: string; unit: string } {
  if (daysUntil < 0) return { value: String(-daysUntil), unit: daysUntil === -1 ? "day late" : "days late" };
  if (daysUntil === 0) return { value: "Due", unit: "today" };
  return { value: String(daysUntil), unit: daysUntil === 1 ? "day left" : "days left" };
}

/** The countdown for a deadline date, read against today. */
export function deadlineCountdownWords(deadline: string): string {
  return countdownWords(getDaysUntilDeadline(deadline));
}

/**
 * Format date for compact display in expanded content.
 * Shows month/day/year in short format.
 */
export function formatCompactDate(dateStr: string): string {
  const date = parseLocalDate(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * How many case dates the card lists. `dates` also carries `created` and
 * `updated`, which the card never shows, so counting every value would put
 * "Show dates (2)" on a case with nothing recorded.
 */
export function countShownDates(dates: object): number {
  return Object.entries(dates).filter(([key, value]) => key !== "created" && key !== "updated" && Boolean(value)).length;
}
