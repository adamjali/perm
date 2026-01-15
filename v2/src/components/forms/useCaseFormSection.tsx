/**
 * useCaseFormSection - Unified hook for form section components
 *
 * Provides all form state and handlers needed by section components.
 * Sections import this hook instead of receiving 8-12 props.
 *
 * Benefits:
 * - Reduces prop drilling from 10+ props to 0-3
 * - Centralizes form state access
 * - Provides type-safe field accessors
 * - Maintains backward compatibility with existing section APIs
 */

"use client";

import { useMemo, createContext, useContext, type ReactNode } from "react";
import type { CaseFormData } from "@/lib/forms/case-form-schema";
import type { DateConstraint } from "@/lib/forms/date-constraints";
import type { ValidationState } from "@/hooks/useDateFieldValidation";

// ============================================================================
// TYPES
// ============================================================================

export interface FieldDisabledState {
  disabled: boolean;
  reason?: string;
}

export interface FormSectionContextValue {
  /**
   * Form mode: add (new case) or edit (existing case)
   */
  mode: "add" | "edit";

  /**
   * Full form data (watched values)
   */
  formData: CaseFormData;

  /**
   * Merged validation errors (RHF + date field + server errors)
   */
  errors: Record<string, string>;

  /**
   * Validation warnings
   */
  warnings: Record<string, string>;

  /**
   * Set of auto-calculated field names
   */
  autoCalculatedFields: Set<string>;

  /**
   * Date constraints for each field
   */
  dateConstraints: Record<string, DateConstraint>;

  /**
   * Validation states for date fields
   */
  validationStates: Record<string, ValidationState>;

  /**
   * Field disabled states based on dependencies
   */
  fieldDisabledStates: Record<string, FieldDisabledState>;

  /**
   * Generic change handler
   */
  onChange: (field: string, value: CaseFormData[keyof CaseFormData]) => void;

  /**
   * Date change handler (triggers calculations)
   */
  onDateChange: (field: string, value: string) => void;

  /**
   * Blur handler (triggers inline validation)
   */
  onBlur: (field: string, value: string | undefined) => void;

  /**
   * Whether auto-status detection is enabled
   */
  isAutoStatusEnabled: boolean;

  /**
   * Toggle auto-status mode
   */
  onAutoStatusToggle: (enabled: boolean) => void;

  /**
   * Special case status change handler (tracks override)
   */
  onCaseStatusChange: (value: string) => void;

  /**
   * Special progress status change handler (tracks override)
   */
  onProgressStatusChange: (value: string) => void;

  /**
   * Suggested case status from auto-detection
   */
  suggestedCaseStatus: CaseFormData["caseStatus"] | null;

  /**
   * Suggested progress status from auto-detection
   */
  suggestedProgressStatus: CaseFormData["progressStatus"] | null;
}

// ============================================================================
// CONTEXT
// ============================================================================

const FormSectionContext = createContext<FormSectionContextValue | null>(null);

// ============================================================================
// PROVIDER
// ============================================================================

export interface FormSectionProviderProps {
  mode: "add" | "edit";
  formData: CaseFormData;
  errors: Record<string, string>;
  warnings: Record<string, string>;
  autoCalculatedFields: Set<string>;
  dateConstraints: Record<string, DateConstraint>;
  validationStates: Record<string, ValidationState>;
  fieldDisabledStates: Record<string, FieldDisabledState>;
  onChange: (field: string, value: CaseFormData[keyof CaseFormData]) => void;
  onDateChange: (field: string, value: string) => void;
  onBlur: (field: string, value: string | undefined) => void;
  isAutoStatusEnabled: boolean;
  onAutoStatusToggle: (enabled: boolean) => void;
  onCaseStatusChange: (value: string) => void;
  onProgressStatusChange: (value: string) => void;
  suggestedCaseStatus: CaseFormData["caseStatus"] | null;
  suggestedProgressStatus: CaseFormData["progressStatus"] | null;
  children: ReactNode;
}

/**
 * FormSectionProvider - Wraps form sections to provide context
 *
 * CaseForm provides this wrapper around all sections, eliminating
 * the need to pass 10+ props to each section.
 */
