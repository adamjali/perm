// Re-export shared status types (single source of truth)
export {
  type CaseStatus,
  type ProgressStatus,
  CASE_STATUSES,
  PROGRESS_STATUSES,
  isCaseStatus,
  isProgressStatus,
} from "./statusTypes";

import type { CaseStatus, ProgressStatus } from "./statusTypes";

// ============================================================================
// Branded Types
// ============================================================================

/**
 * Brand symbol to prevent direct construction of ISODateString.
 * Use createISODate() or isISODateString() to create/validate instances.
 */
declare const ISODateBrand: unique symbol;

/**
 * Branded type for ISO date strings (YYYY-MM-DD format).
 * Provides compile-time safety for date string handling.
 *
 * @example
 * const date = createISODate("2024-01-15"); // Returns ISODateString
 * const date = "2024-01-15" as ISODateString; // Bypass (use sparingly)
 */
export type ISODateString = string & { readonly [ISODateBrand]: true };

/**
 * Validate and create an ISODateString from a raw string.
 * Returns null if the string is not in valid YYYY-MM-DD format.
 *
 * @example
 * const date = createISODate("2024-01-15"); // ISODateString
 * const invalid = createISODate("not-a-date"); // null
 */
export function createISODate(dateStr: string): ISODateString | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return null;
  }
  // Additional validation: check if it parses to a valid date
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year!, month! - 1, day);
  if (
    isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month! - 1 ||
    date.getDate() !== day
  ) {
    return null; // Invalid date like 2024-02-30
  }
  return dateStr as ISODateString;
}

/**
 * Type guard to check if a string is a valid ISODateString.
 *
 * @example
 * if (isISODateString(value)) {
 *   // value is ISODateString
 * }
 */
export function isISODateString(value: string | null | undefined): value is ISODateString {
  if (!value) return false;
  return createISODate(value) !== null;
}

// Validation types
export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  ruleId: string; // V-PWD-01, V-REC-03, etc.
  severity: ValidationSeverity;
  field: string; // Field that triggered the issue
  message: string; // User-facing message
  regulation?: string; // CFR reference if applicable
}

/**
 * Brand symbol to prevent direct construction of ValidationResult.
 * Use createValidationResult() factory to create instances.
 */
declare const ValidationResultBrand: unique symbol;

/**
 * ValidationResult with invariant: valid === (errors.length === 0)
 * MUST be created via createValidationResult() factory function.
 */
export interface ValidationResult {
  readonly valid: boolean; // false if any errors (warnings OK)
  readonly errors: readonly ValidationIssue[];
  readonly warnings: readonly ValidationIssue[];
  /** @internal Brand to prevent direct construction */
  readonly [ValidationResultBrand]?: true;
}

/**
 * Factory function to create ValidationResult with guaranteed consistency.
 * Ensures `valid` is always correctly derived from errors array.
 *
 * @example
 * const result = createValidationResult(
 *   [{ ruleId: 'V-PWD-01', severity: 'error', field: 'pwd_filing_date', message: 'Required' }],
 *   [{ ruleId: 'V-PWD-02', severity: 'warning', field: 'pwd_expiration_date', message: 'Expires soon' }]
 * );
 */
export function createValidationResult(
  errors: ValidationIssue[],
  warnings: ValidationIssue[] = []
): ValidationResult {
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  } as ValidationResult;
}

/**
 * Complete case data for validation.
 * Includes all date fields used across the PERM process.
 *
 * DATE FORMAT REQUIREMENT: All date fields must be in ISO format (YYYY-MM-DD).
 * Use isISODateString() to validate or createISODate() to create dates before assignment.
 *
 * For stricter compile-time safety, consider using ISODateString type at system boundaries
 * (API inputs/outputs) and casting with createISODate() when populating CaseData.
 *
 * @example
 * // Validate before assignment
 * const date = createISODate(userInput);
 * if (date) {
 *   caseData.pwd_filing_date = date;
 * }
 */
export interface CaseData {
  // PWD dates (must be YYYY-MM-DD format or null)
  pwd_filing_date: string | null;
  pwd_determination_date: string | null;
  pwd_expiration_date: string | null;

  // Recruitment dates
  sunday_ad_first_date: string | null;
  sunday_ad_second_date: string | null;
  job_order_start_date: string | null;
  job_order_end_date: string | null;
  notice_of_filing_start_date: string | null;
  notice_of_filing_end_date: string | null;
  recruitment_start_date: string | null; // MIN of all recruitment start dates (first step)
  recruitment_end_date: string | null;   // MAX of all recruitment end dates (last step)
  is_professional_occupation: boolean;

  // ETA 9089 dates
  eta9089_filing_date: string | null;
  eta9089_certification_date: string | null;
  eta9089_expiration_date: string | null;

  // I-140 dates
  i140_filing_date: string | null;
  i140_approval_date: string | null;

  // RFI dates (single active)
  rfi_received_date: string | null;
  rfi_due_date: string | null;
  rfi_submitted_date: string | null;

  // RFE dates (single active)
  rfe_received_date: string | null;
  rfe_due_date: string | null;
  rfe_submitted_date: string | null;

  // Status
  case_status: CaseStatus;
  progress_status: ProgressStatus;
}


/**
 * Type-safe field change that enforces correlation between field and value types.
 * Uses mapped types to ensure the value type matches the field's type in CaseData.
 */
export type FieldChange = {
  [K in keyof CaseData]: { field: K; value: CaseData[K] }
}[keyof CaseData];

// Recruitment deadline output
export interface RecruitmentDeadlines {
  notice_of_filing_deadline: string;
  job_order_start_deadline: string;
  first_sunday_ad_deadline: string;
  second_sunday_ad_deadline: string;
  recruitment_window_closes: string;
}
