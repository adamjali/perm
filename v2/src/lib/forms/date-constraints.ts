/**
 * Date Constraints for PERM Case Forms
 *
 * Calculates min/max date constraints for form fields based on PERM workflow rules.
 * Used to grey out invalid dates in date pickers.
 *
 * Rules are derived from perm_flow.md and 20 CFR § 656.40.
 *
 * KEY DEADLINES (accounting for 30-day waiting period before ETA 9089):
 * - Notice of Filing: min(150 days after first recruitment, 30 days before PWD exp)
 * - Job Order START: min(120 days after first recruitment, 60 days before PWD exp)
 * - 1st Sunday Ad: Last Sunday <= min(143 days after first recruitment, 37 days before PWD exp)
 * - 2nd Sunday Ad: Last Sunday <= min(150 days after first recruitment, 30 days before PWD exp)
 * - Additional Recruitment: min(150 days after first recruitment, 30 days before PWD exp)
 */

import { addDays, subDays, format, parseISO } from "date-fns";
import type { CaseFormData } from "./case-form-schema";
import {
  getFirstRecruitmentDate,
  getLastRecruitmentDate,
  isRecruitmentComplete,
  // Import centralized constants
  RECRUITMENT_WINDOW_DAYS,
  PWD_RECRUITMENT_BUFFER_DAYS,
  JOB_ORDER_START_DEADLINE_DAYS,
  JOB_ORDER_START_PWD_BUFFER_DAYS,
  FIRST_SUNDAY_AD_DEADLINE_DAYS,
  FIRST_SUNDAY_AD_PWD_BUFFER_DAYS,
  SECOND_SUNDAY_AD_DEADLINE_DAYS,
  SECOND_SUNDAY_AD_PWD_BUFFER_DAYS,
} from "../perm";

// Re-export for consumers that import from here
export { isRecruitmentComplete };

// ============================================================================
// Date Utilities
// ============================================================================

/** Get today's date as ISO string (YYYY-MM-DD) */
function today(): string {
  return format(new Date(), "yyyy-MM-dd");
}

