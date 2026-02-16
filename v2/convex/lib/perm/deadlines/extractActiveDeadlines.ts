/**
 * Extract Active Deadlines from Case Data
 *
 * Central function for extracting all active (non-superseded) deadlines from a case.
 * Used by dashboard, calendar, scheduled jobs, and timeline components.
 *
 * This is the SINGLE SOURCE OF TRUTH for deadline extraction logic.
 *
 * @module
 */

import type {
  CaseDataForDeadlines,
  DeadlineType,
  ExtractedDeadline,
} from "./types";
import { DEADLINE_LABELS } from "./types";
import {
  isDeadlineActive,
  getActiveRfiEntry,
  getActiveRfeEntry,
} from "./isDeadlineActive";
import { loggers } from "../../logging";
import { daysBetween, getTodayISO } from "../../dateValidation";
import {
  DEADLINE_TIMEZONE_RULES,
  getTodayForDeadline,
  DEFAULT_USER_TIMEZONE,
} from "./timezones";
import { calculateRecruitmentDeadlines } from "../calculators/recruitment";
import { getFirstRecruitmentDate } from "../dates";

const log = loggers.deadline;

// Re-export date utilities for backwards compatibility
export { daysBetween, getTodayISO };

// ============================================================================
// MAIN EXTRACTION FUNCTION
// ============================================================================

/**
 * Extract all active deadlines from a case.
 *
 * This function:
 * 1. Checks each deadline type for supersession (using isDeadlineActive)
 * 2. Extracts the date and calculates days until (timezone-aware per deadline type)
 * 3. Returns only active, valid deadlines with their timezone rule
 *
 * @param caseData - Case data with deadline-relevant fields
 * @param todayISO - Today's date as ISO string (for testing — overrides timezone resolution)
 * @param userTimezone - User's IANA timezone for "local" deadlines (defaults to America/New_York)
 * @returns Array of active deadlines, sorted by daysUntil (most urgent first)
 *
 * @example
 * const deadlines = extractActiveDeadlines({
 *   pwdExpirationDate: "2025-06-30",
 *   eta9089FilingDate: undefined,
 * }, undefined, "America/Los_Angeles");
 * // Returns: [{ type: "pwd_expiration", date: "2025-06-30", daysUntil: 180, timezoneRule: "local", ... }]
 */
export function extractActiveDeadlines(
  caseData: CaseDataForDeadlines,
  todayISO?: string,
  userTimezone: string = DEFAULT_USER_TIMEZONE
): ExtractedDeadline[] {
  const deadlines: ExtractedDeadline[] = [];

  // Helper: resolve "today" for a given deadline type.
  // If todayISO is provided (testing), use it for all types.
  // Otherwise, resolve per-type using timezone rules.
  const resolveToday = (type: DeadlineType): string =>
    todayISO ?? getTodayForDeadline(type, userTimezone);

  // PWD expiration
  const pwdDeadline = extractPwdExpiration(caseData, resolveToday("pwd_expiration"));
  if (pwdDeadline) deadlines.push(pwdDeadline);

  // Filing window opens
  const filingOpensDeadline = extractFilingWindowOpens(caseData, resolveToday("filing_window_opens"));
  if (filingOpensDeadline) deadlines.push(filingOpensDeadline);

  // Filing window closes
  const filingClosesDeadline = extractFilingWindowCloses(caseData, resolveToday("filing_window_closes"));
  if (filingClosesDeadline) deadlines.push(filingClosesDeadline);

  // I-140 filing deadline
  const i140Deadline = extractI140Deadline(caseData, resolveToday("i140_filing_deadline"));
  if (i140Deadline) deadlines.push(i140Deadline);

  // RFI due
  const rfiDeadline = extractRfiDeadline(caseData, resolveToday("rfi_due"));
  if (rfiDeadline) deadlines.push(rfiDeadline);

  // RFE due
  const rfeDeadline = extractRfeDeadline(caseData, resolveToday("rfe_due"));
  if (rfeDeadline) deadlines.push(rfeDeadline);

  // Recruitment window closes
  const recruitWindowDeadline = extractRecruitmentWindowCloses(caseData, resolveToday("recruitment_window_closes"));
  if (recruitWindowDeadline) deadlines.push(recruitWindowDeadline);

  // Per-step recruitment deadlines (computed from first recruitment + PWD)
  const perStepDeadlines = extractPerStepDeadlines(caseData, resolveToday);
  deadlines.push(...perStepDeadlines);

  // Sort by daysUntil (most urgent first)
  return deadlines.sort((a, b) => a.daysUntil - b.daysUntil);
}

// ============================================================================
// INDIVIDUAL DEADLINE EXTRACTORS
// ============================================================================

/**
 * Extract PWD expiration deadline if active.
 */
