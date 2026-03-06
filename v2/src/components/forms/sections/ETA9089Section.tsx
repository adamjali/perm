"use client";

import * as React from "react";
import { FormSection } from "@/components/forms/FormSection";
import { FormField } from "@/components/forms/FormField";
import { DateInput } from "@/components/forms/DateInput";
import { FilingWindowIndicator, type FilingWindowData } from "@/components/forms/FilingWindowIndicator";
import { Input } from "@/components/ui/input";
import { RFIEntryList } from "@/components/forms/sections/RFIEntryList";
import { differenceInDays, format, addDays } from "date-fns";
import { useETA9089Section } from "@/components/forms/useCaseFormSection";
import type { CaseFormData } from "@/lib/forms/case-form-schema";
import type { DateConstraint } from "@/lib/forms/date-constraints";
import { isRecruitmentComplete } from "@/lib/forms/date-constraints";
import { getFirstRecruitmentDate, getLastRecruitmentDate, FILING_WINDOW_WAIT_DAYS, FILING_WINDOW_CLOSE_DAYS } from "@/lib/perm";
import type { ValidationState } from "@/hooks/useDateFieldValidation";

// ============================================================================
// TYPES
// ============================================================================

export interface ETA9089SectionProps {
  /**
   * Form field values (optional when using FormSectionProvider context)
   */
  values?: Partial<CaseFormData>;

  /**
   * Validation errors keyed by field name (optional when using context)
   */
  errors?: Record<string, string>;

  /**
   * Validation warnings keyed by field name (optional when using context)
   */
  warnings?: Record<string, string>;

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
   * e.g., audit date disabled until filing date is entered
   */
  fieldDisabledStates?: Record<string, { disabled: boolean; reason?: string }>;

  /**
   * Change handler for field updates (optional when using context)
   */
  onChange?: (field: keyof CaseFormData, value: string | undefined) => void;

  /**
   * Optional date change handler for triggering calculations
   */
  onDateChange?: (field: keyof CaseFormData, value: string) => void;

