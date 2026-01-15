/**
 * ETA 9089 Filing Window Calculation
 *
 * CANONICAL SOURCE for filing window calculations per 20 CFR 656.17.
 *
 * Rules:
 * - Window OPENS: 30 days after LAST recruitment step ends
 * - Window CLOSES: 180 days after FIRST recruitment step starts
 *   (or PWD expiration date, whichever is earlier)
 * - Recruitment must COMPLETE: 150 days after FIRST recruitment step starts
 *   (or 30 days before PWD expiration, whichever is earlier)
 *
 * @see convex/lib/perm/constants.ts - SINGLE SOURCE OF TRUTH for all constants
 * @see convex/lib/derivedCalculations.ts - Convex backend version
 * @module
 */

import { differenceInDays, format, max, min, parseISO, isValid } from "date-fns";

// ============================================================================
// CONSTANTS - Imported from single source of truth
// ============================================================================

import {
  FILING_WINDOW_WAIT_DAYS,
  FILING_WINDOW_CLOSE_DAYS,
  RECRUITMENT_WINDOW_DAYS,
  PWD_RECRUITMENT_BUFFER_DAYS,
} from "../constants";

// Re-export for consumers that import from this file
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
 * Filing window for ETA 9089 application
 */
export interface FilingWindow {
  /** ISO date when window opens (recruitment end + 30 days) */
  opens: string;
  /** ISO date when window closes (first recruitment + 180 days, or PWD expiration) */
  closes: string;
  /** Whether PWD expiration truncates the window */
  isPwdLimited: boolean;
}

/**
 * Filing window status with timing information
 */
export interface FilingWindowStatus {
  /** Current status of the filing window */
  status: "waiting" | "open" | "closed";
  /** Filing window dates (if calculable) */
  window?: FilingWindow;
  /** Days until window opens (if waiting) */
  daysUntilOpen?: number;
  /** Days remaining in window (if open) */
  daysRemaining?: number;
  /** Human-readable message */
  message: string;
}

/**
 * Input data for filing window calculation
 */
