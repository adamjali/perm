"use client";

import * as React from "react";
import { useState, useCallback, useMemo, useEffect } from "react";
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
import { applyCascade, type CaseData, type CaseStatus, type ProgressStatus } from "@/lib/perm";
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

// Status order for section visibility
const STATUS_ORDER: CaseStatus[] = ["pwd", "recruitment", "eta9089", "i140", "closed"];

// ============================================================================
// Helpers
// ============================================================================

/**
 * Convert camelCase field to snake_case for cascade compatibility.
 * DemoCase uses camelCase, cascade uses snake_case.
 */
function toCascadeField(field: string): string {
  return field.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase());
}

/**
 * Convert DemoCase (camelCase) to CaseData (snake_case) for cascade operations.
 */
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

/**
 * Apply cascade for a specific date field.
 * Returns the cascaded CaseData with auto-calculated dependent fields.
 */
function applyCascadeForField(
  caseData: CaseData,
  field: string,
  value: string | null
): CaseData {
  // Map camelCase fields to their cascade equivalents
  switch (field) {
    case "pwdDeterminationDate":
      return applyCascade(caseData, {
        field: "pwd_determination_date",
        value: value,
      });
    case "noticeOfFilingStartDate":
      return applyCascade(caseData, {
        field: "notice_of_filing_start_date",
        value: value,
      });
    case "jobOrderStartDate":
      return applyCascade(caseData, {
        field: "job_order_start_date",
        value: value,
      });
    case "eta9089CertificationDate":
      return applyCascade(caseData, {
        field: "eta9089_certification_date",
        value: value,
      });
    case "rfiReceivedDate":
      return applyCascade(caseData, {
        field: "rfi_received_date",
        value: value,
      });
    default:
      // No cascade for this field, just apply the value
      const snakeField = toCascadeField(field);
      return { ...caseData, [snakeField]: value };
  }
}

/**
 * Apply cascade result back to DemoCase format.
 */
function applyCascadeToDemoCase(
  formData: Partial<DemoCase>,
  field: string,
  value: string | null
): Partial<DemoCase> {
  const caseData = toCaseData(formData);

  // Apply cascade with proper typing
  const cascadeResult = applyCascadeForField(caseData, field, value);

  // Build updated form data
  const updated = { ...formData, [field]: value ?? undefined };

  // Map cascaded fields back to camelCase
  const cascadeFieldMap: Record<string, keyof DemoCase> = {
    pwd_expiration_date: "pwdExpirationDate",
    notice_of_filing_end_date: "noticeOfFilingEndDate",
    job_order_end_date: "jobOrderEndDate",
    eta9089_expiration_date: "eta9089ExpirationDate",
    rfi_due_date: "rfiDueDate",
  };

  for (const [snakeKey, camelKey] of Object.entries(cascadeFieldMap)) {
    const cascadeValue = cascadeResult[snakeKey as keyof CaseData];
    if (cascadeValue !== caseData[snakeKey as keyof CaseData]) {
      (updated as Record<string, unknown>)[camelKey] = cascadeValue ?? undefined;
    }
  }

  return updated;
}

/**
 * Create default form data for a new case.
 */
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

/**
 * Get status index for comparison.
 */
function getStatusIndex(status: CaseStatus): number {
  return STATUS_ORDER.indexOf(status);
}

// ============================================================================
// Component
// ============================================================================

/**
 * DemoCaseModal - Add/Edit modal for PERM demo cases.
 *
 * Features:
 * - Form fields for core PERM case data
 * - Auto-calculation via cascade logic (PWD expiration, etc.)
 * - Section visibility based on case status
 * - Client-side validation
 * - Neobrutalist styling
 */
