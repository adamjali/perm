"use client";

import * as React from "react";
import { FormSection } from "@/components/forms/FormSection";
import { FormField } from "@/components/forms/FormField";
import { DateInput } from "@/components/forms/DateInput";
import { SelectInput } from "@/components/forms/SelectInput";
import { Input } from "@/components/ui/input";
import { usePWDSection } from "@/components/forms/useCaseFormSection";
import type { DateConstraint } from "@/lib/forms/date-constraints";
import type { ValidationState } from "@/hooks/useDateFieldValidation";

// ============================================================================
// TYPES
// ============================================================================

export interface PWDSectionProps {
  /**
   * Form field values (optional when using FormSectionProvider context)
   */
  values?: {
    pwdFilingDate?: string;
    pwdDeterminationDate?: string;
    pwdExpirationDate?: string;
    pwdCaseNumber?: string;
    pwdWageAmount?: number;
    pwdWageLevel?: string;
  };

  /**
   * Validation errors keyed by field name (optional when using context)
   */
  errors?: Record<string, string>;

  /**
   * Set of field names that were auto-calculated (optional when using context)
   */
  autoCalculatedFields?: Set<string>;

  /**
   * Date constraints for each field (min/max dates) (optional when using context)
   */
  dateConstraints?: Record<string, DateConstraint>;

  /**
   * Validation states for each field (valid/warning/error) (optional when using context)
   */
  validationStates?: Record<string, ValidationState>;

  /**
   * Field disabled states based on missing dependencies (optional when using context)
   * e.g., determination date disabled until filing date is entered
   */
  fieldDisabledStates?: Record<string, { disabled: boolean; reason?: string }>;

  /**
   * Change handler for field updates (optional when using context)
   */
  onChange?: (field: string, value: string | number | undefined) => void;

  /**
   * Optional date change handler for triggering calculations
   */
  onDateChange?: (field: string, value: string) => void;

  /**
   * Optional blur handler for inline validation
   */
  onBlur?: (field: string, value: string | undefined) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Wage level options (DOL PERM regulation)
 */
const WAGE_LEVEL_OPTIONS = [
  { value: 'Level I', label: 'Level I' },
  { value: 'Level II', label: 'Level II' },
  { value: 'Level III', label: 'Level III' },
  { value: 'Level IV', label: 'Level IV' },
];

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * PWDSection Component
 *
 * Form section for PWD (Prevailing Wage Determination) information.
 * Includes filing/determination/expiration dates, case number, wage amount, and wage level.
 *
 * Features:
 * - Auto-calculated expiration date (disabled field)
 * - "Auto" badge on auto-calculated fields
 * - Date change callback for parent to trigger calculations
 * - 3-column responsive grid layout
 * - PWD status color indicator (#0066FF blue)
 * - Full validation error display
 *
 * Auto-calculation rules (from perm_flow.md):
 * - If determination date is Apr 2 - Jun 30: expiration = determination + 90 days
 * - If determination date is Jul 1 - Dec 31: expiration = Jun 30 of following year
 * - If determination date is Jan 1 - Apr 1: expiration = Jun 30 of same year
 *
 * @example
 * ```tsx
 * <PWDSection
 *   values={formValues}
 *   errors={validationErrors}
 *   autoCalculatedFields={new Set(['pwdExpirationDate'])}
 *   onChange={(field, value) => setFormValues({ ...formValues, [field]: value })}
 *   onDateChange={(field, value) => handleDateCalculation(field, value)}
 * />
 * ```
 */
export function PWDSection(props: PWDSectionProps) {
  // Use hook to get values from context OR props (backward compatible)
  const {
    values,
    errors,
    autoCalculatedFields,
    dateConstraints,
    validationStates,
    fieldDisabledStates,
    onChange,
    onDateChange,
    onBlur,
  } = usePWDSection(props);

  // Generic input handler for text and number fields
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = event.target;

    // Convert number inputs to numeric values
    if (type === 'number') {
      const numericValue = value === '' ? undefined : Number(value);
      (onChange as (field: string, value: string | number | undefined) => void)(name, numericValue);
    } else {
      (onChange as (field: string, value: string | undefined) => void)(name, value || undefined);
    }
  };

  // Generic select handler
  const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = event.target;
    (onChange as (field: string, value: string | undefined) => void)(name, value || undefined);
  };

  // Date change handler - returns a curried function for specific field
  const handleDateChange = (field: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    (onChange as (field: string, value: string | undefined) => void)(field, value || undefined);

    // Trigger onDateChange callback if provided (for calculation logic)
    if (onDateChange) {
      onDateChange(field, value);
    }
  };

  const handleDateBlur = (field: string) => (event: React.FocusEvent<HTMLInputElement>) => {
    if (onBlur) {
      onBlur(field, event.target.value || undefined);
    }
  };

