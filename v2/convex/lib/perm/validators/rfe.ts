import { parseISO, isAfter, differenceInDays } from 'date-fns';
import type { ValidationResult, ValidationIssue } from '../types';
import { createValidationResult } from '../types';
import { getTodayISO, error, warning } from '../utils/validation';

const RFE_WARNING_DAYS = 7;

/**
 * Input data for RFE validation.
 */
export interface RFEValidationInput {
  i140_filing_date: string | null;
  rfe_received_date: string | null;
  rfe_due_date: string | null;
  rfe_submitted_date: string | null;
}

/**
 * Validate RFE dates according to USCIS regulations.
 *
 * Rules:
 * - V-RFE-01: Received date must be after I-140 filing date
 * - V-RFE-02: Due date must be after received date
 * - V-RFE-03: Submitted date must be after received date
 * - V-RFE-04: Warning if submitted after due date
 * - V-RFE-05: Warning if due date approaching and not submitted
 */
export function validateRFE(input: RFEValidationInput): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const { i140_filing_date, rfe_received_date, rfe_due_date, rfe_submitted_date } = input;

  // V-RFE-01: Received after I-140 filing
  if (i140_filing_date && rfe_received_date) {
    const filing = parseISO(i140_filing_date);
    const received = parseISO(rfe_received_date);

    if (!isAfter(received, filing)) {
      errors.push(error(
        'V-RFE-01',
        'rfe_received_date',
        'RFE received date must be after I-140 filing date'
      ));
    }
  }

  // V-RFE-02: Due after received
  if (rfe_received_date && rfe_due_date) {
    const received = parseISO(rfe_received_date);
    const due = parseISO(rfe_due_date);

    if (!isAfter(due, received)) {
      errors.push(error(
        'V-RFE-02',
        'rfe_due_date',
        'RFE due date must be after received date'
      ));
    }
  }

  // V-RFE-03: Submitted after received
  if (rfe_received_date && rfe_submitted_date) {
    const received = parseISO(rfe_received_date);
    const submitted = parseISO(rfe_submitted_date);

    if (!isAfter(submitted, received)) {
      errors.push(error(
        'V-RFE-03',
        'rfe_submitted_date',
        'RFE submitted date must be after received date'
      ));
    }
  }

  // V-RFE-04: Late submission warning
  if (rfe_due_date && rfe_submitted_date) {
    const due = parseISO(rfe_due_date);
    const submitted = parseISO(rfe_submitted_date);

    if (isAfter(submitted, due)) {
      warnings.push(warning(
        'V-RFE-04',
        'rfe_submitted_date',
        `RFE was submitted after the due date. Due: ${rfe_due_date}, Submitted: ${rfe_submitted_date}`
      ));
    }
  }

  // V-RFE-05: Approaching deadline warning
  if (rfe_due_date && !rfe_submitted_date) {
    const due = parseISO(rfe_due_date);
    const today = parseISO(getTodayISO());
    const daysUntil = differenceInDays(due, today);

    if (daysUntil >= 0 && daysUntil <= RFE_WARNING_DAYS) {
      warnings.push(warning(
        'V-RFE-05',
        'rfe_due_date',
        `RFE due date is approaching (${daysUntil} days remaining). Due: ${rfe_due_date}`
      ));
    }
  }

  return createValidationResult(errors, warnings);
}