export function DemoCaseModal({
  isOpen,
  onClose,
  caseToEdit,
  onSave,
}: DemoCaseModalProps) {
  const isEditMode = Boolean(caseToEdit);

  // Form state
  const [formData, setFormData] = useState<Partial<DemoCase>>(
    caseToEdit ?? createDefaultFormData()
  );
  const [errors, setErrors] = useState<FormErrors>({});

  // Reset form when modal opens/closes or caseToEdit changes
  useEffect(() => {
    if (isOpen) {
      setFormData(caseToEdit ?? createDefaultFormData());
      setErrors({});
    }
  }, [isOpen, caseToEdit]);

  // Derived state for section visibility
  const currentStatusIndex = useMemo(
    () => getStatusIndex(formData.status ?? "pwd"),
    [formData.status]
  );

  const showRecruitment = currentStatusIndex >= getStatusIndex("recruitment");
  const showEta9089 = currentStatusIndex >= getStatusIndex("eta9089");
  const showI140 = currentStatusIndex >= getStatusIndex("i140");

  // Handle text input changes
  const handleInputChange = useCallback(
    (field: keyof DemoCase) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));
      if (errors[field as keyof FormErrors]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    },
    [errors]
  );

  // Handle select changes
  const handleSelectChange = useCallback(
    (field: keyof DemoCase) => (e: React.ChangeEvent<HTMLSelectElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value as CaseStatus | ProgressStatus }));
      if (errors[field as keyof FormErrors]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    },
    [errors]
  );

  // Handle date input changes with cascade
  const handleDateChange = useCallback(
    (field: keyof DemoCase) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value || null;

      // Check if this field triggers cascade
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

  // Handle date clear
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

  // Handle checkbox change
  const handleCheckboxChange = useCallback(
    (field: keyof DemoCase) => (checked: boolean) => {
      setFormData((prev) => ({ ...prev, [field]: checked }));
    },
    []
  );

  // Validate form
  const validate = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.beneficiaryName?.trim()) {
      newErrors.beneficiaryName = "Beneficiary name is required";
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

  // Handle save
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
      // PWD dates
      pwdFilingDate: formData.pwdFilingDate,
      pwdDeterminationDate: formData.pwdDeterminationDate,
      pwdExpirationDate: formData.pwdExpirationDate,
      // Recruitment dates
      sundayAdFirstDate: formData.sundayAdFirstDate,
      sundayAdSecondDate: formData.sundayAdSecondDate,
      jobOrderStartDate: formData.jobOrderStartDate,
      jobOrderEndDate: formData.jobOrderEndDate,
      noticeOfFilingStartDate: formData.noticeOfFilingStartDate,
      noticeOfFilingEndDate: formData.noticeOfFilingEndDate,
      recruitmentStartDate: formData.recruitmentStartDate,
      recruitmentEndDate: formData.recruitmentEndDate,
      additionalRecruitmentMethods: formData.additionalRecruitmentMethods,
      // ETA 9089 dates
      eta9089FilingDate: formData.eta9089FilingDate,
      eta9089CertificationDate: formData.eta9089CertificationDate,
      eta9089ExpirationDate: formData.eta9089ExpirationDate,
      // I-140 dates
      i140FilingDate: formData.i140FilingDate,
      i140ApprovalDate: formData.i140ApprovalDate,
      // RFI/RFE dates
      rfiReceivedDate: formData.rfiReceivedDate,
      rfiDueDate: formData.rfiDueDate,
      rfiSubmittedDate: formData.rfiSubmittedDate,
      rfeReceivedDate: formData.rfeReceivedDate,
      rfeDueDate: formData.rfeDueDate,
      rfeSubmittedDate: formData.rfeSubmittedDate,
      // Notes
      notes: formData.notes,
    };

    try {
      onSave(caseData);
      onClose();
    } catch (error) {
      console.error("Failed to save demo case:", error);
      toast.error("Failed to save case. Please try again.");
    }
  }, [formData, caseToEdit, validate, onSave, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Edit Case" : "Add New Case"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Info Section */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Basic Information
            </h3>

            <FormField
              label="Beneficiary Name"
              name="beneficiaryName"
              required
              error={errors.beneficiaryName}
            >
              <Input
                id="beneficiaryName"
                value={formData.beneficiaryName ?? ""}
                onChange={handleInputChange("beneficiaryName")}
                placeholder="Enter beneficiary name"
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
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              PWD (Prevailing Wage Determination)
            </h3>

            <FormField label="PWD Filing Date" name="pwdFilingDate">
              <DateInput
                id="pwdFilingDate"
                value={formData.pwdFilingDate ?? ""}
                onChange={handleDateChange("pwdFilingDate")}
                onClear={handleDateClear("pwdFilingDate")}
              />
            </FormField>

            <FormField
              label="PWD Determination Date"
              name="pwdDeterminationDate"
              hint="Sets PWD expiration date automatically"
            >
              <DateInput
                id="pwdDeterminationDate"
                value={formData.pwdDeterminationDate ?? ""}
                onChange={handleDateChange("pwdDeterminationDate")}
                onClear={handleDateClear("pwdDeterminationDate")}
              />
            </FormField>

            <FormField
              label="PWD Expiration Date"
              name="pwdExpirationDate"
              autoCalculated={Boolean(formData.pwdDeterminationDate && formData.pwdExpirationDate)}
            >
              <DateInput
                id="pwdExpirationDate"
                value={formData.pwdExpirationDate ?? ""}
                onChange={handleDateChange("pwdExpirationDate")}
                onClear={handleDateClear("pwdExpirationDate")}
                autoCalculated={Boolean(formData.pwdDeterminationDate && formData.pwdExpirationDate)}
                disabled={Boolean(formData.pwdDeterminationDate)}
              />
            </FormField>
          </section>

          {/* Recruitment Section */}
          {showRecruitment && (
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Recruitment
              </h3>

              <FormField
                label="Notice of Filing Start"
                name="noticeOfFilingStartDate"
                hint="End date calculated automatically (+10 business days)"
              >
                <DateInput
                  id="noticeOfFilingStartDate"
                  value={formData.noticeOfFilingStartDate ?? ""}
                  onChange={handleDateChange("noticeOfFilingStartDate")}
                  onClear={handleDateClear("noticeOfFilingStartDate")}
                />
              </FormField>

              <FormField
                label="Notice of Filing End"
                name="noticeOfFilingEndDate"
                autoCalculated={Boolean(formData.noticeOfFilingStartDate && formData.noticeOfFilingEndDate)}
              >
                <DateInput
                  id="noticeOfFilingEndDate"
                  value={formData.noticeOfFilingEndDate ?? ""}
                  onChange={handleDateChange("noticeOfFilingEndDate")}
                  onClear={handleDateClear("noticeOfFilingEndDate")}
                  autoCalculated={Boolean(formData.noticeOfFilingStartDate && formData.noticeOfFilingEndDate)}
                  disabled={Boolean(formData.noticeOfFilingStartDate)}
                />
              </FormField>

              <FormField
                label="Job Order Start"
                name="jobOrderStartDate"
                hint="End date calculated automatically (+30 days)"
              >
                <DateInput
                  id="jobOrderStartDate"
                  value={formData.jobOrderStartDate ?? ""}
                  onChange={handleDateChange("jobOrderStartDate")}
                  onClear={handleDateClear("jobOrderStartDate")}
                />
              </FormField>

              <FormField
                label="Job Order End"
                name="jobOrderEndDate"
                autoCalculated={Boolean(formData.jobOrderStartDate && formData.jobOrderEndDate)}
              >
                <DateInput
                  id="jobOrderEndDate"
                  value={formData.jobOrderEndDate ?? ""}
                  onChange={handleDateChange("jobOrderEndDate")}
                  onClear={handleDateClear("jobOrderEndDate")}
                  autoCalculated={Boolean(formData.jobOrderStartDate && formData.jobOrderEndDate)}
                  disabled={Boolean(formData.jobOrderStartDate)}
                />
              </FormField>
            </section>
          )}

          {/* ETA 9089 Section */}
          {showEta9089 && (
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                ETA 9089
              </h3>

              <FormField label="ETA 9089 Filing Date" name="eta9089FilingDate">
                <DateInput
                  id="eta9089FilingDate"
                  value={formData.eta9089FilingDate ?? ""}
                  onChange={handleDateChange("eta9089FilingDate")}
                  onClear={handleDateClear("eta9089FilingDate")}
                />
              </FormField>

              <FormField
                label="ETA 9089 Certification Date"
                name="eta9089CertificationDate"
                hint="Expiration date calculated automatically (+180 days)"
              >
                <DateInput
                  id="eta9089CertificationDate"
                  value={formData.eta9089CertificationDate ?? ""}
                  onChange={handleDateChange("eta9089CertificationDate")}
                  onClear={handleDateClear("eta9089CertificationDate")}
                />
              </FormField>

              <FormField
                label="ETA 9089 Expiration Date"
                name="eta9089ExpirationDate"
                autoCalculated={Boolean(formData.eta9089CertificationDate && formData.eta9089ExpirationDate)}
              >
                <DateInput
                  id="eta9089ExpirationDate"
                  value={formData.eta9089ExpirationDate ?? ""}
                  onChange={handleDateChange("eta9089ExpirationDate")}
                  onClear={handleDateClear("eta9089ExpirationDate")}
                  autoCalculated={Boolean(formData.eta9089CertificationDate && formData.eta9089ExpirationDate)}
                  disabled={Boolean(formData.eta9089CertificationDate)}
                />
              </FormField>
            </section>
          )}

          {/* I-140 Section */}
          {showI140 && (
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                I-140
              </h3>

              <FormField label="I-140 Filing Date" name="i140FilingDate">
                <DateInput
                  id="i140FilingDate"
                  value={formData.i140FilingDate ?? ""}
                  onChange={handleDateChange("i140FilingDate")}
                  onClear={handleDateClear("i140FilingDate")}
                />
              </FormField>

              <FormField label="I-140 Approval Date" name="i140ApprovalDate">
                <DateInput
                  id="i140ApprovalDate"
                  value={formData.i140ApprovalDate ?? ""}
                  onChange={handleDateChange("i140ApprovalDate")}
                  onClear={handleDateClear("i140ApprovalDate")}
                />
              </FormField>
            </section>
          )}
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