  /**
   * Optional blur handler for inline validation
   */
  onBlur?: (field: string, value: string | undefined) => void;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Build filing window data for the FilingWindowIndicator component.
 * Uses canonical FILING_WINDOW_WAIT_DAYS (30) and FILING_WINDOW_CLOSE_DAYS (180).
 */
function buildFilingWindowData(
  lastRecruitmentDate: string | undefined,
  firstRecruitmentDate: string | undefined,
  pwdExpirationDate: string | undefined,
  recruitmentComplete: boolean
): FilingWindowData {
  // If recruitment isn't complete, show that status
  if (!recruitmentComplete) {
    return { isOpen: false, isRecruitmentComplete: false };
  }

  if (!lastRecruitmentDate || !firstRecruitmentDate) {
    return { isOpen: false };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastDate = new Date(lastRecruitmentDate + "T00:00:00");
  const firstDate = new Date(firstRecruitmentDate + "T00:00:00");

  // Window opens FILING_WINDOW_WAIT_DAYS after recruitment ends
  const opensDate = addDays(lastDate, FILING_WINDOW_WAIT_DAYS);
  const opensOn = format(opensDate, "yyyy-MM-dd");

  // Window closes FILING_WINDOW_CLOSE_DAYS after FIRST recruitment activity
  let closesDate = addDays(firstDate, FILING_WINDOW_CLOSE_DAYS);
  let closesOn = format(closesDate, "yyyy-MM-dd");
  let isPwdLimited = false;

  // PWD expiration can truncate the window
  if (pwdExpirationDate) {
    const pwdExpires = new Date(pwdExpirationDate + "T00:00:00");
    if (pwdExpires < closesDate) {
      closesOn = pwdExpirationDate;
      closesDate = pwdExpires;
      isPwdLimited = true;
    }
  }

  const daysUntilOpen = differenceInDays(opensDate, today);
  const daysUntilClose = differenceInDays(closesDate, today);

  const isOpen = daysUntilOpen <= 0 && daysUntilClose >= 0;

  return {
    isOpen,
    opensOn,
    closesOn,
    daysUntilOpen: daysUntilOpen > 0 ? daysUntilOpen : 0,
    daysRemaining: daysUntilClose > 0 ? daysUntilClose : 0,
    isPwdLimited,
    isRecruitmentComplete: true,
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * ETA9089Section Component
 *
 * Form section for ETA 9089 (Application for Permanent Employment Certification).
 * Includes filing/audit/certification/expiration dates, case number, filing window indicator,
 * and expandable RFI (Request for Information) subsection.
 *
 * Features:
 * - Auto-calculated expiration date (certification + 180 days)
 * - Filing window indicator with color-coded status (not-open, open, closing-soon, closed)
 * - Window countdown when closing soon (< 14 days)
 * - "Auto" badge on auto-calculated fields
 * - Date change callback for parent to trigger calculations
 * - 2-column responsive grid layout
 * - ETA 9089 status color indicator (#D97706 orange, #EAB308 yellow when working)
 * - Full validation error and warning display
 * - RFI entry list with array support and one-active-at-a-time rule
 *
 * Auto-calculation rules (from perm_flow.md):
 * - Expiration = certification + 180 days
 * - RFI due date = received + 30 days (strict, not editable)
 *
 * Filing window rules (from perm_flow.md):
 * - Must file 30-180 days after recruitment ends
 * - Must file before PWD expiration
 *
 * RFI rules (from perm_flow.md):
 * - Received date must be after ETA 9089 filing date
 * - Response due = received + 30 days (STRICT, not editable)
 * - Response submitted must be after received and before due
 * - Only one active RFI at a time (no submitted date = active)
 *
 * @example
 * ```tsx
 * <ETA9089Section
 *   values={formValues}
 *   errors={validationErrors}
 *   warnings={validationWarnings}
 *   autoCalculatedFields={new Set(['eta9089ExpirationDate'])}
 *   onChange={(field, value) => setFormValues({ ...formValues, [field]: value })}
 *   onDateChange={(field, value) => handleDateCalculation(field, value)}
 * />
 * ```
 */
export function ETA9089Section(props: ETA9089SectionProps) {
  // Use hook to get values from context OR props (backward compatible)
  const {
    values,
    errors,
    warnings,
    autoCalculatedFields,
    dateConstraints,
    validationStates,
    fieldDisabledStates,
    onChange,
    onDateChange,
    onBlur,
  } = useETA9089Section(props);
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    onChange(name as keyof CaseFormData, value || undefined);
  };

  const handleDateChange = (field: keyof CaseFormData) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    onChange(field, value || undefined);

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

  const isExpirationAutoCalculated = autoCalculatedFields?.has("eta9089ExpirationDate");

  // Get constraints for each field
  const filingConstraint = dateConstraints?.eta9089FilingDate;
  const auditConstraint = dateConstraints?.eta9089AuditDate;
  const certificationConstraint = dateConstraints?.eta9089CertificationDate;

  // Get disabled states for fields with dependencies
  const auditDisabled = fieldDisabledStates?.eta9089AuditDate;
  const certificationDisabled = fieldDisabledStates?.eta9089CertificationDate;

  // Extracted to local variable (React Compiler disabled; kept for SWC safety)
  const filingHint = filingConstraint?.hint;
  const auditHint = auditConstraint?.hint;
  const certHint = certificationConstraint?.hint;
  const auditIsDisabled = auditDisabled?.disabled;
  const certIsDisabled = certificationDisabled?.disabled;

  // Calculate filing window using canonical functions (includes special method exclusion rule)
  const lastRecruitDate = getLastRecruitmentDate(values, values.isProfessionalOccupation ?? false);
  const firstRecruitDate = getFirstRecruitmentDate(values);

  // Check if recruitment is complete before showing window
  const recruitmentComplete = isRecruitmentComplete(values);

  const windowData = buildFilingWindowData(
    lastRecruitDate,
    firstRecruitDate,
    values.pwdExpirationDate,
    recruitmentComplete
  );

  return (
    <FormSection title="ETA 9089" defaultOpen>
      <div className="space-y-4">
        {/* ========== FILING WINDOW INDICATOR ========== */}
        <FilingWindowIndicator
          window={windowData}
          label="ETA 9089 Filing Window"
        />

        {/* ========== FORM FIELDS GRID ========== */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Filing Date */}
          <FormField
            label="Filing Date"
            name="eta9089FilingDate"
            error={errors?.eta9089FilingDate}
            hint={filingHint || "Date ETA 9089 was filed (30-180 days after recruitment)"}
            validationState={validationStates?.eta9089FilingDate}
          >
            <DateInput
              id="eta9089FilingDate"
              name="eta9089FilingDate"
              value={values.eta9089FilingDate || ""}
              onChange={handleDateChange("eta9089FilingDate")}
              onBlur={handleDateBlur("eta9089FilingDate")}
              minDate={filingConstraint?.min}
              maxDate={filingConstraint?.max}
              error={!!errors?.eta9089FilingDate}
              validationState={validationStates?.eta9089FilingDate}
            />
          </FormField>

          {/* Audit Date */}
          <FormField
            label="Audit Date (optional)"
            name="eta9089AuditDate"
            error={errors?.eta9089AuditDate}
            hint={auditIsDisabled ? auditDisabled.reason : (auditHint || "Date case was selected for audit, if applicable")}
            validationState={validationStates?.eta9089AuditDate}
          >
            <DateInput
              id="eta9089AuditDate"
              name="eta9089AuditDate"
              value={values.eta9089AuditDate || ""}
              onChange={handleDateChange("eta9089AuditDate")}
              onBlur={handleDateBlur("eta9089AuditDate")}
              minDate={auditConstraint?.min}
              maxDate={auditConstraint?.max}
              error={!!errors?.eta9089AuditDate}
              validationState={validationStates?.eta9089AuditDate}
              disabled={auditDisabled?.disabled}
            />
          </FormField>

          {/* Certification Date */}
          <FormField
            label="Certification Date"
            name="eta9089CertificationDate"
            error={errors?.eta9089CertificationDate}
            hint={certIsDisabled ? certificationDisabled.reason : (certHint || "Date ETA 9089 was certified by DOL")}
            validationState={validationStates?.eta9089CertificationDate}
          >
            <DateInput
              id="eta9089CertificationDate"
              name="eta9089CertificationDate"
              value={values.eta9089CertificationDate || ""}
              onChange={handleDateChange("eta9089CertificationDate")}
              onBlur={handleDateBlur("eta9089CertificationDate")}
              minDate={certificationConstraint?.min}
              maxDate={certificationConstraint?.max}
              error={!!errors?.eta9089CertificationDate}
              validationState={validationStates?.eta9089CertificationDate}
              disabled={certificationDisabled?.disabled}
            />
          </FormField>

          {/* Expiration Date (Auto-calculated, disabled) */}
          <FormField
            label="Expiration Date"
            name="eta9089ExpirationDate"
            error={errors?.eta9089ExpirationDate}
            autoCalculated={isExpirationAutoCalculated}
            hint="Auto-calculated: certification + 180 days"
          >
            <DateInput
              id="eta9089ExpirationDate"
              name="eta9089ExpirationDate"
              value={values.eta9089ExpirationDate || ""}
              onChange={() => {}} // No-op - field is disabled
              disabled
              autoCalculated={isExpirationAutoCalculated}
              error={!!errors?.eta9089ExpirationDate}
            />
          </FormField>

          {/* Case Number (Full Width) */}
          <FormField
            label="ETA 9089 Case Number"
            name="eta9089CaseNumber"
            error={errors?.eta9089CaseNumber}
            hint="DOL case number (optional)"
            className="md:col-span-2"
          >
            <Input
              id="eta9089CaseNumber"
              name="eta9089CaseNumber"
              type="text"
              value={values.eta9089CaseNumber || ""}
              onChange={handleInputChange}
              aria-invalid={!!errors?.eta9089CaseNumber}
              placeholder="e.g., A-12345-67890"
              maxLength={50}
            />
          </FormField>
        </div>

        {/* ========== WARNINGS ========== */}
        {warnings?.eta9089FilingDate && (
          <div className="rounded-lg border-2 border-orange-300 bg-orange-50 p-3 text-sm text-orange-800 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-700">
            <p className="font-semibold">⚠ Warning</p>
            <p>{warnings.eta9089FilingDate}</p>
          </div>
        )}

        {/* ========== RFI SUBSECTION ========== */}
        <div className="space-y-3 pt-2">
          <h4 className="text-sm font-semibold text-muted-foreground">
            Request for Information (RFI)
          </h4>

          <RFIEntryList
            minReceivedDate={values.eta9089FilingDate ? format(addDays(new Date(values.eta9089FilingDate + "T00:00:00"), 1), "yyyy-MM-dd") : undefined}
            receivedDisabled={
              !values.eta9089FilingDate
                ? { disabled: true, reason: "Enter ETA 9089 filing date first" }
                : undefined
            }
          />
        </div>
      </div>
    </FormSection>
  );
}
