/**
 * useDateFieldValidation Hook
 *
 * Provides inline validation and dynamic date constraints for form fields.
 * Validates on blur and provides real-time feedback with dynamic hints.
 */

import { useCallback, useMemo, useState } from "react";
import { getAllDateConstraints, type DateConstraint } from "@/lib/forms/date-constraints";
import { isSunday, isISODateString } from "@/lib/forms/case-form-schema";
import type { CaseFormData } from "@/lib/forms/case-form-schema";

export interface FieldValidation {
  error?: string;
  warning?: string;
  isValid?: boolean;
}

export type ValidationState = 'valid' | 'warning' | 'error' | undefined;

interface FieldValidationState {
  state: ValidationState;
  error?: string;
  warning?: string;
}

/**
 * Field dependencies - defines which fields must have values before a field can be filled
 */
const FIELD_DEPENDENCIES: Record<string, string[]> = {
  pwdDeterminationDate: ['pwdFilingDate'],
  sundayAdSecondDate: ['sundayAdFirstDate'],
  jobOrderEndDate: ['jobOrderStartDate'],
  noticeOfFilingEndDate: ['noticeOfFilingStartDate'],
  additionalRecruitmentStartDate: ['pwdDeterminationDate'],
  additionalRecruitmentEndDate: ['pwdDeterminationDate', 'additionalRecruitmentStartDate'],
  eta9089AuditDate: ['eta9089FilingDate'],
  eta9089CertificationDate: ['eta9089FilingDate'],
  i140ReceiptDate: ['i140FilingDate'],
  i140ApprovalDate: ['i140FilingDate', 'i140ReceiptDate'],
  i140DenialDate: ['i140FilingDate', 'i140ReceiptDate'],
};

const FIELD_NAME_MAP: Record<string, string> = {
  pwdFilingDate: 'PWD filing date',
  pwdDeterminationDate: 'PWD determination date',
  sundayAdFirstDate: 'first Sunday ad date',
  jobOrderStartDate: 'job order start date',
  noticeOfFilingStartDate: 'notice of filing start date',
  additionalRecruitmentStartDate: 'additional recruitment start date',
  eta9089FilingDate: 'ETA 9089 filing date',
  i140FilingDate: 'I-140 filing date',
  i140ReceiptDate: 'I-140 receipt date',
};

const DATE_FIELDS = [
  'pwdFilingDate', 'pwdDeterminationDate',
  'sundayAdFirstDate', 'sundayAdSecondDate',
  'jobOrderStartDate', 'jobOrderEndDate',
  'noticeOfFilingStartDate', 'noticeOfFilingEndDate',
  'additionalRecruitmentStartDate', 'additionalRecruitmentEndDate',
  'eta9089FilingDate', 'eta9089AuditDate', 'eta9089CertificationDate',
  'i140FilingDate', 'i140ReceiptDate', 'i140ApprovalDate', 'i140DenialDate',
] as const;

/**
 * Validate a single date field
 */
