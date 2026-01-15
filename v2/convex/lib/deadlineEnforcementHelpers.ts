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

// Re-export for backwards compatibility
export { getTodayISO };

// ============================================================================
// CONSTANTS
// ============================================================================

/** Days before PWD expiration when restart is no longer viable */
export const MIN_DAYS_FOR_RESTART = 60;

/** Days for ETA 9089 certification validity (I-140 must file within this) */
export const ETA9089_VALIDITY_DAYS = 180;

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
  recruitmentWindowCloses?: string | null;
  filingWindowCloses?: string | null;

  // ETA 9089 phase
  eta9089FilingDate?: string | null;
  eta9089CertificationDate?: string | null;
  eta9089ExpirationDate?: string | null;

  // I-140 phase
  i140FilingDate?: string | null;
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
  todayISO: string
): DeadlineViolation | null {
  // Only check if ETA 9089 is NOT filed and we have recruitment data
  if (caseData.eta9089FilingDate) return null;
  if (!caseData.recruitmentStartDate) return null; // No recruitment started yet

  // Use stored recruitmentWindowCloses if available
  const windowCloses = caseData.recruitmentWindowCloses || caseData.filingWindowCloses;

  if (!isValidISODate(windowCloses)) return null;

  const daysUntil = daysBetween(todayISO, windowCloses);

  if (daysUntil === null) return null;

  // Window has closed (past the date)
  if (daysUntil < 0) {
    const canRestart = canRestartProcess(caseData.pwdExpirationDate, todayISO);

    return {
      type: "recruitment_window_missed",
      reason: `Recruitment window closed on ${windowCloses}. The 180-day filing deadline from first recruitment was missed.`,
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
  todayISO: string
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
      // Check if filing window is still open
      if (isValidISODate(caseData.filingWindowCloses)) {
        const filingDaysUntil = daysBetween(todayISO, caseData.filingWindowCloses);
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
 * @param caseData - Case data for enforcement check
 * @param todayISO - Reference date (ISO string), defaults to today
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
  todayISO?: string
): DeadlineViolation | null {
  const today = todayISO || getTodayISO();

  // Skip already closed or deleted cases
  if (caseData.caseStatus === "closed") return null;
  if (caseData.deletedAt !== undefined) return null;

  // Check in priority order - return first violation found
  const pwdViolation = checkPwdExpiration(caseData, today);
  if (pwdViolation) return pwdViolation;

  const recruitmentViolation = checkRecruitmentWindow(caseData, today);
  if (recruitmentViolation) return recruitmentViolation;

  const filingViolation = checkFilingWindow(caseData, today);
  if (filingViolation) return filingViolation;

  const eta9089Violation = checkEta9089Expiration(caseData, today);
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
