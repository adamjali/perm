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
  type CaseFormData,
} from "@/lib/forms/case-form-schema";
import {
  errorsToFieldMap,
  parseServerValidationError,
} from "@/components/forms/case-form.helpers";
import { captureError } from "@/lib/sentry";

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
}: UseFormSubmissionProps): UseFormSubmissionResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const updateMutation = useMutation(api.cases.update);

  const handleSubmit = useCallback(
    async (event: React.FormEvent, getValues: () => CaseFormData) => {
      event.preventDefault();

      const currentFormData = getValues();

      // Run full validation (Zod + lib/perm)
      const result = validateCaseForm(currentFormData);

      if (!result.valid) {
        setLegacyErrors(errorsToFieldMap(result.errors));
        setWarnings(errorsToFieldMap(result.warnings));
        setShowErrorSummary(true);

        // Build informative toast message
        const errorMessages = result.errors.slice(0, 3).map((e) => e.message);
        const remainingCount = result.errors.length - 3;
        const firstError = result.errors[0];
        const toastMessage =
          result.errors.length === 1 && firstError
            ? firstError.message
            : `${errorMessages.join("; ")}${remainingCount > 0 ? ` (+${remainingCount} more)` : ""}`;

        toast.error(`Validation failed: ${toastMessage}`, { duration: 5000 });
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
            ...currentFormData,
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

        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

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
            errorMessage.includes("unauthorized")
          ) {
            toast.error("You don't have permission to save this case.");
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
    ]
  );

  return {
    isSubmitting,
    handleSubmit,
  };
}
