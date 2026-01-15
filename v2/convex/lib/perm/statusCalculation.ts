/**
 * Auto-Status Calculation
 *
 * SINGLE SOURCE OF TRUTH for calculating case/progress status from dates.
 *
 * This function determines the correct caseStatus and progressStatus based on
 * which milestone dates have been entered. It checks stages in reverse order
 * (I-140 → ETA 9089 → Recruitment → PWD) and returns the appropriate status.
 *
 * Used by:
 * - Backend mutations (cases.create, cases.update) to auto-calculate status
 * - Frontend form hook (useFormCalculations) for status suggestions
 *
 * @module
 */

import type { CaseStatus, ProgressStatus } from './statusTypes';
import { isRecruitmentComplete } from './recruitment/isRecruitmentComplete';
import { FILING_WINDOW_WAIT_DAYS } from './constants';
import { parseISO, addDays, isAfter } from 'date-fns';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Input for status calculation.
 * Supports both camelCase (frontend) and snake_case (backend validators).
 */
export interface StatusCalculationInput {
  // RFI/RFE entries (for active status detection)
  rfiEntries?: Array<{ receivedDate?: string; responseSubmittedDate?: string }>;
  rfeEntries?: Array<{ receivedDate?: string; responseSubmittedDate?: string }>;

  // I-140 dates
  i140ApprovalDate?: string | null;
  i140DenialDate?: string | null;
  i140FilingDate?: string | null;

  // ETA 9089 dates
  eta9089CertificationDate?: string | null;
  eta9089FilingDate?: string | null;

  // PWD dates
  pwdDeterminationDate?: string | null;
  pwdFilingDate?: string | null;

  // Recruitment dates (for isRecruitmentComplete check)
  jobOrderStartDate?: string | null;
  jobOrderEndDate?: string | null;
  sundayAdFirstDate?: string | null;
  sundayAdSecondDate?: string | null;
  noticeOfFilingStartDate?: string | null;
  noticeOfFilingEndDate?: string | null;

  // Professional occupation
  isProfessionalOccupation?: boolean;
  additionalRecruitmentMethods?: Array<{ method: string; date: string; description?: string }>;
  additionalRecruitmentEndDate?: string | null;
}

/**
 * Result of status calculation
 */
export interface AutoStatusResult {
  caseStatus: CaseStatus;
  progressStatus: ProgressStatus;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Check if any entry in the array is active (received but not responded)
 */
function hasActiveEntry(
  entries: Array<{ receivedDate?: string; responseSubmittedDate?: string }> | undefined
): boolean {
  return entries?.some((e) => e.receivedDate && !e.responseSubmittedDate) ?? false;
}

/**
 * Get the last recruitment end date from all activities
 */
function getRecruitmentEndDate(input: StatusCalculationInput): string | null {
  const dates: string[] = [];

  // Collect all end dates
  if (input.jobOrderEndDate) dates.push(input.jobOrderEndDate);
  if (input.sundayAdSecondDate) dates.push(input.sundayAdSecondDate);
  if (input.noticeOfFilingEndDate) dates.push(input.noticeOfFilingEndDate);

  // For professional occupations, include additional recruitment
  if (input.isProfessionalOccupation) {
    if (input.additionalRecruitmentEndDate) {
      dates.push(input.additionalRecruitmentEndDate);
    }
    // Also check additionalRecruitmentMethods array
    if (input.additionalRecruitmentMethods) {
      for (const method of input.additionalRecruitmentMethods) {
        if (method.date) dates.push(method.date);
      }
    }
  }

  if (dates.length === 0) return null;

  // Return the latest date (array is guaranteed non-empty at this point)
  const sortedDates = dates.sort().reverse();
  return sortedDates[0] ?? null;
}

/**
 * Check if the ETA 9089 filing window is open
 * (30+ days have passed since the last recruitment step)
 */
function isEta9089WindowOpen(input: StatusCalculationInput): boolean {
  if (!isRecruitmentComplete(input)) return false;

  const recruitmentEnd = getRecruitmentEndDate(input);
  if (!recruitmentEnd) return false;

  const endDate = parseISO(recruitmentEnd);
  const windowOpenDate = addDays(endDate, FILING_WINDOW_WAIT_DAYS);
  const today = new Date();

  return !isAfter(windowOpenDate, today);
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Calculate the appropriate case and progress status based on current data.
 *
 * Checks stages in reverse order (I-140 → ETA 9089 → Recruitment → PWD).
 * This ensures the status reflects the most advanced stage of the case.
 *
 * Priority order:
 * 1. Active RFI/RFE (overrides stage-based status)
 * 2. I-140 stage (approved > denied > filed)
 * 3. ETA 9089 stage (certified > filed)
 * 4. Recruitment stage (complete + window open > complete > in progress)
 * 5. PWD stage (filed > working)
 *
 * @example
 * // Case with only PWD determination date
 * calculateAutoStatus({ pwdDeterminationDate: '2024-06-15' })
 * // => { caseStatus: 'recruitment', progressStatus: 'working' }
 *
 * @example
 * // Case with PWD filed but not determined
 * calculateAutoStatus({ pwdFilingDate: '2024-01-15' })
 * // => { caseStatus: 'pwd', progressStatus: 'filed' }
 */
export function calculateAutoStatus(input: StatusCalculationInput): AutoStatusResult {
  // -------------------------------------------------------------------------
  // 1. RFI/RFE override (highest priority)
  // -------------------------------------------------------------------------
  if (hasActiveEntry(input.rfeEntries)) {
    return { caseStatus: 'i140', progressStatus: 'rfi_rfe' };
  }
  if (hasActiveEntry(input.rfiEntries)) {
    return { caseStatus: 'eta9089', progressStatus: 'rfi_rfe' };
  }

  // -------------------------------------------------------------------------
  // 2. I-140 stage checks
  // -------------------------------------------------------------------------
  if (input.i140ApprovalDate) {
    return { caseStatus: 'i140', progressStatus: 'approved' };
  }
  if (input.i140DenialDate) {
    return { caseStatus: 'closed', progressStatus: 'approved' };
  }
  if (input.i140FilingDate) {
    return { caseStatus: 'i140', progressStatus: 'filed' };
  }

  // -------------------------------------------------------------------------
  // 3. ETA 9089 stage checks
  // -------------------------------------------------------------------------
  if (input.eta9089CertificationDate) {
    return { caseStatus: 'i140', progressStatus: 'working' };
  }
  if (input.eta9089FilingDate) {
    return { caseStatus: 'eta9089', progressStatus: 'filed' };
  }

  // -------------------------------------------------------------------------
  // 4. Recruitment stage checks
  // -------------------------------------------------------------------------
  if (input.pwdDeterminationDate) {
    const recruitmentDone = isRecruitmentComplete(input);
    if (recruitmentDone) {
      const windowOpen = isEta9089WindowOpen(input);
      return windowOpen
        ? { caseStatus: 'eta9089', progressStatus: 'working' }
        : { caseStatus: 'recruitment', progressStatus: 'filed' };
    }
    // PWD determined but recruitment not complete = recruitment in progress
    return { caseStatus: 'recruitment', progressStatus: 'working' };
  }

  // -------------------------------------------------------------------------
  // 5. PWD stage checks
  // -------------------------------------------------------------------------
  if (input.pwdFilingDate) {
    return { caseStatus: 'pwd', progressStatus: 'filed' };
  }

  // -------------------------------------------------------------------------
  // Default: PWD stage, working (new case)
  // -------------------------------------------------------------------------
  return { caseStatus: 'pwd', progressStatus: 'working' };
}
