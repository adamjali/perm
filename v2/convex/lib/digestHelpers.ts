/**
 * Weekly Digest Helpers
 *
 * Types and transformation functions for building weekly digest email content.
 * Used by the weekly digest cron job to aggregate user data into structured
 * email content.
 *
 * @module
 */

import type { Id } from "../_generated/dataModel";

// ============================================================================
// TYPES
// ============================================================================

/**
 * A deadline item in the digest, with urgency categorization.
 */
export interface DigestDeadline {
  caseId: Id<"cases">;
  employerName: string;
  beneficiaryIdentifier: string;
  deadlineType: string;
  deadlineDate: string; // ISO date string
  daysUntil: number;
  urgency: "overdue" | "urgent" | "upcoming" | "later";
}

/**
 * A case that was recently updated.
 */
export interface DigestCaseUpdate {
  caseId: Id<"cases">;
  employerName: string;
  beneficiaryIdentifier: string;
  caseStatus: string;
  updatedAt: number; // timestamp
  changeDescription: string;
}

/**
 * Stats summary for the digest header.
 */
export interface DigestStats {
  totalActiveCases: number;
  overdueCount: number;
  urgentCount: number; // Next 7 days
  unreadNotificationCount: number;
}

/**
 * Complete digest content ready for email template.
 */
export interface DigestContent {
  userName: string;
  userEmail: string;
  weekStartDate: string; // ISO date string (Monday of this week)
  weekEndDate: string; // ISO date string (Sunday of this week)
  stats: DigestStats;
  overdueDeadlines: DigestDeadline[];
  next7DaysDeadlines: DigestDeadline[];
  next14DaysDeadlines: DigestDeadline[]; // Days 8-14
  recentCaseUpdates: DigestCaseUpdate[];
  isEmpty: boolean;
  emptyMessage: string;
}

/**
 * Raw deadline data from the database query.
 */
export interface RawDeadlineData {
  caseId: Id<"cases">;
  employerName: string;
  beneficiaryIdentifier: string;
  deadlineType: string;
  deadlineDate: string;
  daysUntil: number;
}

/**
 * Raw case update data from the database query.
 */
