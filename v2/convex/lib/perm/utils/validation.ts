/**
 * Shared validation utilities.
 *
 * Provides common date validation patterns and result aggregation
 * used across all PERM validators.
 */

import { parseISO, isValid, isBefore, isAfter, format } from 'date-fns';
import type { ValidationIssue, ValidationResult } from '../types';
import { createValidationResult } from '../types';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Validator function signature - takes input and returns ValidationResult.
 */
export type Validator<T> = (input: T) => ValidationResult;

/**
 * Input for single-field date validation.
 */
interface DateValidationInput {
  value: string;
  fieldName: string;
  ruleId: string;
}

/**
 * Result of date parsing with validation info.
 */
interface ParsedDateResult {
  date: Date | null;
  error: ValidationIssue | null;
}

// ============================================================================
// Date Utilities
// ============================================================================

/**
 * Get today's date as ISO string (YYYY-MM-DD).
 * Avoids timezone issues by using local date format.
 */
export function getTodayISO(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

/**
 * Parse and validate an ISO date string.
 * Returns both the parsed date and any validation error.
 */
export function parseAndValidateDate(
  input: DateValidationInput
): ParsedDateResult {
  const { value, fieldName, ruleId } = input;
  const date = parseISO(value);

  if (!isValid(date)) {
    return {
      date: null,
      error: {
        ruleId,
        severity: 'error',
        field: fieldName,
        message: `Invalid date format: ${value}`,
      },
    };
  }

  return { date, error: null };
}

/**
 * Validate that date A is before date B.
 * Returns null if valid, or a ValidationIssue if invalid.
 */
export function validateDateOrder(
  dateA: Date,
  dateB: Date,
  issue: Omit<ValidationIssue, 'severity'>
): ValidationIssue | null {
  if (!isBefore(dateA, dateB)) {
    return { ...issue, severity: 'error' };
  }
  return null;
}

/**
 * Validate that date A is after date B.
 * Returns null if valid, or a ValidationIssue if invalid.
 */
export function validateDateAfter(
  dateA: Date,
  dateB: Date,
  issue: Omit<ValidationIssue, 'severity'>
): ValidationIssue | null {
  if (!isAfter(dateA, dateB)) {
    return { ...issue, severity: 'error' };
  }
  return null;
}

// ============================================================================
// Issue Builders
// ============================================================================

/**
 * Create a validation error issue.
 */
export function error(
  ruleId: string,
  field: string,
  message: string,
  regulation?: string
): ValidationIssue {
  return { ruleId, severity: 'error', field, message, regulation };
}

/**
 * Create a validation warning issue.
 */
export function warning(
  ruleId: string,
  field: string,
  message: string,
  regulation?: string
): ValidationIssue {
  return { ruleId, severity: 'warning', field, message, regulation };
}

// ============================================================================
// Validator Composition
// ============================================================================

/**
 * Combine multiple ValidationResults into one.
 * Aggregates all errors and warnings.
 */
export function mergeResults(results: ValidationResult[]): ValidationResult {
  const allErrors: ValidationIssue[] = [];
  const allWarnings: ValidationIssue[] = [];

  for (const result of results) {
    allErrors.push(...result.errors);
    allWarnings.push(...result.warnings);
  }

  return createValidationResult(allErrors, allWarnings);
}

/**
 * Compose multiple validators into a single validator.
 * Runs all validators and merges their results.
 *
 * @example
 * const validateCase = composeValidators(
 *   (data) => validatePWD(extractPWDFields(data)),
 *   (data) => validateRecruitment(extractRecruitmentFields(data)),
 *   ...
 * );
 */
export function composeValidators<T>(
  ...validators: Validator<T>[]
): Validator<T> {
  return (input: T): ValidationResult => {
    const results = validators.map((v) => v(input));
    return mergeResults(results);
  };
}

/**
 * Create a result from arrays of errors and warnings.
 * Convenience wrapper around createValidationResult.
 */
export function result(
  errors: ValidationIssue[],
  warnings: ValidationIssue[] = []
): ValidationResult {
  return createValidationResult(errors, warnings);
}
