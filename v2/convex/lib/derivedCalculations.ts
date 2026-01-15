/**
 * Derived Date Calculations for PERM Cases (Convex Backend)
 *
 * Computed on every case create/update and stored for:
 * - Chatbot queryability
 * - Dashboard performance
 * - Consistent deadline calculations
 *
 * Rules (per 20 CFR 656.17):
 * - Filing window OPENS: 30 days after LAST recruitment step ends
 * - Filing window CLOSES: 180 days after FIRST recruitment step starts
 *   (or PWD expiration date, whichever is earlier)
 *
 * IMPORTANT: Additional recruitment dates (additionalRecruitmentEndDate, additionalRecruitmentMethods)
 * should ONLY be included if isProfessionalOccupation is true.
 *
 * @see convex/lib/perm/constants.ts - SINGLE SOURCE OF TRUTH for all constants
 * @module
 */

// ============================================================================
// CONSTANTS (imported from single source of truth)
// ============================================================================

import {
  FILING_WINDOW_WAIT_DAYS,
  FILING_WINDOW_CLOSE_DAYS,
  RECRUITMENT_WINDOW_DAYS,
  PWD_RECRUITMENT_BUFFER_DAYS,
} from './perm/constants';
import {
  isValidISODate,
  parseISOToUTCSafe,
  addDaysToISOSafe,
  getMinDate,
  getMaxDate,
} from './dateValidation';

// Re-export for backwards compatibility
export {
  FILING_WINDOW_WAIT_DAYS,
  FILING_WINDOW_CLOSE_DAYS,
  RECRUITMENT_WINDOW_DAYS,
  PWD_RECRUITMENT_BUFFER_DAYS,
};

// ============================================================================
// TYPES
// ============================================================================

/**
 * Input data for derived date calculations.
 * Matches the field names in Convex schema (camelCase).
 */
export interface DerivedCalculationInput {
  // Basic recruitment dates (required for all cases)
  sundayAdFirstDate?: string | null;
  sundayAdSecondDate?: string | null;
  jobOrderStartDate?: string | null;
  jobOrderEndDate?: string | null;
  noticeOfFilingStartDate?: string | null;
  noticeOfFilingEndDate?: string | null;

  // Professional occupation dates (only included if isProfessionalOccupation is true)
  additionalRecruitmentEndDate?: string | null;
  additionalRecruitmentMethods?: Array<{ date?: string }>;

  // PWD expiration date (optional constraint for filing window)
  pwdExpirationDate?: string | null;

  // Flag to determine if additional recruitment dates should be included
  isProfessionalOccupation: boolean;
}

/**
 * Output of derived date calculations.
 * All fields are optional (null if insufficient data to calculate).
 */
export interface DerivedDates {
  /** MIN of all recruitment start dates (first step) */
  recruitmentStartDate: string | null;
  /** MAX of all recruitment end dates (last step) */
  recruitmentEndDate: string | null;
  /** recruitmentEndDate + 30 days */
  filingWindowOpens: string | null;
  /** MIN(recruitmentStartDate + 180 days, pwdExpirationDate) */
  filingWindowCloses: string | null;
  /** MIN(recruitmentStartDate + 150 days, pwdExpirationDate - 30 days) */
  recruitmentWindowCloses: string | null;
}


// ============================================================================
// MAIN CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate recruitment start date (MIN of all start dates).
 * First recruitment step = earliest of:
 * - First Sunday ad
 * - Job order start
 * - Notice of filing start
 *
 * Note: Professional occupation additional dates do NOT affect start date.
 *
 * @param input - Case data with recruitment fields
 * @returns ISO date string or null if no dates available
 */
export function calculateRecruitmentStartDate(
  input: Pick<
    DerivedCalculationInput,
    "sundayAdFirstDate" | "jobOrderStartDate" | "noticeOfFilingStartDate"
  >
): string | null {
  const dates: string[] = [];

  if (isValidISODate(input.sundayAdFirstDate)) {
    dates.push(input.sundayAdFirstDate);
  }
  if (isValidISODate(input.jobOrderStartDate)) {
    dates.push(input.jobOrderStartDate);
  }
  if (isValidISODate(input.noticeOfFilingStartDate)) {
    dates.push(input.noticeOfFilingStartDate);
  }

  return getMinDate(dates);
}