/** Safely parse an ISO date string, returning null on failure */
function safeParseISO(dateStr: string | undefined | null): Date | null {
  if (!dateStr) return null;
  const parsed = parseISO(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/** Format a date string for display (e.g., "Jan 15, 2025") */
function formatDateForDisplay(dateStr: string): string {
  const parsed = safeParseISO(dateStr);
  return parsed ? format(parsed, "MMM d, yyyy") : dateStr;
}

/** Add days to a date string and return ISO format */
function addDaysToDateStr(dateStr: string, days: number): string {
  return format(addDays(new Date(dateStr + "T00:00:00"), days), "yyyy-MM-dd");
}

/** Subtract days from a date string and return ISO format */
function subDaysFromDateStr(dateStr: string, days: number): string {
  return format(subDays(new Date(dateStr + "T00:00:00"), days), "yyyy-MM-dd");
}

/**
 * Calculate the FIRST recruitment start date (earliest of any recruitment step)
 * Used throughout for 180-day filing window and recruitment deadline calculations
 *
 * Wraps canonical getFirstRecruitmentDate() from lib/perm.
 */
export function getFirstRecruitmentStartDate(values: Partial<CaseFormData>): string | undefined {
  return getFirstRecruitmentDate(values);
}

/**
 * Get the last Sunday on or before a given date string
 * Used for Sunday ad deadline calculations
 */
function getLastSundayOnOrBefore(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const dayOfWeek = date.getDay();
  if (dayOfWeek === 0) return dateStr; // Already Sunday
  date.setDate(date.getDate() - dayOfWeek);
  return format(date, "yyyy-MM-dd");
}

/**
 * Calculate recruitment field deadline based on perm_flow.md rules
 *
 * @param field - The recruitment field name
 * @param firstRecruitmentDate - Earliest recruitment start date
 * @param pwdExpiration - PWD expiration date
 * @returns { maxDate, limitingFactor } - The calculated max date and which constraint is limiting
 */
export function getRecruitmentFieldDeadline(
  field: string,
  firstRecruitmentDate: string | undefined,
  pwdExpiration: string | undefined
): { maxDate: string | undefined; limitingFactor: 'recruitment' | 'pwd' | undefined; hint: string } {
  // Field-specific rules from perm_flow.md:
  // - Notice of Filing: 150 days from first recruitment OR 30 days before PWD exp
  // - Job Order START: 120 days from first recruitment OR 60 days before PWD exp
  // - 1st Sunday Ad: 143 days from first recruitment OR 37 days before PWD exp (must be Sunday)
  // - 2nd Sunday Ad: 150 days from first recruitment OR 30 days before PWD exp (must be Sunday)

  // Deadline configuration using centralized constants from convex/lib/perm/constants.ts
  const deadlineConfig: Record<string, { daysFromRecruitment: number; daysBeforePwd: number; isSunday: boolean }> = {
    noticeOfFilingStartDate: { daysFromRecruitment: RECRUITMENT_WINDOW_DAYS, daysBeforePwd: PWD_RECRUITMENT_BUFFER_DAYS, isSunday: false },
    jobOrderStartDate: { daysFromRecruitment: JOB_ORDER_START_DEADLINE_DAYS, daysBeforePwd: JOB_ORDER_START_PWD_BUFFER_DAYS, isSunday: false },
    sundayAdFirstDate: { daysFromRecruitment: FIRST_SUNDAY_AD_DEADLINE_DAYS, daysBeforePwd: FIRST_SUNDAY_AD_PWD_BUFFER_DAYS, isSunday: true },
    sundayAdSecondDate: { daysFromRecruitment: SECOND_SUNDAY_AD_DEADLINE_DAYS, daysBeforePwd: SECOND_SUNDAY_AD_PWD_BUFFER_DAYS, isSunday: true },
    // Additional recruitment follows same rules as notice of filing
    additionalRecruitmentStartDate: { daysFromRecruitment: RECRUITMENT_WINDOW_DAYS, daysBeforePwd: PWD_RECRUITMENT_BUFFER_DAYS, isSunday: false },
    additionalRecruitmentEndDate: { daysFromRecruitment: RECRUITMENT_WINDOW_DAYS, daysBeforePwd: PWD_RECRUITMENT_BUFFER_DAYS, isSunday: false },
  };

  const config = deadlineConfig[field];
  if (!config) {
    return { maxDate: undefined, limitingFactor: undefined, hint: '' };
  }

  let maxFromRecruitment: string | undefined;
  let maxFromPwd: string | undefined;

  // Calculate based on first recruitment date
  if (firstRecruitmentDate) {
    const deadlineDate = format(addDays(new Date(firstRecruitmentDate + "T00:00:00"), config.daysFromRecruitment), "yyyy-MM-dd");
    maxFromRecruitment = config.isSunday ? getLastSundayOnOrBefore(deadlineDate) : deadlineDate;
  }

  // Calculate based on PWD expiration
  if (pwdExpiration) {
    const deadlineDate = format(subDays(new Date(pwdExpiration + "T00:00:00"), config.daysBeforePwd), "yyyy-MM-dd");
    maxFromPwd = config.isSunday ? getLastSundayOnOrBefore(deadlineDate) : deadlineDate;
  }

  // Determine which is the limiting factor (earlier date wins)
  let maxDate: string | undefined;
  let limitingFactor: 'recruitment' | 'pwd' | undefined;

  if (maxFromRecruitment && maxFromPwd) {
    if (maxFromRecruitment <= maxFromPwd) {
      maxDate = maxFromRecruitment;
      limitingFactor = 'recruitment';
    } else {
      maxDate = maxFromPwd;
      limitingFactor = 'pwd';
    }
  } else if (maxFromRecruitment) {
    maxDate = maxFromRecruitment;
    limitingFactor = 'recruitment';
  } else if (maxFromPwd) {
    maxDate = maxFromPwd;
    limitingFactor = 'pwd';
  }

  // Build hint explaining both constraints
  let hint = '';
  if (maxDate) {
    const sundayNote = config.isSunday ? ' (must be Sunday)' : '';
    if (limitingFactor === 'recruitment') {
      hint = `By ${formatDateForDisplay(maxDate)}${sundayNote} (${config.daysFromRecruitment} days from first recruitment)`;
    } else if (limitingFactor === 'pwd') {
      hint = `By ${formatDateForDisplay(maxDate)}${sundayNote} (${config.daysBeforePwd} days before PWD exp)`;
    }
  }

  return { maxDate, limitingFactor, hint };
}

/**
 * Calculate date constraints for PWD Section fields
 *
 * Per perm_flow.md:
 * - Filing date cannot be in the future
 * - Determination date must be STRICTLY AFTER filing (not same day) and cannot be in the future
 *
 * IMPORTANT: All "after" constraints use +1 day to exclude the boundary date itself.
 * This prevents entering the same date for dependent fields.
 */
export function getPWDDateConstraints(values: Partial<CaseFormData>) {
  const todayStr = today();
  const { pwdFilingDate, pwdDeterminationDate } = values;

  // Max filing: day BEFORE determination or today (whichever is earlier)
  const maxFiling = pwdDeterminationDate ? subDaysFromDateStr(pwdDeterminationDate, 1) : todayStr;
  const effectiveMaxFiling = maxFiling > todayStr ? todayStr : maxFiling;

  // Min determination: day AFTER filing
  const minDetermination = pwdFilingDate ? addDaysToDateStr(pwdFilingDate, 1) : undefined;

  return {
    pwdFilingDate: {
      max: effectiveMaxFiling,
      hint: pwdDeterminationDate
        ? `Must be before determination (${formatDateForDisplay(pwdDeterminationDate)})`
        : "Date PWD application was filed",
    },
    pwdDeterminationDate: {
      min: minDetermination,
      max: todayStr,
      hint: pwdFilingDate
        ? `Must be after filing (${formatDateForDisplay(pwdFilingDate)}). Triggers expiration calculation.`
        : "Enter filing date first. Triggers auto-calculation of expiration.",
    },
  };
}

/**
 * Calculate date constraints for Recruitment Section fields
 *
 * Per perm_flow.md, recruitment fields have BOTH min and max constraints:
 * - Min: STRICTLY AFTER PWD determination date (not same day)
 * - Max: Based on field-specific deadlines (see getRecruitmentFieldDeadline)
 *
 * IMPORTANT: All "after" constraints use +1 day to exclude the boundary date itself.
 */
export function getRecruitmentDateConstraints(values: Partial<CaseFormData>) {
  const firstRecruitmentDate = getFirstRecruitmentStartDate(values);
  const { pwdExpirationDate: pwdExpiration, pwdDeterminationDate: pwdDet, sundayAdFirstDate, jobOrderStartDate } = values;

  // Get deadlines for each field
  const deadlines = {
    sundayFirst: getRecruitmentFieldDeadline('sundayAdFirstDate', firstRecruitmentDate, pwdExpiration),
    sundaySecond: getRecruitmentFieldDeadline('sundayAdSecondDate', firstRecruitmentDate, pwdExpiration),
    jobOrder: getRecruitmentFieldDeadline('jobOrderStartDate', firstRecruitmentDate, pwdExpiration),
    notice: getRecruitmentFieldDeadline('noticeOfFilingStartDate', firstRecruitmentDate, pwdExpiration),
  };

  // Min date after PWD determination
  const minAfterPwd = pwdDet ? addDaysToDateStr(pwdDet, 1) : undefined;
  const pwdDisplay = pwdDet ? formatDateForDisplay(pwdDet) : '';

  return {
    sundayAdFirstDate: {
      min: minAfterPwd,
      max: deadlines.sundayFirst.maxDate,
      hint: pwdDet
        ? buildConstraintHint(`After ${pwdDisplay} (Sunday)`, deadlines.sundayFirst, `Must be a Sunday after ${pwdDisplay}`)
        : "Must be a Sunday. Enter PWD determination date first.",
    },
    sundayAdSecondDate: {
      min: sundayAdFirstDate ? addDaysToDateStr(sundayAdFirstDate, 7) : minAfterPwd,
      max: deadlines.sundaySecond.maxDate,
      hint: sundayAdFirstDate
        ? buildConstraintHint(`After ${formatDateForDisplay(sundayAdFirstDate)} + 7 days (Sunday)`, deadlines.sundaySecond, `Must be a Sunday, at least 7 days after ${formatDateForDisplay(sundayAdFirstDate)}`)
        : "Enter first Sunday ad date first. Must be 1+ week apart.",
    },
    jobOrderStartDate: {
      min: minAfterPwd,
      max: deadlines.jobOrder.maxDate,
      hint: pwdDet
        ? buildConstraintHint(`After ${pwdDisplay}`, deadlines.jobOrder, `After ${pwdDisplay}. Triggers auto-calculation of end date.`)
        : "Job order posting start. Enter PWD determination first.",
    },
    jobOrderEndDate: {
      min: jobOrderStartDate ? addDaysToDateStr(jobOrderStartDate, 30) : undefined,
      hint: jobOrderStartDate
        ? `Minimum 30 days required. Earliest: ${formatDateForDisplay(addDaysToDateStr(jobOrderStartDate, 30))}`
        : "Auto-calculated +30 days from start. Enter start date first.",
    },
    noticeOfFilingStartDate: {
      min: minAfterPwd,
      max: deadlines.notice.maxDate,
      hint: pwdDet
        ? buildConstraintHint(`After ${pwdDisplay}`, deadlines.notice, `After ${pwdDisplay}. Triggers auto-calculation of end date (+10 business days).`)
        : "Notice posting start. Enter PWD determination first.",
    },
  };
}

/** Build hint combining min description with deadline info */
function buildConstraintHint(
  minDescription: string,
  deadline: { maxDate: string | undefined; hint: string },
  defaultHint: string
): string {
  return deadline.maxDate && deadline.hint ? `${minDescription}. ${deadline.hint}` : defaultHint;
}

/**
 * Calculate date constraints for Professional Section (Additional Recruitment)
 *
 * Rules from perm_flow.md and 20 CFR § 656.40:
 * - Min date: STRICTLY AFTER PWD determination date (not same day)
 * - Max date: min(150 days from first recruitment, 30 days before PWD exp)
 *   This allows 30-day waiting period before ETA 9089 filing window opens
 *
 * IMPORTANT: All "after" constraints use +1 day to exclude the boundary date itself.
 */
export function getProfessionalDateConstraints(values: Partial<CaseFormData>) {
  const firstRecruitmentDate = getFirstRecruitmentStartDate(values);
  const { pwdExpirationDate: pwdExpiration, pwdDeterminationDate: pwdDet, additionalRecruitmentStartDate: startDate } = values;

  const startDeadline = getRecruitmentFieldDeadline('additionalRecruitmentStartDate', firstRecruitmentDate, pwdExpiration);
  const endDeadline = getRecruitmentFieldDeadline('additionalRecruitmentEndDate', firstRecruitmentDate, pwdExpiration);

  const minAfterPwd = pwdDet ? addDaysToDateStr(pwdDet, 1) : undefined;

  return {
    additionalRecruitmentStartDate: {
      min: minAfterPwd,
      max: startDeadline.maxDate,
      hint: buildAfterHint(pwdDet, startDeadline, "Enter PWD determination date first"),
    },
    additionalRecruitmentEndDate: {
      min: startDate ? addDaysToDateStr(startDate, 1) : minAfterPwd,
      max: endDeadline.maxDate,
      hint: buildAfterHint(startDate, endDeadline, "Enter start date first"),
    },
  };
}

/** Build hint for "after X" with optional deadline info */
function buildAfterHint(
  afterDate: string | undefined,
  deadline: { maxDate: string | undefined; hint: string },
  defaultHint: string
): string {
  if (!afterDate) return deadline.hint || defaultHint;
  const afterDisplay = `After ${formatDateForDisplay(afterDate)}`;
  return deadline.maxDate ? `${afterDisplay}. ${deadline.hint}` : afterDisplay;
}

/**
 * Calculate the LAST recruitment end date from all recruitment activities
 * Used for the 30-day waiting period before ETA 9089 filing per perm_flow.md
 *
 * Wraps canonical getLastRecruitmentDate() from lib/perm.
 * For professional occupations, includes all additional recruitment method dates.
 * For non-professional occupations, excludes additional recruitment dates.
 */
export function getRecruitmentEndDate(values: Partial<CaseFormData>): string | undefined {
  return getLastRecruitmentDate(values, values.isProfessionalOccupation ?? false);
}

/**
 * Calculate date constraints for ETA 9089 Section fields
 *
 * Per perm_flow.md:
 * - Filing window OPENS: 30 days after LAST recruitment step ends
 * - Filing window CLOSES: 180 days after FIRST recruitment step starts (or PWD expiration, whichever is first)
 */
export function getETA9089DateConstraints(values: Partial<CaseFormData>) {
  const recruitmentEnd = getRecruitmentEndDate(values);
  const firstRecruitmentDate = getFirstRecruitmentStartDate(values);
  const todayStr = today();
  const { eta9089FilingDate, eta9089AuditDate, pwdExpirationDate } = values;

  // Filing window: opens 30 days after last recruitment, closes 180 days after first
  const filingWindowOpen = recruitmentEnd ? addDaysToDateStr(recruitmentEnd, 30) : undefined;
  const filingWindowClose = firstRecruitmentDate ? addDaysToDateStr(firstRecruitmentDate, 180) : undefined;

  // Take earlier of window close or PWD expiration
  const { max: filingMax, pwdTrumps } = getEarlierDate(filingWindowClose, pwdExpirationDate);
  const effectiveMax = capToToday(filingMax, todayStr);

  // Build filing window hint
  const filingHint = buildFilingWindowHint(filingWindowOpen, filingMax, pwdTrumps, recruitmentEnd, firstRecruitmentDate);

  // Min for certification: after audit if exists, otherwise after filing
  const certMinRef = eta9089AuditDate || eta9089FilingDate;

  return {
    eta9089FilingDate: {
      min: filingWindowOpen,
      max: effectiveMax,
      hint: filingHint,
    },
    eta9089AuditDate: {
      min: eta9089FilingDate ? addDaysToDateStr(eta9089FilingDate, 1) : undefined,
      max: todayStr,
      hint: eta9089FilingDate
        ? `Must be after filing (${formatDateForDisplay(eta9089FilingDate)})`
        : "Enter filing date first",
    },
    eta9089CertificationDate: {
      min: certMinRef ? addDaysToDateStr(certMinRef, 1) : undefined,
      max: todayStr,
      hint: buildCertificationHint(eta9089AuditDate, eta9089FilingDate),
    },
  };
}

/** Get earlier of two dates with flag indicating which won */
function getEarlierDate(date1: string | undefined, date2: string | undefined): { max: string | undefined; pwdTrumps: boolean } {
  if (date1 && date2) {
    return date2 < date1 ? { max: date2, pwdTrumps: true } : { max: date1, pwdTrumps: false };
  }
  return { max: date1 || date2, pwdTrumps: !date1 && !!date2 };
}

/** Cap a date to today if in future */
function capToToday(date: string | undefined, todayStr: string): string | undefined {
  return date && todayStr < date ? todayStr : date;
}

/** Build filing window hint */
function buildFilingWindowHint(
  windowOpen: string | undefined,
  windowMax: string | undefined,
  pwdTrumps: boolean,
  recruitmentEnd: string | undefined,
  firstRecruitmentDate: string | undefined
): string {
  if (windowOpen && windowMax) {
    const pwdNote = pwdTrumps ? " (limited by PWD expiration)" : "";
    return `Filing window: ${formatDateForDisplay(windowOpen)} to ${formatDateForDisplay(windowMax)}${pwdNote}`;
  }
  if (recruitmentEnd && !firstRecruitmentDate) return "Enter first recruitment start date to calculate window close.";
  if (firstRecruitmentDate && !recruitmentEnd) return "Complete recruitment end dates to open filing window.";
  return "Complete recruitment dates first. Window: 30 days after last recruitment to 180 days after first.";
}

/** Build certification hint */
function buildCertificationHint(auditDate: string | undefined, filingDate: string | undefined): string {
  if (auditDate) return `Must be after audit (${formatDateForDisplay(auditDate)}). Triggers auto-calculation of expiration (+180 days).`;
  if (filingDate) return `Must be after filing (${formatDateForDisplay(filingDate)}). Triggers auto-calculation of expiration.`;
  return "Enter filing date first. Triggers auto-calculation of expiration (+180 days).";
}

/**
 * Get minimum received date for RFI entries (within ETA 9089)
 * Individual entry constraints are handled in RFIEntry component
 */
export function getRFIMinReceivedDate(values: Partial<CaseFormData>): string | undefined {
  return values.eta9089FilingDate || undefined;
}

/**
 * Calculate date constraints for I-140 Section fields
 *
 * Per perm_flow.md:
 * - Filing must be after ETA 9089 certification, within 180 days
 * - Receipt, approval, and denial dates cannot be in the future
 */
export function getI140DateConstraints(values: Partial<CaseFormData>) {
  const todayStr = today();
  const { eta9089CertificationDate: certDate, eta9089ExpirationDate: expDate, i140FilingDate, i140ReceiptDate } = values;

  // Filing deadline: 180 days from certification or ETA expiration (whichever earlier)
  const filingDeadline = certDate ? addDaysToDateStr(certDate, 180) : undefined;
  const { max: filingMax } = getEarlierDate(filingDeadline, expDate);
  const effectiveFilingMax = capToToday(filingMax, todayStr);

  // Min dates for approval/denial: after receipt (or filing if no receipt)
  const approvalDenialMin = i140ReceiptDate || i140FilingDate;

  return {
    i140FilingDate: {
      min: certDate ? addDaysToDateStr(certDate, 1) : undefined,
      max: effectiveFilingMax,
      hint: certDate && filingMax
        ? `Must be after ${formatDateForDisplay(certDate)}, within 180 days of certification`
        : "Enter ETA 9089 certification date first. Filing must be after certification.",
    },
    i140ReceiptDate: {
      min: i140FilingDate ? addDaysToDateStr(i140FilingDate, 1) : undefined,
      max: todayStr,
      hint: buildAfterDateHint(i140FilingDate, "filing"),
    },
    i140ApprovalDate: {
      min: approvalDenialMin ? addDaysToDateStr(approvalDenialMin, 1) : undefined,
      max: todayStr,
      hint: buildAfterDateHint(i140ReceiptDate, "receipt") || buildAfterDateHint(i140FilingDate, "filing"),
    },
    i140DenialDate: {
      min: approvalDenialMin ? addDaysToDateStr(approvalDenialMin, 1) : undefined,
      max: todayStr,
      hint: buildAfterDateHint(i140ReceiptDate, "receipt") || buildAfterDateHint(i140FilingDate, "filing"),
    },
  };
}

/** Build simple "after X" hint */
function buildAfterDateHint(date: string | undefined, label: string): string {
  return date ? `Must be after ${label} (${formatDateForDisplay(date)})` : "Enter filing date first";
}

/**
 * Get minimum received date for RFE entries (within I-140)
 * Individual entry constraints are handled in RFEEntry component
 */
export function getRFEMinReceivedDate(values: Partial<CaseFormData>): string | undefined {
  return values.i140FilingDate || undefined;
}

/**
 * Combined type for all date constraints
 */
export interface DateConstraint {
  min?: string;
  max?: string;
  hint?: string;
}

// isRecruitmentComplete is now imported from @/lib/perm (canonical source)

/**
 * Get all date constraints for the entire form
 * Note: RFI/RFE date constraints are now handled within individual entry components
 * using getRFIMinReceivedDate() and getRFEMinReceivedDate() helpers
 */
export function getAllDateConstraints(values: Partial<CaseFormData>): Record<string, DateConstraint> {
  return {
    ...getPWDDateConstraints(values),
    ...getRecruitmentDateConstraints(values),
    ...getProfessionalDateConstraints(values),
    ...getETA9089DateConstraints(values),
    ...getI140DateConstraints(values),
  };
}

/**
 * Get the date when the ETA 9089 filing window opens (30 days after last recruitment step)
 * Returns undefined if recruitment is not complete or date is invalid
 */
export function getEta9089WindowOpenDate(values: Partial<CaseFormData>): string | undefined {
  const recruitmentEndDate = getRecruitmentEndDate(values);
  if (!recruitmentEndDate) return undefined;

  const parsed = safeParseISO(recruitmentEndDate);
  if (!parsed) return undefined;

  const windowOpenDate = addDays(parsed, 30);
  return format(windowOpenDate, "yyyy-MM-dd");
}

/**
 * Check if the ETA 9089 filing window is open (30+ days have passed since last recruitment step)
 * Returns true if recruitment is complete AND 30 days have passed since the last step
 */
export function isEta9089WindowOpen(values: Partial<CaseFormData>): boolean {
  if (!isRecruitmentComplete(values)) return false;

  const windowOpenDate = getEta9089WindowOpenDate(values);
  if (!windowOpenDate) return false;

  const todayStr = format(new Date(), "yyyy-MM-dd");
  return todayStr >= windowOpenDate;
}

/**
 * Get the number of days remaining until ETA 9089 filing window opens
 * Returns undefined if recruitment is not complete or date is invalid, or negative if window is already open
 */
export function getDaysUntilEta9089Window(values: Partial<CaseFormData>): number | undefined {
  const recruitmentEndDate = getRecruitmentEndDate(values);
  if (!recruitmentEndDate) return undefined;

  const parsed = safeParseISO(recruitmentEndDate);
  if (!parsed) return undefined;

  const windowOpenDate = addDays(parsed, 30);
  const today = new Date();
  const diffTime = windowOpenDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}
