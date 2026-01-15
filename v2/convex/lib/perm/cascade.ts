import { parseISO, isBefore } from 'date-fns';
import { calculatePWDExpiration } from './calculators/pwd';
import { calculateNoticeOfFilingEnd, calculateJobOrderEnd } from './calculators/recruitment';
import { calculateETA9089Expiration } from './calculators/eta9089';
import { calculateRFIDueDate } from './calculators/rfi';
import { formatUTC } from './dates';
import type { CaseData, FieldChange } from './types';

export type CascadeChange = FieldChange;

type CascadeField = keyof CaseData;

interface CascadeRule {
  target: CascadeField;
  calculate: (value: string) => string;
  extendOnly?: boolean;
}

/**
 * Cascade rule configuration.
 * Maps source fields to their dependent target fields and calculation logic.
 */
const CASCADE_RULES: Partial<Record<CascadeField, CascadeRule>> = {
  pwd_determination_date: {
    target: 'pwd_expiration_date',
    calculate: calculatePWDExpiration,
  },
  notice_of_filing_start_date: {
    target: 'notice_of_filing_end_date',
    calculate: calculateNoticeOfFilingEnd,
    extendOnly: true,
  },
  job_order_start_date: {
    target: 'job_order_end_date',
    calculate: calculateJobOrderEnd,
    extendOnly: true,
  },
  eta9089_certification_date: {
    target: 'eta9089_expiration_date',
    calculate: (value: string) => {
      const certDate = new Date(value);
      const expiration = calculateETA9089Expiration(certDate);
      return formatUTC(expiration);
    },
  },
  rfi_received_date: {
    target: 'rfi_due_date',
    calculate: calculateRFIDueDate,
  },
};

/**
 * Apply extend-only logic: only update if new value extends beyond current.
 */
function applyExtendOnly(
  currentValue: string | null,
  newValue: string
): string | null {
  if (currentValue === null) {
    return newValue;
  }

  const current = parseISO(currentValue);
  const calculated = parseISO(newValue);

  return isBefore(current, calculated) ? newValue : currentValue;
}

/**
 * Apply cascade rules for a single field change.
 *
 * Cascade rules (DAG structure, no cycles):
 * - V-CASCADE-01: pwd_determination_date -> pwd_expiration_date
 * - V-CASCADE-04: notice_of_filing_start_date -> notice_of_filing_end_date (extend-only)
 * - V-CASCADE-05: job_order_start_date -> job_order_end_date (extend-only)
 * - eta9089_certification_date -> eta9089_expiration_date
 * - rfi_received_date -> rfi_due_date (strict 30 days)
 *
 * @param currentState - Current case data
 * @param change - Field change to apply
 * @returns Updated case data with cascaded changes
 */
export function applyCascade(
  currentState: CaseData,
  change: CascadeChange
): CaseData {
  const newState = { ...currentState, [change.field]: change.value };
  const rule = CASCADE_RULES[change.field];

  if (!rule) {
    return newState;
  }

  // Handle null/boolean values by clearing target
  if (change.value === null || typeof change.value === 'boolean') {
    return { ...newState, [rule.target]: null };
  }

  // Calculate new value
  const calculatedValue = rule.calculate(change.value);

  // Apply extend-only logic if configured
  const finalValue = rule.extendOnly
    ? applyExtendOnly(currentState[rule.target] as string | null, calculatedValue)
    : calculatedValue;

  return { ...newState, [rule.target]: finalValue };
}

/**
 * Apply multiple cascade changes in sequence.
 *
 * @param currentState - Current case data
 * @param changes - Array of field changes to apply
 * @returns Updated case data with all cascaded changes
 */
export function applyCascadeMultiple(
  currentState: CaseData,
  changes: CascadeChange[]
): CaseData {
  return changes.reduce(
    (state, change) => applyCascade(state, change),
    currentState
  );
}
