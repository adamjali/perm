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
import { ALL_DEADLINE_TYPES, DEADLINE_LABELS } from "./types";
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
import { getFirstRecruitmentDate, subtractBusinessDays } from "../dates";
import { calculateStepDeadline, STEP_DEADLINE_CONFIGS } from "../calculators/recruitment";
import { NOTICE_MIN_BUSINESS_DAYS } from "../constants";

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

  // Field-based deadlines (type → date field)
  const fieldDeadlines: Array<{ type: DeadlineType; date: string | undefined }> = [
    { type: "pwd_expiration", date: caseData.pwdExpirationDate },
    { type: "filing_window_opens", date: caseData.filingWindowOpens },
    { type: "filing_window_closes", date: caseData.filingWindowCloses },
    { type: "i140_filing_deadline", date: caseData.eta9089ExpirationDate },
    { type: "recruitment_window_closes", date: caseData.recruitmentWindowCloses },
  ];

  for (const { type, date } of fieldDeadlines) {
    const deadline = extractSingleDeadline(type, date, caseData, resolveToday(type));
    if (deadline) deadlines.push(deadline);
  }

  // RFI/RFE deadlines (use active entry date + entryId)
  const activeRfi = getActiveRfiEntry(caseData.rfiEntries ?? []);
  const rfiDeadline = extractSingleDeadline("rfi_due", activeRfi?.responseDueDate, caseData, resolveToday("rfi_due"), activeRfi?.id);
  if (rfiDeadline) deadlines.push(rfiDeadline);

  const activeRfe = getActiveRfeEntry(caseData.rfeEntries ?? []);
  const rfeDeadline = extractSingleDeadline("rfe_due", activeRfe?.responseDueDate, caseData, resolveToday("rfe_due"), activeRfe?.id);
  if (rfeDeadline) deadlines.push(rfeDeadline);

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
 * Generic extractor for a single deadline type.
 * Checks supersession, validates date, computes daysUntil.
 */
function extractSingleDeadline(
  type: DeadlineType,
  date: string | undefined,
  caseData: CaseDataForDeadlines,
  todayISO: string,
  entryId?: string
): ExtractedDeadline | null {
  const status = isDeadlineActive(type, caseData);
  if (!status.isActive) return null;
  if (!date) return null;

  try {
    return {
      type,
      label: DEADLINE_LABELS[type],
      date,
      daysUntil: daysBetween(todayISO, date),
      timezoneRule: DEADLINE_TIMEZONE_RULES[type],
      entryId,
    };
  } catch (error) {
    log.error(`Failed to extract ${type}`, {
      date,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Extract per-step recruitment deadlines (job order, notice, Sunday ads).
 *
 * Uses calculateStepDeadline (central source of truth) which computes
 * each constraint arm independently — deadlines are returned even when
 * only firstRecruitmentDate or pwdExpirationDate is available.
 */
function extractPerStepDeadlines(
  caseData: CaseDataForDeadlines,
  resolveToday: (type: DeadlineType) => string
): ExtractedDeadline[] {
  const deadlines: ExtractedDeadline[] = [];

  const firstRecruit = getFirstRecruitmentDate(caseData);
  const pwdExp = caseData.pwdExpirationDate;
  if (!firstRecruit && !pwdExp) return deadlines;

  // Map central config keys to deadline types
  const keyToType: Record<string, DeadlineType> = {
    job_order_start_deadline: "job_order_start_deadline",
    notice_of_filing_deadline: "notice_of_filing_start_deadline", // NOF uses start deadline
    first_sunday_ad_deadline: "first_sunday_ad_deadline",
    second_sunday_ad_deadline: "second_sunday_ad_deadline",
  };

  for (const config of STEP_DEADLINE_CONFIGS) {
    const type = keyToType[config.key];
    if (!type) continue;

    const status = isDeadlineActive(type, caseData);
    if (!status.isActive) continue;

    try {
      let date = calculateStepDeadline(firstRecruit, pwdExp, config);
      if (!date) continue;

      // NOF start = subtract 10 business days from the notice deadline
      if (type === "notice_of_filing_start_deadline") {
        date = subtractBusinessDays(date, NOTICE_MIN_BUSINESS_DAYS);
      }

      const today = resolveToday(type);
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
  return ALL_DEADLINE_TYPES.filter((type) => isDeadlineActive(type, caseData).isActive);
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
