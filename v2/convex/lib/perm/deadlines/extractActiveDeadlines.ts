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
 * 2. Extracts the date and calculates days until
 * 3. Returns only active, valid deadlines
 *
 * @param caseData - Case data with deadline-relevant fields
 * @param todayISO - Today's date as ISO string (for testing, defaults to actual today)
 * @returns Array of active deadlines, sorted by daysUntil (most urgent first)
 *
 * @example
 * const deadlines = extractActiveDeadlines({
 *   pwdExpirationDate: "2025-06-30",
 *   eta9089FilingDate: undefined,
 * });
 * // Returns: [{ type: "pwd_expiration", date: "2025-06-30", daysUntil: 180, ... }]
 */
export function extractActiveDeadlines(
  caseData: CaseDataForDeadlines,
  todayISO: string = getTodayISO()
): ExtractedDeadline[] {
  const deadlines: ExtractedDeadline[] = [];

  // PWD expiration
  const pwdDeadline = extractPwdExpiration(caseData, todayISO);
  if (pwdDeadline) deadlines.push(pwdDeadline);

  // Filing window opens
  const filingOpensDeadline = extractFilingWindowOpens(caseData, todayISO);
  if (filingOpensDeadline) deadlines.push(filingOpensDeadline);

  // Filing window closes
  const filingClosesDeadline = extractFilingWindowCloses(caseData, todayISO);
  if (filingClosesDeadline) deadlines.push(filingClosesDeadline);

  // I-140 filing deadline
  const i140Deadline = extractI140Deadline(caseData, todayISO);
  if (i140Deadline) deadlines.push(i140Deadline);

  // RFI due
  const rfiDeadline = extractRfiDeadline(caseData, todayISO);
  if (rfiDeadline) deadlines.push(rfiDeadline);

  // RFE due
  const rfeDeadline = extractRfeDeadline(caseData, todayISO);
  if (rfeDeadline) deadlines.push(rfeDeadline);

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