export function FormSectionProvider({
  mode,
  formData,
  errors,
  warnings,
  autoCalculatedFields,
  dateConstraints,
  validationStates,
  fieldDisabledStates,
  onChange,
  onDateChange,
  onBlur,
  isAutoStatusEnabled,
  onAutoStatusToggle,
  onCaseStatusChange,
  onProgressStatusChange,
  suggestedCaseStatus,
  suggestedProgressStatus,
  children,
}: FormSectionProviderProps) {
  const value = useMemo<FormSectionContextValue>(
    () => ({
      mode,
      formData,
      errors,
      warnings,
      autoCalculatedFields,
      dateConstraints,
      validationStates,
      fieldDisabledStates,
      onChange,
      onDateChange,
      onBlur,
      isAutoStatusEnabled,
      onAutoStatusToggle,
      onCaseStatusChange,
      onProgressStatusChange,
      suggestedCaseStatus,
      suggestedProgressStatus,
    }),
    [
      mode,
      formData,
      errors,
      warnings,
      autoCalculatedFields,
      dateConstraints,
      validationStates,
      fieldDisabledStates,
      onChange,
      onDateChange,
      onBlur,
      isAutoStatusEnabled,
      onAutoStatusToggle,
      onCaseStatusChange,
      onProgressStatusChange,
      suggestedCaseStatus,
      suggestedProgressStatus,
    ]
  );

  return (
    <FormSectionContext.Provider value={value}>
      {children}
    </FormSectionContext.Provider>
  );
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * useFormSectionContext - Access all form state from section components
 *
 * @throws Error if used outside FormSectionProvider
 */
export function useFormSectionContext(): FormSectionContextValue {
  const context = useContext(FormSectionContext);
  if (!context) {
    throw new Error("useFormSectionContext must be used within FormSectionProvider");
  }
  return context;
}

/**
 * useFormSectionContextOptional - Access form state if available
 *
 * Returns null if used outside FormSectionProvider (for backward compatibility).
 * Use this when migrating existing sections that still support props.
 */
export function useFormSectionContextOptional(): FormSectionContextValue | null {
  return useContext(FormSectionContext);
}

// ============================================================================
// SECTION-SPECIFIC HOOKS
// ============================================================================

/**
 * useBasicInfoSection - Hook for BasicInfoSection component
 *
 * Provides all state and handlers needed for the basic info section.
 * Can use context OR fall back to props for backward compatibility.
 */
interface BasicInfoSectionHookReturn {
  values: {
    employerName: string;
    beneficiaryIdentifier: string;
    positionTitle: string;
    caseNumber?: string;
    caseStatus: CaseFormData["caseStatus"];
    progressStatus: CaseFormData["progressStatus"];
  };
  errors: Record<string, string>;
  onChange: (field: string, value: string) => void;
  onCaseStatusChange: ((value: string) => void) | undefined;
  onProgressStatusChange: ((value: string) => void) | undefined;
  isProgressStatusAutoDetected: boolean | undefined;
  isCaseStatusAutoDetected: boolean | undefined;
  suggestedCaseStatus: CaseFormData["caseStatus"] | null;
  isAutoStatusEnabled: boolean;
  onAutoStatusToggle: (enabled: boolean) => void;
}

export function useBasicInfoSection(props?: {
  values?: {
    employerName: string;
    beneficiaryIdentifier: string;
    positionTitle: string;
    caseNumber?: string;
    caseStatus: CaseFormData["caseStatus"];
    progressStatus: CaseFormData["progressStatus"];
  };
  errors?: Record<string, string>;
  onChange?: (field: string, value: string) => void;
  onCaseStatusChange?: (value: string) => void;
  onProgressStatusChange?: (value: string) => void;
  isProgressStatusAutoDetected?: boolean;
  isCaseStatusAutoDetected?: boolean;
  suggestedCaseStatus?: CaseFormData["caseStatus"] | null;
  isAutoStatusEnabled?: boolean;
  onAutoStatusToggle?: (enabled: boolean) => void;
}): BasicInfoSectionHookReturn {
  const context = useFormSectionContextOptional();

  // If context exists, use it; otherwise, fall back to props
  const values = props?.values ?? {
    employerName: context?.formData.employerName ?? "",
    beneficiaryIdentifier: context?.formData.beneficiaryIdentifier ?? "",
    positionTitle: context?.formData.positionTitle ?? "",
    caseNumber: context?.formData.caseNumber,
    caseStatus: context?.formData.caseStatus ?? "pwd",
    progressStatus: context?.formData.progressStatus ?? "working",
  };

  const errors = props?.errors ?? context?.errors ?? {};
  const onChange = props?.onChange ?? context?.onChange ?? (() => {});
  // Don't provide noop fallback - let component handle undefined for fallback logic
  const onCaseStatusChange = props?.onCaseStatusChange ?? context?.onCaseStatusChange;
  const onProgressStatusChange = props?.onProgressStatusChange ?? context?.onProgressStatusChange;
  const isAutoStatusEnabled = props?.isAutoStatusEnabled ?? context?.isAutoStatusEnabled ?? true;
  const onAutoStatusToggle = props?.onAutoStatusToggle ?? context?.onAutoStatusToggle ?? (() => {});
  const suggestedCaseStatus = props?.suggestedCaseStatus ?? context?.suggestedCaseStatus ?? null;

  const isProgressStatusAutoDetected =
    props?.isProgressStatusAutoDetected ??
    (context?.isAutoStatusEnabled && context?.suggestedProgressStatus !== null);
  const isCaseStatusAutoDetected =
    props?.isCaseStatusAutoDetected ??
    (context?.isAutoStatusEnabled && context?.suggestedCaseStatus !== null);

  return {
    values,
    errors,
    onChange,
    onCaseStatusChange,
    onProgressStatusChange,
    isProgressStatusAutoDetected,
    isCaseStatusAutoDetected,
    suggestedCaseStatus,
    isAutoStatusEnabled,
    onAutoStatusToggle,
  };
}

/**
 * usePWDSection - Hook for PWDSection component
 */
export function usePWDSection(props?: {
  values?: {
    pwdFilingDate?: string;
    pwdDeterminationDate?: string;
    pwdExpirationDate?: string;
    pwdCaseNumber?: string;
    pwdWageAmount?: number;
    pwdWageLevel?: string;
  };
  errors?: Record<string, string>;
  autoCalculatedFields?: Set<string>;
  dateConstraints?: Record<string, DateConstraint>;
  validationStates?: Record<string, ValidationState>;
  fieldDisabledStates?: Record<string, FieldDisabledState>;
  onChange?: (field: string, value: string | number | undefined) => void;
  onDateChange?: (field: string, value: string) => void;
  onBlur?: (field: string, value: string | undefined) => void;
}) {
  const context = useFormSectionContextOptional();

  const values = props?.values ?? {
    pwdFilingDate: context?.formData.pwdFilingDate,
    pwdDeterminationDate: context?.formData.pwdDeterminationDate,
    pwdExpirationDate: context?.formData.pwdExpirationDate,
    pwdCaseNumber: context?.formData.pwdCaseNumber,
    pwdWageAmount: context?.formData.pwdWageAmount,
    pwdWageLevel: context?.formData.pwdWageLevel,
  };

  return {
    values,
    errors: props?.errors ?? context?.errors ?? {},
    autoCalculatedFields: props?.autoCalculatedFields ?? context?.autoCalculatedFields ?? new Set(),
    dateConstraints: props?.dateConstraints ?? context?.dateConstraints ?? {},
    validationStates: props?.validationStates ?? context?.validationStates ?? {},
    fieldDisabledStates: props?.fieldDisabledStates ?? context?.fieldDisabledStates ?? {},
    onChange: props?.onChange ?? context?.onChange ?? (() => {}),
    onDateChange: props?.onDateChange ?? context?.onDateChange ?? (() => {}),
    onBlur: props?.onBlur ?? context?.onBlur ?? (() => {}),
  };
}

/**
 * useRecruitmentSection - Hook for RecruitmentSection component
 */
export function useRecruitmentSection(props?: {
  values?: Partial<CaseFormData>;
  errors?: Record<string, string>;
  autoCalculatedFields?: Set<string>;
  dateConstraints?: Record<string, DateConstraint>;
  validationStates?: Record<string, ValidationState>;
  fieldDisabledStates?: Record<string, FieldDisabledState>;
  onChange?: (field: string, value: CaseFormData[keyof CaseFormData]) => void;
  onDateChange?: (field: string, value: string) => void;
  onBlur?: (field: string, value: string | undefined) => void;
}) {
  const context = useFormSectionContextOptional();

  return {
    values: props?.values ?? context?.formData ?? {},
    errors: props?.errors ?? context?.errors ?? {},
    autoCalculatedFields: props?.autoCalculatedFields ?? context?.autoCalculatedFields ?? new Set(),
    dateConstraints: props?.dateConstraints ?? context?.dateConstraints ?? {},
    validationStates: props?.validationStates ?? context?.validationStates ?? {},
    fieldDisabledStates: props?.fieldDisabledStates ?? context?.fieldDisabledStates ?? {},
    onChange: props?.onChange ?? context?.onChange ?? (() => {}),
    onDateChange: props?.onDateChange ?? context?.onDateChange ?? (() => {}),
    onBlur: props?.onBlur ?? context?.onBlur ?? (() => {}),
  };
}

/**
 * useETA9089Section - Hook for ETA9089Section component
 */
export function useETA9089Section(props?: {
  values?: Partial<CaseFormData>;
  errors?: Record<string, string>;
  warnings?: Record<string, string>;
  autoCalculatedFields?: Set<string>;
  dateConstraints?: Record<string, DateConstraint>;
  validationStates?: Record<string, ValidationState>;
  fieldDisabledStates?: Record<string, FieldDisabledState>;
  onChange?: (field: keyof CaseFormData, value: string | undefined) => void;
  onDateChange?: (field: keyof CaseFormData, value: string) => void;
  onBlur?: (field: string, value: string | undefined) => void;
}) {
  const context = useFormSectionContextOptional();

  return {
    values: props?.values ?? context?.formData ?? {},
    errors: props?.errors ?? context?.errors ?? {},
    warnings: props?.warnings ?? context?.warnings ?? {},
    autoCalculatedFields: props?.autoCalculatedFields ?? context?.autoCalculatedFields ?? new Set(),
    dateConstraints: props?.dateConstraints ?? context?.dateConstraints ?? {},
    validationStates: props?.validationStates ?? context?.validationStates ?? {},
    fieldDisabledStates: props?.fieldDisabledStates ?? context?.fieldDisabledStates ?? {},
    onChange: props?.onChange ?? context?.onChange ?? (() => {}),
    onDateChange: props?.onDateChange ?? context?.onDateChange ?? (() => {}),
    onBlur: props?.onBlur ?? context?.onBlur ?? (() => {}),
  };
}

/**
 * useI140Section - Hook for I140Section component
 */
export function useI140Section(props?: {
  values?: Partial<CaseFormData>;
  errors?: Record<string, string>;
  warnings?: Record<string, string>;
  autoCalculatedFields?: Set<string>;
  dateConstraints?: Record<string, DateConstraint>;
  validationStates?: Record<string, ValidationState>;
  fieldDisabledStates?: Record<string, FieldDisabledState>;
  onChange?: (field: keyof CaseFormData, value: string | number | boolean | undefined) => void;
  onDateChange?: (field: keyof CaseFormData, value: string) => void;
  onBlur?: (field: string, value: string | undefined) => void;
}) {
  const context = useFormSectionContextOptional();

  return {
    values: props?.values ?? context?.formData ?? {},
    errors: props?.errors ?? context?.errors ?? {},
    warnings: props?.warnings ?? context?.warnings ?? {},
    autoCalculatedFields: props?.autoCalculatedFields ?? context?.autoCalculatedFields ?? new Set(),
    dateConstraints: props?.dateConstraints ?? context?.dateConstraints ?? {},
    validationStates: props?.validationStates ?? context?.validationStates ?? {},
    fieldDisabledStates: props?.fieldDisabledStates ?? context?.fieldDisabledStates ?? {},
    onChange: props?.onChange ?? context?.onChange ?? (() => {}),
    onDateChange: props?.onDateChange ?? context?.onDateChange ?? (() => {}),
    onBlur: props?.onBlur ?? context?.onBlur ?? (() => {}),
  };
}