export interface FilingWindowInput {
  // First recruitment date (earliest of recruitment start dates)
  firstRecruitmentDate?: string;
  // Last recruitment date (latest of recruitment end dates)
  lastRecruitmentDate?: string;
  // PWD expiration date (optional constraint)
  pwdExpirationDate?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Safely parse an ISO date string to UTC midnight.
 * This ensures consistent date math regardless of local timezone.
 * Matches the parsing logic in derivedCalculations.ts.
 */
function safeParseISO(dateStr: string | undefined | null): Date | null {
  if (!dateStr) return null;
  try {
    // Parse as UTC midnight to avoid timezone issues with date-only strings
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      // Fallback to date-fns for non-standard formats
      const parsed = parseISO(dateStr);
      return isValid(parsed) && !isNaN(parsed.getTime()) ? parsed : null;
    }
    const [, year, month, day] = match;
    const parsed = new Date(Date.UTC(parseInt(year!, 10), parseInt(month!, 10) - 1, parseInt(day!, 10)));
    return !isNaN(parsed.getTime()) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Add days to a date in UTC (avoids DST issues)
 */
function addDaysUTC(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/**
 * Format a Date to ISO date string (YYYY-MM-DD) using UTC.
 * This ensures consistent formatting regardless of local timezone.
 */
function formatUTC(date: Date): string {
  return date.toISOString().split("T")[0]!;
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Calculate the ETA 9089 filing window.
 *
 * Per 20 CFR 656.17:
 * - Must wait 30 days after recruitment ends before filing
 * - Must file within 180 days of first recruitment step
 * - Cannot file after PWD expiration
 *
 * @param input - Dates needed for calculation
 * @returns Filing window or null if insufficient data
 *
 * @example
 * const window = calculateFilingWindow({
 *   firstRecruitmentDate: "2024-01-15",
 *   lastRecruitmentDate: "2024-02-20",
 *   pwdExpirationDate: "2024-12-31",
 * });
 * // { opens: "2024-03-21", closes: "2024-07-13", isPwdLimited: false }
 */
export function calculateFilingWindow(
  input: FilingWindowInput
): FilingWindow | null {
  const firstDate = safeParseISO(input.firstRecruitmentDate);
  const lastDate = safeParseISO(input.lastRecruitmentDate);

  if (!firstDate || !lastDate) {
    return null;
  }

  // Window opens 30 days after last recruitment ends
  const opensDate = addDaysUTC(lastDate, FILING_WINDOW_WAIT_DAYS);
  const opens = formatUTC(opensDate);

  // Window closes 180 days after first recruitment starts
  const naturalCloseDate = addDaysUTC(firstDate, FILING_WINDOW_CLOSE_DAYS);
  const naturalCloseISO = formatUTC(naturalCloseDate);
  let closes = naturalCloseISO;
  let isPwdLimited = false;

  // PWD expiration can truncate the window
  // Compare by date string (YYYY-MM-DD) to avoid DST timestamp issues
  const pwdDate = safeParseISO(input.pwdExpirationDate);
  if (pwdDate) {
    const pwdISO = formatUTC(pwdDate);
    if (pwdISO < naturalCloseISO) {
      closes = pwdISO;
      isPwdLimited = true;
    }
  }

  return { opens, closes, isPwdLimited };
}

/**
 * Get the current status of the filing window.
 *
 * @param input - Dates needed for calculation
 * @param referenceDate - Date to check against (defaults to today)
 * @returns Filing window status with timing information
 *
 * @example
 * const status = getFilingWindowStatus({
 *   firstRecruitmentDate: "2024-01-15",
 *   lastRecruitmentDate: "2024-02-20",
 * });
 * // { status: "open", window: {...}, daysRemaining: 45, message: "..." }
 */
export function getFilingWindowStatus(
  input: FilingWindowInput,
  referenceDate?: Date
): FilingWindowStatus {
  const window = calculateFilingWindow(input);
  const today = referenceDate ?? new Date();
  today.setHours(0, 0, 0, 0);

  if (!window) {
    return {
      status: "closed",
      message: "Complete recruitment dates to calculate filing window",
    };
  }

  const opensDate = parseISO(window.opens);
  const closesDate = parseISO(window.closes);

  // Check if window is valid (opens before closes)
  if (opensDate > closesDate) {
    return {
      status: "closed",
      window,
      message: "Filing window is invalid (opens after it closes). Review recruitment dates.",
    };
  }

  if (today < opensDate) {
    const daysUntilOpen = differenceInDays(opensDate, today);
    return {
      status: "waiting",
      window,
      daysUntilOpen,
      message: `Must wait ${daysUntilOpen} day${daysUntilOpen === 1 ? "" : "s"} before filing`,
    };
  }

  if (today <= closesDate) {
    const daysRemaining = differenceInDays(closesDate, today);
    const pwdNote = window.isPwdLimited ? " (limited by PWD expiration)" : "";
    return {
      status: "open",
      window,
      daysRemaining,
      message: `Ready to file! ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining${pwdNote}`,
    };
  }

  return {
    status: "closed",
    window,
    message: "Filing window has closed. Must restart recruitment.",
  };
}

/**
 * Format a filing window for display.
 *
 * @param window - Filing window to format
 * @returns Formatted string like "Mar 21, 2024 - Jul 13, 2024"
 */
export function formatFilingWindow(window: FilingWindow): string {
  const opens = format(parseISO(window.opens), "MMM d, yyyy");
  const closes = format(parseISO(window.closes), "MMM d, yyyy");
  const pwdNote = window.isPwdLimited ? " (PWD limited)" : "";
  return `${opens} - ${closes}${pwdNote}`;
}

// ============================================================================
// RECRUITMENT WINDOW CALCULATION
// ============================================================================

/**
 * Result of recruitment window calculation
 */
export interface RecruitmentWindow {
  /** ISO date when recruitment must complete */
  closes: string;
  /** Whether PWD constraint is limiting (vs 150-day rule) */
  isPwdLimited: boolean;
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
 * @param firstRecruitmentDate - Earliest recruitment start date (ISO string)
 * @param pwdExpirationDate - PWD expiration date (ISO string)
 * @returns RecruitmentWindow or null if insufficient data
 *
 * @example
 * const window = calculateRecruitmentWindowCloses("2024-01-15", "2024-12-31");
 * // { closes: "2024-06-13", isPwdLimited: false } // 150 days from first
 *
 * @example
 * const window = calculateRecruitmentWindowCloses("2024-01-15", "2024-05-01");
 * // { closes: "2024-04-01", isPwdLimited: true } // pwd - 30 is earlier
 */
export function calculateRecruitmentWindowCloses(
  firstRecruitmentDate: string | undefined,
  pwdExpirationDate: string | undefined
): RecruitmentWindow | null {
  const firstDate = safeParseISO(firstRecruitmentDate);
  const pwdDate = safeParseISO(pwdExpirationDate);

  if (!firstDate) {
    return null;
  }

  // 150 days from first recruitment
  const naturalClose = addDaysUTC(firstDate, RECRUITMENT_WINDOW_DAYS);
  const naturalCloseISO = formatUTC(naturalClose);

  // If no PWD, use natural close
  if (!pwdDate) {
    return {
      closes: naturalCloseISO,
      isPwdLimited: false,
    };
  }

  // PWD constraint: must complete 30 days before PWD expires
  const pwdConstraint = addDaysUTC(pwdDate, -PWD_RECRUITMENT_BUFFER_DAYS);
  const pwdConstraintISO = formatUTC(pwdConstraint);

  // Take the earlier of the two
  // Compare by date string (YYYY-MM-DD) to avoid DST timestamp issues
  if (pwdConstraintISO < naturalCloseISO) {
    return {
      closes: pwdConstraintISO,
      isPwdLimited: true,
    };
  }

  return {
    closes: naturalCloseISO,
    isPwdLimited: false,
  };
}

/**
 * Calculate recruitment window from case data.
 * Convenience function that extracts first date and calculates window.
 *
 * @param caseData - Case data with recruitment fields
 * @returns RecruitmentWindow or null
 */
export function calculateRecruitmentWindowFromCase(caseData: {
  sundayAdFirstDate?: string;
  jobOrderStartDate?: string;
  noticeOfFilingStartDate?: string;
  pwdExpirationDate?: string;
}): RecruitmentWindow | null {
  const firstRecruitmentDate = getFirstRecruitmentDate(caseData);
  return calculateRecruitmentWindowCloses(firstRecruitmentDate, caseData.pwdExpirationDate);
}

// ============================================================================
// CONVENIENCE EXTRACTORS
// ============================================================================

/**
 * Extract first recruitment date from case data.
 * First = earliest of (first Sunday ad, job order start, notice of filing start)
 *
 * @param data - Object with recruitment date fields
 * @returns ISO date string or undefined
 */
export function getFirstRecruitmentDate(data: {
  sundayAdFirstDate?: string;
  jobOrderStartDate?: string;
  noticeOfFilingStartDate?: string;
}): string | undefined {
  const dates = [
    data.sundayAdFirstDate,
    data.jobOrderStartDate,
    data.noticeOfFilingStartDate,
  ].filter((d): d is string => !!d);

  if (dates.length === 0) return undefined;

  // Return earliest date (parsed as UTC for consistency)
  const parsed = dates
    .map((d) => safeParseISO(d))
    .filter((d): d is Date => d !== null);
  if (parsed.length === 0) return undefined;

  return formatUTC(min(parsed));
}

/**
 * Extract last recruitment date from case data.
 * Last = latest of (second Sunday ad, job order end, notice of filing end)
 * For professional occupations: also includes additional recruitment end dates
 *
 * IMPORTANT: Additional recruitment dates (additionalRecruitmentEndDate, additionalRecruitmentMethods)
 * should ONLY be included if isProfessionalOccupation is true. Non-professional cases
 * should ignore these dates even if filled out.
 *
 * @param data - Object with recruitment date fields
 * @param isProfessionalOccupation - Whether to include additional recruitment dates (default: false)
 * @returns ISO date string or undefined
 */
export function getLastRecruitmentDate(
  data: {
    sundayAdSecondDate?: string;
    jobOrderEndDate?: string;
    noticeOfFilingEndDate?: string;
    additionalRecruitmentEndDate?: string;
    additionalRecruitmentMethods?: Array<{ date?: string }>;
  },
  isProfessionalOccupation: boolean = false
): string | undefined {
  // Base recruitment dates (required for all cases)
  const dates = [
    data.sundayAdSecondDate,
    data.jobOrderEndDate,
    data.noticeOfFilingEndDate,
  ].filter((d): d is string => !!d);

  // Professional occupation dates (only if applicable)
  if (isProfessionalOccupation) {
    if (data.additionalRecruitmentEndDate) {
      dates.push(data.additionalRecruitmentEndDate);
    }

    // Include individual additional method dates
    if (data.additionalRecruitmentMethods) {
      data.additionalRecruitmentMethods.forEach((method) => {
        if (method.date) dates.push(method.date);
      });
    }
  }

  if (dates.length === 0) return undefined;

  // Return latest date (parsed as UTC for consistency)
  const parsed = dates
    .map((d) => safeParseISO(d))
    .filter((d): d is Date => d !== null);
  if (parsed.length === 0) return undefined;

  return formatUTC(max(parsed));
}

/**
 * Calculate filing window from case data.
 * Convenience function that extracts dates and calculates window.
 *
 * @param caseData - Case data with all recruitment fields
 * @returns Filing window or null
 */
export function calculateFilingWindowFromCase(caseData: {
  sundayAdFirstDate?: string;
  sundayAdSecondDate?: string;
  jobOrderStartDate?: string;
  jobOrderEndDate?: string;
  noticeOfFilingStartDate?: string;
  noticeOfFilingEndDate?: string;
  additionalRecruitmentEndDate?: string;
  additionalRecruitmentMethods?: Array<{ date?: string }>;
  pwdExpirationDate?: string;
  isProfessionalOccupation?: boolean;
}): FilingWindow | null {
  return calculateFilingWindow({
    firstRecruitmentDate: getFirstRecruitmentDate(caseData),
    lastRecruitmentDate: getLastRecruitmentDate(caseData, caseData.isProfessionalOccupation ?? false),
    pwdExpirationDate: caseData.pwdExpirationDate,
  });
}

/**
 * Get filing window status from case data.
 * Convenience function that extracts dates and calculates status.
 *
 * @param caseData - Case data with all recruitment fields
 * @param referenceDate - Date to check against (defaults to today)
 * @returns Filing window status
 */
export function getFilingWindowStatusFromCase(
  caseData: {
    sundayAdFirstDate?: string;
    sundayAdSecondDate?: string;
    jobOrderStartDate?: string;
    jobOrderEndDate?: string;
    noticeOfFilingStartDate?: string;
    noticeOfFilingEndDate?: string;
    additionalRecruitmentEndDate?: string;
    additionalRecruitmentMethods?: Array<{ date?: string }>;
    pwdExpirationDate?: string;
    isProfessionalOccupation?: boolean;
  },
  referenceDate?: Date
): FilingWindowStatus {
  return getFilingWindowStatus(
    {
      firstRecruitmentDate: getFirstRecruitmentDate(caseData),
      lastRecruitmentDate: getLastRecruitmentDate(caseData, caseData.isProfessionalOccupation ?? false),
      pwdExpirationDate: caseData.pwdExpirationDate,
    },
    referenceDate
  );
}
