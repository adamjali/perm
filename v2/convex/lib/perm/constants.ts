/**
 * PERM Date Constants - SINGLE SOURCE OF TRUTH
 *
 * All PERM deadline-related constants are defined here.
 * Import from this file - NEVER hard-code these values elsewhere.
 *
 * @see 20 CFR § 656.17 - Filing window rules
 * @see 20 CFR § 656.40 - PWD expiration rules
 * @see 20 CFR § 656.10(d) - Notice of filing requirements
 * @module
 */

// ============================================================================
// FILING WINDOW CONSTANTS
// ============================================================================

/**
 * Days after LAST recruitment ends before ETA 9089 filing window OPENS.
 * Per 20 CFR § 656.17(e) - "30-day quiet period"
 */
export const FILING_WINDOW_WAIT_DAYS = 30;

/**
 * Days after FIRST recruitment starts before ETA 9089 filing window CLOSES.
 * Per 20 CFR § 656.17(e)
 */
export const FILING_WINDOW_CLOSE_DAYS = 180;

/**
 * Days after FIRST recruitment by which all recruitment must COMPLETE.
 *
 * MATHEMATICAL DERIVATION:
 * - Filing window closes at: first_recruitment + 180 days
 * - Filing window opens at: last_recruitment + 30 days
 * - Therefore, for filing to be possible:
 *     last_recruitment + 30 <= first_recruitment + 180
 *     last_recruitment <= first_recruitment + 150
 *
 * So 150 days = 180 days (window close) - 30 days (waiting period)
 */
export const RECRUITMENT_WINDOW_DAYS = 150;

/**
 * Days before PWD expiration by which recruitment must complete.
 * Ensures 30-day waiting period can still occur before PWD expires.
 */
export const PWD_RECRUITMENT_BUFFER_DAYS = 30;

// ============================================================================
// RECRUITMENT DURATION CONSTANTS
// ============================================================================

/**
 * Minimum duration for Job Order posting.
 * Per 20 CFR § 656.17(d) - Job order must be posted for at least 30 calendar days.
 */
export const JOB_ORDER_MIN_DAYS = 30;

/**
 * Minimum duration for Notice of Filing posting.
 * Per 20 CFR § 656.10(d)(1)(ii) - Notice must be posted for at least 10 business days.
 */
export const NOTICE_MIN_BUSINESS_DAYS = 10;

// ============================================================================
// I-140 CONSTANTS
// ============================================================================

/**
 * Days after ETA 9089 certification within which I-140 must be filed.
 * Per USCIS regulations.
 */
export const I140_FILING_DAYS = 180;

/**
 * ETA 9089 expiration period (same as I-140 filing deadline).
 * Certification is valid for 180 days.
 */
export const ETA9089_EXPIRATION_DAYS = 180;

// ============================================================================
// RFI/RFE CONSTANTS
// ============================================================================

/**
 * Days after RFI received by which response is due.
 * This is a STRICT deadline - not user-editable.
 */
export const RFI_DUE_DAYS = 30;

/**
 * Days before RFI due date to show warning (approaching deadline).
 */
export const RFI_WARNING_DAYS = 7;

/**
 * Days before RFE due date to show warning (approaching deadline).
 */
export const RFE_WARNING_DAYS = 7;

// ============================================================================
// RECRUITMENT DEADLINE BUFFER CONSTANTS
// Per V2_DEADLINE_FLOWS.md formulas
// ============================================================================

/**
 * Days after first recruitment for job order START deadline.
 * Formula: min(first + 120, pwd - 60)
 */
export const JOB_ORDER_START_DEADLINE_DAYS = 120;

/**
 * Days before PWD expiration for job order START deadline.
 * Formula: min(first + 120, pwd - 60)
 */
export const JOB_ORDER_START_PWD_BUFFER_DAYS = 60;

/**
 * Days after first recruitment for first Sunday ad deadline.
 * Formula: min(first + 143, pwd - 37)
 * Note: 143 = 150 - 7 (one week buffer for Sunday ad)
 */
export const FIRST_SUNDAY_AD_DEADLINE_DAYS = 143;

/**
 * Days before PWD expiration for first Sunday ad deadline.
 * Formula: min(first + 143, pwd - 37)
 */
export const FIRST_SUNDAY_AD_PWD_BUFFER_DAYS = 37;

/**
 * Days after first recruitment for second Sunday ad / notice of filing deadline.
 * Formula: min(first + 150, pwd - 30)
 */
export const SECOND_SUNDAY_AD_DEADLINE_DAYS = 150;

/**
 * Days before PWD expiration for second Sunday ad / notice of filing deadline.
 * Formula: min(first + 150, pwd - 30)
 */
export const SECOND_SUNDAY_AD_PWD_BUFFER_DAYS = 30;