function validateDateField(
  field: string,
  value: string | undefined,
  constraint: DateConstraint | undefined,
  formValues: Partial<CaseFormData>
): FieldValidation {
  if (!value) return {};

  if (!isISODateString(value)) {
    return { error: "Invalid date format. Use YYYY-MM-DD." };
  }

  const date = new Date(value + "T00:00:00");

  // Sunday ad fields must be on Sunday
  if ((field === "sundayAdFirstDate" || field === "sundayAdSecondDate") && !isSunday(value)) {
    return { error: "This date must be a Sunday." };
  }

  // Check min/max constraints
  if (constraint?.min) {
    const minDate = new Date(constraint.min + "T00:00:00");
    if (date < minDate) {
      return { error: `Date must be on or after ${constraint.min}.` };
    }
  }

  if (constraint?.max) {
    const maxDate = new Date(constraint.max + "T00:00:00");
    if (date > maxDate) {
      return { error: `Date must be on or before ${constraint.max}.` };
    }
  }

  // Cross-field validation
  if (field === "sundayAdSecondDate" && formValues.sundayAdFirstDate) {
    const first = new Date(formValues.sundayAdFirstDate + "T00:00:00");
    const daysDiff = Math.floor((date.getTime() - first.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff < 7) {
      return { error: "Second Sunday ad must be at least 1 week after the first." };
    }
  }

  if (field === "jobOrderEndDate" && formValues.jobOrderStartDate) {
    const start = new Date(formValues.jobOrderStartDate + "T00:00:00");
    const daysDiff = Math.floor((date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff < 30) {
      return { error: `Job order must be at least 30 days. Current duration: ${daysDiff} days.` };
    }
  }

  return { isValid: true };
}

function deriveValidationState(result: FieldValidation): ValidationState {
  if (result.error) return 'error';
  if (result.warning) return 'warning';
  if (result.isValid) return 'valid';
  return undefined;
}

function checkFieldDisabled(
  field: string,
  formValues: Partial<CaseFormData>
): { disabled: boolean; reason?: string } {
  const deps = FIELD_DEPENDENCIES[field];
  if (!deps?.length) return { disabled: false };

  const missingDeps = deps.filter(dep => {
    const value = formValues[dep as keyof CaseFormData];
    return value === undefined || value === null || value === '';
  });

  if (missingDeps.length === 0) return { disabled: false };

  const missingNames = missingDeps.map(dep => FIELD_NAME_MAP[dep] || dep).join(', ');
  return { disabled: true, reason: `Enter ${missingNames} first` };
}

/**
 * Hook for date field validation and constraints
 */
export function useDateFieldValidation(formValues: Partial<CaseFormData>) {
  const constraints = useMemo(() => getAllDateConstraints(formValues), [formValues]);

  // Unified validation state: { [field]: { state, error, warning } }
  const [validationStates, setValidationStates] = useState<Record<string, FieldValidationState>>({});

  const updateFieldState = useCallback((field: string, result: FieldValidation) => {
    setValidationStates(prev => ({
      ...prev,
      [field]: {
        state: deriveValidationState(result),
        error: result.error,
        warning: result.warning,
      },
    }));
  }, []);

  const validateField = useCallback(
    (field: string, value: string | undefined): FieldValidation => {
      const result = validateDateField(field, value, constraints[field], formValues);
      updateFieldState(field, result);
      return result;
    },
    [constraints, formValues, updateFieldState]
  );

  const validateOnChange = useCallback(
    (field: string, value: string | undefined): FieldValidation => {
      if (!value) {
        setValidationStates(prev => ({
          ...prev,
          [field]: { state: undefined, error: undefined, warning: undefined },
        }));
        return {};
      }

      // Only validate complete dates (10 chars: YYYY-MM-DD)
      if (value.length === 10) {
        return validateField(field, value);
      }

      return {};
    },
    [validateField]
  );

  const clearFieldValidation = useCallback((field: string) => {
    setValidationStates(prev => ({
      ...prev,
      [field]: { state: undefined, error: undefined, warning: undefined },
    }));
  }, []);

  const setServerError = useCallback((field: string, error: string) => {
    setValidationStates(prev => ({
      ...prev,
      [field]: { state: 'error', error, warning: undefined },
    }));
  }, []);

  const setServerErrors = useCallback((errors: Record<string, string>) => {
    setValidationStates(prev => {
      const newStates = { ...prev };
      for (const [field, error] of Object.entries(errors)) {
        newStates[field] = { state: 'error', error, warning: undefined };
      }
      return newStates;
    });
  }, []);

  const revalidateAllFields = useCallback(() => {
    for (const field of DATE_FIELDS) {
      const value = formValues[field as keyof CaseFormData] as string | undefined;
      if (value) {
        validateField(field, value);
      }
    }
  }, [formValues, validateField]);

  // Memoized getters
  const getConstraint = useCallback(
    (field: string): DateConstraint | undefined => constraints[field],
    [constraints]
  );

  const getHint = useCallback(
    (field: string, defaultHint?: string): string | undefined => constraints[field]?.hint || defaultHint,
    [constraints]
  );

  const getValidationState = useCallback(
    (field: string): ValidationState => validationStates[field]?.state,
    [validationStates]
  );

  const getError = useCallback(
    (field: string): string | undefined => validationStates[field]?.error,
    [validationStates]
  );

  const getWarning = useCallback(
    (field: string): string | undefined => validationStates[field]?.warning,
    [validationStates]
  );

  const isFieldDisabled = useCallback(
    (field: string): { disabled: boolean; reason?: string } => checkFieldDisabled(field, formValues),
    [formValues]
  );

  const allFieldDisabledStates = useMemo(() => {
    const states: Record<string, { disabled: boolean; reason?: string }> = {};
    for (const field of Object.keys(FIELD_DEPENDENCIES)) {
      states[field] = checkFieldDisabled(field, formValues);
    }
    return states;
  }, [formValues]);

  // Derived state for backward compatibility
  const fieldStates = useMemo(() => {
    const result: Record<string, ValidationState> = {};
    for (const [field, state] of Object.entries(validationStates)) {
      result[field] = state.state;
    }
    return result;
  }, [validationStates]);

  const fieldErrors = useMemo(() => {
    const result: Record<string, string | undefined> = {};
    for (const [field, state] of Object.entries(validationStates)) {
      result[field] = state.error;
    }
    return result;
  }, [validationStates]);

  const fieldWarnings = useMemo(() => {
    const result: Record<string, string | undefined> = {};
    for (const [field, state] of Object.entries(validationStates)) {
      result[field] = state.warning;
    }
    return result;
  }, [validationStates]);

  return {
    constraints,
    validateField,
    validateOnChange,
    clearFieldValidation,
    getConstraint,
    getHint,
    getValidationState,
    getError,
    getWarning,
    isFieldDisabled,
    allFieldDisabledStates,
    fieldStates,
    fieldErrors,
    fieldWarnings,
    revalidateAllFields,
    setServerError,
    setServerErrors,
  };
}
