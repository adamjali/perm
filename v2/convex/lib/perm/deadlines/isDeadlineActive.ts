/**
 * Deadline Supersession Logic
 *
 * Determines whether a deadline is active (should be shown/notified) based on
 * case data and PERM workflow rules.
 *
 * Per perm_flow.md (deadline supersession section):
 * "A deadline becomes inactive/met once the field has a value"
 *
 * @module
 */

import type {
  CaseDataForDeadlines,
  DeadlineType,
  DeadlineActiveStatus,
  RfiEntry,
  RfeEntry,
} from "./types";
import { SUPERSESSION_REASONS } from "./types";
import { isRecruitmentComplete } from "../recruitment/isRecruitmentComplete";

// ============================================================================
// MAIN SUPERSESSION CHECK
// ============================================================================

/**
 * Check if a specific deadline type is active for a case.
 *
 * Supersession rules per perm_flow.md:
 * - PWD expiration: Inactive when ETA 9089 filed
 * - Filing window (opens/closes): Inactive when ETA 9089 filed
 * - Recruitment window: Inactive when ETA 9089 filed
 * - I-140 deadline: Inactive when I-140 filed
 * - RFI due: Inactive when response submitted
 * - RFE due: Inactive when response submitted
 *
 * @param deadlineType - The type of deadline to check
 * @param caseData - Case data with relevant fields
 * @returns Status indicating if deadline is active and why if not
 *
 * @example
 * // PWD expiration is active (ETA 9089 not filed)
 * isDeadlineActive("pwd_expiration", { pwdExpirationDate: "2025-06-30" })
 * // { isActive: true }
 *
 * @example
 * // PWD expiration is superseded (ETA 9089 filed)
 * isDeadlineActive("pwd_expiration", {
 *   pwdExpirationDate: "2025-06-30",
 *   eta9089FilingDate: "2024-12-01"
 * })
 * // { isActive: false, supersededReason: "ETA 9089 has been filed" }
 */
export function isDeadlineActive(
  deadlineType: DeadlineType,
  caseData: CaseDataForDeadlines
): DeadlineActiveStatus {
  // Global filters: closed or deleted cases have no active deadlines
  if (caseData.caseStatus === "closed") {
    return { isActive: false, supersededReason: SUPERSESSION_REASONS.CASE_CLOSED };
  }

  if (caseData.deletedAt !== undefined) {
    return { isActive: false, supersededReason: SUPERSESSION_REASONS.CASE_DELETED };
  }

  // Type-specific supersession rules
  switch (deadlineType) {
    case "pwd_expiration":
      return checkPwdExpirationActive(caseData);

    case "filing_window_opens":
    case "filing_window_closes":
      return checkFilingWindowActive(caseData);

    case "recruitment_window_closes":
      return checkRecruitmentWindowActive(caseData);

    case "job_order_start_deadline":
      return checkPerStepActive(caseData, caseData.jobOrderStartDate, SUPERSESSION_REASONS.JOB_ORDER_STARTED);

    case "notice_of_filing_start_deadline":
      return checkPerStepActive(caseData, caseData.noticeOfFilingStartDate, SUPERSESSION_REASONS.NOTICE_OF_FILING_STARTED);

    case "first_sunday_ad_deadline":
      return checkPerStepActive(caseData, caseData.sundayAdFirstDate, SUPERSESSION_REASONS.FIRST_SUNDAY_AD_PLACED);

    case "second_sunday_ad_deadline":
      return checkPerStepActive(caseData, caseData.sundayAdSecondDate, SUPERSESSION_REASONS.SECOND_SUNDAY_AD_PLACED);

    case "i140_filing_deadline":
      return checkI140DeadlineActive(caseData);

    case "rfi_due":
      return checkRfiActive(caseData);

    case "rfe_due":
      return checkRfeActive(caseData);

    default:
      // Unknown deadline type - assume active
      return { isActive: true };
  }
}

// ============================================================================
// TYPE-SPECIFIC CHECKS
// ============================================================================

/**
 * PWD expiration is superseded when ETA 9089 is filed.
 *
 * Per perm_flow.md: Once ETA 9089 is filed, PWD expiration is no longer
 * a relevant deadline because the filing has been completed within the PWD window.
 */
function checkPwdExpirationActive(
  caseData: CaseDataForDeadlines
): DeadlineActiveStatus {
  // Must have a PWD expiration date to be active
  if (!caseData.pwdExpirationDate) {
    return { isActive: false, supersededReason: SUPERSESSION_REASONS.NO_DATE };
  }

  // Superseded when ETA 9089 filed
  if (caseData.eta9089FilingDate) {
    return { isActive: false, supersededReason: SUPERSESSION_REASONS.ETA9089_FILED };
  }

  return { isActive: true };
}

/**
 * Filing window deadlines (opens/closes) are superseded when ETA 9089 is filed,
 * or inactive when recruitment is not yet complete.
 *
 * Applies to:
 * - filing_window_opens (30 days after recruitment ends)
 * - filing_window_closes (180 days from first recruitment or PWD expiration)
 */
function checkFilingWindowActive(
  caseData: CaseDataForDeadlines
): DeadlineActiveStatus {
  // Superseded when ETA 9089 filed
  if (caseData.eta9089FilingDate) {
    return { isActive: false, supersededReason: SUPERSESSION_REASONS.ETA9089_FILED };
  }

  // Inactive when recruitment is not complete
  if (!isRecruitmentComplete(caseData)) {
    return { isActive: false, supersededReason: SUPERSESSION_REASONS.RECRUITMENT_INCOMPLETE };
  }

  return { isActive: true };
}

