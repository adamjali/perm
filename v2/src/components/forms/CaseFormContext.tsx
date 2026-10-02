"use client";

// `createContext` exists ONLY in React's client build; in the server build the
// export is absent, so a module calling it without a boundary fails with
// `TypeError: (0 , d.createContext) is not a function` the moment the chunk
// graph puts it server-side - naming webpack bootstrap and no source file.
// Declared here rather than inherited from whichever importer
// happened to cross a boundary first. See components/layout/Footer.tsx.

/**
 * CaseFormContext - React Hook Form Integration
 *
 * Provides centralized form state management using react-hook-form.
 * Key benefit: useFieldArray automatically clears errors when array items are removed,
 * solving the root cause of stale validation errors blocking form submission.
 *
 * Architecture:
 * - CaseFormProvider wraps the form and provides RHF context
 * - useCaseFormContext gives child components access to form methods
 * - useRequestEntryArray manages RFI/RFE entries with automatic error cleanup
 */

"use client";

import * as React from "react";
import { createContext, useContext, useCallback, useMemo } from "react";
import {
  useForm,
  useFieldArray,
  FormProvider,
  useFormContext,
  type UseFormReturn,
} from "react-hook-form";
import { zod4Resolver } from "@/lib/forms/zod4-resolver";
import {
  caseFormSchema,
  type CaseFormData,
  type RFIEntry,
  type RFEEntry,
} from "@/lib/forms/case-form-schema";
import { newEntryId } from "@convex/lib/ids";
import { DEFAULT_FORM_DATA, initializeFormData } from "./case-form.helpers";

// ============================================================================
// TYPES
// ============================================================================

export interface CaseFormContextValue {
  /**
   * Form mode: add (new case) or edit (existing case)
   */
  mode: "add" | "edit";

  /**
   * Full react-hook-form methods
   */
  form: UseFormReturn<CaseFormData>;

  /**
   * Shorthand for form.formState.errors
   */
  errors: UseFormReturn<CaseFormData>["formState"]["errors"];

  /**
   * Shorthand for form.formState.isDirty
   */
  isDirty: boolean;

  /**
   * Shorthand for form.formState.isSubmitting
   */
  isSubmitting: boolean;

  /**
   * Whether the form has any validation errors
   */
  hasErrors: boolean;

  /**
   * Total count of validation errors
   */
  errorCount: number;

  /**
   * Get all flat error messages (for error summary display)
   */
  getErrorMessages: () => Array<{ field: string; message: string }>;

  /**
   * Set multiple server errors at once
   */
  setServerErrors: (errors: Record<string, string>) => void;

  /**
   * Clear all errors
   */
  clearErrors: () => void;

  /**
   * Clear error for a specific field
   */
  clearFieldError: (field: keyof CaseFormData) => void;
}

export interface CaseFormProviderProps {
  /**
   * Form mode: add (new case) or edit (existing case)
   */
  mode: "add" | "edit";

  /**
   * Initial form data
   */
  initialData?: Partial<CaseFormData>;

  /**
   * Children components
   */
  children: React.ReactNode;
}

// ============================================================================
// CONTEXT
// ============================================================================

const CaseFormContext = createContext<CaseFormContextValue | null>(null);

// ============================================================================
// PROVIDER
// ============================================================================

/**
 * CaseFormProvider - Provides react-hook-form context to all child components
 *
 * Benefits:
 * 1. Centralized form state - no more dual error state (errors + dateFieldErrors)
 * 2. useFieldArray for RFI/RFE - automatically clears errors when entries removed
 * 3. Zod integration - schema validation on submit
 * 4. Better TypeScript support - typed register, errors, etc.
 */
