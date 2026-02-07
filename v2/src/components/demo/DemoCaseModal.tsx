"use client";

import * as React from "react";
import { useState, useCallback, useMemo, useEffect } from "react";
import { AlertCircle, Zap, CheckCircle2 } from "lucide-react";
import { toast } from "@/lib/toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FormField } from "@/components/forms/FormField";
import { DateInput } from "@/components/forms/DateInput";
import { SelectInput, type SelectOption } from "@/components/forms/SelectInput";
import {
  applyCascade,
  validateCase,
  type CaseData,
  type CaseStatus,
  type ProgressStatus,
  type ValidationResult,
} from "@/lib/perm";
import type { DemoCase } from "@/lib/demo/types";

// ============================================================================
// Types
// ============================================================================

interface DemoCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseToEdit?: DemoCase;
  onSave: (caseData: DemoCase) => void;
}

interface FormErrors {
  beneficiaryName?: string;
  employerName?: string;
  status?: string;
  progressStatus?: string;
}

// ============================================================================
// Constants
// ============================================================================

const STATUS_OPTIONS: SelectOption[] = [
  { value: "pwd", label: "PWD" },
  { value: "recruitment", label: "Recruitment" },
  { value: "eta9089", label: "ETA 9089" },
  { value: "i140", label: "I-140" },
  { value: "closed", label: "Closed" },
];

const PROGRESS_STATUS_OPTIONS: SelectOption[] = [
  { value: "working", label: "Working" },
  { value: "waiting_intake", label: "Waiting Intake" },
  { value: "filed", label: "Filed" },
  { value: "approved", label: "Approved" },
  { value: "under_review", label: "Under Review" },
  { value: "rfi_rfe", label: "RFI/RFE" },
];

const STATUS_ORDER: CaseStatus[] = ["pwd", "recruitment", "eta9089", "i140", "closed"];

// Map snake_case validation fields to camelCase form fields
const FIELD_MAP: Record<string, string> = {
  pwd_filing_date: "pwdFilingDate",
  pwd_determination_date: "pwdDeterminationDate",
  pwd_expiration_date: "pwdExpirationDate",
  sunday_ad_first_date: "sundayAdFirstDate",
  sunday_ad_second_date: "sundayAdSecondDate",
  job_order_start_date: "jobOrderStartDate",
  job_order_end_date: "jobOrderEndDate",
  notice_of_filing_start_date: "noticeOfFilingStartDate",
  notice_of_filing_end_date: "noticeOfFilingEndDate",
  recruitment_start_date: "recruitmentStartDate",
  recruitment_end_date: "recruitmentEndDate",
  eta9089_filing_date: "eta9089FilingDate",
  eta9089_certification_date: "eta9089CertificationDate",
  eta9089_expiration_date: "eta9089ExpirationDate",
  i140_filing_date: "i140FilingDate",
  i140_approval_date: "i140ApprovalDate",
  rfi_received_date: "rfiReceivedDate",
  rfi_due_date: "rfiDueDate",
  rfi_submitted_date: "rfiSubmittedDate",
  rfe_received_date: "rfeReceivedDate",
  rfe_due_date: "rfeDueDate",
  rfe_submitted_date: "rfeSubmittedDate",
};

// ============================================================================
// Helpers
// ============================================================================

function toCascadeField(field: string): string {
  return field.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase());
}