export interface RawCaseUpdateData {
  caseId: Id<"cases">;
  employerName: string;
  beneficiaryIdentifier: string;
  caseStatus: string;
  progressStatus?: string;
  updatedAt: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the Monday of the current week.
 */
export function getWeekStartDate(today: Date = new Date()): string {
  const day = today.getUTCDay();
  const diff = today.getUTCDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  const monday = new Date(today);
  monday.setUTCDate(diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString().split("T")[0]!;
}

/**
 * Get the Sunday of the current week.
 */
export function getWeekEndDate(today: Date = new Date()): string {
  const day = today.getUTCDay();
  const diff = today.getUTCDate() - day + (day === 0 ? 0 : 7); // Sunday
  const sunday = new Date(today);
  sunday.setUTCDate(diff);
  sunday.setUTCHours(23, 59, 59, 999);
  return sunday.toISOString().split("T")[0]!;
}

/**
 * Determine the urgency level of a deadline based on days until.
 */
export function getDeadlineUrgency(
  daysUntil: number
): "overdue" | "urgent" | "upcoming" | "later" {
  if (daysUntil < 0) return "overdue";
  if (daysUntil <= 7) return "urgent";
  if (daysUntil <= 14) return "upcoming";
  return "later";
}

/**
 * Format deadline type for human-readable display.
 */
export function formatDeadlineType(deadlineType: string): string {
  const typeMap: Record<string, string> = {
    pwd_expiration: "PWD Expiration",
    "PWD Expiration": "PWD Expiration",
    filing_window_opens: "Filing Window",
    filing_window_closes: "Filing Window Closes",
    "Filing Window Closes": "Filing Window Closes",
    i140_filing_deadline: "I-140 Filing Deadline",
    rfi_due: "RFI Response Due",
    "RFI Response Due": "RFI Response Due",
    rfe_due: "RFE Response Due",
    "RFE Response Due": "RFE Response Due",
  };
  return typeMap[deadlineType] ?? deadlineType;
}

/**
 * Format a case status change for display.
 */
export function formatCaseStatusChange(
  caseStatus: string,
  progressStatus?: string
): string {
  const statusDisplay: Record<string, string> = {
    pwd: "PWD Stage",
    recruitment: "Recruitment Stage",
    eta_9089: "ETA 9089 Stage",
    i140: "I-140 Stage",
    complete: "Complete",
    closed: "Closed",
  };

  const progressDisplay: Record<string, string> = {
    not_started: "Not Started",
    in_progress: "In Progress",
    complete: "Complete",
    on_hold: "On Hold",
    blocked: "Blocked",
    needs_review: "Needs Review",
  };

  const statusText = statusDisplay[caseStatus] ?? caseStatus;
  if (progressStatus && progressDisplay[progressStatus]) {
    return `${statusText} - ${progressDisplay[progressStatus]}`;
  }
  return statusText;
}

/**
 * Format a date for display in the email (e.g., "January 15, 2025").
 */
export function formatDateForDisplay(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00Z");
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Format relative days for display (e.g., "2 days ago", "in 3 days").
 */
export function formatRelativeDays(daysUntil: number): string {
  if (daysUntil === 0) return "Today";
  if (daysUntil === 1) return "Tomorrow";
  if (daysUntil === -1) return "Yesterday";
  if (daysUntil < 0) return `${Math.abs(daysUntil)} days overdue`;
  return `in ${daysUntil} days`;
}

// ============================================================================
// DIGEST BUILDER
// ============================================================================

/**
 * Transform raw deadline data into DigestDeadline with urgency.
 */
export function transformDeadline(raw: RawDeadlineData): DigestDeadline {
  return {
    caseId: raw.caseId,
    employerName: raw.employerName,
    beneficiaryIdentifier: raw.beneficiaryIdentifier,
    deadlineType: formatDeadlineType(raw.deadlineType),
    deadlineDate: raw.deadlineDate,
    daysUntil: raw.daysUntil,
    urgency: getDeadlineUrgency(raw.daysUntil),
  };
}

/**
 * Transform raw case update data into DigestCaseUpdate.
 */
export function transformCaseUpdate(raw: RawCaseUpdateData): DigestCaseUpdate {
  return {
    caseId: raw.caseId,
    employerName: raw.employerName,
    beneficiaryIdentifier: raw.beneficiaryIdentifier,
    caseStatus: raw.caseStatus,
    updatedAt: raw.updatedAt,
    changeDescription: formatCaseStatusChange(raw.caseStatus, raw.progressStatus),
  };
}

/**
 * Categorize deadlines by urgency for the digest sections.
 */
export function categorizeDeadlines(deadlines: DigestDeadline[]): {
  overdue: DigestDeadline[];
  next7Days: DigestDeadline[];
  next14Days: DigestDeadline[];
} {
  const overdue: DigestDeadline[] = [];
  const next7Days: DigestDeadline[] = [];
  const next14Days: DigestDeadline[] = [];

  for (const deadline of deadlines) {
    if (deadline.daysUntil < 0) {
      overdue.push(deadline);
    } else if (deadline.daysUntil <= 7) {
      next7Days.push(deadline);
    } else if (deadline.daysUntil <= 14) {
      next14Days.push(deadline);
    }
  }

  // Sort each category by date
  overdue.sort((a, b) => a.deadlineDate.localeCompare(b.deadlineDate));
  next7Days.sort((a, b) => a.deadlineDate.localeCompare(b.deadlineDate));
  next14Days.sort((a, b) => a.deadlineDate.localeCompare(b.deadlineDate));

  return { overdue, next7Days, next14Days };
}

/**
 * Build the complete digest content from raw data.
 */
export function buildDigestContent(params: {
  userName: string;
  userEmail: string;
  totalActiveCases: number;
  unreadNotificationCount: number;
  rawDeadlines: RawDeadlineData[];
  rawCaseUpdates: RawCaseUpdateData[];
  today?: Date;
}): DigestContent {
  const {
    userName,
    userEmail,
    totalActiveCases,
    unreadNotificationCount,
    rawDeadlines,
    rawCaseUpdates,
    today = new Date(),
  } = params;

  // Transform deadlines
  const deadlines = rawDeadlines.map(transformDeadline);
  const { overdue, next7Days, next14Days } = categorizeDeadlines(deadlines);

  // Transform case updates and sort by most recent
  const caseUpdates = rawCaseUpdates
    .map(transformCaseUpdate)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  // Build stats
  const stats: DigestStats = {
    totalActiveCases,
    overdueCount: overdue.length,
    urgentCount: next7Days.length,
    unreadNotificationCount,
  };

  // Determine if digest is empty
  const isEmpty =
    overdue.length === 0 &&
    next7Days.length === 0 &&
    next14Days.length === 0 &&
    caseUpdates.length === 0;

  // Generate appropriate empty message
  let emptyMessage = "";
  if (isEmpty) {
    if (totalActiveCases === 0) {
      emptyMessage = "You have no active cases. Get started by adding your first case!";
    } else {
      emptyMessage = "No urgent deadlines this week! Your cases are on track.";
    }
  }

  return {
    userName,
    userEmail,
    weekStartDate: getWeekStartDate(today),
    weekEndDate: getWeekEndDate(today),
    stats,
    overdueDeadlines: overdue,
    next7DaysDeadlines: next7Days,
    next14DaysDeadlines: next14Days,
    recentCaseUpdates: caseUpdates.slice(0, 10), // Limit to 10 most recent
    isEmpty,
    emptyMessage,
  };
}

/**
 * Get urgency color for email styling.
 */
export function getUrgencyColor(urgency: DigestDeadline["urgency"]): string {
  switch (urgency) {
    case "overdue":
      return "#991B1B"; // Deep red
    case "urgent":
      return "#DC2626"; // Red
    case "upcoming":
      return "#F97316"; // Orange
    case "later":
      return "#2563EB"; // Blue
  }
}

/**
 * Get urgency background color for email styling.
 */
export function getUrgencyBgColor(urgency: DigestDeadline["urgency"]): string {
  switch (urgency) {
    case "overdue":
      return "#FEE2E2"; // Light red
    case "urgent":
      return "#FEF2F2"; // Very light red
    case "upcoming":
      return "#FFF7ED"; // Light orange
    case "later":
      return "#EFF6FF"; // Light blue
  }
}
