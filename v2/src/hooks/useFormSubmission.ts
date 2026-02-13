/**
 * useFormSubmission Hook
 *
 * Extracts form submission logic from CaseForm, including:
 * - Validation via validateCaseForm
 * - Add mode: passing data to onSuccess callback
 * - Edit mode: calling updateMutation, then onSuccess
 * - Error handling (validation errors vs network/permission errors)
 * - Server error parsing
 */

"use client";

import { useState, useCallback } from "react";
import { useMutation } from "convex/react";
import { toast } from "@/lib/toast";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  validateCaseForm,
  stripIncompleteRecruitmentEntries,
  getFieldLabel,
  type CaseFormData,
} from "@/lib/forms/case-form-schema";
import {
  errorsToFieldMap,
  parseServerValidationError,
} from "@/components/forms/case-form.helpers";
import { prepareUpdatePayload } from "@/lib/forms/prepareUpdatePayload";
import { ConvexError } from "convex/values";
import { captureError, captureMessage, trackValidationError } from "@/lib/sentry";

export interface UseFormSubmissionProps {
  mode: "add" | "edit";
  caseId?: Id<"cases">;
  onSuccess: (formDataOrCaseId: CaseFormData | Id<"cases">) => void | Promise<void>;
  markNavigating: () => void;
  setDateServerErrors: (errors: Record<string, string>) => void;
  setLegacyErrors: (errors: Record<string, string>) => void;
  setWarnings: (warnings: Record<string, string>) => void;
  setShowErrorSummary: (show: boolean) => void;
  clearAllErrors: () => void;
  /** Called when save fails due to auth/permission error — clears dirty state so user can navigate away */
  onAuthError?: () => void;
}

export interface UseFormSubmissionResult {
  /**
   * Whether submission is in progress
   */
  isSubmitting: boolean;

  /**
   * Handle form submission
   * @param getValues - Function to get current form values from RHF
   */
  handleSubmit: (
    event: React.FormEvent,
    getValues: () => CaseFormData
  ) => Promise<void>;
}

/**
 * Hook for managing form submission logic
 */
export function useFormSubmission({
  mode,
  caseId,
  onSuccess,
  markNavigating,
  setDateServerErrors,
  setLegacyErrors,
  setWarnings,
  setShowErrorSummary,
  clearAllErrors,
  onAuthError,
}: UseFormSubmissionProps): UseFormSubmissionResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const updateMutation = useMutation(api.cases.update);

  const handleSubmit = useCallback(
    async (event: React.FormEvent, getValues: () => CaseFormData) => {
      event.preventDefault();

      const rawFormData = getValues();

      // Strip incomplete recruitment entries before validation
      // (prevents false positives from empty method slots)
      const currentFormData = stripIncompleteRecruitmentEntries(rawFormData);

      // Run full validation (Zod + lib/perm)
      const result = validateCaseForm(currentFormData);

      if (!result.valid) {
        setLegacyErrors(errorsToFieldMap(result.errors));
        setWarnings(errorsToFieldMap(result.warnings));
        setShowErrorSummary(true);

        // Build informative toast message with field labels
        const labeledErrors = result.errors.map((e) => {
          const label = getFieldLabel(e.field);
          return `${label}: ${e.message}`;
        });
        const errorMessages = labeledErrors.slice(0, 3);
        const remainingCount = result.errors.length - 3;
        const toastMessage =
          result.errors.length === 1
            ? errorMessages[0]!
            : `${errorMessages.join("; ")}${remainingCount > 0 ? ` (+${remainingCount} more)` : ""}`;

        toast.error(`Validation failed: ${toastMessage}`, { duration: 5000 });

        // Log validation errors for admin visibility
        const errorDetails = result.errors.map((e) => ({
          field: e.field,
          label: getFieldLabel(e.field),
          message: e.message,
          value: currentFormData[e.field as keyof CaseFormData],
        }));
        console.warn(
          "[CaseForm] Validation failed on submit:",
          { errors: errorDetails, mode, caseId }
        );

        // Send to Sentry so admin can track validation patterns
        trackValidationError("CaseForm", result.errors.length, result.errors.map((e) => e.field));
        captureMessage(
          `Case form validation failed: ${result.errors.map((e) => `${getFieldLabel(e.field)}: ${e.message}`).join("; ")}`,
          "warning",
          {
            operation: "validateCaseForm",
            resourceId: caseId,
            extra: { mode, errorDetails },
          }
        );

        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      // Clear all errors/warnings on successful validation
      clearAllErrors();

      // Submit
      setIsSubmitting(true);
      try {
        if (mode === "add") {
          try {
            markNavigating();
            await onSuccess(currentFormData);
          } catch (callbackError) {
            console.error("onSuccess callback error:", callbackError);
            captureError(callbackError, {
              operation: "onSuccessCallback",
              extra: { mode: "add" },
            });
            toast.warning(
              "Case data prepared, but an error occurred. Please check the cases list."
            );
          }
        } else {
          if (!caseId) {
            throw new Error("Cannot update case without ID");
          }

          await updateMutation({
            id: caseId,
            ...prepareUpdatePayload(currentFormData as Record<string, unknown>),
          });

          toast.success("Case updated successfully");
          try {
            markNavigating();
            await onSuccess(caseId);
          } catch (callbackError) {
            console.error("onSuccess callback error:", callbackError);
            captureError(callbackError, {
              operation: "onSuccessCallback",
              resourceId: caseId,
              extra: { mode: "edit" },
            });
            toast.warning(
              "Case saved, but navigation failed. Check the cases list."
            );
          }
        }
      } catch (error) {
        console.error("Failed to save case:", error);

        captureError(error, {
          operation: "saveCaseForm",
          resourceId: caseId,
          extra: { mode, hasFormData: !!currentFormData },
        });

        let errorMessage: string;
        if (error instanceof ConvexError) {
          const data = error.data;
          errorMessage = typeof data === "string" ? data : "Unknown error";
        } else {
          errorMessage = error instanceof Error ? error.message : "Unknown error";
        }

        const serverErrors = parseServerValidationError(errorMessage);

        if (serverErrors && serverErrors.length > 0) {
          const errorMap = errorsToFieldMap(serverErrors);
          setLegacyErrors(errorMap);
          setShowErrorSummary(true);
          setDateServerErrors(errorMap);

          const errorSummary = serverErrors
            .slice(0, 3)
            .map((e) => e.message)
            .join("; ");
          toast.error(`Validation failed: ${errorSummary}`, { duration: 5000 });
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          // Non-validation errors (network, permission, generic) - clear error state
          // so the user can retry immediately
          clearAllErrors();

          if (
            errorMessage.includes("network") ||
            errorMessage.includes("Network")
          ) {
            toast.error("Network error. Please check your connection and try again.");
          } else if (
            errorMessage.includes("permission") ||
            errorMessage.includes("Permission") ||
            errorMessage.includes("unauthorized") ||
            errorMessage.includes("Not authenticated") ||
            errorMessage.includes("not authenticated")
          ) {
            toast.error("Session expired. Please sign in again.");
            onAuthError?.();
          } else {
            toast.error("Failed to save case. Please try again.");
          }
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      mode,
      caseId,
      updateMutation,
      onSuccess,
      markNavigating,
      setDateServerErrors,
      setLegacyErrors,
      setWarnings,
      setShowErrorSummary,
      clearAllErrors,
      onAuthError,
    ]
  );

  return {
    isSubmitting,
    handleSubmit,
  };
}