  const isExpirationAutoCalculated = autoCalculatedFields?.has('pwdExpirationDate');

  // Get constraints for each field
  const filingConstraint = dateConstraints?.pwdFilingDate;
  const determinationConstraint = dateConstraints?.pwdDeterminationDate;

  // Get disabled states for fields with dependencies
  const determinationDisabled = fieldDisabledStates?.pwdDeterminationDate;

  return (
    <FormSection title="PWD (Prevailing Wage Determination)" defaultOpen>
      <div className="grid gap-4 md:grid-cols-3">
        {/* ========== ROW 1: DATE FIELDS ========== */}

        {/* Filing Date */}
        <FormField
          label="Filing Date"
          name="pwdFilingDate"
          error={errors?.pwdFilingDate}
          hint={filingConstraint?.hint || "Date PWD application was filed"}
          validationState={validationStates?.pwdFilingDate}
        >
          <DateInput
            id="pwdFilingDate"
            name="pwdFilingDate"
            value={values.pwdFilingDate || ''}
            onChange={handleDateChange('pwdFilingDate')}
            onBlur={handleDateBlur('pwdFilingDate')}
            maxDate={filingConstraint?.max}
            error={!!errors?.pwdFilingDate}
            validationState={validationStates?.pwdFilingDate}
          />
        </FormField>

        {/* Determination Date */}
        <FormField
          label="Determination Date"
          name="pwdDeterminationDate"
          error={errors?.pwdDeterminationDate}
          hint={determinationDisabled?.disabled ? determinationDisabled.reason : (determinationConstraint?.hint || "Determination date triggers expiration calculation")}
          validationState={validationStates?.pwdDeterminationDate}
        >
          <DateInput
            id="pwdDeterminationDate"
            name="pwdDeterminationDate"
            value={values.pwdDeterminationDate || ''}
            onChange={handleDateChange('pwdDeterminationDate')}
            onBlur={handleDateBlur('pwdDeterminationDate')}
            minDate={determinationConstraint?.min}
            error={!!errors?.pwdDeterminationDate}
            validationState={validationStates?.pwdDeterminationDate}
            disabled={determinationDisabled?.disabled}
          />
        </FormField>

        {/* Expiration Date (Auto-calculated, disabled) */}
        <FormField
          label="Expiration Date"
          name="pwdExpirationDate"
          error={errors?.pwdExpirationDate}
          autoCalculated={isExpirationAutoCalculated}
          hint="Auto-calculated based on determination date"
        >
          <DateInput
            id="pwdExpirationDate"
            name="pwdExpirationDate"
            value={values.pwdExpirationDate || ''}
            onChange={() => {}} // No-op - field is disabled
            disabled
            autoCalculated={isExpirationAutoCalculated}
            error={!!errors?.pwdExpirationDate}
          />
        </FormField>

        {/* ========== ROW 2: CASE INFO FIELDS ========== */}

        {/* PWD Case Number */}
        <FormField
          label="PWD Case Number"
          name="pwdCaseNumber"
          error={errors?.pwdCaseNumber}
          hint="DOL case number (optional)"
        >
          <Input
            id="pwdCaseNumber"
            name="pwdCaseNumber"
            type="text"
            value={values.pwdCaseNumber || ''}
            onChange={handleInputChange}
            aria-invalid={!!errors?.pwdCaseNumber}
            placeholder="e.g., PWD-2024-001"
          />
        </FormField>

        {/* Wage Amount */}
        <FormField
          label="Wage Amount"
          name="pwdWageAmount"
          error={errors?.pwdWageAmount}
          hint="Annual wage in USD (optional)"
        >
          <Input
            id="pwdWageAmount"
            name="pwdWageAmount"
            type="number"
            value={values.pwdWageAmount ?? ''}
            onChange={handleInputChange}
            onBlur={(e) => {
              // Round to nearest cent on blur (industry standard)
              const raw = e.target.value;
              if (raw === '') return;
              const rounded = Math.round(Number(raw) * 100) / 100;
              if (!isNaN(rounded) && rounded >= 0) {
                (onChange as (field: string, value: number | undefined) => void)('pwdWageAmount', rounded);
              }
            }}
            aria-invalid={!!errors?.pwdWageAmount}
            placeholder="e.g., 85000.00"
            min="0"
            step="0.01"
          />
        </FormField>

        {/* Wage Level */}
        <FormField
          label="Wage Level"
          name="pwdWageLevel"
          error={errors?.pwdWageLevel}
          hint="DOL wage level (optional)"
        >
          <SelectInput
            id="pwdWageLevel"
            name="pwdWageLevel"
            value={values.pwdWageLevel || ''}
            onChange={handleSelectChange}
            aria-invalid={!!errors?.pwdWageLevel}
            options={WAGE_LEVEL_OPTIONS}
            placeholder="Select wage level"
          />
        </FormField>
      </div>
    </FormSection>
  );
}