function extractPwdExpiration(
  caseData: CaseDataForDeadlines,
  todayISO: string
): ExtractedDeadline | null {
  const status = isDeadlineActive("pwd_expiration", caseData);
  if (!status.isActive) return null;

  const date = caseData.pwdExpirationDate;
  if (!date) return null;

  try {
    return {
      type: "pwd_expiration",
      label: DEADLINE_LABELS.pwd_expiration,
      date,
      daysUntil: daysBetween(todayISO, date),
      timezoneRule: DEADLINE_TIMEZONE_RULES.pwd_expiration,
    };
  } catch (error) {
    log.error('Failed to extract PWD expiration', {
      date,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Extract filing window opens deadline if active.
 */
function extractFilingWindowOpens(
  caseData: CaseDataForDeadlines,
  todayISO: string
): ExtractedDeadline | null {
  const status = isDeadlineActive("filing_window_opens", caseData);
  if (!status.isActive) return null;

  const date = caseData.filingWindowOpens;
  if (!date) return null;

  try {
    return {
      type: "filing_window_opens",
      label: DEADLINE_LABELS.filing_window_opens,
      date,
      daysUntil: daysBetween(todayISO, date),
      timezoneRule: DEADLINE_TIMEZONE_RULES.filing_window_opens,
    };
  } catch (error) {
    log.error('Failed to extract filing window opens', {
      date,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Extract filing window closes deadline if active.
 */
function extractFilingWindowCloses(
  caseData: CaseDataForDeadlines,
  todayISO: string
): ExtractedDeadline | null {
  const status = isDeadlineActive("filing_window_closes", caseData);
  if (!status.isActive) return null;

  const date = caseData.filingWindowCloses;
  if (!date) return null;

  try {
    return {
      type: "filing_window_closes",
      label: DEADLINE_LABELS.filing_window_closes,
      date,
      daysUntil: daysBetween(todayISO, date),
      timezoneRule: DEADLINE_TIMEZONE_RULES.filing_window_closes,
    };
  } catch (error) {
    log.error('Failed to extract filing window closes', {
      date,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Extract I-140 filing deadline if active.
 *
 * The I-140 deadline is the ETA 9089 expiration date (180 days from certification).
 */
function extractI140Deadline(
  caseData: CaseDataForDeadlines,
  todayISO: string
): ExtractedDeadline | null {
  const status = isDeadlineActive("i140_filing_deadline", caseData);
  if (!status.isActive) return null;

  const date = caseData.eta9089ExpirationDate;
  if (!date) return null;

  try {
    return {
      type: "i140_filing_deadline",
      label: DEADLINE_LABELS.i140_filing_deadline,
      date,
      daysUntil: daysBetween(todayISO, date),
      timezoneRule: DEADLINE_TIMEZONE_RULES.i140_filing_deadline,
    };
  } catch (error) {
    log.error('Failed to extract I-140 deadline', {
      date,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Extract RFI response due deadline if active.
 */
function extractRfiDeadline(
  caseData: CaseDataForDeadlines,
  todayISO: string
): ExtractedDeadline | null {
  const status = isDeadlineActive("rfi_due", caseData);
  if (!status.isActive) return null;

  const activeRfi = getActiveRfiEntry(caseData.rfiEntries ?? []);
  if (!activeRfi?.responseDueDate) return null;

  try {
    return {
      type: "rfi_due",
      label: DEADLINE_LABELS.rfi_due,
      date: activeRfi.responseDueDate,
      daysUntil: daysBetween(todayISO, activeRfi.responseDueDate),
      timezoneRule: DEADLINE_TIMEZONE_RULES.rfi_due,
      entryId: activeRfi.id,
    };
  } catch (error) {
    log.error('Failed to extract RFI deadline', {
      date: activeRfi.responseDueDate,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Extract RFE response due deadline if active.
 */
function extractRfeDeadline(
  caseData: CaseDataForDeadlines,
  todayISO: string
): ExtractedDeadline | null {
  const status = isDeadlineActive("rfe_due", caseData);
  if (!status.isActive) return null;

  const activeRfe = getActiveRfeEntry(caseData.rfeEntries ?? []);
  if (!activeRfe?.responseDueDate) return null;

  try {
    return {
      type: "rfe_due",
      label: DEADLINE_LABELS.rfe_due,
      date: activeRfe.responseDueDate,
      daysUntil: daysBetween(todayISO, activeRfe.responseDueDate),
      timezoneRule: DEADLINE_TIMEZONE_RULES.rfe_due,
      entryId: activeRfe.id,
    };
  } catch (error) {
    log.error('Failed to extract RFE deadline', {
      date: activeRfe.responseDueDate,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Extract recruitment window closes deadline if active.
 */
function extractRecruitmentWindowCloses(
  caseData: CaseDataForDeadlines,
  todayISO: string
): ExtractedDeadline | null {
  const status = isDeadlineActive("recruitment_window_closes", caseData);
  if (!status.isActive) return null;

  const date = caseData.recruitmentWindowCloses;
  if (!date) return null;

  try {
    return {
      type: "recruitment_window_closes",
      label: DEADLINE_LABELS.recruitment_window_closes,
      date,
      daysUntil: daysBetween(todayISO, date),
      timezoneRule: DEADLINE_TIMEZONE_RULES.recruitment_window_closes,
    };
  } catch (error) {
    log.error('Failed to extract recruitment window closes', {
      date,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Extract per-step recruitment deadlines (job order, notice, Sunday ads).
 *
 * These are computed from firstRecruitmentDate + pwdExpirationDate using
 * the central calculateRecruitmentDeadlines function.
 */
function extractPerStepDeadlines(
  caseData: CaseDataForDeadlines,
  resolveToday: (type: DeadlineType) => string
): ExtractedDeadline[] {
  const deadlines: ExtractedDeadline[] = [];

  // Need both first recruitment date and PWD expiration to compute deadlines
  const firstRecruit = getFirstRecruitmentDate(caseData);
  if (!firstRecruit || !caseData.pwdExpirationDate) return deadlines;

  // Compute all per-step deadline dates from central calculator
  let computed;
  try {
    computed = calculateRecruitmentDeadlines(firstRecruit, caseData.pwdExpirationDate);
  } catch (error) {
    log.error('Failed to compute recruitment deadlines', {
      firstRecruit,
      pwdExpiration: caseData.pwdExpirationDate,
      error: error instanceof Error ? error.message : String(error),
    });
    return deadlines;
  }

  // Map of deadline type → computed date
  const perStepMap: Array<{ type: DeadlineType; date: string }> = [
    { type: "job_order_start_deadline", date: computed.job_order_start_deadline },
    { type: "notice_of_filing_start_deadline", date: computed.notice_of_filing_start_deadline },
    { type: "first_sunday_ad_deadline", date: computed.first_sunday_ad_deadline },
    { type: "second_sunday_ad_deadline", date: computed.second_sunday_ad_deadline },
  ];

  for (const { type, date } of perStepMap) {
    const status = isDeadlineActive(type, caseData);
    if (!status.isActive) continue;

    const today = resolveToday(type);
    try {
      deadlines.push({
        type,
        label: DEADLINE_LABELS[type],
        date,
        daysUntil: daysBetween(today, date),
        timezoneRule: DEADLINE_TIMEZONE_RULES[type],
      });
    } catch (error) {
      log.error('Failed to extract per-step deadline', {
        type,
        date,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return deadlines;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if a deadline type is active for a case.
 *
 * Convenience re-export of isDeadlineActive for external use.
 */
export { isDeadlineActive } from "./isDeadlineActive";

/**
 * Get all active deadline types for a case (without extracting dates).
 *
 * Useful for quick filtering without computing daysUntil.
 *
 * @param caseData - Case data to check
 * @returns Array of active deadline types
 */
export function getActiveDeadlineTypes(
  caseData: CaseDataForDeadlines
): DeadlineType[] {
  const allTypes: DeadlineType[] = [
    "pwd_expiration",
    "filing_window_opens",
    "filing_window_closes",
    "recruitment_window_closes",
    "job_order_start_deadline",
    "notice_of_filing_start_deadline",
    "first_sunday_ad_deadline",
    "second_sunday_ad_deadline",
    "i140_filing_deadline",
    "rfi_due",
    "rfe_due",
  ];

  return allTypes.filter((type) => isDeadlineActive(type, caseData).isActive);
}

/**
 * Check if a specific deadline type should trigger a reminder.
 *
 * Combines supersession check with date existence check.
 *
 * @param deadlineType - Type of deadline
 * @param caseData - Case data
 * @returns True if this deadline should generate reminders
 */
export function shouldRemindForDeadline(
  deadlineType: DeadlineType,
  caseData: CaseDataForDeadlines
): boolean {
  const status = isDeadlineActive(deadlineType, caseData);
  if (!status.isActive) return false;

  // Check that the deadline has a date
  switch (deadlineType) {
    case "pwd_expiration":
      return !!caseData.pwdExpirationDate;
    case "filing_window_opens":
      return !!caseData.filingWindowOpens;
    case "filing_window_closes":
      return !!caseData.filingWindowCloses;
    case "recruitment_window_closes":
      return !!caseData.recruitmentWindowCloses;
    case "job_order_start_deadline":
    case "notice_of_filing_start_deadline":
    case "first_sunday_ad_deadline":
    case "second_sunday_ad_deadline": {
      // Per-step deadlines need first recruitment + PWD to compute dates
      const first = getFirstRecruitmentDate(caseData);
      return !!first && !!caseData.pwdExpirationDate;
    }
    case "i140_filing_deadline":
      return !!caseData.eta9089ExpirationDate;
    case "rfi_due":
      return !!getActiveRfiEntry(caseData.rfiEntries ?? [])?.responseDueDate;
    case "rfe_due":
      return !!getActiveRfeEntry(caseData.rfeEntries ?? [])?.responseDueDate;
    default:
      return false;
  }
}
