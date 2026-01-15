"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { GraduationCap, Briefcase } from "lucide-react";
import { FormSection } from "@/components/forms/FormSection";
import { FormField } from "@/components/forms/FormField";
import { DateInput } from "@/components/forms/DateInput";
import { SelectInput } from "@/components/forms/SelectInput";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { DateConstraint } from "@/lib/forms/date-constraints";
import type { ValidationState } from "@/hooks/useDateFieldValidation";
import type { AdditionalRecruitmentMethod } from "@/lib/shared/types";

// Re-export for consumers of this module
export type { AdditionalRecruitmentMethod } from "@/lib/shared/types";

// ============================================================================
// TYPES
// ============================================================================

export interface ProfessionalSectionProps {
  /**
   * Form field values
   */
  values: {
    isProfessionalOccupation?: boolean;
    additionalRecruitmentMethods?: AdditionalRecruitmentMethod[];
    additionalRecruitmentStartDate?: string;
    additionalRecruitmentEndDate?: string;
  };

  /**
   * Validation errors keyed by field name
   */
  errors?: Record<string, string>;

  /**
   * Date constraints for each field (min/max dates)
   */
  dateConstraints?: Record<string, DateConstraint>;

  /**
   * Validation states for each field (valid/warning/error)
   */
  validationStates?: Record<string, ValidationState>;

  /**
   * Field disabled states based on missing dependencies
   */
  fieldDisabledStates?: Record<string, { disabled: boolean; reason?: string }>;

