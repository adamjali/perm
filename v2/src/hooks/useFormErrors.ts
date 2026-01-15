/**
 * useFormErrors Hook
 *
 * Consolidates three error sources into a single unified error system:
 * 1. React Hook Form errors (rhfErrors)
 * 2. Legacy useState errors (from validation)
 * 3. Date field validation errors (from useDateFieldValidation)
 *
 * Priority order: RHF errors > legacy errors > date field errors
 * This ensures the most specific error is displayed for each field.
 */

"use client";

import { useMemo, useState, useCallback } from "react";
import type { FieldErrors } from "react-hook-form";
import type { CaseFormData } from "@/lib/forms/case-form-schema";

export interface UseFormErrorsResult {
  /**
   * Merged errors from all sources (RHF, legacy, date validation)
   */
  mergedErrors: Record<string, string>;

  /**
   * Total count of merged errors
   */
  errorCount: number;

  /**
   * Warnings (soft errors that don't block submission)
   */
  warnings: Record<string, string>;

  /**
   * Count of warnings
   */
  warningCount: number;

  /**
   * Whether to show the error summary panel
   */
  showErrorSummary: boolean;

  /**
   * Set show error summary state
   */
  setShowErrorSummary: (show: boolean) => void;

  /**
   * Set legacy errors (from validateCaseForm)
   */
  setLegacyErrors: (errors: Record<string, string>) => void;

  /**
   * Set warnings
   */
  setWarnings: (warnings: Record<string, string>) => void;

  /**
   * Clear a specific field's legacy error
   */
  clearFieldError: (field: string) => void;

  /**
   * Clear all legacy errors
   */
  clearAllErrors: () => void;

  /**
   * Clear errors matching a prefix (e.g., 'rfiEntries' or 'rfeEntries')
   */
  clearErrorsByPrefix: (prefix: string) => void;

  /**
   * Clear professional field errors (when isProfessionalOccupation is toggled off)
   */
  clearProfessionalErrors: () => void;
}

/**
 * Extract flat error messages from RHF nested error structure
 */
function extractRhfErrors(rhfErrors: FieldErrors<CaseFormData>): Record<string, string> {
  const result: Record<string, string> = {};

  function extractNested(errors: FieldErrors, prefix = ""): void {
    for (const [key, value] of Object.entries(errors)) {
      if (value && typeof value === "object") {
        if ("message" in value && typeof value.message === "string") {
          const fieldKey = prefix ? `${prefix}.${key}` : key;
          result[fieldKey] = value.message;
        } else if (!("ref" in value)) {
          // Nested object (array fields like rfiEntries[0].receivedDate)
          extractNested(value as FieldErrors, prefix ? `${prefix}.${key}` : key);
        }
      }
    }
  }

  extractNested(rhfErrors);
  return result;
}

/**
 * Hook for managing unified form errors from multiple sources
 *
 * @param rhfErrors - React Hook Form errors from formState
 * @param dateFieldErrors - Errors from useDateFieldValidation hook
 */
export function useFormErrors(
  rhfErrors: FieldErrors<CaseFormData>,
  dateFieldErrors: Record<string, string | undefined>
): UseFormErrorsResult {
  const [legacyErrors, setLegacyErrorsState] = useState<Record<string, string>>({});
  const [warnings, setWarningsState] = useState<Record<string, string>>({});
  const [showErrorSummary, setShowErrorSummary] = useState(false);

  // Merge all error sources with priority: RHF > legacy > date field
  const mergedErrors = useMemo(() => {
    const merged: Record<string, string> = { ...legacyErrors };

    // Add date field errors if not already present
    for (const [field, error] of Object.entries(dateFieldErrors)) {
      if (error && !merged[field]) {
        merged[field] = error;
      }
    }

    // Add RHF errors (highest priority, overwrites others)
    const rhfFlat = extractRhfErrors(rhfErrors);
    for (const [field, error] of Object.entries(rhfFlat)) {
      merged[field] = error;
    }

    return merged;
  }, [legacyErrors, dateFieldErrors, rhfErrors]);

  const errorCount = Object.keys(mergedErrors).length;
  const warningCount = Object.keys(warnings).length;

  const setLegacyErrors = useCallback((errors: Record<string, string>) => {
    setLegacyErrorsState(errors);
  }, []);

  const setWarnings = useCallback((newWarnings: Record<string, string>) => {
    setWarningsState(newWarnings);
  }, []);

  const clearFieldError = useCallback((field: string) => {
    setLegacyErrorsState((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const clearAllErrors = useCallback(() => {
    setLegacyErrorsState({});
    setWarningsState({});
    setShowErrorSummary(false);
  }, []);

  const clearErrorsByPrefix = useCallback((prefix: string) => {
    setLegacyErrorsState((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const key of Object.keys(next)) {
        if (key.startsWith(prefix)) {
          delete next[key];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  const clearProfessionalErrors = useCallback(() => {
    setLegacyErrorsState((prev) => {
      const next = { ...prev };
      delete next["additionalRecruitmentStartDate"];
      delete next["additionalRecruitmentEndDate"];
      for (const key of Object.keys(next)) {
        if (key.startsWith("additionalRecruitmentMethods")) {
          delete next[key];
        }
      }
      return next;
    });
    setWarningsState((prev) => {
      const next = { ...prev };
      delete next["additionalRecruitmentStartDate"];
      delete next["additionalRecruitmentEndDate"];
      for (const key of Object.keys(next)) {
        if (key.startsWith("additionalRecruitmentMethods")) {
          delete next[key];
        }
      }
      return next;
    });
  }, []);

  return {
    mergedErrors,
    errorCount,
    warnings,
    warningCount,
    showErrorSummary,
    setShowErrorSummary,
    setLegacyErrors,
    setWarnings,
    clearFieldError,
    clearAllErrors,
    clearErrorsByPrefix,
    clearProfessionalErrors,
  };
}