/**
 * Calculate recruitment end date (MAX of all end dates).
 * Last recruitment step = latest of:
 * - Second Sunday ad
 * - Job order end
 * - Notice of filing end
 * - Additional recruitment end (ONLY if isProfessionalOccupation)
 * - Additional method dates (ONLY if isProfessionalOccupation)
 *
 * @param input - Case data with recruitment fields
 * @returns ISO date string or null if no dates available
 */
export function calculateRecruitmentEndDate(
  input: Pick<
    DerivedCalculationInput,
    | "sundayAdSecondDate"
    | "jobOrderEndDate"
    | "noticeOfFilingEndDate"
    | "additionalRecruitmentEndDate"
    | "additionalRecruitmentMethods"
    | "isProfessionalOccupation"
  >
): string | null {
  const dates: string[] = [];

  // Base recruitment dates (required for all cases)
  if (isValidISODate(input.sundayAdSecondDate)) {
    dates.push(input.sundayAdSecondDate);
  }
  if (isValidISODate(input.jobOrderEndDate)) {
    dates.push(input.jobOrderEndDate);
  }
  if (isValidISODate(input.noticeOfFilingEndDate)) {
    dates.push(input.noticeOfFilingEndDate);
  }

  // Professional occupation dates (only if applicable)
  if (input.isProfessionalOccupation) {
    if (isValidISODate(input.additionalRecruitmentEndDate)) {
      dates.push(input.additionalRecruitmentEndDate);
    }

    // Include individual method dates
    if (input.additionalRecruitmentMethods) {
      for (const method of input.additionalRecruitmentMethods) {
        if (isValidISODate(method.date)) {
          dates.push(method.date);
        }
      }
    }
  }

  return getMaxDate(dates);
}

/**
 * Calculate when the filing window opens.
 * Filing window opens 30 days after last recruitment step ends.
 *
 * @param recruitmentEndDate - The last recruitment end date (ISO string)
 * @returns ISO date string or null if no end date
 */
export function calculateFilingWindowOpens(
  recruitmentEndDate: string | null
): string | null {
  if (!recruitmentEndDate) return null;
  return addDaysToISOSafe(recruitmentEndDate, FILING_WINDOW_WAIT_DAYS);
}

/**
 * Calculate when the filing window closes.
 * Filing window closes at the EARLIER of:
 * - 180 days after first recruitment step starts
 * - PWD expiration date
 *
 * @param recruitmentStartDate - The first recruitment start date (ISO string)
 * @param pwdExpirationDate - PWD expiration date (ISO string, optional)
 * @returns ISO date string or null if no start date
 */
export function calculateFilingWindowCloses(
  recruitmentStartDate: string | null,
  pwdExpirationDate: string | null | undefined
): string | null {
  if (!recruitmentStartDate) return null;

  // Calculate 180 days after first recruitment
  const naturalClose = addDaysToISOSafe(recruitmentStartDate, FILING_WINDOW_CLOSE_DAYS);
  if (!naturalClose) return null;

  // If no PWD expiration, use natural close
  if (!isValidISODate(pwdExpirationDate)) {
    return naturalClose;
  }

  // Return the earlier of the two dates
  const naturalCloseTime = parseISOToUTCSafe(naturalClose);
  const pwdTime = parseISOToUTCSafe(pwdExpirationDate);

  if (naturalCloseTime === null) return null;
  if (pwdTime === null) return naturalClose;

  return pwdTime < naturalCloseTime ? pwdExpirationDate : naturalClose;
}

