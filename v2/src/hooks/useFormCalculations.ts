"use client";

import { useState, useCallback, useMemo } from "react";
import { format } from "date-fns";
import {
  calculatePWDExpiration,
  calculateNoticeOfFilingEnd,
  calculateJobOrderEnd,
  calculateETA9089Expiration,
  calculateAutoStatus as calculateAutoStatusFromPerm,
} from "@/lib/perm";
import type { CaseFormData } from "@/lib/forms";
import type { CaseStatus, ProgressStatus } from "@/lib/perm";

/** Field dependencies for auto-calculation cascade. Only fields with dependencies are listed. */
const FIELD_DEPENDENCIES: Partial<Record<keyof CaseFormData, (keyof CaseFormData)[]>> = {
  // Clear-only: clearing parent clears user-entered child (prevents soft-lock on disabled fields)
  pwdFilingDate: ["pwdDeterminationDate"],
  sundayAdFirstDate: ["sundayAdSecondDate"],
  eta9089FilingDate: ["eta9089AuditDate", "eta9089CertificationDate"],
  i140FilingDate: ["i140ReceiptDate", "i140ApprovalDate", "i140DenialDate"],
  // Auto-calculated: changing parent recalculates child
  pwdDeterminationDate: ["pwdExpirationDate"],
  noticeOfFilingStartDate: ["noticeOfFilingEndDate"],
  jobOrderStartDate: ["jobOrderEndDate"],
  eta9089CertificationDate: ["eta9089ExpirationDate"],
  // Mutual exclusivity
  i140ApprovalDate: ["i140DenialDate"],
  i140DenialDate: ["i140ApprovalDate"],
};

export interface AutoStatusResult {
  caseStatus: CaseStatus;
  progressStatus: ProgressStatus;
}

/**
 * Calculate the appropriate case and progress status based on current form data.
 * Checks stages in reverse order (I-140 → ETA9089 → Recruitment → PWD).
 *
 * This is a wrapper around the central PERM module's calculateAutoStatus function.
 * The central function is the single source of truth for status calculation.
 */
export function calculateAutoStatus(formData: Partial<CaseFormData>): AutoStatusResult {
  return calculateAutoStatusFromPerm({
    // RFI/RFE entries
    rfiEntries: formData.rfiEntries,
    rfeEntries: formData.rfeEntries,
    // I-140 dates
    i140ApprovalDate: formData.i140ApprovalDate,
    i140DenialDate: formData.i140DenialDate,
    i140FilingDate: formData.i140FilingDate,
    // ETA 9089 dates
    eta9089CertificationDate: formData.eta9089CertificationDate,
    eta9089FilingDate: formData.eta9089FilingDate,
    // PWD dates
    pwdDeterminationDate: formData.pwdDeterminationDate,
    pwdFilingDate: formData.pwdFilingDate,
    // Recruitment dates
    jobOrderStartDate: formData.jobOrderStartDate,
    jobOrderEndDate: formData.jobOrderEndDate,
    sundayAdFirstDate: formData.sundayAdFirstDate,
    sundayAdSecondDate: formData.sundayAdSecondDate,
    noticeOfFilingStartDate: formData.noticeOfFilingStartDate,
    noticeOfFilingEndDate: formData.noticeOfFilingEndDate,
    // Professional occupation
    isProfessionalOccupation: formData.isProfessionalOccupation,
    additionalRecruitmentMethods: formData.additionalRecruitmentMethods,
    additionalRecruitmentEndDate: formData.additionalRecruitmentEndDate,
  });
}

/** Legacy wrapper for backward compatibility */
export function detectProgressStatus(formData: Partial<CaseFormData>): ProgressStatus {
  return calculateAutoStatus(formData).progressStatus;
}

/** Legacy wrapper for backward compatibility */
export function detectCaseStatusAdvancement(formData: Partial<CaseFormData>): CaseStatus | null {
  const currentStatus = formData.caseStatus || "pwd";
  const autoStatus = calculateAutoStatus(formData);
  return autoStatus.caseStatus !== currentStatus ? autoStatus.caseStatus : null;
}

/**
 * Calculate the new value for a dependent field based on source field change.
 * Returns undefined on calculation failure (with logging).
 */
