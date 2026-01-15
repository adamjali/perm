"use client";

import * as React from "react";
import { FormSection } from "@/components/forms/FormSection";
import { FormField } from "@/components/forms/FormField";
import { DateInput } from "@/components/forms/DateInput";
import { FilingWindowIndicator, type FilingWindowData } from "@/components/forms/FilingWindowIndicator";
import { ProcessingTimeEstimate } from "@/components/forms/ProcessingTimeEstimate";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RFEEntryList } from "@/components/forms/sections/RFEEntryList";
import { differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import { useI140Section } from "@/components/forms/useCaseFormSection";
import type { CaseFormData } from "@/lib/forms/case-form-schema";
import type { DateConstraint } from "@/lib/forms/date-constraints";
import type { ValidationState } from "@/hooks/useDateFieldValidation";
import type { I140Category, ServiceCenter } from "@/lib/processing-times/i140ProcessingTimes";
import { Info, CheckCircle2 } from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

export interface I140SectionProps {
  /**
   * Form field values (includes RFE fields) (optional when using context)
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
   * Date constraints for each field (min/max dates) (optional when using context)
   */
  dateConstraints?: Record<string, DateConstraint>;

  /**
   * Validation states for each field (valid/warning/error) (optional when using context)
   */
  validationStates?: Record<string, ValidationState>;

  /**
   * Field disabled states based on missing dependencies (optional when using context)
   * e.g., receipt date disabled until filing date is entered
   */
  fieldDisabledStates?: Record<string, { disabled: boolean; reason?: string }>;

  /**
   * Change handler for field updates (optional when using context)
   */
  onChange?: (field: keyof CaseFormData, value: string | number | boolean | undefined) => void;

  /**
   * Optional date change handler for triggering calculations
   */
  onDateChange?: (field: keyof CaseFormData, value: string) => void;

  /**
   * Optional blur handler for inline validation
   */
  onBlur?: (field: string, value: string | undefined) => void;

  /**
   * Set of field names that were auto-calculated (optional when using context)
   */
  autoCalculatedFields?: Set<string>;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Build filing window data for I-140 (opens at ETA 9089 certification, closes at expiration)
 */
function buildI140FilingWindowData(
  eta9089CertificationDate: string | undefined,
  eta9089ExpirationDate: string | undefined,
  i140FilingDate: string | undefined
): FilingWindowData {
  // If already filed, window is moot
  if (i140FilingDate) {
    return { isOpen: false };
  }

  // If no certification yet, window not available
  if (!eta9089CertificationDate || !eta9089ExpirationDate) {
    return { isOpen: false };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // I-140 window opens immediately at certification
  const opensDate = new Date(eta9089CertificationDate + "T00:00:00");
  // Window closes at ETA 9089 expiration (cert + 180 days)
  const closesDate = new Date(eta9089ExpirationDate + "T00:00:00");

  const daysUntilOpen = differenceInDays(opensDate, today);
  const daysRemaining = differenceInDays(closesDate, today);

  const isOpen = daysUntilOpen <= 0 && daysRemaining >= 0;

  return {
    isOpen,
    opensOn: eta9089CertificationDate,
    closesOn: eta9089ExpirationDate,
    daysUntilOpen: daysUntilOpen > 0 ? daysUntilOpen : 0,
    daysRemaining: daysRemaining > 0 ? daysRemaining : 0,
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * I140Section Component
 *
 * Form section for I-140 Immigrant Petition for Alien Worker.
 * Includes filing/receipt/approval/denial dates, category, service center, premium processing,
 * filing deadline indicator, and expandable RFE (Request for Evidence) subsection.
 *
 * Features:
 * - Filing deadline indicator with color-coded status (open, due-soon, urgent, past-deadline)
 * - Countdown when deadline is near (< 30 days)
 * - Completion badge when I-140 is approved
 * - Category dropdown (EB-1, EB-2, EB-3)
 * - Premium processing checkbox with explanation tooltip
 * - Receipt tracking (date + number)
 * - Mutual exclusivity validation for approval/denial
 * - Date change callback for parent to trigger calculations
 * - 2-column responsive grid layout
 * - I-140 status color indicator (#059669 teal/green)
 * - Full validation error and warning display
 * - Expandable RFE subsection with Framer Motion animations
 *
 * Filing deadline rules (from perm_flow.md):
 * - Must file within 180 days of ETA 9089 certification
 * - Deadline = ETA 9089 expiration date (cert + 180 days)
 *
 * Validation rules (from perm_flow.md):
 * - Filing date must be after ETA 9089 certification
 * - Filing date must be before ETA 9089 expiration (180 days)
 * - Approval date must be after filing date
 * - Denial date must be after filing date
 * - Only one of approval/denial can be set
 *
 * RFE rules (from perm_flow.md):
 * - Received date must be after I-140 filing date
 * - Response due IS editable (no auto-calculation, typically 30-90 days, standard 87)
 * - Response submitted must be after received and before due
 * - Only one active RFE at a time (no submitted date = active)
 *
 * @example
 * ```tsx
 * <I140Section
 *   values={formValues}
 *   errors={validationErrors}
 *   warnings={validationWarnings}
 *   onChange={(field, value) => setFormValues({ ...formValues, [field]: value })}
 *   onDateChange={(field, value) => handleDateCalculation(field, value)}
 * />
 * ```
 */
export function I140Section(props: I140SectionProps) {
  // Use hook to get values from context OR props (backward compatible)
  const {
    values,
    errors,
    warnings,
    dateConstraints,
    validationStates,
    fieldDisabledStates,
    onChange,
    onDateChange,
    onBlur,
    autoCalculatedFields: _autoCalculatedFields,
  } = useI140Section(props);
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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

  const handleCheckboxChange = (field: keyof CaseFormData) => (checked: boolean) => {
    onChange(field, checked);
  };

  // Get constraints for each field
  const filingConstraint = dateConstraints?.i140FilingDate;
  const receiptConstraint = dateConstraints?.i140ReceiptDate;
  const approvalConstraint = dateConstraints?.i140ApprovalDate;
  const denialConstraint = dateConstraints?.i140DenialDate;

  // Get disabled states for fields with dependencies
  // Per perm_flow.md: receipt needs filing, approval/denial need filing AND receipt
  const receiptDisabled = fieldDisabledStates?.i140ReceiptDate;
  const approvalDisabled = fieldDisabledStates?.i140ApprovalDate;
  const denialDisabled = fieldDisabledStates?.i140DenialDate;

  // Calculate filing window data
  const windowData = buildI140FilingWindowData(
    values.eta9089CertificationDate,
    values.eta9089ExpirationDate,
    values.i140FilingDate
  );

  // Check if I-140 is approved (for completion badge)
  const isApproved = !!values.i140ApprovalDate;

  return (
    <FormSection title="I-140 Immigrant Petition" defaultOpen>
      <div className="space-y-4">
        {/* ========== COMPLETION BADGE ========== */}
        {isApproved && (
          <div className="flex items-center gap-2 rounded-lg border-2 border-emerald-300 bg-emerald-50 p-3 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-heading font-semibold">Complete - I-140 Approved!</span>
          </div>
        )}

        {/* ========== FILING WINDOW INDICATOR ========== */}
        {!values.i140FilingDate && (
          <FilingWindowIndicator
            window={windowData}
            label="I-140 Filing Window"
          />
        )}

        {/* ========== FORM FIELDS GRID ========== */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Filing Date */}
          <FormField
            label="Filing Date"
            name="i140FilingDate"
            error={errors?.i140FilingDate}
            hint={filingConstraint?.hint || "Date I-140 was filed (within 180 days of ETA 9089 cert)"}
            validationState={validationStates?.i140FilingDate}
          >
            <DateInput
              id="i140FilingDate"
              name="i140FilingDate"
              value={values.i140FilingDate || ""}
              onChange={handleDateChange("i140FilingDate")}
              onBlur={handleDateBlur("i140FilingDate")}
              minDate={filingConstraint?.min}
              maxDate={filingConstraint?.max}
              error={!!errors?.i140FilingDate}
              validationState={validationStates?.i140FilingDate}
            />
          </FormField>

          {/* Receipt Date */}
          <FormField
            label="Receipt Date"
            name="i140ReceiptDate"
            error={errors?.i140ReceiptDate}
            hint={receiptDisabled?.disabled ? receiptDisabled.reason : (receiptConstraint?.hint || "Date USCIS receipt notice was received (optional)")}
            validationState={validationStates?.i140ReceiptDate}
          >
            <DateInput
              id="i140ReceiptDate"
              name="i140ReceiptDate"
              value={values.i140ReceiptDate || ""}
              onChange={handleDateChange("i140ReceiptDate")}
              onBlur={handleDateBlur("i140ReceiptDate")}
              minDate={receiptConstraint?.min}
              error={!!errors?.i140ReceiptDate}
              validationState={validationStates?.i140ReceiptDate}
              disabled={receiptDisabled?.disabled}
            />
          </FormField>

          {/* Receipt Number */}
          <FormField
            label="Receipt Number"
            name="i140ReceiptNumber"
            error={errors?.i140ReceiptNumber}
            hint="USCIS receipt number (optional)"
          >
            <Input
              id="i140ReceiptNumber"
              name="i140ReceiptNumber"
              type="text"
              value={values.i140ReceiptNumber || ""}
              onChange={handleInputChange}
              aria-invalid={!!errors?.i140ReceiptNumber}
              placeholder="e.g., WAC2412345678"
            />
          </FormField>

          {/* Category */}
          <FormField
            label="Category"
            name="i140Category"
            error={errors?.i140Category}
            hint="Employment-based preference category"
          >
            <select
              id="i140Category"
              name="i140Category"
              value={values.i140Category || ""}
              onChange={handleInputChange}
              className={cn(
                "flex h-10 w-full rounded-md border-2 border-border bg-background px-3 py-2 text-sm",
                "ring-offset-background placeholder:text-muted-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "disabled:cursor-not-allowed disabled:opacity-50",
                "shadow-hard-sm transition-all",
                errors?.i140Category && "border-destructive"
              )}
              aria-invalid={!!errors?.i140Category}
            >
              <option value="">Select category (optional)</option>
              <option value="EB-1">EB-1 (Extraordinary Ability / Outstanding Researcher / Multinational Executive)</option>
              <option value="EB-2">EB-2 (Advanced Degree / Exceptional Ability)</option>
              <option value="EB-2-NIW">EB-2 National Interest Waiver</option>
              <option value="EB-3">EB-3 (Skilled Worker / Professional)</option>
            </select>
          </FormField>

          {/* Approval Date */}
          <FormField
            label="Approval Date"
            name="i140ApprovalDate"
            error={errors?.i140ApprovalDate}
            hint={approvalDisabled?.disabled ? approvalDisabled.reason : (approvalConstraint?.hint || "Date I-140 was approved (triggers completion status)")}
            validationState={validationStates?.i140ApprovalDate}
          >
            <DateInput
              id="i140ApprovalDate"
              name="i140ApprovalDate"
              value={values.i140ApprovalDate || ""}
              onChange={handleDateChange("i140ApprovalDate")}
              onBlur={handleDateBlur("i140ApprovalDate")}
              minDate={approvalConstraint?.min}
              error={!!errors?.i140ApprovalDate}
              validationState={validationStates?.i140ApprovalDate}
              disabled={approvalDisabled?.disabled}
            />
          </FormField>

          {/* Denial Date */}
          <FormField
            label="Denial Date"
            name="i140DenialDate"
            error={errors?.i140DenialDate}
            hint={denialDisabled?.disabled ? denialDisabled.reason : (denialConstraint?.hint || "Date I-140 was denied (optional)")}
            validationState={validationStates?.i140DenialDate}
          >
            <DateInput
              id="i140DenialDate"
              name="i140DenialDate"
              value={values.i140DenialDate || ""}
              onChange={handleDateChange("i140DenialDate")}
              onBlur={handleDateBlur("i140DenialDate")}
              minDate={denialConstraint?.min}
              error={!!errors?.i140DenialDate}
              validationState={validationStates?.i140DenialDate}
              disabled={denialDisabled?.disabled}
            />
          </FormField>

          {/* Service Center */}
          <FormField
            label="Service Center"
            name="i140ServiceCenter"
            error={errors?.i140ServiceCenter}
            hint="USCIS service center handling the case (optional)"
          >
            <select
              id="i140ServiceCenter"
              name="i140ServiceCenter"
              value={values.i140ServiceCenter || ""}
              onChange={handleInputChange}
              className={cn(
                "flex h-10 w-full rounded-md border-2 border-border bg-background px-3 py-2 text-sm",
                "ring-offset-background placeholder:text-muted-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "disabled:cursor-not-allowed disabled:opacity-50",
                "shadow-hard-sm transition-all",
                errors?.i140ServiceCenter && "border-destructive"
              )}
              aria-invalid={!!errors?.i140ServiceCenter}
            >
              <option value="">Select service center (optional)</option>
              <option value="Texas">Texas Service Center</option>
              <option value="Nebraska">Nebraska Service Center</option>
              <option value="California">California Service Center</option>
              <option value="Vermont">Vermont Service Center</option>
            </select>
          </FormField>

          {/* Premium Processing (Full Width) */}
          <FormField
            label=""
            name="i140PremiumProcessing"
            error={errors?.i140PremiumProcessing}
            className="md:col-span-2"
          >
            <div className="flex items-start gap-3 rounded-lg border-2 border-border bg-muted/30 p-3">
              <Checkbox
                id="i140PremiumProcessing"
                name="i140PremiumProcessing"
                checked={values.i140PremiumProcessing || false}
                onCheckedChange={handleCheckboxChange("i140PremiumProcessing")}
              />
              <div className="grid gap-1.5 leading-none">
                <Label
                  htmlFor="i140PremiumProcessing"
                  className="font-semibold cursor-pointer flex items-center gap-2"
                >
                  Premium Processing
                  <Info className="h-4 w-4 text-muted-foreground" />
                </Label>
                <p className="text-sm text-muted-foreground">
                  Expedited processing (15 business days guaranteed review). Additional fee required.
                </p>
              </div>
            </div>
          </FormField>

          {/* Processing Time Estimate (Full Width) */}
          <div className="md:col-span-2">
            <ProcessingTimeEstimate
              category={(values.i140Category || "") as I140Category}
              serviceCenter={(values.i140ServiceCenter || "") as ServiceCenter}
              isPremiumProcessing={values.i140PremiumProcessing || false}
              filingDate={values.i140FilingDate}
            />
          </div>
        </div>

        {/* ========== WARNINGS ========== */}
        {warnings?.i140FilingDate && (
          <div className="rounded-lg border-2 border-orange-300 bg-orange-50 p-3 text-sm text-orange-800 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-700">
            <p className="font-semibold">⚠ Warning</p>
            <p>{warnings.i140FilingDate}</p>
          </div>
        )}

        {/* ========== RFE SUBSECTION ========== */}
        <div className="space-y-3 pt-2">
          <h4 className="text-sm font-semibold text-muted-foreground">
            Request for Evidence (RFE)
          </h4>

          <RFEEntryList
            minReceivedDate={values.i140FilingDate}
            maxReceivedDate={values.eta9089ExpirationDate}
            receivedDisabled={
              !values.i140FilingDate
                ? { disabled: true, reason: "Enter I-140 filing date first" }
                : undefined
            }
          />
        </div>
      </div>
    </FormSection>
  );
}