function toCaseData(demoCase: Partial<DemoCase>): CaseData {
  return {
    pwd_filing_date: demoCase.pwdFilingDate ?? null,
    pwd_determination_date: demoCase.pwdDeterminationDate ?? null,
    pwd_expiration_date: demoCase.pwdExpirationDate ?? null,
    sunday_ad_first_date: demoCase.sundayAdFirstDate ?? null,
    sunday_ad_second_date: demoCase.sundayAdSecondDate ?? null,
    job_order_start_date: demoCase.jobOrderStartDate ?? null,
    job_order_end_date: demoCase.jobOrderEndDate ?? null,
    notice_of_filing_start_date: demoCase.noticeOfFilingStartDate ?? null,
    notice_of_filing_end_date: demoCase.noticeOfFilingEndDate ?? null,
    recruitment_start_date: demoCase.recruitmentStartDate ?? null,
    recruitment_end_date: demoCase.recruitmentEndDate ?? null,
    is_professional_occupation: demoCase.isProfessionalOccupation ?? false,
    eta9089_filing_date: demoCase.eta9089FilingDate ?? null,
    eta9089_certification_date: demoCase.eta9089CertificationDate ?? null,
    eta9089_expiration_date: demoCase.eta9089ExpirationDate ?? null,
    i140_filing_date: demoCase.i140FilingDate ?? null,
    i140_approval_date: demoCase.i140ApprovalDate ?? null,
    rfi_received_date: demoCase.rfiReceivedDate ?? null,
    rfi_due_date: demoCase.rfiDueDate ?? null,
    rfi_submitted_date: demoCase.rfiSubmittedDate ?? null,
    rfe_received_date: demoCase.rfeReceivedDate ?? null,
    rfe_due_date: demoCase.rfeDueDate ?? null,
    rfe_submitted_date: demoCase.rfeSubmittedDate ?? null,
    case_status: demoCase.status ?? "pwd",
    progress_status: demoCase.progressStatus ?? "working",
  };
}

function applyCascadeForField(
  caseData: CaseData,
  field: string,
  value: string | null
): CaseData {
  switch (field) {
    case "pwdDeterminationDate":
      return applyCascade(caseData, { field: "pwd_determination_date", value });
    case "noticeOfFilingStartDate":
      return applyCascade(caseData, { field: "notice_of_filing_start_date", value });
    case "jobOrderStartDate":
      return applyCascade(caseData, { field: "job_order_start_date", value });
    case "eta9089CertificationDate":
      return applyCascade(caseData, { field: "eta9089_certification_date", value });
    case "rfiReceivedDate":
      return applyCascade(caseData, { field: "rfi_received_date", value });
    default: {
      const snakeField = toCascadeField(field);
      return { ...caseData, [snakeField]: value };
    }
  }
}

function applyCascadeToDemoCase(
  formData: Partial<DemoCase>,
  field: string,
  value: string | null
): Partial<DemoCase> {
  const caseData = toCaseData(formData);
  const cascadeResult = applyCascadeForField(caseData, field, value);
  const updated = { ...formData, [field]: value ?? undefined };

  const cascadeFieldMap: Record<string, keyof DemoCase> = {
    pwd_expiration_date: "pwdExpirationDate",
    notice_of_filing_end_date: "noticeOfFilingEndDate",
    job_order_end_date: "jobOrderEndDate",
    eta9089_expiration_date: "eta9089ExpirationDate",
    rfi_due_date: "rfiDueDate",
  };

  const cascadedFields: string[] = [];

  for (const [snakeKey, camelKey] of Object.entries(cascadeFieldMap)) {
    const cascadeValue = cascadeResult[snakeKey as keyof CaseData];
    if (cascadeValue !== caseData[snakeKey as keyof CaseData]) {
      (updated as Record<string, unknown>)[camelKey] = cascadeValue ?? undefined;
      if (cascadeValue) {
        cascadedFields.push(camelKey);
      }
    }
  }

  // Toast feedback when fields auto-calculate
  if (cascadedFields.length > 0) {
    const labels: Record<string, string> = {
      pwdExpirationDate: "PWD Expiration",
      noticeOfFilingEndDate: "NOF End Date",
      jobOrderEndDate: "Job Order End",
      eta9089ExpirationDate: "ETA 9089 Expiration",
      rfiDueDate: "RFI Due Date",
    };
    const names = cascadedFields.map((f) => labels[f] || f).join(", ");
    toast.success(`Auto-calculated: ${names}`);
  }

  return updated;
}

function createDefaultFormData(): Partial<DemoCase> {
  return {
    beneficiaryName: "",
    employerName: "",
    status: "pwd",
    progressStatus: "working",
    isProfessionalOccupation: false,
    isFavorite: false,
  };
}

function getStatusIndex(status: CaseStatus): number {
  return STATUS_ORDER.indexOf(status);
}

// ============================================================================
// Section Header
// ============================================================================

interface SectionHeaderProps {
  title: string;
  stageColor: string;
  icon?: React.ReactNode;
}