function calculateDependentValue(
  sourceField: keyof CaseFormData,
  dependentField: keyof CaseFormData,
  formData: CaseFormData
): string | undefined {
  try {
    // PWD expiration calculation
    if (sourceField === "pwdDeterminationDate" && dependentField === "pwdExpirationDate") {
      if (!formData.pwdDeterminationDate) {
        return undefined;
      }
      return calculatePWDExpiration(formData.pwdDeterminationDate);
    }

    // Notice of Filing end calculation (+10 business days)
    if (sourceField === "noticeOfFilingStartDate" && dependentField === "noticeOfFilingEndDate") {
      if (!formData.noticeOfFilingStartDate) {
        return undefined;
      }
      return calculateNoticeOfFilingEnd(formData.noticeOfFilingStartDate);
    }

    // Job order end calculation (+30 days)
    if (sourceField === "jobOrderStartDate" && dependentField === "jobOrderEndDate") {
      if (!formData.jobOrderStartDate) {
        return undefined;
      }
      return calculateJobOrderEnd(formData.jobOrderStartDate);
    }

    // ETA 9089 expiration calculation (+180 days from certification)
    if (sourceField === "eta9089CertificationDate" && dependentField === "eta9089ExpirationDate") {
      if (!formData.eta9089CertificationDate) {
        return undefined;
      }
      const certDate = new Date(formData.eta9089CertificationDate + "T00:00:00");
      const expirationDate = calculateETA9089Expiration(certDate);
      return format(expirationDate, "yyyy-MM-dd");
    }

    // NOTE: RFI due date is now calculated in RFIEntryList component when handling array entries
    // The +30 day calculation happens in handleUpdate when receivedDate changes

    // I-140 approval/denial mutual exclusivity
    // When approval date is set, clear denial date
    if (sourceField === "i140ApprovalDate" && dependentField === "i140DenialDate") {
      return formData.i140ApprovalDate ? undefined : formData.i140DenialDate;
    }
    // When denial date is set, clear approval date
    if (sourceField === "i140DenialDate" && dependentField === "i140ApprovalDate") {
      return formData.i140DenialDate ? undefined : formData.i140ApprovalDate;
    }

    // Default clear-only behavior: clear dependent when source is cleared, keep value otherwise
    const sourceValue = formData[sourceField];
    if (!sourceValue) {
      return undefined;
    }
    return formData[dependentField] as string | undefined;
  } catch (error) {
    console.error(
      `[useFormCalculations] Failed to calculate ${String(dependentField)} from ${String(sourceField)}:`,
      { sourceValue: formData[sourceField], error }
    );
    return undefined;
  }
}

export interface ClearedFieldInfo {
  field: keyof CaseFormData;
  reason: string;
}

export interface UseFormCalculationsResult {
  autoCalculatedFields: Set<keyof CaseFormData>;
  triggerCalculation: (fieldName: keyof CaseFormData, updatedValue?: string) => ClearedFieldInfo[];
  markAsManual: (fieldName: keyof CaseFormData) => void;
  clearManualOverride: (fieldName: keyof CaseFormData) => void;
  suggestedProgressStatus: ProgressStatus | null;
  suggestedCaseStatus: CaseStatus | null;
  isProgressStatusOverridden: boolean;
  markProgressStatusOverridden: () => void;
  clearProgressStatusOverride: () => void;
  isCaseStatusOverridden: boolean;
  markCaseStatusOverridden: () => void;
  clearCaseStatusOverride: () => void;
}

/** Hook for managing boolean override state with mark/clear functions */
function useBooleanOverride(initial: boolean): [boolean, () => void, () => void] {
  const [value, setValue] = useState(initial);
  const mark = useCallback(() => setValue(true), []);
  const clear = useCallback(() => setValue(false), []);
  return [value, mark, clear];
}

/**
 * Hook for managing auto-calculation cascade in case forms.
 * Handles date dependencies (PWD → expiration, etc.) and status suggestions.
 */
