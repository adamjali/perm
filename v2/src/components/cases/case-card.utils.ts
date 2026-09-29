/**
 * CaseCard Utility Functions
 * Pure functions for formatting and display logic in CaseCard component.
 */

import { getDaysUntilDeadline } from "@/lib/status/urgency";
import type { CaseStatus } from "@/lib/perm";

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

/**
 * The countdown the card leads with: a number and its unit, e.g. 24 / "days",
 * 0 / "today", 3 / "days late". The number is the visual; the unit says what
 * it counts.
 */
export function deadlineCountdown(deadline: string): { value: number; unit: string } {
  const days = getDaysUntilDeadline(deadline);
  if (days < 0) return { value: Math.abs(days), unit: Math.abs(days) === 1 ? "day late" : "days late" };
  if (days === 0) return { value: 0, unit: "today" };
  return { value: days, unit: days === 1 ? "day" : "days" };
}

/**
 * Format deadline for display.
 * ALWAYS shows the actual date, plus relative time for context.
 */
export function formatDeadline(deadline: string): string {
  const deadlineDate = parseLocalDate(deadline);
  const daysUntil = getDaysUntilDeadline(deadline);

  const dateStr = deadlineDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  if (daysUntil === 0) return `${dateStr} (today)`;
  if (daysUntil === 1) return `${dateStr} (tomorrow)`;
  if (daysUntil < 0) return `${dateStr} (overdue)`;
  if (daysUntil <= 30) return `${dateStr} (${daysUntil} days)`;

  return dateStr;
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

/**
 * Get stage color bar CSS variable.
 */
export function getStageColorVar(stage: CaseStatus): string {
  const varMap: Record<string, string> = {
    pwd: "var(--stage-pwd)",
    recruitment: "var(--stage-recruitment)",
    eta9089: "var(--stage-eta9089)",
    i140: "var(--stage-i140)",
    closed: "var(--stage-closed)",
  };
  return varMap[stage] || "var(--stage-pwd)";
}

/**
 * Format case status for display (e.g., "eta9089" -> "ETA 9089", "i140" -> "I-140")
 */
export function formatCaseStatus(status: CaseStatus): string {
  if (status === "eta9089") return "ETA 9089";
  if (status === "i140") return "I-140";
  if (status === "pwd") return "PWD";
  return status.charAt(0).toUpperCase() + status.slice(1);
}
