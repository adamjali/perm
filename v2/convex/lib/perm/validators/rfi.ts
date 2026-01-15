import { parseISO, isAfter, differenceInDays } from 'date-fns';
import type { ValidationResult, ValidationIssue } from '../types';
import { createValidationResult } from '../types';
import { calculateRFIDueDate } from '../calculators/rfi';
import { RFI_DUE_DAYS, RFI_WARNING_DAYS } from '../constants';
import { getTodayISO, error, warning } from '../utils/validation';

/**
 * Input data for RFI validation.
 */
export interface RFIValidationInput {
  eta9089_filing_date: string | null;
  rfi_received_date: string | null;
  rfi_due_date: string | null;
  rfi_submitted_date: string | null;
}

/**
 * Validate RFI dates according to PERM regulations.
 *
 * Rules:
 * - V-RFI-01: Received date must be after ETA 9089 filing date
 * - V-RFI-02: Due date must be exactly received + 30 days (strict)
 * - V-RFI-03: Submitted date must be after received date
 * - V-RFI-04: Warning if submitted after due date
 * - V-RFI-05: Warning if due date approaching and not submitted
 */
export function validateRFI(input: RFIValidationInput): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const { eta9089_filing_date, rfi_received_date, rfi_due_date, rfi_submitted_date } = input;

  // V-RFI-01: Received after ETA filing
  if (eta9089_filing_date && rfi_received_date) {
    const filing = parseISO(eta9089_filing_date);
    const received = parseISO(rfi_received_date);

    if (!isAfter(received, filing)) {
      errors.push(error(
        'V-RFI-01',
        'rfi_received_date',
        'RFI received date must be after ETA 9089 filing date'
      ));
    }
  }

  // V-RFI-02: Due date must be exactly received + 30 days
  if (rfi_received_date && rfi_due_date) {
    const expected = calculateRFIDueDate(rfi_received_date);
    if (expected !== rfi_due_date) {
      errors.push(error(
        'V-RFI-02',
        'rfi_due_date',
        `RFI due date must be exactly ${RFI_DUE_DAYS} days after received date. Expected: ${expected}, Current: ${rfi_due_date}`
      ));
    }
  }

  // V-RFI-03: Submitted after received
  if (rfi_received_date && rfi_submitted_date) {
    const received = parseISO(rfi_received_date);
    const submitted = parseISO(rfi_submitted_date);

    if (!isAfter(submitted, received)) {
      errors.push(error(
        'V-RFI-03',
        'rfi_submitted_date',
        'RFI submitted date must be after received date'
      ));
    }
  }

  // V-RFI-04: Late submission warning
  if (rfi_due_date && rfi_submitted_date) {
    const due = parseISO(rfi_due_date);
    const submitted = parseISO(rfi_submitted_date);

    if (isAfter(submitted, due)) {
      warnings.push(warning(
        'V-RFI-04',
        'rfi_submitted_date',
        `RFI was submitted after the due date. Due: ${rfi_due_date}, Submitted: ${rfi_submitted_date}`
      ));
    }
  }

  // V-RFI-05: Approaching deadline warning
  if (rfi_due_date && !rfi_submitted_date) {
    const due = parseISO(rfi_due_date);
    const today = parseISO(getTodayISO());
    const daysUntil = differenceInDays(due, today);

    if (daysUntil >= 0 && daysUntil <= RFI_WARNING_DAYS) {
      warnings.push(warning(
        'V-RFI-05',
        'rfi_due_date',
        `RFI due date is approaching (${daysUntil} days remaining). Due: ${rfi_due_date}`
      ));
    }
  }

  return createValidationResult(errors, warnings);
}