export function useFormCalculations(
  formData: CaseFormData,
  setFormData: (data: CaseFormData) => void,
  initialStatusOverride?: boolean
): UseFormCalculationsResult {
  const [autoCalculatedFields, setAutoCalculatedFields] = useState<Set<keyof CaseFormData>>(
    new Set()
  );
  const [manualOverrides, setManualOverrides] = useState<Set<keyof CaseFormData>>(new Set());

  const [isProgressStatusOverridden, markProgressStatusOverridden, clearProgressStatusOverride] =
    useBooleanOverride(initialStatusOverride ?? false);
  const [isCaseStatusOverridden, markCaseStatusOverridden, clearCaseStatusOverride] =
    useBooleanOverride(initialStatusOverride ?? false);

  const suggestedProgressStatus = useMemo(() => {
    if (isProgressStatusOverridden) return null;
    const detected = detectProgressStatus(formData);
    return detected !== formData.progressStatus ? detected : null;
  }, [formData, isProgressStatusOverridden]);

  const suggestedCaseStatus = useMemo(() => {
    if (isCaseStatusOverridden) return null;
    const detected = detectCaseStatusAdvancement(formData);
    return detected !== formData.caseStatus ? detected : null;
  }, [formData, isCaseStatusOverridden]);

  const triggerCalculation = useCallback(
    (fieldName: keyof CaseFormData, updatedValue?: string): ClearedFieldInfo[] => {
      const dependentFields = FIELD_DEPENDENCIES[fieldName] ?? [];
      if (dependentFields.length === 0) return [];

      const effectiveFormData =
        updatedValue !== undefined ? { ...formData, [fieldName]: updatedValue } : formData;

      const updates: Partial<CaseFormData> = {};
      const newAutoFields = new Set(autoCalculatedFields);
      const clearedFields: ClearedFieldInfo[] = [];

      // Process dependents and collect fields that were cleared for recursive cascade
      const fieldsToRecurse: (keyof CaseFormData)[] = [];

      for (const dependentField of dependentFields) {
        if (manualOverrides.has(dependentField)) continue;

        const oldValue = formData[dependentField];
        const newValue = calculateDependentValue(fieldName, dependentField, effectiveFormData);
        (updates as Record<string, unknown>)[dependentField] = newValue;

        if (newValue !== undefined) {
          newAutoFields.add(dependentField);
        } else {
          newAutoFields.delete(dependentField);
          if (oldValue) {
            // Track for recursive cascade (e.g., filing→determination→expiration)
            fieldsToRecurse.push(dependentField);
            // Track cleared I-140 approval/denial for toast notification
            const clearReasons: Record<string, string> = {
              "i140ApprovalDate:i140DenialDate":
                "I-140 Denial date cleared because approval date was entered",
              "i140DenialDate:i140ApprovalDate":
                "I-140 Approval date cleared because denial date was entered",
            };
            const key = `${fieldName}:${dependentField}`;
            if (clearReasons[key]) {
              clearedFields.push({ field: dependentField, reason: clearReasons[key] });
            }
          }
        }
      }

      // Recursive cascade: process dependents of cleared fields
      // e.g., clearing pwdFilingDate clears pwdDeterminationDate, which then clears pwdExpirationDate
      const cascadedFormData = { ...effectiveFormData, ...updates };
      for (const clearedField of fieldsToRecurse) {
        const childDeps = FIELD_DEPENDENCIES[clearedField] ?? [];
        for (const childDep of childDeps) {
          if (manualOverrides.has(childDep)) continue;
          if (childDep in updates) continue; // Already processed

          const oldChildValue = formData[childDep];
          const newChildValue = calculateDependentValue(clearedField, childDep, cascadedFormData);
          (updates as Record<string, unknown>)[childDep] = newChildValue;

          if (newChildValue !== undefined) {
            newAutoFields.add(childDep);
          } else {
            newAutoFields.delete(childDep);
          }

          if (newChildValue !== oldChildValue) {
            (cascadedFormData as Record<string, unknown>)[childDep] = newChildValue;
          }
        }
      }

      if (Object.keys(updates).length > 0) {
        // Convert undefined → "" so cleared values persist through save.
        // Convex strips undefined from mutation args, causing ?? fallback to old DB value.
        // Empty strings pass through as real values: "" ?? oldValue === ""
        const persistableUpdates: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(updates)) {
          persistableUpdates[key] = value === undefined ? "" : value;
        }
        setFormData({ ...effectiveFormData, ...persistableUpdates } as CaseFormData);
        setAutoCalculatedFields(newAutoFields);
      }

      return clearedFields;
    },
    [formData, setFormData, autoCalculatedFields, manualOverrides]
  );

  const markAsManual = useCallback((fieldName: keyof CaseFormData) => {
    setManualOverrides((prev) => new Set([...prev, fieldName]));
    setAutoCalculatedFields((prev) => {
      const next = new Set(prev);
      next.delete(fieldName);
      return next;
    });
  }, []);

  const clearManualOverride = useCallback((fieldName: keyof CaseFormData) => {
    setManualOverrides((prev) => {
      const next = new Set(prev);
      next.delete(fieldName);
      return next;
    });
  }, []);

  return useMemo(
    () => ({
      autoCalculatedFields,
      triggerCalculation,
      markAsManual,
      clearManualOverride,
      suggestedProgressStatus,
      suggestedCaseStatus,
      isProgressStatusOverridden,
      markProgressStatusOverridden,
      clearProgressStatusOverride,
      isCaseStatusOverridden,
      markCaseStatusOverridden,
      clearCaseStatusOverride,
    }),
    [
      autoCalculatedFields,
      triggerCalculation,
      markAsManual,
      clearManualOverride,
      suggestedProgressStatus,
      suggestedCaseStatus,
      isProgressStatusOverridden,
      markProgressStatusOverridden,
      clearProgressStatusOverride,
      isCaseStatusOverridden,
      markCaseStatusOverridden,
      clearCaseStatusOverride,
    ]
  );
}
