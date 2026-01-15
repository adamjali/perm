/**
 * useCaseFormSubmit Hook
 *
 * Extracted form submission logic from CaseForm.
 * Handles validation, mutation calls, and error handling.
 *
 * @example Edit mode - mutation handled internally, onSuccess receives caseId
 * ```tsx
 * const { handleSubmit, isSubmitting } = useCaseFormSubmit({
 *   mode: "edit",
 *   caseId: existingCase._id,
 *   onSuccess: (id) => router.push(`/cases/${id}`),
 *   setErrors,
 *   setWarnings,
 *   setShowErrorSummary,
 *   setServerErrors,
 * });
 * ```
 *
 * @example Add mode - onSuccess receives formData for external handling
 * ```tsx
 * const { handleSubmit, isSubmitting } = useCaseFormSubmit({
 *   mode: "add",
 *   onSuccess: async (formData) => {
 *     // Check for duplicates, then create case
 *     await checkDuplicates(formData);
 *     await createCase(formData);
 *     router.push("/cases");
 *   },
 *   setErrors,
 *   setWarnings,
 *   setShowErrorSummary,
 *   setServerErrors,
 * });
 * ```
 */

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

// ============================================================================
// TYPES
// ============================================================================

export interface UseCaseFormSubmitOptions {
  /**
   * Form mode: add (new case) or edit (existing case)
   */
  mode: "add" | "edit";

  /**
   * Case ID for edit mode (required when mode is "edit")
   */
  caseId?: Id<"cases">;

  /**
   * Success callback
   * - In add mode: receives form data for external handling
   * - In edit mode: receives case ID after successful update
   */
  onSuccess: (result: CaseFormData | Id<"cases">) => void | Promise<void>;

  /**
   * Setter for field errors
   */
  setErrors: (errors: Record<string, string>) => void;

  /**
   * Setter for field warnings
   */
  setWarnings: (warnings: Record<string, string>) => void;

  /**
   * Setter for error summary visibility
   */
  setShowErrorSummary: (show: boolean) => void;

  /**
   * Setter for server-side validation errors (updates field validation states)
   */
  setServerErrors: (errors: Record<string, string>) => void;

  /**
   * Mark that programmatic navigation is about to occur.
   * Called before onSuccess to prevent unsaved changes cleanup from interfering.
   */
  markNavigating?: () => void;
}

export interface UseCaseFormSubmitResult {
  /**
   * Submit handler to be called with form data
   * Returns true on success, false on validation/submission failure
   */
  handleSubmit: (formData: CaseFormData) => Promise<boolean>;

  /**
   * Whether a submission is currently in progress
   */
  isSubmitting: boolean;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Custom hook for handling case form submission logic.
 *
 * Extracts the complex submission logic from CaseForm including:
 * - Form validation
 * - Error/warning state management
 * - Convex mutation calls (edit mode)
 * - Server error parsing
 * - Toast notifications
 */
export function useCaseFormSubmit({
  mode,
  caseId,
  onSuccess,
  setErrors,
  setWarnings,
  setShowErrorSummary,
  setServerErrors,
  markNavigating,
}: UseCaseFormSubmitOptions): UseCaseFormSubmitResult {
  // ============================================================================
  // STATE
  // ============================================================================

  const [isSubmitting, setIsSubmitting] = useState(false);

  // ============================================================================
  // MUTATIONS
  // ============================================================================

  const updateMutation = useMutation(api.cases.update);

  // ============================================================================
  // SUBMIT HANDLER
  // ============================================================================

  const handleSubmit = useCallback(
    async (formData: CaseFormData): Promise<boolean> => {
      // Validate form
      const result = validateCaseForm(formData);

      if (!result.valid) {
        setErrors(errorsToFieldMap(result.errors));
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

        toast.error(`Validation failed: ${toastMessage}`, {
          duration: 5000,
        });

        // Scroll to error summary at top
        window.scrollTo({ top: 0, behavior: "smooth" });
        return false;
      }

      // Clear all errors/warnings on successful validation
      setErrors({});
      setWarnings({});
      setShowErrorSummary(false);

      // Submit
      setIsSubmitting(true);
      try {
        if (mode === "add") {
          // In add mode, pass formData to onSuccess for external handling
          // (e.g., duplicate detection, actual mutation call by parent)
          try {
            // Mark navigation before calling onSuccess to prevent unsaved changes cleanup interference
            markNavigating?.();
            await onSuccess(formData);
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
          return true;
        } else {
          // Edit mode: handle mutation internally
          if (!caseId) {
            throw new Error("Cannot update case without ID");
          }

          await updateMutation({
            id: caseId,
            ...formData,
          });

          toast.success("Case updated successfully");
          try {
            // Mark navigation before calling onSuccess to prevent unsaved changes cleanup interference
            markNavigating?.();
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
          return true;
        }
      } catch (error) {
        console.error("Failed to save case:", error);

        // Report to Sentry with context
        captureError(error, {
          operation: "saveCaseForm",
          resourceId: caseId,
          extra: {
            mode,
            hasFormData: !!formData,
          },
        });

        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        // Try to parse server validation errors for field-level display
        const serverErrors = parseServerValidationError(errorMessage);

        if (serverErrors && serverErrors.length > 0) {
          // Map to field errors and show error summary
          const errorMap = errorsToFieldMap(serverErrors);
          setErrors(errorMap);
          setShowErrorSummary(true);

          // Update validation states to show error state
          setServerErrors(errorMap);

          // Show brief toast with first few errors
          const errorSummary = serverErrors
            .slice(0, 3)
            .map((e) => e.message)
            .join("; ");
          toast.error(`Validation failed: ${errorSummary}`, { duration: 5000 });

          // Scroll to top to show error summary
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else if (
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

        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      mode,
      caseId,
      updateMutation,
      onSuccess,
      setErrors,
      setWarnings,
      setShowErrorSummary,
      setServerErrors,
      markNavigating,
    ]
  );

  return {
    handleSubmit,
    isSubmitting,
  };
}
