/**
 * Deadline Enforcement Helper Functions
 *
 * Pure functions for automatic deadline enforcement logic.
 * All functions are testable without database dependencies.
 *
 * Business Rules (per perm_flow.md lines 74-78):
 * 1. PWD expires before ETA 9089 filed → case closed
 * 2. 180-day recruitment window missed → restart recruitment if PWD >60 days, else close
 * 3. ETA 9089 filing window missed → restart recruitment if PWD >60 days, else close
 * 4. ETA 9089 certification expired → restart if possible, else close
 *
 * @see /perm_flow.md - Source of truth for business rules
 * @see ./derivedCalculations.ts - Reuses date calculation patterns
 * @module
 */

import {
  isValidISODate,
  parseISOToUTCSafe,
  getTodayISO,
  MS_PER_DAY,
} from "./dateValidation";
import {
  ENFORCEMENT_TIMEZONE_RULES,
  getTodayInTimezone,
  getEffectiveTimezone,
  DEFAULT_USER_TIMEZONE,
} from "./perm/deadlines/timezones";

// Re-export for backwards compatibility
export { getTodayISO };

// Re-export type for shared mapping
import type { DeadlineNotificationType } from "./notificationHelpers";
import {
  isRecruitmentComplete,
  type RecruitmentCheckInput,
} from "./perm/recruitment/isRecruitmentComplete";

// ============================================================================
// CONSTANTS
// ============================================================================

/** Days before PWD expiration when restart is no longer viable */
export const MIN_DAYS_FOR_RESTART = 60;

/** Days for ETA 9089 certification validity (I-140 must file within this) */
export const ETA9089_VALIDITY_DAYS = 180;

/** Map ViolationType to DeadlineNotificationType for email formatting. Single source of truth. */
export const VIOLATION_TO_DEADLINE_TYPE: Record<ViolationType, DeadlineNotificationType> = {
  pwd_expired: "pwd_expiration",
  recruitment_window_missed: "recruitment_window",
  filing_window_missed: "filing_window_closes",
  eta9089_expired: "eta9089_expiration",
};

// ============================================================================
// TYPES
// ============================================================================

/**
 * Types of deadline violations that can trigger case closure.
 * Matches the closureReason field in schema.
 */
export type ViolationType =
  | "pwd_expired"
  | "recruitment_window_missed"
  | "filing_window_missed"
  | "eta9089_expired";

/**
 * Suggested action when a deadline violation is detected.
 */
export type SuggestedAction = "close" | "restart_recruitment" | "restart_eta9089";

/**
 * Result of deadline violation check.
 */
export interface DeadlineViolation {
  /** Type of deadline violated */
  type: ViolationType;
  /** Human-readable reason for the violation */
  reason: string;
  /** Suggested remediation action */
  suggestedAction: SuggestedAction;
  /** Whether restart is viable (PWD has >60 days remaining) */
  canRestart: boolean;
}

/**
 * Case data required for deadline enforcement checks.
 * Subset of full case data focused on relevant fields.
 */
export interface CaseDataForEnforcement {
  caseStatus: string;
  deletedAt?: number;

  // PWD phase
  pwdExpirationDate?: string | null;

  // Recruitment phase
  recruitmentStartDate?: string | null;
  /** Derived last recruitment date — when recruitment actually finished. */
  recruitmentEndDate?: string | null;
  /**
   * Whether every required recruitment step has a date (basic steps, plus the
   * 3 additional methods for professional occupations).
   *
   * Required to tell "recruitment was never finished" apart from "recruitment
   * finished on time and the deadline has since passed" — the two look
   * identical if you only compare the window date against today.
   */
  recruitmentComplete?: boolean;
  recruitmentWindowCloses?: string | null;
  filingWindowCloses?: string | null;

  // ETA 9089 phase
  eta9089FilingDate?: string | null;
  eta9089CertificationDate?: string | null;
  eta9089ExpirationDate?: string | null;

  // I-140 phase
  i140FilingDate?: string | null;
}