/**
 * Recruitment window deadline is superseded when ETA 9089 is filed
 * or when all recruitment activities are complete.
 */
function checkRecruitmentWindowActive(
  caseData: CaseDataForDeadlines
): DeadlineActiveStatus {
  if (caseData.eta9089FilingDate) {
    return { isActive: false, supersededReason: SUPERSESSION_REASONS.ETA9089_FILED };
  }

  if (isRecruitmentComplete(caseData)) {
    return { isActive: false, supersededReason: SUPERSESSION_REASONS.RECRUITMENT_COMPLETE };
  }

  return { isActive: true };
}

/**
 * Per-step recruitment deadline supersession.
 * Active when:
 * - ETA 9089 not yet filed
 * - The step has NOT been completed (no date set for the corresponding field)
 * - First recruitment has started (needed to calculate the deadline)
 */
function checkPerStepActive(
  caseData: CaseDataForDeadlines,
  stepCompletionDate: string | undefined,
  completionReason: string
): DeadlineActiveStatus {
  // Superseded when ETA 9089 filed
  if (caseData.eta9089FilingDate) {
    return { isActive: false, supersededReason: SUPERSESSION_REASONS.ETA9089_FILED };
  }

  // Superseded when the step is already completed
  if (stepCompletionDate) {
    return { isActive: false, supersededReason: completionReason };
  }

  return { isActive: true };
}

/**
 * I-140 filing deadline is superseded when I-140 is filed.
 *
 * The deadline only becomes active once ETA 9089 is certified
 * (which sets eta9089CertificationDate and eta9089ExpirationDate).
 */
function checkI140DeadlineActive(
  caseData: CaseDataForDeadlines
): DeadlineActiveStatus {
  // Need certification to have an I-140 deadline
  if (!caseData.eta9089CertificationDate || !caseData.eta9089ExpirationDate) {
    return { isActive: false, supersededReason: SUPERSESSION_REASONS.NOT_CERTIFIED };
  }

  // Superseded when I-140 filed
  if (caseData.i140FilingDate) {
    return { isActive: false, supersededReason: SUPERSESSION_REASONS.I140_FILED };
  }

  return { isActive: true };
}

/**
 * RFI deadline is superseded when response is submitted.
 *
 * Per perm_flow.md (RFI section): "only one active one at a time"
 * We check if there's ANY active RFI entry.
 */
function checkRfiActive(caseData: CaseDataForDeadlines): DeadlineActiveStatus {
  const activeRfi = getActiveRfiEntry(caseData.rfiEntries ?? []);

  if (!activeRfi) {
    return { isActive: false, supersededReason: SUPERSESSION_REASONS.RFI_RESPONDED };
  }

  if (!activeRfi.responseDueDate) {
    return { isActive: false, supersededReason: SUPERSESSION_REASONS.NO_DATE };
  }

  return { isActive: true };
}

/**
 * RFE deadline is superseded when response is submitted.
 *
 * Per perm_flow.md (RFE section): "only one active one at a time"
 * We check if there's ANY active RFE entry.
 */
function checkRfeActive(caseData: CaseDataForDeadlines): DeadlineActiveStatus {
  const activeRfe = getActiveRfeEntry(caseData.rfeEntries ?? []);

  if (!activeRfe) {
    return { isActive: false, supersededReason: SUPERSESSION_REASONS.RFE_RESPONDED };
  }

  if (!activeRfe.responseDueDate) {
    return { isActive: false, supersededReason: SUPERSESSION_REASONS.NO_DATE };
  }

  return { isActive: true };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the first active RFI entry (received but not responded).
 *
 * An RFI is "active" if:
 * - It has a receivedDate
 * - It does NOT have a responseSubmittedDate
 *
 * @param entries - Array of RFI entries
 * @returns The first active entry, or undefined if none
 */
export function getActiveRfiEntry(entries: RfiEntry[]): RfiEntry | undefined {
  return entries.find(
    (entry) => entry.receivedDate && !entry.responseSubmittedDate
  );
}

/**
 * Get the first active RFE entry (received but not responded).
 *
 * An RFE is "active" if:
 * - It has a receivedDate
 * - It does NOT have a responseSubmittedDate
 *
 * @param entries - Array of RFE entries
 * @returns The first active entry, or undefined if none
 */
export function getActiveRfeEntry(entries: RfeEntry[]): RfeEntry | undefined {
  return entries.find(
    (entry) => entry.receivedDate && !entry.responseSubmittedDate
  );
}

/**
 * Check if a case has any active deadlines at all.
 *
 * Useful for filtering cases that need attention.
 *
 * @param caseData - Case data to check
 * @returns True if the case has at least one active deadline
 */
export function hasAnyActiveDeadline(caseData: CaseDataForDeadlines): boolean {
  // Skip closed/deleted cases
  if (caseData.caseStatus === "closed" || caseData.deletedAt !== undefined) {
    return false;
  }

  // Check each deadline type
  const deadlineTypes: DeadlineType[] = [
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

  return deadlineTypes.some((type) => isDeadlineActive(type, caseData).isActive);
}