/**
 * Calculate when all recruitment must complete.
 *
 * Formula: MIN(firstRecruitment + 150, pwdExpiration - 30)
 *
 * This is an "effective" deadline that accounts for the 30-day waiting period.
 * Recruitment must complete early enough to leave time for the mandatory 30-day
 * quiet period before filing, while still filing within 180 days of first recruitment.
 *
 * Per PERM_SYSTEM_ARCHITECTURE.md:
 * - recruitment_window_closes = MIN(first + 150, pwd - 30)
 *
 * @param recruitmentStartDate - The first recruitment start date (ISO string)
 * @param pwdExpirationDate - PWD expiration date (ISO string, optional)
 * @returns ISO date string or null if no start date
 *
 * @example
 * calculateRecruitmentWindowCloses("2024-01-15", "2024-12-31");
 * // "2024-06-13" // 150 days from first (earlier than pwd - 30)
 *
 * @example
 * calculateRecruitmentWindowCloses("2024-01-15", "2024-05-01");
 * // "2024-04-01" // pwd - 30 is earlier
 */
export function calculateRecruitmentWindowCloses(
  recruitmentStartDate: string | null,
  pwdExpirationDate: string | null | undefined
): string | null {
  if (!recruitmentStartDate) return null;

  // Calculate 150 days after first recruitment
  const naturalClose = addDaysToISOSafe(recruitmentStartDate, RECRUITMENT_WINDOW_DAYS);
  if (!naturalClose) return null;

  // If no PWD expiration, use natural close
  if (!isValidISODate(pwdExpirationDate)) {
    return naturalClose;
  }

  // PWD constraint: must complete 30 days before PWD expires
  const pwdConstraint = addDaysToISOSafe(pwdExpirationDate, -PWD_RECRUITMENT_BUFFER_DAYS);
  if (!pwdConstraint) return naturalClose;

  // Return the earlier of the two dates (compare by string to avoid DST issues)
  return pwdConstraint < naturalClose ? pwdConstraint : naturalClose;
}

/**
 * Calculate all derived dates for a case.
 * This is the main orchestrating function called by Convex mutations.
 *
 * @param input - Case data with all recruitment and PWD fields
 * @returns All 5 derived date fields
 *
 * @example
 * const derived = calculateDerivedDates({
 *   sundayAdFirstDate: "2024-01-15",
 *   sundayAdSecondDate: "2024-01-22",
 *   jobOrderStartDate: "2024-01-10",
 *   jobOrderEndDate: "2024-02-10",
 *   noticeOfFilingStartDate: "2024-01-12",
 *   noticeOfFilingEndDate: "2024-01-26",
 *   pwdExpirationDate: "2024-12-31",
 *   isProfessionalOccupation: false,
 * });
 * // {
 * //   recruitmentStartDate: "2024-01-10",  // MIN(Jan 15, Jan 10, Jan 12)
 * //   recruitmentEndDate: "2024-02-10",    // MAX(Jan 22, Feb 10, Jan 26)
 * //   filingWindowOpens: "2024-03-11",     // Feb 10 + 30 days
 * //   filingWindowCloses: "2024-07-08",    // MIN(Jan 10 + 180, Dec 31)
 * //   recruitmentWindowCloses: "2024-06-08", // MIN(Jan 10 + 150, Dec 31 - 30)
 * // }
 */
export function calculateDerivedDates(
  input: DerivedCalculationInput
): DerivedDates {
  const recruitmentStartDate = calculateRecruitmentStartDate(input);
  const recruitmentEndDate = calculateRecruitmentEndDate(input);
  const filingWindowOpens = calculateFilingWindowOpens(recruitmentEndDate);
  const filingWindowCloses = calculateFilingWindowCloses(
    recruitmentStartDate,
    input.pwdExpirationDate
  );
  const recruitmentWindowCloses = calculateRecruitmentWindowCloses(
    recruitmentStartDate,
    input.pwdExpirationDate
  );

  return {
    recruitmentStartDate,
    recruitmentEndDate,
    filingWindowOpens,
    filingWindowCloses,
    recruitmentWindowCloses,
  };
}