/**
 * Map a case document to the enforcement check format.
 * Accepts any object with these optional fields (e.g., Doc<"cases">).
 */
export function mapCaseToEnforcementData(
  caseDoc: CaseDataForEnforcement & Record<string, unknown>
): CaseDataForEnforcement {
  return {
    caseStatus: caseDoc.caseStatus,
    deletedAt: caseDoc.deletedAt,
    pwdExpirationDate: caseDoc.pwdExpirationDate,
    recruitmentStartDate: caseDoc.recruitmentStartDate,
    recruitmentEndDate: caseDoc.recruitmentEndDate,
    // Computed from the raw recruitment fields on the doc rather than stored,
    // so it can never go stale relative to the dates it summarises. The cast is
    // needed only because the parameter's `Record<string, unknown>` index
    // signature shares no declared properties with RecruitmentCheckInput;
    // a case document does carry these camelCase fields.
    recruitmentComplete: isRecruitmentComplete(caseDoc as RecruitmentCheckInput),
    recruitmentWindowCloses: caseDoc.recruitmentWindowCloses,
    filingWindowCloses: caseDoc.filingWindowCloses,
    eta9089FilingDate: caseDoc.eta9089FilingDate,
    eta9089CertificationDate: caseDoc.eta9089CertificationDate,
    eta9089ExpirationDate: caseDoc.eta9089ExpirationDate,
    i140FilingDate: caseDoc.i140FilingDate,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate days between two ISO date strings.
 * Returns null for invalid dates (non-throwing variant for enforcement checks).
 */
function daysBetween(fromISO: string, toISO: string): number | null {
  const fromUTC = parseISOToUTCSafe(fromISO);
  const toUTC = parseISOToUTCSafe(toISO);

  if (fromUTC === null || toUTC === null) return null;

  return Math.floor((toUTC - fromUTC) / MS_PER_DAY);
}

// ============================================================================
// MAIN ENFORCEMENT FUNCTIONS
// ============================================================================

/**
 * Check if there's enough time to restart recruitment or ETA 9089.
 *
 * Per perm_flow.md: If PWD has 60 days or less remaining, case must close
 * because there isn't enough time to restart the process.
 *
 * @param pwdExpirationDate - PWD expiration date (ISO string)
 * @param todayISO - Reference date (ISO string)
 * @returns true if >60 days until PWD expiration
 *
 * @example
 * canRestartProcess("2024-12-31", "2024-10-01") // true (91 days)
 * canRestartProcess("2024-11-15", "2024-10-01") // false (45 days)
 */
export function canRestartProcess(
  pwdExpirationDate: string | null | undefined,
  todayISO: string
): boolean {
  if (!isValidISODate(pwdExpirationDate)) {
    // No PWD expiration means we can't assess restart viability
    // Default to false (conservative - require restart consideration)
    return false;
  }

  const daysRemaining = daysBetween(todayISO, pwdExpirationDate);

  if (daysRemaining === null) return false;

  return daysRemaining > MIN_DAYS_FOR_RESTART;
}

/**
 * Check for PWD expiration violation.
 *
 * Rule: PWD expires before ETA 9089 filed → case must close
 *
 * @param caseData - Case data for enforcement check
 * @param todayISO - Reference date (ISO string)
 * @returns DeadlineViolation or null if no violation
 */
function checkPwdExpiration(
  caseData: CaseDataForEnforcement,
  todayISO: string
): DeadlineViolation | null {
  // Only check if we have PWD expiration and ETA 9089 is NOT filed
  if (!isValidISODate(caseData.pwdExpirationDate)) return null;
  if (caseData.eta9089FilingDate) return null; // ETA 9089 already filed, PWD expiration doesn't matter

  const daysUntil = daysBetween(todayISO, caseData.pwdExpirationDate);

  if (daysUntil === null) return null;

  // PWD has expired (past the date)
  if (daysUntil < 0) {
    return {
      type: "pwd_expired",
      reason: `PWD expired on ${caseData.pwdExpirationDate}. ETA 9089 was not filed before expiration.`,
      suggestedAction: "close",
      canRestart: false, // PWD expired = must start entirely new PERM process
    };
  }

  return null;
}

/**
 * Check for recruitment window missed violation.
 *
 * Rule: 180-day recruitment window missed →
 *   - If PWD has >60 days: can restart recruitment
 *   - If PWD has ≤60 days: case must close
 *
 * @param caseData - Case data for enforcement check
 * @param todayISO - Reference date (ISO string)
 * @returns DeadlineViolation or null if no violation
 */
function checkRecruitmentWindow(
  caseData: CaseDataForEnforcement,
  todayISO: string,
  dolTodayISO?: string
): DeadlineViolation | null {
  // Only check if ETA 9089 is NOT filed and we have recruitment data
  if (caseData.eta9089FilingDate) return null;
  if (!caseData.recruitmentStartDate) return null; // No recruitment started yet

  // Use stored recruitmentWindowCloses if available, fall back to filingWindowCloses.
  // When falling back to filingWindowCloses (a DOL-governed date), use DOL "today"
  const windowCloses = caseData.recruitmentWindowCloses || caseData.filingWindowCloses;
  const useDolDate = !caseData.recruitmentWindowCloses && !!caseData.filingWindowCloses;
  const effectiveToday = useDolDate && dolTodayISO ? dolTodayISO : todayISO;

  if (!isValidISODate(windowCloses)) return null;

  // This window governs when recruitment must FINISH — nothing after that.
  // Recruitment that completed on or before it met the deadline, so the date
  // passing later is not a violation. Without this, every compliant case became
  // a violation the moment its window date slipped into the past, and the daily
  // enforcement cron closed it again every night.
  //
  // Both halves are required. `recruitmentComplete` alone would spare a case
  // whose steps were all backfilled long after the deadline; the end-date
  // comparison alone would spare a case with, say, a job order but no Sunday
  // ads, because a partial end date can still precede the window.
  //
  // Cases that genuinely never finished still fall through to a violation here,
  // and cases that finished in time but never file are still caught downstream
  // by checkFilingWindow and checkPwdExpiration.
  if (
    caseData.recruitmentComplete &&
    isValidISODate(caseData.recruitmentEndDate) &&
    caseData.recruitmentEndDate <= windowCloses
  ) {
    return null;
  }

  const daysUntil = daysBetween(effectiveToday, windowCloses);

  if (daysUntil === null) return null;

  // Window has closed (past the date)
  if (daysUntil < 0) {
    const canRestart = canRestartProcess(caseData.pwdExpirationDate, todayISO);

    // Name the deadline that was actually missed. When recruitmentWindowCloses
    // is absent we are reading the ETA 9089 filing date, which is a different
    // obligation and a different regulation — reporting it as the 180-day
    // recruitment rule sent people to re-check dates that were never at fault.
    const reason = useDolDate
      ? `Recruitment was not completed before the ETA 9089 filing window closed on ${windowCloses}.`
      : `Recruitment window closed on ${windowCloses}. Recruitment was not completed by the deadline.`;

    return {
      type: "recruitment_window_missed",
      reason,
      suggestedAction: canRestart ? "restart_recruitment" : "close",
      canRestart,
    };
  }

  return null;
}

/**
 * Check for ETA 9089 filing window missed violation.
 *
 * Rule: ETA 9089 filing window missed (180 days from first recruitment OR PWD expired) →
 *   - If PWD has >60 days: can restart recruitment
 *   - If PWD has ≤60 days: case must close
 *
 * @param caseData - Case data for enforcement check
 * @param todayISO - Reference date (ISO string)
 * @returns DeadlineViolation or null if no violation
 */
function checkFilingWindow(
  caseData: CaseDataForEnforcement,
  todayISO: string
): DeadlineViolation | null {
  // Only check if ETA 9089 is NOT filed
  if (caseData.eta9089FilingDate) return null;

  if (!isValidISODate(caseData.filingWindowCloses)) return null;

  const daysUntil = daysBetween(todayISO, caseData.filingWindowCloses);

  if (daysUntil === null) return null;

  // Filing window has closed
  if (daysUntil < 0) {
    const canRestart = canRestartProcess(caseData.pwdExpirationDate, todayISO);

    return {
      type: "filing_window_missed",
      reason: `ETA 9089 filing window closed on ${caseData.filingWindowCloses}. ETA 9089 was not filed in time.`,
      suggestedAction: canRestart ? "restart_recruitment" : "close",
      canRestart,
    };
  }

  return null;
}

/**
 * Check for ETA 9089 certification expiration violation.
 *
 * Rule: ETA 9089 certified but I-140 not filed within 180 days →
 *   - If within 180 days of first recruitment AND PWD valid: can restart ETA 9089
 *   - Otherwise: case must close
 *
 * @param caseData - Case data for enforcement check
 * @param todayISO - Reference date (ISO string)
 * @returns DeadlineViolation or null if no violation
 */
function checkEta9089Expiration(
  caseData: CaseDataForEnforcement,
  todayISO: string,
  dolTodayISO?: string
): DeadlineViolation | null {
  // Only check if ETA 9089 is certified AND I-140 is NOT filed
  if (!caseData.eta9089CertificationDate) return null;
  if (caseData.i140FilingDate) return null;

  // Use stored expiration or calculate from certification date
  let expirationDate = caseData.eta9089ExpirationDate;

  if (!isValidISODate(expirationDate)) {
    // Calculate expiration: certification + 180 days
    const certUTC = parseISOToUTCSafe(caseData.eta9089CertificationDate);
    if (certUTC === null) return null;

    const expDate = new Date(certUTC + ETA9089_VALIDITY_DAYS * 24 * 60 * 60 * 1000);
    expirationDate = expDate.toISOString().split("T")[0]!;
  }

  const daysUntil = daysBetween(todayISO, expirationDate);

  if (daysUntil === null) return null;

  // ETA 9089 certification has expired
  if (daysUntil < 0) {
    // Check if we can restart ETA 9089 (need valid PWD and time)
    const canRestart = canRestartProcess(caseData.pwdExpirationDate, todayISO);

    // Also need to be within recruitment filing window to restart ETA 9089
    // If filing window is also closed, must restart recruitment entirely
    let suggestedAction: SuggestedAction = "close";

    if (canRestart) {
      // Check if filing window is still open (filingWindowCloses is DOL-governed)
      if (isValidISODate(caseData.filingWindowCloses)) {
        const filingToday = dolTodayISO ?? todayISO;
        const filingDaysUntil = daysBetween(filingToday, caseData.filingWindowCloses);
        if (filingDaysUntil !== null && filingDaysUntil >= 0) {
          suggestedAction = "restart_eta9089";
        } else {
          suggestedAction = "restart_recruitment";
        }
      } else {
        suggestedAction = "restart_eta9089";
      }
    }

    return {
      type: "eta9089_expired",
      reason: `ETA 9089 certification expired on ${expirationDate}. I-140 was not filed within 180 days of certification.`,
      suggestedAction,
      canRestart,
    };
  }

  return null;
}

/**
 * Check for any deadline violations on a case.
 *
 * Checks all deadline types in priority order:
 * 1. PWD expiration (most critical)
 * 2. Recruitment window
 * 3. Filing window
 * 4. ETA 9089 certification expiration
 *
 * Returns the first violation found (most critical).
 *
 * Each violation type uses timezone-aware "today" resolution:
 * - PWD expired, recruitment missed, ETA 9089 expired → user's local timezone
 * - Filing window missed → DOL Eastern Time
 *
 * @param caseData - Case data for enforcement check
 * @param todayISO - Reference date (ISO string) for testing — overrides timezone resolution
 * @param userTimezone - User's IANA timezone for "local" violations (defaults to America/New_York)
 * @returns First DeadlineViolation found or null if no violations
 *
 * @example
 * const violation = checkDeadlineViolations({
 *   caseStatus: "recruitment",
 *   pwdExpirationDate: "2024-06-01",
 *   eta9089FilingDate: undefined,
 * }, "2024-07-15");
 * // { type: "pwd_expired", reason: "...", suggestedAction: "close", canRestart: false }
 */
export function checkDeadlineViolations(
  caseData: CaseDataForEnforcement,
  todayISO?: string,
  userTimezone: string = DEFAULT_USER_TIMEZONE
): DeadlineViolation | null {
  // Helper: resolve "today" for a given violation type.
  // If todayISO is provided (testing), use it for all types.
  // Otherwise, resolve per-type using timezone rules.
  const resolveToday = (violationType: ViolationType): string => {
    if (todayISO) return todayISO;
    const rule = ENFORCEMENT_TIMEZONE_RULES[violationType];
    const tz = getEffectiveTimezone(rule, userTimezone);
    return getTodayInTimezone(tz);
  };

  // Skip already closed or deleted cases
  if (caseData.caseStatus === "closed") return null;
  if (caseData.deletedAt !== undefined) return null;

  // Resolve DOL "today" once for functions that cross-check filing window dates
  const dolToday = resolveToday("filing_window_missed");

  // Check in priority order - return first violation found
  const pwdViolation = checkPwdExpiration(caseData, resolveToday("pwd_expired"));
  if (pwdViolation) return pwdViolation;

  const recruitmentViolation = checkRecruitmentWindow(caseData, resolveToday("recruitment_window_missed"), dolToday);
  if (recruitmentViolation) return recruitmentViolation;

  const filingViolation = checkFilingWindow(caseData, dolToday);
  if (filingViolation) return filingViolation;

  const eta9089Violation = checkEta9089Expiration(caseData, resolveToday("eta9089_expired"), dolToday);
  if (eta9089Violation) return eta9089Violation;

  return null;
}

// ============================================================================
// MESSAGE GENERATION
// ============================================================================

/**
 * Generate a user-friendly closure message for a violation.
 *
 * @param violation - The deadline violation
 * @param employerName - Employer name for context
 * @param beneficiaryIdentifier - Beneficiary identifier for context
 * @returns Human-readable notification message
 *
 * @example
 * generateClosureMessage({
 *   type: "pwd_expired",
 *   reason: "PWD expired on 2024-06-01",
 *   suggestedAction: "close",
 *   canRestart: false,
 * }, "Acme Corp", "John D.");
 * // "Case for John D. at Acme Corp has been automatically closed: PWD expired..."
 */
export function generateClosureMessage(
  violation: DeadlineViolation,
  employerName: string,
  beneficiaryIdentifier: string
): string {
  const caseLabel = `${beneficiaryIdentifier} at ${employerName}`;

  if (violation.suggestedAction === "close") {
    return `Case for ${caseLabel} has been automatically closed: ${violation.reason}`;
  }

  // Case needs restart but isn't being closed
  const actionLabel =
    violation.suggestedAction === "restart_recruitment"
      ? "restart recruitment"
      : "refile ETA 9089";

  return `Case for ${caseLabel} requires attention: ${violation.reason} You may need to ${actionLabel}.`;
}

/**
 * Generate a title for the auto-closure notification.
 *
 * @param violation - The deadline violation
 * @returns Short title for notification
 */
export function generateClosureTitle(violation: DeadlineViolation): string {
  switch (violation.type) {
    case "pwd_expired":
      return "PWD Expired - Case Closed";
    case "recruitment_window_missed":
      return violation.canRestart
        ? "Recruitment Window Missed - Action Required"
        : "Recruitment Window Missed - Case Closed";
    case "filing_window_missed":
      return violation.canRestart
        ? "Filing Window Missed - Action Required"
        : "Filing Window Missed - Case Closed";
    case "eta9089_expired":
      return violation.canRestart
        ? "ETA 9089 Expired - Action Required"
        : "ETA 9089 Expired - Case Closed";
    default:
      return "Deadline Missed";
  }
}
