"use client";

import * as React from "react";
import { FormSection } from "@/components/forms/FormSection";
import { FormField } from "@/components/forms/FormField";
import { SelectInput } from "@/components/forms/SelectInput";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useBasicInfoSection } from "@/components/forms/useCaseFormSection";

// ============================================================================
// TYPES
// ============================================================================

export type CaseStatus = 'pwd' | 'recruitment' | 'eta9089' | 'i140' | 'closed';
export type ProgressStatus = 'working' | 'waiting_intake' | 'filed' | 'approved' | 'under_review' | 'rfi_rfe';

export interface BasicInfoSectionProps {
  /**
   * Form field values (optional when using FormSectionProvider context)
   */
  values?: {
    employerName: string;
    beneficiaryIdentifier: string;
    positionTitle: string;
    caseNumber?: string;
    caseStatus: CaseStatus;
    progressStatus: ProgressStatus;
  };

  /**
   * Validation errors keyed by field name (optional when using context)
   */
  errors?: Record<string, string>;

  /**
   * Change handler for field updates (optional when using context)
   */
  onChange?: (field: string, value: string) => void;

  /**
   * Optional: Special handler for case status changes (for status advancement logic)
   */
  onCaseStatusChange?: (value: string) => void;

  /**
   * Optional: Special handler for progress status changes (for override tracking)
   */
  onProgressStatusChange?: (value: string) => void;

  /**
   * Whether progress status was auto-detected (shows indicator)
   */
  isProgressStatusAutoDetected?: boolean;

  /**
   * Whether case status was auto-detected (shows indicator)
   */
  isCaseStatusAutoDetected?: boolean;

  /**
   * Suggested case status advancement (shows advancement hint)
   */
  suggestedCaseStatus?: CaseStatus | null;

  /**
   * Whether auto-status mode is enabled (controls BOTH statuses together)
   */
  isAutoStatusEnabled?: boolean;

  /**
   * Handler for toggling auto-status mode
   */
  onAutoStatusToggle?: (enabled: boolean) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Case status options with colors matching design tokens
 * See: .planning/FRONTEND_DESIGN_SKILL.md and perm_flow.md
 */
const CASE_STATUS_OPTIONS = [
  { value: 'pwd', label: 'PWD', color: '#0066FF' }, // Blue
  { value: 'recruitment', label: 'Recruitment', color: '#9333ea' }, // Purple
  { value: 'eta9089', label: 'ETA 9089', color: '#D97706' }, // Orange
  { value: 'i140', label: 'I-140', color: '#059669' }, // Teal/Green
  { value: 'closed', label: 'Closed', color: '#6B7280' }, // Gray
];

/**
 * Progress status options from perm_flow.md
 */
const PROGRESS_STATUS_OPTIONS = [
  { value: 'working', label: 'Working' },
  { value: 'waiting_intake', label: 'Waiting for Intake' },
  { value: 'filed', label: 'Filed' },
  { value: 'approved', label: 'Approved' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'rfi_rfe', label: 'RFI/RFE' },
];

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * BasicInfoSection Component
 *
 * Form section for basic case information including employer details,
 * beneficiary identifier, position, case status, and progress status.
 *
 * Features:
 * - Required field indicators (red asterisks)
 * - Status color indicators (colored dots matching case status)
 * - 2-column responsive grid layout
 * - Full validation error display
 * - Prominent employer name and position title
 *
 * @example
 * ```tsx
 * <BasicInfoSection
 *   values={formValues}
 *   errors={validationErrors}
 *   onChange={(field, value) => setFormValues({ ...formValues, [field]: value })}
 * />
 * ```
 */
export function BasicInfoSection(props: BasicInfoSectionProps) {
  // Use hook to get values from context OR props (backward compatible)
  const {
    values,
    errors,
    onChange,
    onCaseStatusChange,
    onProgressStatusChange,
    isProgressStatusAutoDetected,
    isCaseStatusAutoDetected,
    suggestedCaseStatus: _suggestedCaseStatus,
    isAutoStatusEnabled,
    onAutoStatusToggle,
  } = useBasicInfoSection(props);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    onChange(name, value);
  };

