"use client";

import * as React from "react";
import { FormSection } from "@/components/forms/FormSection";
import { FormField } from "@/components/forms/FormField";
import { DateInput } from "@/components/forms/DateInput";
import { SelectInput } from "@/components/forms/SelectInput";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { GraduationCap, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useRecruitmentSection } from "@/components/forms/useCaseFormSection";
import type { DateConstraint } from "@/lib/forms/date-constraints";
import type { ValidationState } from "@/hooks/useDateFieldValidation";
import type { AdditionalRecruitmentMethod } from "@/lib/shared/types";
import type { CaseFormData } from "@/lib/forms/case-form-schema";

// Import extracted constants and components
import { US_STATES, RECRUITMENT_METHODS } from "./recruitment-section.constants";
import { RecruitmentDeadlineIndicator } from "./recruitment-section.components";
import { parseISO, addDays, differenceInDays, format } from "date-fns";

// ============================================================================
// HELPERS - Quick Select for Second Sunday Ad
// ============================================================================

/**
 * Check if a date string is a valid Sunday
 */
function isValidSunday(dateStr: string | undefined): boolean {
  if (!dateStr || dateStr.length !== 10) return false;
  try {
    const date = parseISO(dateStr);
    return !isNaN(date.getTime()) && date.getDay() === 0;
  } catch {
    return false;
  }
}

/**
 * Add days to a date string and return new date string (YYYY-MM-DD)
 */
function addDaysToDate(dateStr: string, days: number): string {
  const date = parseISO(dateStr);
  const newDate = addDays(date, days);
  return format(newDate, "yyyy-MM-dd");
}

/**
 * Calculate days between two date strings
 */
function daysBetween(dateStr1: string, dateStr2: string): number {
  const date1 = parseISO(dateStr1);
  const date2 = parseISO(dateStr2);
  return differenceInDays(date2, date1);
}

// Re-export for consumers of this module
export type { AdditionalRecruitmentMethod } from "@/lib/shared/types";
export { US_STATES, RECRUITMENT_METHODS } from "./recruitment-section.constants";
export { RecruitmentDeadlineIndicator } from "./recruitment-section.components";

// ============================================================================
// TYPES
// ============================================================================