function SectionHeader({ title, stageColor, icon }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-5 w-1.5"
        style={{ backgroundColor: stageColor }}
        aria-hidden="true"
      />
      {icon}
      <h3 className="font-heading text-sm font-bold uppercase tracking-wider">
        {title}
      </h3>
    </div>
  );
}

// ============================================================================
// Validation Summary
// ============================================================================

interface ValidationSummaryProps {
  validation: ValidationResult;
}

function ValidationSummary({ validation }: ValidationSummaryProps) {
  if (validation.valid && validation.warnings.length === 0) return null;

  return (
    <div className="space-y-2">
      {/* Errors */}
      {validation.errors.length > 0 && (
        <div className="border-2 border-destructive/30 bg-destructive/5 p-3">
          <div className="mb-1.5 flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-destructive" />
            <span className="text-xs font-bold uppercase tracking-wider text-destructive">
              {validation.errors.length} Validation {validation.errors.length === 1 ? "Error" : "Errors"}
            </span>
          </div>
          <ul className="space-y-1">
            {validation.errors.map((err) => (
              <li key={err.ruleId} className="text-xs text-destructive/90">
                <span className="font-mono text-[10px] text-destructive/60">[{err.ruleId}]</span>{" "}
                {err.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {validation.warnings.length > 0 && (
        <div className="border-2 border-orange-500/30 bg-orange-50 p-3 dark:bg-orange-900/10">
          <div className="mb-1.5 flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-orange-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400">
              {validation.warnings.length} {validation.warnings.length === 1 ? "Warning" : "Warnings"}
            </span>
          </div>
          <ul className="space-y-1">
            {validation.warnings.map((warn) => (
              <li key={warn.ruleId} className="text-xs text-orange-600/90 dark:text-orange-400/90">
                <span className="font-mono text-[10px] text-orange-500/60">[{warn.ruleId}]</span>{" "}
                {warn.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export function DemoCaseModal({
  isOpen,
  onClose,
  caseToEdit,
  onSave,
}: DemoCaseModalProps) {
  const isEditMode = Boolean(caseToEdit);

  const [formData, setFormData] = useState<Partial<DemoCase>>(
    caseToEdit ?? createDefaultFormData()
  );
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (isOpen) {
      setFormData(caseToEdit ?? createDefaultFormData());
      setErrors({});
    }
  }, [isOpen, caseToEdit]);

  // Section visibility
  const currentStatusIndex = useMemo(
    () => getStatusIndex(formData.status ?? "pwd"),
    [formData.status]
  );

  const showRecruitment = currentStatusIndex >= getStatusIndex("recruitment");
  const showEta9089 = currentStatusIndex >= getStatusIndex("eta9089");
  const showI140 = currentStatusIndex >= getStatusIndex("i140");

  // Live PERM validation
  const permValidation = useMemo<ValidationResult>(() => {
    const caseData = toCaseData(formData);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { case_status, progress_status, ...validationData } = caseData;
    return validateCase(validationData);
  }, [formData]);

  // Map validation issues by field for inline display
  const fieldErrors = useMemo(() => {
    const map: Record<string, string> = {};
    for (const issue of permValidation.errors) {
      const camelField = FIELD_MAP[issue.field];
      if (camelField && !map[camelField]) {
        map[camelField] = issue.message;
      }
    }
    return map;
  }, [permValidation]);

  const fieldWarnings = useMemo(() => {
    const map: Record<string, string> = {};
    for (const issue of permValidation.warnings) {
      const camelField = FIELD_MAP[issue.field];
      if (camelField && !map[camelField]) {
        map[camelField] = issue.message;
      }
    }
    return map;
  }, [permValidation]);

  // Track which fields are auto-calculated
  const autoCalcFields = useMemo(() => {
    const fields = new Set<string>();
    if (formData.pwdDeterminationDate && formData.pwdExpirationDate) {
      fields.add("pwdExpirationDate");
    }
    if (formData.noticeOfFilingStartDate && formData.noticeOfFilingEndDate) {
      fields.add("noticeOfFilingEndDate");
    }
    if (formData.jobOrderStartDate && formData.jobOrderEndDate) {
      fields.add("jobOrderEndDate");
    }
    if (formData.eta9089CertificationDate && formData.eta9089ExpirationDate) {
      fields.add("eta9089ExpirationDate");
    }
    if (formData.rfiReceivedDate && formData.rfiDueDate) {
      fields.add("rfiDueDate");
    }
    return fields;
  }, [formData]);

  // Handlers
  const handleInputChange = useCallback(
    (field: keyof DemoCase) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));
      if (errors[field as keyof FormErrors]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    },
    [errors]
  );

  const handleSelectChange = useCallback(
    (field: keyof DemoCase) => (e: React.ChangeEvent<HTMLSelectElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value as CaseStatus | ProgressStatus }));
      if (errors[field as keyof FormErrors]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    },
    [errors]
  );

  const handleDateChange = useCallback(
    (field: keyof DemoCase) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value || null;
      const cascadeFields = [
        "pwdDeterminationDate",
        "noticeOfFilingStartDate",
        "jobOrderStartDate",
        "eta9089CertificationDate",
        "rfiReceivedDate",
      ];

      if (cascadeFields.includes(field)) {
        setFormData((prev) => applyCascadeToDemoCase(prev, field, value));
      } else {
        setFormData((prev) => ({ ...prev, [field]: value ?? undefined }));
      }
    },
    []
  );

  const handleDateClear = useCallback(
    (field: keyof DemoCase) => () => {
      const cascadeFields = [
        "pwdDeterminationDate",
        "noticeOfFilingStartDate",
        "jobOrderStartDate",
        "eta9089CertificationDate",
        "rfiReceivedDate",
      ];

      if (cascadeFields.includes(field)) {
        setFormData((prev) => applyCascadeToDemoCase(prev, field, null));
      } else {
        setFormData((prev) => ({ ...prev, [field]: undefined }));
      }
    },
    []
  );

  const handleCheckboxChange = useCallback(
    (field: keyof DemoCase) => (checked: boolean) => {
      setFormData((prev) => ({ ...prev, [field]: checked }));
    },
    []
  );

  const validate = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.beneficiaryName?.trim()) {
      newErrors.beneficiaryName = "Foreign worker name is required";
    }
    if (!formData.employerName?.trim()) {
      newErrors.employerName = "Employer name is required";
    }
    if (!formData.status) {
      newErrors.status = "Status is required";
    }
    if (!formData.progressStatus) {
      newErrors.progressStatus = "Progress status is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleSave = useCallback(() => {
    if (!validate()) return;

    const now = new Date().toISOString();
    const caseData: DemoCase = {
      id: caseToEdit?.id ?? crypto.randomUUID(),
      beneficiaryName: formData.beneficiaryName!,
      employerName: formData.employerName!,
      status: formData.status!,
      progressStatus: formData.progressStatus!,
      isProfessionalOccupation: formData.isProfessionalOccupation ?? false,
      isFavorite: formData.isFavorite ?? false,
      createdAt: caseToEdit?.createdAt ?? now,
      updatedAt: now,
      pwdFilingDate: formData.pwdFilingDate,
      pwdDeterminationDate: formData.pwdDeterminationDate,
      pwdExpirationDate: formData.pwdExpirationDate,
      sundayAdFirstDate: formData.sundayAdFirstDate,
      sundayAdSecondDate: formData.sundayAdSecondDate,
      jobOrderStartDate: formData.jobOrderStartDate,
      jobOrderEndDate: formData.jobOrderEndDate,
      noticeOfFilingStartDate: formData.noticeOfFilingStartDate,
      noticeOfFilingEndDate: formData.noticeOfFilingEndDate,
      recruitmentStartDate: formData.recruitmentStartDate,
      recruitmentEndDate: formData.recruitmentEndDate,
      additionalRecruitmentMethods: formData.additionalRecruitmentMethods,
      eta9089FilingDate: formData.eta9089FilingDate,
      eta9089CertificationDate: formData.eta9089CertificationDate,
      eta9089ExpirationDate: formData.eta9089ExpirationDate,
      i140FilingDate: formData.i140FilingDate,
      i140ApprovalDate: formData.i140ApprovalDate,
      rfiReceivedDate: formData.rfiReceivedDate,
      rfiDueDate: formData.rfiDueDate,
      rfiSubmittedDate: formData.rfiSubmittedDate,
      rfeReceivedDate: formData.rfeReceivedDate,
      rfeDueDate: formData.rfeDueDate,
      rfeSubmittedDate: formData.rfeSubmittedDate,
      notes: formData.notes,
    };

    try {
      onSave(caseData);
      if (permValidation.warnings.length > 0) {
        toast.warning(`Saved with ${permValidation.warnings.length} warning(s)`);
      }
      onClose();
    } catch (error) {
      console.error("Failed to save demo case:", error);
      toast.error("Failed to save case. Please try again.");
    }
  }, [formData, caseToEdit, validate, onSave, onClose, permValidation]);

  // Helper to check if a field has a value
  const hasValue = (field: keyof DemoCase) => Boolean(formData[field]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {isEditMode ? "Edit Case" : "Add New Case"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Live Validation Summary */}
          <ValidationSummary validation={permValidation} />

          {/* Validation status indicator */}
          {permValidation.valid && permValidation.warnings.length === 0 && hasValue("pwdFilingDate") && (
            <div className="flex items-center gap-2 border-2 border-emerald-500/30 bg-emerald-50 p-2.5 dark:bg-emerald-900/10">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                All validations passing
              </span>
            </div>
          )}

          {/* Basic Info Section */}
          <section className="space-y-4">
            <SectionHeader
              title="Basic Information"
              stageColor="var(--primary)"
            />

            <FormField
              label="Foreign Worker Name"
              name="beneficiaryName"
              required
              error={errors.beneficiaryName}
            >
              <Input
                id="beneficiaryName"
                value={formData.beneficiaryName ?? ""}
                onChange={handleInputChange("beneficiaryName")}
                placeholder="Enter foreign worker name"
              />
            </FormField>

            <FormField
              label="Employer Name"
              name="employerName"
              required
              error={errors.employerName}
            >
              <Input
                id="employerName"
                value={formData.employerName ?? ""}
                onChange={handleInputChange("employerName")}
                placeholder="Enter employer name"
              />
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="Case Status"
                name="status"
                required
                error={errors.status}
              >
                <SelectInput
                  id="status"
                  options={STATUS_OPTIONS}
                  value={formData.status ?? ""}
                  onChange={handleSelectChange("status")}
                  placeholder="Select status"
                />
              </FormField>

              <FormField
                label="Progress Status"
                name="progressStatus"
                required
                error={errors.progressStatus}
              >
                <SelectInput
                  id="progressStatus"
                  options={PROGRESS_STATUS_OPTIONS}
                  value={formData.progressStatus ?? ""}
                  onChange={handleSelectChange("progressStatus")}
                  placeholder="Select progress"
                />
              </FormField>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="isProfessionalOccupation"
                checked={formData.isProfessionalOccupation ?? false}
                onCheckedChange={handleCheckboxChange("isProfessionalOccupation")}
              />
              <Label htmlFor="isProfessionalOccupation" className="cursor-pointer">
                Professional Occupation (requires additional recruitment)
              </Label>
            </div>
          </section>

          {/* PWD Section */}
          <section className="space-y-4">
            <SectionHeader
              title="PWD (Prevailing Wage Determination)"
              stageColor="var(--stage-pwd)"
            />

            <FormField
              label="PWD Filing Date"
              name="pwdFilingDate"
              error={fieldErrors.pwdFilingDate}
              warning={fieldWarnings.pwdFilingDate}
            >
              <DateInput
                id="pwdFilingDate"
                value={formData.pwdFilingDate ?? ""}
                onChange={handleDateChange("pwdFilingDate")}
                onClear={handleDateClear("pwdFilingDate")}
                error={Boolean(fieldErrors.pwdFilingDate)}
              />
            </FormField>

            <FormField
              label="PWD Determination Date"
              name="pwdDeterminationDate"
              hint={hasValue("pwdFilingDate") ? "Auto-calculates PWD Expiration (1 year)" : "Enter PWD Filing Date first"}
              error={fieldErrors.pwdDeterminationDate}
              warning={fieldWarnings.pwdDeterminationDate}
            >
              <DateInput
                id="pwdDeterminationDate"
                value={formData.pwdDeterminationDate ?? ""}
                onChange={handleDateChange("pwdDeterminationDate")}
                onClear={handleDateClear("pwdDeterminationDate")}
                disabled={!hasValue("pwdFilingDate")}
                error={Boolean(fieldErrors.pwdDeterminationDate)}
              />
            </FormField>

            <FormField
              label="PWD Expiration Date"
              name="pwdExpirationDate"
              autoCalculated={autoCalcFields.has("pwdExpirationDate")}
              error={fieldErrors.pwdExpirationDate}
              warning={fieldWarnings.pwdExpirationDate}
              hint={autoCalcFields.has("pwdExpirationDate") ? "1 year from determination date" : undefined}
            >
              <DateInput
                id="pwdExpirationDate"
                value={formData.pwdExpirationDate ?? ""}
                onChange={handleDateChange("pwdExpirationDate")}
                onClear={handleDateClear("pwdExpirationDate")}
                autoCalculated={autoCalcFields.has("pwdExpirationDate")}
                disabled={autoCalcFields.has("pwdExpirationDate")}
                error={Boolean(fieldErrors.pwdExpirationDate)}
              />
            </FormField>
          </section>

          {/* Recruitment Section */}
          {showRecruitment && (
            <section className="space-y-4">
              <SectionHeader
                title="Recruitment"
                stageColor="var(--stage-recruitment)"
              />

              <FormField
                label="Notice of Filing Start"
                name="noticeOfFilingStartDate"
                hint="Auto-calculates end date (+10 business days)"
                error={fieldErrors.noticeOfFilingStartDate}
                warning={fieldWarnings.noticeOfFilingStartDate}
              >
                <DateInput
                  id="noticeOfFilingStartDate"
                  value={formData.noticeOfFilingStartDate ?? ""}
                  onChange={handleDateChange("noticeOfFilingStartDate")}
                  onClear={handleDateClear("noticeOfFilingStartDate")}
                  error={Boolean(fieldErrors.noticeOfFilingStartDate)}
                />
              </FormField>

              <FormField
                label="Notice of Filing End"
                name="noticeOfFilingEndDate"
                autoCalculated={autoCalcFields.has("noticeOfFilingEndDate")}
                hint={autoCalcFields.has("noticeOfFilingEndDate") ? "+10 business days from start" : undefined}
                error={fieldErrors.noticeOfFilingEndDate}
                warning={fieldWarnings.noticeOfFilingEndDate}
              >
                <DateInput
                  id="noticeOfFilingEndDate"
                  value={formData.noticeOfFilingEndDate ?? ""}
                  onChange={handleDateChange("noticeOfFilingEndDate")}
                  onClear={handleDateClear("noticeOfFilingEndDate")}
                  autoCalculated={autoCalcFields.has("noticeOfFilingEndDate")}
                  disabled={autoCalcFields.has("noticeOfFilingEndDate")}
                  error={Boolean(fieldErrors.noticeOfFilingEndDate)}
                />
              </FormField>

              <FormField
                label="Job Order Start"
                name="jobOrderStartDate"
                hint="Auto-calculates end date (+30 days)"
                error={fieldErrors.jobOrderStartDate}
                warning={fieldWarnings.jobOrderStartDate}
              >
                <DateInput
                  id="jobOrderStartDate"
                  value={formData.jobOrderStartDate ?? ""}
                  onChange={handleDateChange("jobOrderStartDate")}
                  onClear={handleDateClear("jobOrderStartDate")}
                  error={Boolean(fieldErrors.jobOrderStartDate)}
                />
              </FormField>

              <FormField
                label="Job Order End"
                name="jobOrderEndDate"
                autoCalculated={autoCalcFields.has("jobOrderEndDate")}
                hint={autoCalcFields.has("jobOrderEndDate") ? "+30 days from start" : undefined}
                error={fieldErrors.jobOrderEndDate}
                warning={fieldWarnings.jobOrderEndDate}
              >
                <DateInput
                  id="jobOrderEndDate"
                  value={formData.jobOrderEndDate ?? ""}
                  onChange={handleDateChange("jobOrderEndDate")}
                  onClear={handleDateClear("jobOrderEndDate")}
                  autoCalculated={autoCalcFields.has("jobOrderEndDate")}
                  disabled={autoCalcFields.has("jobOrderEndDate")}
                  error={Boolean(fieldErrors.jobOrderEndDate)}
                />
              </FormField>

              <FormField
                label="Sunday Ad #1"
                name="sundayAdFirstDate"
                error={fieldErrors.sundayAdFirstDate}
                warning={fieldWarnings.sundayAdFirstDate}
              >
                <DateInput
                  id="sundayAdFirstDate"
                  value={formData.sundayAdFirstDate ?? ""}
                  onChange={handleDateChange("sundayAdFirstDate")}
                  onClear={handleDateClear("sundayAdFirstDate")}
                  sundayOnly
                  error={Boolean(fieldErrors.sundayAdFirstDate)}
                />
              </FormField>

              <FormField
                label="Sunday Ad #2"
                name="sundayAdSecondDate"
                hint={!hasValue("sundayAdFirstDate") ? "Enter Sunday Ad #1 first" : undefined}
                error={fieldErrors.sundayAdSecondDate}
                warning={fieldWarnings.sundayAdSecondDate}
              >
                <DateInput
                  id="sundayAdSecondDate"
                  value={formData.sundayAdSecondDate ?? ""}
                  onChange={handleDateChange("sundayAdSecondDate")}
                  onClear={handleDateClear("sundayAdSecondDate")}
                  sundayOnly
                  disabled={!hasValue("sundayAdFirstDate")}
                  minDate={formData.sundayAdFirstDate}
                  error={Boolean(fieldErrors.sundayAdSecondDate)}
                />
              </FormField>

              <FormField
                label="Recruitment End Date"
                name="recruitmentEndDate"
                error={fieldErrors.recruitmentEndDate}
                warning={fieldWarnings.recruitmentEndDate}
              >
                <DateInput
                  id="recruitmentEndDate"
                  value={formData.recruitmentEndDate ?? ""}
                  onChange={handleDateChange("recruitmentEndDate")}
                  onClear={handleDateClear("recruitmentEndDate")}
                  error={Boolean(fieldErrors.recruitmentEndDate)}
                />
              </FormField>
            </section>
          )}

          {/* ETA 9089 Section */}
          {showEta9089 && (
            <section className="space-y-4">
              <SectionHeader
                title="ETA 9089"
                stageColor="var(--stage-eta9089)"
              />

              <FormField
                label="ETA 9089 Filing Date"
                name="eta9089FilingDate"
                error={fieldErrors.eta9089FilingDate}
                warning={fieldWarnings.eta9089FilingDate}
              >
                <DateInput
                  id="eta9089FilingDate"
                  value={formData.eta9089FilingDate ?? ""}
                  onChange={handleDateChange("eta9089FilingDate")}
                  onClear={handleDateClear("eta9089FilingDate")}
                  error={Boolean(fieldErrors.eta9089FilingDate)}
                />
              </FormField>

              <FormField
                label="ETA 9089 Certification Date"
                name="eta9089CertificationDate"
                hint="Auto-calculates expiration (+180 days)"
                error={fieldErrors.eta9089CertificationDate}
                warning={fieldWarnings.eta9089CertificationDate}
              >
                <DateInput
                  id="eta9089CertificationDate"
                  value={formData.eta9089CertificationDate ?? ""}
                  onChange={handleDateChange("eta9089CertificationDate")}
                  onClear={handleDateClear("eta9089CertificationDate")}
                  error={Boolean(fieldErrors.eta9089CertificationDate)}
                />
              </FormField>

              <FormField
                label="ETA 9089 Expiration Date"
                name="eta9089ExpirationDate"
                autoCalculated={autoCalcFields.has("eta9089ExpirationDate")}
                hint={autoCalcFields.has("eta9089ExpirationDate") ? "+180 days from certification" : undefined}
                error={fieldErrors.eta9089ExpirationDate}
                warning={fieldWarnings.eta9089ExpirationDate}
              >
                <DateInput
                  id="eta9089ExpirationDate"
                  value={formData.eta9089ExpirationDate ?? ""}
                  onChange={handleDateChange("eta9089ExpirationDate")}
                  onClear={handleDateClear("eta9089ExpirationDate")}
                  autoCalculated={autoCalcFields.has("eta9089ExpirationDate")}
                  disabled={autoCalcFields.has("eta9089ExpirationDate")}
                  error={Boolean(fieldErrors.eta9089ExpirationDate)}
                />
              </FormField>
            </section>
          )}

          {/* I-140 Section */}
          {showI140 && (
            <section className="space-y-4">
              <SectionHeader
                title="I-140"
                stageColor="var(--stage-i140)"
              />

              <FormField
                label="I-140 Filing Date"
                name="i140FilingDate"
                error={fieldErrors.i140FilingDate}
                warning={fieldWarnings.i140FilingDate}
              >
                <DateInput
                  id="i140FilingDate"
                  value={formData.i140FilingDate ?? ""}
                  onChange={handleDateChange("i140FilingDate")}
                  onClear={handleDateClear("i140FilingDate")}
                  error={Boolean(fieldErrors.i140FilingDate)}
                />
              </FormField>

              <FormField
                label="I-140 Approval Date"
                name="i140ApprovalDate"
                error={fieldErrors.i140ApprovalDate}
                warning={fieldWarnings.i140ApprovalDate}
              >
                <DateInput
                  id="i140ApprovalDate"
                  value={formData.i140ApprovalDate ?? ""}
                  onChange={handleDateChange("i140ApprovalDate")}
                  onClear={handleDateClear("i140ApprovalDate")}
                  error={Boolean(fieldErrors.i140ApprovalDate)}
                />
              </FormField>
            </section>
          )}

          {/* RFI Section */}
          <section className="space-y-4">
            <SectionHeader
              title="RFI (Request for Information)"
              stageColor="var(--urgency-urgent, #ef4444)"
            />

            <FormField
              label="RFI Received Date"
              name="rfiReceivedDate"
              hint="Auto-calculates due date (+30 days)"
              error={fieldErrors.rfiReceivedDate}
              warning={fieldWarnings.rfiReceivedDate}
            >
              <DateInput
                id="rfiReceivedDate"
                value={formData.rfiReceivedDate ?? ""}
                onChange={handleDateChange("rfiReceivedDate")}
                onClear={handleDateClear("rfiReceivedDate")}
                error={Boolean(fieldErrors.rfiReceivedDate)}
              />
            </FormField>

            <FormField
              label="RFI Due Date"
              name="rfiDueDate"
              autoCalculated={autoCalcFields.has("rfiDueDate")}
              hint={autoCalcFields.has("rfiDueDate") ? "+30 days from received date" : !hasValue("rfiReceivedDate") ? "Enter RFI Received Date first" : undefined}
              error={fieldErrors.rfiDueDate}
              warning={fieldWarnings.rfiDueDate}
            >
              <DateInput
                id="rfiDueDate"
                value={formData.rfiDueDate ?? ""}
                onChange={handleDateChange("rfiDueDate")}
                onClear={handleDateClear("rfiDueDate")}
                autoCalculated={autoCalcFields.has("rfiDueDate")}
                disabled={autoCalcFields.has("rfiDueDate") || !hasValue("rfiReceivedDate")}
                error={Boolean(fieldErrors.rfiDueDate)}
              />
            </FormField>

            <FormField
              label="RFI Submitted Date"
              name="rfiSubmittedDate"
              hint={!hasValue("rfiReceivedDate") ? "Enter RFI Received Date first" : undefined}
              error={fieldErrors.rfiSubmittedDate}
              warning={fieldWarnings.rfiSubmittedDate}
            >
              <DateInput
                id="rfiSubmittedDate"
                value={formData.rfiSubmittedDate ?? ""}
                onChange={handleDateChange("rfiSubmittedDate")}
                onClear={handleDateClear("rfiSubmittedDate")}
                disabled={!hasValue("rfiReceivedDate")}
                error={Boolean(fieldErrors.rfiSubmittedDate)}
              />
            </FormField>
          </section>

          {/* Auto-Calculation Callout */}
          <div className="flex items-start gap-2 border-2 border-primary/30 bg-primary/5 p-3">
            <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <div>
              <p className="text-xs font-bold text-foreground">
                Auto-Cascade in Action
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Try entering a PWD Determination Date — the Expiration Date
                fills in automatically. This cascade works for NOF, Job Order,
                ETA 9089, and RFI dates too.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {isEditMode ? "Save Changes" : "Add Case"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