  const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = event.target;
    // Use special handlers if provided, otherwise use generic onChange
    if (name === "caseStatus" && onCaseStatusChange) {
      onCaseStatusChange(value);
    } else if (name === "progressStatus" && onProgressStatusChange) {
      onProgressStatusChange(value);
    } else {
      onChange(name, value);
    }
  };

  // Get color for current case status
  const statusColor = CASE_STATUS_OPTIONS.find(
    opt => opt.value === values.caseStatus
  )?.color || '#6B7280';

  return (
    <FormSection title="Basic Information" defaultOpen>
      <div className="space-y-4">
        {/* ========== PRIMARY FIELDS ========== */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Employer Name (Full Width) */}
          <FormField
            label="Employer Name"
            name="employerName"
            required
            error={errors?.employerName}
            className="md:col-span-2"
          >
            <Input
              id="employerName"
              name="employerName"
              type="text"
              value={values.employerName}
              onChange={handleInputChange}
              aria-invalid={!!errors?.employerName}
              placeholder="Enter employer's full legal name"
            />
          </FormField>

          {/* Foreign Worker ID | Case Number (side by side) */}
          <FormField
            label="Foreign Worker ID"
            name="beneficiaryIdentifier"
            error={errors?.beneficiaryIdentifier}
          >
            <Input
              id="beneficiaryIdentifier"
              name="beneficiaryIdentifier"
              type="text"
              value={values.beneficiaryIdentifier}
              onChange={handleInputChange}
              aria-invalid={!!errors?.beneficiaryIdentifier}
              placeholder="Initials or unique ID (optional)"
            />
          </FormField>

          <FormField
            label="Case Number"
            name="caseNumber"
            error={errors?.caseNumber}
          >
            <Input
              id="caseNumber"
              name="caseNumber"
              type="text"
              value={values.caseNumber || ''}
              onChange={handleInputChange}
              aria-invalid={!!errors?.caseNumber}
              placeholder="Internal reference (optional)"
            />
          </FormField>

          {/* Position Title (Full Width) */}
          <FormField
            label="Position Title"
            name="positionTitle"
            required
            error={errors?.positionTitle}
            className="md:col-span-2"
          >
            <Input
              id="positionTitle"
              name="positionTitle"
              type="text"
              value={values.positionTitle}
              onChange={handleInputChange}
              aria-invalid={!!errors?.positionTitle}
              placeholder="Enter job position title"
            />
          </FormField>
        </div>

        {/* ========== STATUS FIELDS (Grouped) ========== */}
        <div className="rounded-lg border-2 border-border bg-muted/30 p-4">
          {/* Auto-Status Toggle Header */}
          <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-border">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">Status</span>
              {isAutoStatusEnabled && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-700">
                  Auto-updating
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="autoStatusToggle"
                checked={isAutoStatusEnabled}
                onCheckedChange={(checked) => {
                  if (onAutoStatusToggle) {
                    onAutoStatusToggle(checked);
                  }
                }}
                aria-label="Auto-detect status from form data"
              />
              <Label
                htmlFor="autoStatusToggle"
                className="text-sm text-muted-foreground cursor-pointer"
              >
                Auto
              </Label>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Case Status */}
            <FormField
              label="Case Status"
              name="caseStatus"
              required
              error={errors?.caseStatus}
            >
              <div className="relative">
                <SelectInput
                  id="caseStatus"
                  name="caseStatus"
                  value={values.caseStatus}
                  onChange={handleSelectChange}
                  aria-invalid={!!errors?.caseStatus}
                  options={CASE_STATUS_OPTIONS.map(opt => ({
                    value: opt.value,
                    label: opt.label,
                  }))}
                  className={cn(
                    "pl-8",
                    isCaseStatusAutoDetected && isAutoStatusEnabled && "ring-2 ring-emerald-500/30 border-emerald-500"
                  )}
                />
                {/* Color indicator dot */}
                <div
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full pointer-events-none"
                  style={{ backgroundColor: statusColor }}
                  aria-hidden="true"
                />
                {/* Auto-detected indicator */}
                {isCaseStatusAutoDetected && isAutoStatusEnabled && (
                  <div
                    className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500"
                    title="Auto-detected from form data"
                    aria-hidden="true"
                  />
                )}
              </div>
            </FormField>

            {/* Progress Status */}
            <FormField
              label="Progress Status"
              name="progressStatus"
              required
              error={errors?.progressStatus}
            >
              <div className="relative">
                <SelectInput
                  id="progressStatus"
                  name="progressStatus"
                  value={values.progressStatus}
                  onChange={handleSelectChange}
                  aria-invalid={!!errors?.progressStatus}
                  options={PROGRESS_STATUS_OPTIONS.map(opt => ({
                    value: opt.value,
                    label: opt.label,
                  }))}
                  className={isProgressStatusAutoDetected && isAutoStatusEnabled ? "ring-2 ring-emerald-500/30 border-emerald-500" : ""}
                />
                {/* Auto-detected indicator */}
                {isProgressStatusAutoDetected && isAutoStatusEnabled && (
                  <div
                    className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500"
                    title="Auto-detected from form data"
                    aria-hidden="true"
                  />
                )}
              </div>
            </FormField>
          </div>

          {/* Helper text */}
          {isAutoStatusEnabled && (
            <p className="mt-3 text-xs text-muted-foreground">
              Status automatically updates based on form data. Toggle off to set manually.
            </p>
          )}
        </div>
      </div>
    </FormSection>
  );
}
