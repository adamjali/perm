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
 * - useRfiFieldArray and useRfeFieldArray manage RFI/RFE entries with automatic error cleanup
 */

"use client";

import * as React from "react";
import { createContext, useContext, useCallback, useMemo, useRef, useEffect } from "react";
import {
  useForm,
  useFieldArray,
  FormProvider,
  useFormContext,
  type UseFormReturn,
  type FieldArrayWithId,
  type UseFieldArrayReturn,
} from "react-hook-form";
import { zod4Resolver } from "@/lib/forms/zod4-resolver";
import {
  caseFormSchema,
  type CaseFormData,
  type RFIEntry,
  type RFEEntry,
} from "@/lib/forms/case-form-schema";
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

/**
 * useRfiFieldArray - Manage RFI entries with automatic error cleanup
 *
 * When an entry is removed via `remove()`, react-hook-form automatically:
 * 1. Updates the array in form state
 * 2. Clears any validation errors for that index
 * 3. Re-indexes remaining entries
 *
 * This solves the root cause of the bug where deleting an RFI with validation
 * errors still blocked the save button.
 */
export function useRfiFieldArray(): UseFieldArrayReturn<CaseFormData, "rfiEntries"> & {
  entries: FieldArrayWithId<CaseFormData, "rfiEntries">[];
  addEntry: (entry: Omit<RFIEntry, "id" | "createdAt">) => void;
  removeEntry: (index: number) => void;
  updateEntry: (index: number, data: Partial<RFIEntry>) => void;
  getActiveEntryIndex: () => number | null;
} {
  const { control } = useCaseFormMethods();

  const fieldArray = useFieldArray({
    control,
    name: "rfiEntries",
  });

  const { fields, append, remove, update } = fieldArray;

  // Use ref to access current fields without adding to dependencies
  // This prevents updateEntry from getting a new reference on every keystroke
  const fieldsRef = useRef(fields);
  useEffect(() => {
    fieldsRef.current = fields;
  }, [fields]);

  // Add a new RFI entry
  const addEntry = useCallback(
    (entry: Omit<RFIEntry, "id" | "createdAt">) => {
      append({
        ...entry,
        id: `rfi-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        createdAt: Date.now(),
      });
    },
    [append]
  );

  // Remove an RFI entry - errors are automatically cleared by RHF!
  const removeEntry = useCallback(
    (index: number) => {
      remove(index);
    },
    [remove]
  );

  // Update an RFI entry - uses ref to avoid dependency on fields array
  const updateEntry = useCallback(
    (index: number, data: Partial<RFIEntry>) => {
      const current = fieldsRef.current[index];
      if (current) {
        update(index, { ...current, ...data });
      }
    },
    [update]
  );

  // Get the index of the active entry (first without responseSubmittedDate)
  const getActiveEntryIndex = useCallback((): number | null => {
    const index = fieldsRef.current.findIndex((entry) => !entry.responseSubmittedDate);
    return index >= 0 ? index : null;
  }, []);

  return {
    ...fieldArray,
    entries: fields,
    addEntry,
    removeEntry,
    updateEntry,
    getActiveEntryIndex,
  };
}

/**
 * useRfeFieldArray - Manage RFE entries with automatic error cleanup
 *
 * Same benefits as useRfiFieldArray for RFE entries.
 */
export function useRfeFieldArray(): UseFieldArrayReturn<CaseFormData, "rfeEntries"> & {
  entries: FieldArrayWithId<CaseFormData, "rfeEntries">[];
  addEntry: (entry: Omit<RFEEntry, "id" | "createdAt">) => void;
  removeEntry: (index: number) => void;
  updateEntry: (index: number, data: Partial<RFEEntry>) => void;
  getActiveEntryIndex: () => number | null;
} {
  const { control } = useCaseFormMethods();

  const fieldArray = useFieldArray({
    control,
    name: "rfeEntries",
  });

  const { fields, append, remove, update } = fieldArray;

  // Use ref to access current fields without adding to dependencies
  // This prevents updateEntry from getting a new reference on every keystroke
  const fieldsRef = useRef(fields);
  useEffect(() => {
    fieldsRef.current = fields;
  }, [fields]);

  // Add a new RFE entry
  const addEntry = useCallback(
    (entry: Omit<RFEEntry, "id" | "createdAt">) => {
      append({
        ...entry,
        id: `rfe-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        createdAt: Date.now(),
      });
    },
    [append]
  );

  // Remove an RFE entry - errors are automatically cleared by RHF!
  const removeEntry = useCallback(
    (index: number) => {
      remove(index);
    },
    [remove]
  );

  // Update an RFE entry - uses ref to avoid dependency on fields array
  const updateEntry = useCallback(
    (index: number, data: Partial<RFEEntry>) => {
      const current = fieldsRef.current[index];
      if (current) {
        update(index, { ...current, ...data });
      }
    },
    [update]
  );

  // Get the index of the active entry (first without responseSubmittedDate)
  const getActiveEntryIndex = useCallback((): number | null => {
    const index = fieldsRef.current.findIndex((entry) => !entry.responseSubmittedDate);
    return index >= 0 ? index : null;
  }, []);

  return {
    ...fieldArray,
    entries: fields,
    addEntry,
    removeEntry,
    updateEntry,
    getActiveEntryIndex,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export { DEFAULT_FORM_DATA };