export interface RecruitmentSectionProps {
  /**
   * Form field values (optional when using FormSectionProvider context)
   */
  values?: {
    sundayAdFirstDate?: string;
    sundayAdSecondDate?: string;
    sundayAdNewspaper?: string;
    jobOrderStartDate?: string;
    jobOrderEndDate?: string;
    jobOrderState?: string;
    noticeOfFilingStartDate?: string;
    noticeOfFilingEndDate?: string;
    recruitmentApplicantsCount?: number;
    // PWD dates for deadline calculation
    pwdDeterminationDate?: string;
    pwdExpirationDate?: string;
    // Professional occupation fields (for additional recruitment)
    isProfessionalOccupation?: boolean;
    additionalRecruitmentMethods?: AdditionalRecruitmentMethod[];
    additionalRecruitmentStartDate?: string;
    additionalRecruitmentEndDate?: string;
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
   * e.g., second Sunday ad disabled until first Sunday ad is entered
   */
  fieldDisabledStates?: Record<string, { disabled: boolean; reason?: string }>;

  /**
   * Change handler for field updates (optional when using context)
   */
  onChange?: (field: string, value: string | number | boolean | AdditionalRecruitmentMethod[] | undefined) => void;

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
// COMPONENT
// ============================================================================

/**
 * RecruitmentSection Component
 *
 * Form section for Recruitment information in PERM cases.
 * Includes Sunday ads, job order, notice of filing, and applicant count.
 *
 * Features:
 * - Sunday validation (must be on Sunday, second after first)
 * - Auto-calculated notice end date (+10 business days)
 * - Auto-suggested job order end date (+30 days)
 * - State dropdown (51 options: 50 states + DC)
 * - "Auto" badge on auto-calculated fields
 * - Organized subsections with responsive grid layout
 * - Purple indicator (#9333ea) for Recruitment phase
 * - Full validation error display
 *
 * Auto-calculation rules (from perm_flow.md):
 * - Notice of filing end date = start + 10 business days (excludes weekends and federal holidays)
 * - Job order end date suggestion = start + 30 calendar days (can extend, not shorten)
 *
 * Validation rules (from perm_flow.md):
 * - Sunday ads MUST be on Sundays (day of week = 0)
 * - Second Sunday ad MUST be after first (strictly after, not same date)
 * - Second Sunday ad must be at least 1 week after first
 * - Job order duration >= 30 days
 * - Notice of filing >= 10 business days
 *
 * @example
 * ```tsx
 * <RecruitmentSection
 *   values={formValues}
 *   errors={validationErrors}
 *   autoCalculatedFields={new Set(['noticeOfFilingEndDate', 'jobOrderEndDate'])}
 *   onChange={(field, value) => setFormValues({ ...formValues, [field]: value })}
 *   onDateChange={(field, value) => handleDateCalculation(field, value)}
 * />
 * ```
 */
export function RecruitmentSection(props: RecruitmentSectionProps) {
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
  } = useRecruitmentSection(props as Parameters<typeof useRecruitmentSection>[0]);
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
  const handleDateChange = (field: keyof CaseFormData) => (event: React.ChangeEvent<HTMLInputElement>) => {
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

  // ========== PROFESSIONAL OCCUPATION HANDLERS ==========
  // Type-safe handler for additionalRecruitmentMethods array changes
  // Cast is required to bridge UI type (plain string dates) to schema type (branded ISODateString)
  const updateRecruitmentMethods = (methods: AdditionalRecruitmentMethod[]) => {
    onChange('additionalRecruitmentMethods', methods as CaseFormData['additionalRecruitmentMethods']);
  };

  const handleCheckboxChange = (checked: boolean) => {
    onChange('isProfessionalOccupation', checked);
    // Initialize with one empty method when checkbox is checked
    if (checked && (!values.additionalRecruitmentMethods || values.additionalRecruitmentMethods.length === 0)) {
      updateRecruitmentMethods([{ method: '', date: '', description: '' }]);
    }
  };

  const methods = values.additionalRecruitmentMethods || [];
  const filledMethodsCount = methods.filter(m => m.method).length;

  // Get list of already selected methods for filtering dropdowns
  const selectedMethods = methods.map(m => m.method).filter(Boolean);

  const addMethod = () => {
    if (methods.length < 3) {
      updateRecruitmentMethods([...methods, { method: '', date: '', description: '' }]);
    }
  };

  const removeMethod = (index: number) => {
    if (methods.length > 1) {
      updateRecruitmentMethods(methods.filter((_, i) => i !== index));
    }
  };

  const updateMethod = (index: number, field: keyof AdditionalRecruitmentMethod, value: string) => {
    updateRecruitmentMethods(methods.map((m, i) =>
      i === index ? { ...m, [field]: value } : m
    ));
  };

  // Get constraints for professional recruitment dates
  const additionalStartConstraint = dateConstraints?.additionalRecruitmentStartDate;
  const additionalEndConstraint = dateConstraints?.additionalRecruitmentEndDate;
  const additionalEndDisabled = fieldDisabledStates?.additionalRecruitmentEndDate;

  // Check which fields are auto-calculated
  const isNoticeEndAutoCalculated = autoCalculatedFields?.has('noticeOfFilingEndDate');
  const isJobOrderEndAutoCalculated = autoCalculatedFields?.has('jobOrderEndDate');

  // Get constraints for each field
  const sundayFirstConstraint = dateConstraints?.sundayAdFirstDate;
  const sundaySecondConstraint = dateConstraints?.sundayAdSecondDate;
  const jobOrderStartConstraint = dateConstraints?.jobOrderStartDate;
  const jobOrderEndConstraint = dateConstraints?.jobOrderEndDate;
  const noticeStartConstraint = dateConstraints?.noticeOfFilingStartDate;

  // Get disabled states for fields with dependencies
  const sundaySecondDisabled = fieldDisabledStates?.sundayAdSecondDate;
  const jobOrderEndDisabled = fieldDisabledStates?.jobOrderEndDate;

  // ========== QUICK SELECT FOR SECOND SUNDAY AD ==========
  const firstSundayIsValid = isValidSunday(values.sundayAdFirstDate);
  const secondSundayIsValid = isValidSunday(values.sundayAdSecondDate);

  // Calculate days between first and second Sunday for hint text
  // Note: isValidSunday already validates the date is defined and properly formatted
  const daysDiff = (firstSundayIsValid && secondSundayIsValid)
    ? daysBetween(values.sundayAdFirstDate!, values.sundayAdSecondDate!)
    : null;

  // Dynamic hint for second Sunday ad
  const secondSundayHint = (() => {
    if (sundaySecondDisabled?.disabled) return sundaySecondDisabled.reason;
    if (daysDiff !== null && daysDiff >= 7) {
      return `✓ Valid Sunday (${daysDiff} days after first ad)`;
    }
    return sundaySecondConstraint?.hint || "Must be a Sunday, after first ad";
  })();

  // Handler for quick select buttons
  const handleQuickSelectSunday = (daysToAdd: number) => {
    if (!values.sundayAdFirstDate) return;

    const newDate = addDaysToDate(values.sundayAdFirstDate, daysToAdd);
    onChange('sundayAdSecondDate', newDate);

    // Trigger onDateChange callback if provided (for calculation logic)
    if (onDateChange) {
      onDateChange('sundayAdSecondDate', newDate);
    }
  };

  return (
    <FormSection title="Recruitment" defaultOpen>
      <div className="space-y-6">
        {/* ========== RECRUITMENT DEADLINE INDICATOR ========== */}
        <RecruitmentDeadlineIndicator
          pwdDeterminationDate={values.pwdDeterminationDate}
          pwdExpirationDate={values.pwdExpirationDate}
          sundayAdFirstDate={values.sundayAdFirstDate}
          jobOrderStartDate={values.jobOrderStartDate}
          noticeOfFilingStartDate={values.noticeOfFilingStartDate}
        />

        {/* ========== SUNDAY NEWSPAPER ADS ========== */}
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground mb-3">
            Sunday Newspaper Ads
          </h4>
          <div className="grid gap-4 md:grid-cols-3">
            {/* First Sunday Ad */}
            <FormField
              label="First Sunday Ad"
              name="sundayAdFirstDate"
              error={errors?.sundayAdFirstDate}
              hint={sundayFirstConstraint?.hint || "Must be a Sunday"}
              validationState={validationStates?.sundayAdFirstDate}
            >
              <DateInput
                id="sundayAdFirstDate"
                name="sundayAdFirstDate"
                value={values.sundayAdFirstDate || ''}
                onChange={handleDateChange('sundayAdFirstDate')}
                onBlur={handleDateBlur('sundayAdFirstDate')}
                minDate={sundayFirstConstraint?.min}
                maxDate={sundayFirstConstraint?.max}
                error={!!errors?.sundayAdFirstDate}
                validationState={validationStates?.sundayAdFirstDate}
                sundayOnly
              />
            </FormField>

            {/* Second Sunday Ad */}
            <div className="space-y-2">
              <FormField
                label="Second Sunday Ad"
                name="sundayAdSecondDate"
                error={errors?.sundayAdSecondDate}
                hint={secondSundayHint}
                validationState={validationStates?.sundayAdSecondDate}
              >
                <DateInput
                  id="sundayAdSecondDate"
                  name="sundayAdSecondDate"
                  value={values.sundayAdSecondDate || ''}
                  onChange={handleDateChange('sundayAdSecondDate')}
                  onBlur={handleDateBlur('sundayAdSecondDate')}
                  minDate={sundaySecondConstraint?.min}
                  maxDate={sundaySecondConstraint?.max}
                  error={!!errors?.sundayAdSecondDate}
                  validationState={validationStates?.sundayAdSecondDate}
                  sundayOnly
                  disabled={sundaySecondDisabled?.disabled}
                />
              </FormField>

              {/* Quick Select Buttons - only show when first Sunday is valid */}
              {firstSundayIsValid && !sundaySecondDisabled?.disabled && (
                <div className="flex flex-wrap items-center gap-2 animate-fade-in">
                  <span className="text-xs font-medium text-muted-foreground">Quick select:</span>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={() => handleQuickSelectSunday(7)}
                      aria-label="Set second Sunday ad to 7 days after first ad"
                      className="text-xs"
                    >
                      +7 days
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={() => handleQuickSelectSunday(14)}
                      aria-label="Set second Sunday ad to 14 days after first ad"
                      className="text-xs"
                    >
                      +14 days
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={() => handleQuickSelectSunday(21)}
                      aria-label="Set second Sunday ad to 21 days after first ad"
                      className="text-xs"
                    >
                      +21 days
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Newspaper (optional) */}
            <FormField
              label="Newspaper"
              name="sundayAdNewspaper"
              error={errors?.sundayAdNewspaper}
              hint="Publication name (optional)"
            >
              <Input
                id="sundayAdNewspaper"
                name="sundayAdNewspaper"
                type="text"
                value={values.sundayAdNewspaper || ''}
                onChange={handleInputChange}
                aria-invalid={!!errors?.sundayAdNewspaper}
                placeholder="e.g., New York Times"
              />
            </FormField>
          </div>
        </div>

        {/* ========== JOB ORDER ========== */}
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground mb-3">
            Job Order
          </h4>
          <div className="grid gap-4 md:grid-cols-3">
            {/* Job Order Start Date */}
            <FormField
              label="Job Order Start"
              name="jobOrderStartDate"
              error={errors?.jobOrderStartDate}
              hint={jobOrderStartConstraint?.hint || "Start date of job order posting"}
              validationState={validationStates?.jobOrderStartDate}
            >
              <DateInput
                id="jobOrderStartDate"
                name="jobOrderStartDate"
                value={values.jobOrderStartDate || ''}
                onChange={handleDateChange('jobOrderStartDate')}
                onBlur={handleDateBlur('jobOrderStartDate')}
                minDate={jobOrderStartConstraint?.min}
                maxDate={jobOrderStartConstraint?.max}
                error={!!errors?.jobOrderStartDate}
                validationState={validationStates?.jobOrderStartDate}
              />
            </FormField>

            {/* Job Order End Date (Auto-suggested +30 days) */}
            <FormField
              label="Job Order End"
              name="jobOrderEndDate"
              error={errors?.jobOrderEndDate}
              autoCalculated={isJobOrderEndAutoCalculated}
              hint={jobOrderEndDisabled?.disabled ? jobOrderEndDisabled.reason : (jobOrderEndConstraint?.hint || "Auto-suggested +30 days, editable")}
              validationState={validationStates?.jobOrderEndDate}
            >
              <DateInput
                id="jobOrderEndDate"
                name="jobOrderEndDate"
                value={values.jobOrderEndDate || ''}
                onChange={handleDateChange('jobOrderEndDate')}
                onBlur={handleDateBlur('jobOrderEndDate')}
                minDate={jobOrderEndConstraint?.min}
                autoCalculated={isJobOrderEndAutoCalculated}
                error={!!errors?.jobOrderEndDate}
                validationState={validationStates?.jobOrderEndDate}
                disabled={jobOrderEndDisabled?.disabled}
              />
            </FormField>

            {/* Job Order State (51 options: 50 states + DC) */}
            <FormField
              label="State"
              name="jobOrderState"
              error={errors?.jobOrderState}
              hint="State where job order was posted"
            >
              <SelectInput
                id="jobOrderState"
                name="jobOrderState"
                value={values.jobOrderState || ''}
                onChange={handleSelectChange}
                aria-invalid={!!errors?.jobOrderState}
                options={US_STATES}
                placeholder="Select state"
              />
            </FormField>
          </div>
        </div>

        {/* ========== NOTICE OF FILING ========== */}
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground mb-3">
            Notice of Filing
          </h4>
          <div className="grid gap-4 md:grid-cols-2">
            {/* Notice of Filing Start Date */}
            <FormField
              label="Notice Start"
              name="noticeOfFilingStartDate"
              error={errors?.noticeOfFilingStartDate}
              hint={noticeStartConstraint?.hint || "Notice of filing start date"}
              validationState={validationStates?.noticeOfFilingStartDate}
            >
              <DateInput
                id="noticeOfFilingStartDate"
                name="noticeOfFilingStartDate"
                value={values.noticeOfFilingStartDate || ''}
                onChange={handleDateChange('noticeOfFilingStartDate')}
                onBlur={handleDateBlur('noticeOfFilingStartDate')}
                minDate={noticeStartConstraint?.min}
                maxDate={noticeStartConstraint?.max}
                error={!!errors?.noticeOfFilingStartDate}
                validationState={validationStates?.noticeOfFilingStartDate}
              />
            </FormField>

            {/* Notice of Filing End Date (Auto-calculated +10 business days, disabled) */}
            <FormField
              label="Notice End"
              name="noticeOfFilingEndDate"
              error={errors?.noticeOfFilingEndDate}
              autoCalculated={isNoticeEndAutoCalculated}
              hint="Auto-calculated +10 business days"
            >
              <DateInput
                id="noticeOfFilingEndDate"
                name="noticeOfFilingEndDate"
                value={values.noticeOfFilingEndDate || ''}
                onChange={() => {}} // No-op - field is auto-calculated
                disabled
                autoCalculated={isNoticeEndAutoCalculated}
                error={!!errors?.noticeOfFilingEndDate}
              />
            </FormField>
          </div>
        </div>

        {/* ========== RECRUITMENT RESULTS ========== */}
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground mb-3">
            Recruitment Results
          </h4>
          <div className="grid gap-4 md:grid-cols-1">
            {/* Applicant Count */}
            <FormField
              label="Applicant Count"
              name="recruitmentApplicantsCount"
              error={errors?.recruitmentApplicantsCount}
              hint="Number of applicants (default 0)"
            >
              <Input
                id="recruitmentApplicantsCount"
                name="recruitmentApplicantsCount"
                type="number"
                value={values.recruitmentApplicantsCount ?? ''}
                onChange={handleInputChange}
                aria-invalid={!!errors?.recruitmentApplicantsCount}
                placeholder="0"
                min="0"
                step="1"
              />
            </FormField>
          </div>
        </div>

        {/* ========== PROFESSIONAL OCCUPATION ========== */}
        <div className="border-t-2 border-border pt-6">
          <div className="flex items-center gap-3 mb-4">
            <Checkbox
              id="isProfessionalOccupation"
              checked={values.isProfessionalOccupation || false}
              onCheckedChange={handleCheckboxChange}
            />
            <div className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-muted-foreground" />
              <Label
                htmlFor="isProfessionalOccupation"
                className="font-semibold cursor-pointer"
              >
                Professional Occupation
              </Label>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Check if the position requires a Bachelor&apos;s degree or higher.
            Professional occupations require 3 additional recruitment methods.
          </p>

          {/* Collapsible Content */}
          <AnimatePresence>
            {values.isProfessionalOccupation && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="space-y-4 pt-2">
                  {/* Methods Warning */}
                  {filledMethodsCount < 3 && (
                    <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-700">
                      <p className="font-semibold">
                        {filledMethodsCount}/3 required methods selected
                      </p>
                      <p className="text-xs mt-1">
                        Professional occupations require 3 additional recruitment methods per 20 CFR § 656.17(e)
                      </p>
                    </div>
                  )}

                  {/* Additional Recruitment Methods */}
                  <div className="space-y-3">
                    <h5 className="text-sm font-medium text-muted-foreground">
                      Additional Recruitment Methods
                    </h5>

                    {methods.map((method, index) => (
                      <div
                        key={index}
                        className="grid gap-3 p-3 rounded-lg border border-border bg-muted/20"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Method {index + 1}
                          </span>
                          {methods.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeMethod(index)}
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive/80"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>

                        <div className="grid gap-3 md:grid-cols-3">
                          {/* Method Select */}
                          <FormField
                            label="Method"
                            name={`method-${index}`}
                            error={errors?.[`additionalRecruitmentMethods.${index}.method`]}
                          >
                            <select
                              id={`method-${index}`}
                              value={method.method}
                              onChange={(e) => updateMethod(index, 'method', e.target.value)}
                              className={cn(
                                "flex h-10 w-full rounded-md border-2 border-border bg-background px-3 py-2 text-sm",
                                "ring-offset-background placeholder:text-muted-foreground",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                "disabled:cursor-not-allowed disabled:opacity-50",
                                "shadow-hard-sm transition-all"
                              )}
                            >
                              <option value="">Select method</option>
                              {RECRUITMENT_METHODS.map((opt) => (
                                <option
                                  key={opt.value}
                                  value={opt.value}
                                  disabled={selectedMethods.includes(opt.value) && method.method !== opt.value}
                                >
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </FormField>

                          {/* Date */}
                          <FormField
                            label="Date"
                            name={`method-date-${index}`}
                            error={errors?.[`additionalRecruitmentMethods.${index}.date`]}
                            hint={additionalStartConstraint?.hint || "Date of recruitment activity"}
                          >
                            <DateInput
                              id={`method-date-${index}`}
                              name={`method-date-${index}`}
                              value={method.date || ''}
                              onChange={(e) => updateMethod(index, 'date', e.target.value)}
                              minDate={additionalStartConstraint?.min}
                              maxDate={additionalStartConstraint?.max}
                              error={!!errors?.[`additionalRecruitmentMethods.${index}.date`]}
                            />
                          </FormField>

                          {/* Description */}
                          <FormField
                            label="Description"
                            name={`method-desc-${index}`}
                            hint="Optional details"
                          >
                            <Input
                              id={`method-desc-${index}`}
                              value={method.description || ''}
                              onChange={(e) => updateMethod(index, 'description', e.target.value)}
                              placeholder="e.g., publication name"
                            />
                          </FormField>
                        </div>
                      </div>
                    ))}

                    {/* Add Method Button */}
                    {methods.length < 3 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addMethod}
                        className="w-full"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Method ({methods.length}/3)
                      </Button>
                    )}
                  </div>

                  {/* Additional Recruitment Period (Optional) */}
                  <div className="pt-2">
                    <h5 className="text-sm font-medium text-muted-foreground mb-3">
                      Additional Recruitment Period (Optional)
                    </h5>
                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        label="Start Date"
                        name="additionalRecruitmentStartDate"
                        error={errors?.additionalRecruitmentStartDate}
                        hint={additionalStartConstraint?.hint || "First additional recruitment activity"}
                        validationState={validationStates?.additionalRecruitmentStartDate}
                      >
                        <DateInput
                          id="additionalRecruitmentStartDate"
                          name="additionalRecruitmentStartDate"
                          value={values.additionalRecruitmentStartDate || ''}
                          onChange={handleDateChange('additionalRecruitmentStartDate')}
                          onBlur={handleDateBlur('additionalRecruitmentStartDate')}
                          minDate={additionalStartConstraint?.min}
                          maxDate={additionalStartConstraint?.max}
                          error={!!errors?.additionalRecruitmentStartDate}
                          validationState={validationStates?.additionalRecruitmentStartDate}
                        />
                      </FormField>

                      <FormField
                        label="End Date"
                        name="additionalRecruitmentEndDate"
                        error={errors?.additionalRecruitmentEndDate}
                        hint={additionalEndDisabled?.disabled ? additionalEndDisabled.reason : (additionalEndConstraint?.hint || "Last additional recruitment activity")}
                        validationState={validationStates?.additionalRecruitmentEndDate}
                      >
                        <DateInput
                          id="additionalRecruitmentEndDate"
                          name="additionalRecruitmentEndDate"
                          value={values.additionalRecruitmentEndDate || ''}
                          onChange={handleDateChange('additionalRecruitmentEndDate')}
                          onBlur={handleDateBlur('additionalRecruitmentEndDate')}
                          minDate={additionalEndConstraint?.min}
                          maxDate={additionalEndConstraint?.max}
                          error={!!errors?.additionalRecruitmentEndDate}
                          validationState={validationStates?.additionalRecruitmentEndDate}
                          disabled={additionalEndDisabled?.disabled}
                        />
                      </FormField>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </FormSection>
  );
}