  /**
   * Change handler for field updates
   */
  onChange: (field: string, value: boolean | string | AdditionalRecruitmentMethod[] | undefined) => void;

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
 * Additional recruitment methods per 20 CFR § 656.17(e)
 * Professional occupations require 3 from this list
 */
const RECRUITMENT_METHODS = [
  { value: 'local_newspaper', label: 'Local/Ethnic Newspaper Ad' },
  { value: 'radio_ad', label: 'Radio Advertisement' },
  { value: 'tv_ad', label: 'Television Advertisement' },
  { value: 'job_fair', label: 'Job Fair' },
  { value: 'campus_placement', label: 'Campus Placement Office' },
  { value: 'trade_organization', label: 'Trade/Professional Organization' },
  { value: 'private_employment_firm', label: 'Private Employment Firm' },
  { value: 'employee_referral', label: 'Employee Referral Program' },
  { value: 'employer_website', label: "Employer's Website" },
  { value: 'job_website_ad', label: 'Job Website (Indeed, Monster, etc.)' },
  { value: 'on_campus_recruitment', label: 'On-Campus Recruitment' },
];

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * ProfessionalSection Component
 *
 * Form section for Professional Occupation and additional recruitment methods.
 * Per perm_flow.md:
 * - If checked, need 3 additional recruitment methods
 * - Each method must be different (dropdown excludes already selected)
 * - 3 max, no add button
 * - Nice animation to expand the section
 * - Can save without all 3, shows warning
 *
 * Per 20 CFR § 656.17(e):
 * Professional occupations (requiring Bachelor's or higher) need 3 additional
 * recruitment methods from the specified list.
 *
 * @example
 * ```tsx
 * <ProfessionalSection
 *   values={formValues}
 *   errors={validationErrors}
 *   onChange={(field, value) => setFormValues({ ...formValues, [field]: value })}
 * />
 * ```
 */
export function ProfessionalSection({
  values,
  errors,
  dateConstraints,
  validationStates,
  fieldDisabledStates: _fieldDisabledStates,
  onChange,
  onDateChange,
  onBlur,
}: ProfessionalSectionProps) {
  const [isExpanded, setIsExpanded] = useState(values.isProfessionalOccupation ?? false);

  // Get constraints for each field
  const startConstraint = dateConstraints?.additionalRecruitmentStartDate;
  const endConstraint = dateConstraints?.additionalRecruitmentEndDate;

  // Sync expanded state with checkbox value
  useEffect(() => {
    setIsExpanded(values.isProfessionalOccupation ?? false);
  }, [values.isProfessionalOccupation]);

  // Initialize methods array with 3 empty entries if needed
  const methods = values.additionalRecruitmentMethods || [];

  // Ensure we always have exactly 3 entries for display (filled + empty slots)
  const displayMethods: AdditionalRecruitmentMethod[] = [
    methods[0] || { method: '', date: '', description: '' },
    methods[1] || { method: '', date: '', description: '' },
    methods[2] || { method: '', date: '', description: '' },
  ];

  // Get selected methods for filtering dropdowns
  const selectedMethods = displayMethods
    .map(m => m.method)
    .filter(m => m);

  // Get available options for each dropdown (excluding already selected)
  const getAvailableOptions = (currentMethod: string) => {
    return RECRUITMENT_METHODS.filter(
      option => option.value === currentMethod || !selectedMethods.includes(option.value)
    );
  };

  // Handle checkbox change
  const handleCheckboxChange = (checked: boolean) => {
    onChange('isProfessionalOccupation', checked);
    if (!checked) {
      // Clear methods when unchecked
      onChange('additionalRecruitmentMethods', []);
    }
  };

  // Handle method field change
  const handleMethodChange = (index: number, field: keyof AdditionalRecruitmentMethod, value: string) => {
    // Build new methods array with proper types
    const newMethods = displayMethods.map((m, i) => {
      const base = {
        method: m.method || '',
        date: m.date || '',
        description: m.description || '',
      };
      // Apply the change to the targeted index
      if (i === index) {
        return { ...base, [field]: value };
      }
      return base;
    });

    // Filter out empty entries for storage
    const validMethods: AdditionalRecruitmentMethod[] = newMethods.filter(m => m.method || m.date || m.description);
    onChange('additionalRecruitmentMethods', validMethods);
  };

  // Count filled methods for warning
  const filledMethodCount = displayMethods.filter(m => m.method && m.date).length;
  const showWarning = values.isProfessionalOccupation && filledMethodCount < 3;

  return (
    <FormSection title="Professional Occupation" defaultOpen>
      <div className="space-y-4">
        {/* Professional Checkbox */}
        <div
          className={cn(
            "flex items-start gap-4 p-4 rounded-lg border-2 transition-all duration-300",
            values.isProfessionalOccupation
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50"
          )}
        >
          <div className="flex items-center h-6">
            <Checkbox
              id="isProfessionalOccupation"
              checked={values.isProfessionalOccupation ?? false}
              onCheckedChange={handleCheckboxChange}
            />
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <GraduationCap className="size-5 text-muted-foreground" />
              <Label htmlFor="isProfessionalOccupation" className="font-semibold cursor-pointer">
                Professional Occupation
              </Label>
            </div>
            <p className="text-sm text-muted-foreground">
              Check if position requires Bachelor&apos;s degree or higher (per 20 CFR § 656.17(e)).
              Requires 3 additional recruitment methods.
            </p>
          </div>
        </div>

        {/* Expandable Additional Recruitment Methods */}
        <div
          className={cn(
            "overflow-hidden transition-all duration-500 ease-out",
            isExpanded ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"
          )}
        >
          <div className="pt-4 space-y-4">
            {/* Section Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Briefcase className="size-5 text-muted-foreground" />
                <h4 className="text-sm font-semibold text-muted-foreground">
                  Additional Recruitment Methods
                </h4>
              </div>
              {showWarning && (
                <span className="text-sm text-orange-600 dark:text-orange-400">
                  {filledMethodCount}/3 required methods filled
                </span>
              )}
            </div>

            <p className="text-sm text-muted-foreground">
              Select 3 different methods from the list below. Each method must be unique.
            </p>

            {/* Method Entries */}
            <div className="space-y-4">
              {displayMethods.map((method, index) => (
                <div
                  key={index}
                  className={cn(
                    "p-4 rounded-lg border-2 border-dashed transition-all duration-300",
                    method.method
                      ? "border-primary/50 bg-primary/5"
                      : "border-muted hover:border-primary/30",
                    "animate-fade-in"
                  )}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="size-6 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </span>
                    <span className="text-sm font-medium">
                      Method {index + 1} {index === 2 ? '' : ''}
                    </span>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    {/* Method Type Dropdown */}
                    <FormField
                      label="Method Type"
                      name={`additionalRecruitmentMethods.${index}.method`}
                      error={errors?.[`additionalRecruitmentMethods.${index}.method`]}
                      required={values.isProfessionalOccupation}
                    >
                      <SelectInput
                        id={`method-${index}`}
                        name={`additionalRecruitmentMethods.${index}.method`}
                        value={method.method}
                        onChange={(e) => handleMethodChange(index, 'method', e.target.value)}
                        options={getAvailableOptions(method.method)}
                        placeholder="Select method..."
                      />
                    </FormField>

                    {/* Date Input */}
                    <FormField
                      label="Date"
                      name={`additionalRecruitmentMethods.${index}.date`}
                      error={errors?.[`additionalRecruitmentMethods.${index}.date`]}
                      hint="Date of recruitment activity"
                    >
                      <DateInput
                        id={`method-date-${index}`}
                        name={`additionalRecruitmentMethods.${index}.date`}
                        value={method.date}
                        onChange={(e) => handleMethodChange(index, 'date', e.target.value)}
                        error={!!errors?.[`additionalRecruitmentMethods.${index}.date`]}
                      />
                    </FormField>

                    {/* Description (Optional) */}
                    <FormField
                      label="Description"
                      name={`additionalRecruitmentMethods.${index}.description`}
                      hint="Optional details (outlet name, etc.)"
                    >
                      <Input
                        id={`method-desc-${index}`}
                        name={`additionalRecruitmentMethods.${index}.description`}
                        value={method.description || ''}
                        onChange={(e) => handleMethodChange(index, 'description', e.target.value)}
                        placeholder="e.g., Chicago Tribune"
                      />
                    </FormField>
                  </div>
                </div>
              ))}
            </div>

            {/* Overall Date Range (Optional) */}
            <div className="pt-4 border-t border-border">
              <h5 className="text-sm font-medium text-muted-foreground mb-3">
                Additional Recruitment Period (Optional)
              </h5>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  label="Start Date"
                  name="additionalRecruitmentStartDate"
                  error={errors?.additionalRecruitmentStartDate}
                  hint={startConstraint?.hint || "Overall start of additional recruitment"}
                  validationState={validationStates?.additionalRecruitmentStartDate}
                >
                  <DateInput
                    id="additionalRecruitmentStartDate"
                    name="additionalRecruitmentStartDate"
                    value={values.additionalRecruitmentStartDate || ''}
                    onChange={(e) => {
                      onChange('additionalRecruitmentStartDate', e.target.value || undefined);
                      onDateChange?.('additionalRecruitmentStartDate', e.target.value);
                    }}
                    onBlur={(e) => onBlur?.('additionalRecruitmentStartDate', e.target.value || undefined)}
                    minDate={startConstraint?.min}
                    maxDate={startConstraint?.max}
                    error={!!errors?.additionalRecruitmentStartDate}
                    validationState={validationStates?.additionalRecruitmentStartDate}
                  />
                </FormField>

                <FormField
                  label="End Date"
                  name="additionalRecruitmentEndDate"
                  error={errors?.additionalRecruitmentEndDate}
                  hint={endConstraint?.hint || "Overall end of additional recruitment"}
                  validationState={validationStates?.additionalRecruitmentEndDate}
                >
                  <DateInput
                    id="additionalRecruitmentEndDate"
                    name="additionalRecruitmentEndDate"
                    value={values.additionalRecruitmentEndDate || ''}
                    onChange={(e) => {
                      onChange('additionalRecruitmentEndDate', e.target.value || undefined);
                      onDateChange?.('additionalRecruitmentEndDate', e.target.value);
                    }}
                    onBlur={(e) => onBlur?.('additionalRecruitmentEndDate', e.target.value || undefined)}
                    minDate={endConstraint?.min}
                    maxDate={endConstraint?.max}
                    error={!!errors?.additionalRecruitmentEndDate}
                    validationState={validationStates?.additionalRecruitmentEndDate}
                  />
                </FormField>
              </div>
            </div>
          </div>
        </div>
      </div>
    </FormSection>
  );
}