export function CaseFormProvider({
  mode,
  initialData,
  children,
}: CaseFormProviderProps) {
  // Initialize form with react-hook-form
  const form = useForm<CaseFormData>({
    // Cast schema to satisfy ZodLikeSchema interface (Zod 4 type workaround)
    resolver: zod4Resolver(caseFormSchema as unknown as Parameters<typeof zod4Resolver<CaseFormData>>[0]),
    defaultValues: initializeFormData(mode, initialData),
    mode: "onBlur", // Validate on blur for inline feedback
    reValidateMode: "onChange", // Re-validate on change after first blur
  });

  const { formState, setError, clearErrors: rhfClearErrors } = form;

  // Compute error count
  const errorCount = useMemo(() => {
    return Object.keys(formState.errors).length;
  }, [formState.errors]);

  // Get flat error messages for error summary
  const getErrorMessages = useCallback((): Array<{ field: string; message: string }> => {
    const messages: Array<{ field: string; message: string }> = [];

    const extractErrors = (errors: Record<string, unknown>, prefix = "") => {
      for (const [key, value] of Object.entries(errors)) {
        if (value && typeof value === "object") {
          if ("message" in value && typeof value.message === "string") {
            messages.push({
              field: prefix ? `${prefix}.${key}` : key,
              message: value.message,
            });
          } else {
            // Nested object (array fields, etc.)
            extractErrors(value as Record<string, unknown>, prefix ? `${prefix}.${key}` : key);
          }
        }
      }
    };

    extractErrors(formState.errors as Record<string, unknown>);
    return messages;
  }, [formState.errors]);

  // Set multiple server errors at once
  const setServerErrors = useCallback(
    (errors: Record<string, string>) => {
      for (const [field, message] of Object.entries(errors)) {
        setError(field as keyof CaseFormData, {
          type: "server",
          message,
        });
      }
    },
    [setError]
  );

  // Clear all errors
  const clearErrors = useCallback(() => {
    rhfClearErrors();
  }, [rhfClearErrors]);

  // Clear error for a specific field
  const clearFieldError = useCallback(
    (field: keyof CaseFormData) => {
      rhfClearErrors(field);
    },
    [rhfClearErrors]
  );

  // Build context value
  const contextValue: CaseFormContextValue = useMemo(
    () => ({
      mode,
      form,
      errors: formState.errors,
      isDirty: formState.isDirty,
      isSubmitting: formState.isSubmitting,
      hasErrors: errorCount > 0,
      errorCount,
      getErrorMessages,
      setServerErrors,
      clearErrors,
      clearFieldError,
    }),
    [
      mode,
      form,
      formState.errors,
      formState.isDirty,
      formState.isSubmitting,
      errorCount,
      getErrorMessages,
      setServerErrors,
      clearErrors,
      clearFieldError,
    ]
  );

  return (
    <CaseFormContext.Provider value={contextValue}>
      <FormProvider {...form}>{children}</FormProvider>
    </CaseFormContext.Provider>
  );
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * useCaseFormContext - Access the CaseForm context from child components
 *
 * @throws Error if used outside CaseFormProvider
 */
export function useCaseFormContext(): CaseFormContextValue {
  const context = useContext(CaseFormContext);
  if (!context) {
    throw new Error("useCaseFormContext must be used within CaseFormProvider");
  }
  return context;
}

/**
 * useCaseFormMethods - Direct access to react-hook-form methods
 *
 * For components that need direct RHF access without our wrapper.
 * Prefer useCaseFormContext for most use cases.
 */
export function useCaseFormMethods(): UseFormReturn<CaseFormData> {
  return useFormContext<CaseFormData>();
}

// ============================================================================
// FIELD ARRAY HOOKS
// ============================================================================

/** The two kinds of agency request a case tracks: DOL's RFIs and USCIS's RFEs. */
export type RequestKind = "rfi" | "rfe";

/**
 * useRequestEntryArray - Manage a case's RFI or RFE entries
 *
 * Removing an entry through useFieldArray also clears that index's validation
 * errors and re-indexes the rest, so a deleted entry with errors can't keep
 * blocking the save button.
 */
export function useRequestEntryArray(kind: RequestKind) {
  const { control } = useCaseFormMethods();
  const { fields, append, remove } = useFieldArray({
    control,
    name: `${kind}Entries` as const,
  });

  const addEntry = useCallback(
    (entry: Omit<RFIEntry | RFEEntry, "id" | "createdAt">) => {
      append({
        ...entry,
        id: newEntryId(kind),
        createdAt: Date.now(),
      });
    },
    [append, kind]
  );

  const removeEntry = useCallback(
    (index: number) => {
      remove(index);
    },
    [remove]
  );

  return { entries: fields, addEntry, removeEntry };
}

// ============================================================================
// EXPORTS
// ============================================================================

export { DEFAULT_FORM_DATA };
