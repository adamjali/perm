/**
 * CaseForm Component
 *
 * Container component for case add/edit forms.
 * Orchestrates all form sections and handles validation, submission, and auto-calculation.
 *
 * Architecture (v2 with react-hook-form):
 * - Uses react-hook-form for centralized form state
 * - useFieldArray for RFI/RFE entries with automatic error cleanup
 * - useFormErrors for consolidated error management
 * - useFormSubmission for submission logic
 * - Preserves existing auto-calculation and inline validation hooks
 *
 * Features:
 * - Single form for both add and edit modes
 * - All sections in one scrollable view (not wizard)
 * - Live validation with cross-field dependency checking
 * - Auto-fill cascade for calculated fields
 * - RFI/RFE dynamic entries (useFieldArray)
 * - Sticky footer with action buttons
 * - Loading states and error handling
 * - Success/cancel callbacks
 *
 * Phase: 22 (Case Forms)
 * Created: 2025-12-25
 * Refactored: 2026-01 (simplified with custom hooks)
 */

"use client";

import * as React from "react";
import { useCallback, useEffect, useRef, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { useForm, FormProvider } from "react-hook-form";
import { zod4Resolver } from "@/lib/forms/zod4-resolver";
import { api } from "../../../convex/_generated/api";
import {
  AlertTriangle,
  XCircle,
  FileText,
  ClipboardList,
  FileCheck,
  Building2,
  StickyNote,
  Trash2,
} from "lucide-react";
import { toast } from "@/lib/toast";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { UnsavedChangesDialog } from "@/components/ui/unsaved-changes-dialog";
import { BasicInfoSection } from "./sections/BasicInfoSection";
import { PWDSection } from "./sections/PWDSection";
import { RecruitmentSection } from "./sections/RecruitmentSection";
import { ETA9089Section } from "./sections/ETA9089Section";
import { I140Section } from "./sections/I140Section";
import { NotesJournal } from "./NotesJournal";
import { CollapsibleSection } from "./CollapsibleSection";
import { FormSectionProvider } from "./useCaseFormSection";
import { useFormCalculations } from "@/hooks/useFormCalculations";
import { useDateFieldValidation } from "@/hooks/useDateFieldValidation";
import { useFormErrors } from "@/hooks/useFormErrors";
import { useFormSubmission } from "@/hooks/useFormSubmission";
import { useSectionState, type SectionName } from "@/hooks/useSectionState";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import {
  caseFormSchema,
  validateStatusSelection,
  type CaseFormData,
  type NoteEntry,
} from "@/lib/forms/case-form-schema";
import { getAllDateConstraints } from "@/lib/forms/date-constraints";
import { initializeFormData, mapFieldToInputName } from "./case-form.helpers";

// Re-export helpers for consumers
export { DEFAULT_FORM_DATA, initializeFormData, errorsToFieldMap } from "./case-form.helpers";

// ============================================================================
// TYPES
// ============================================================================

export interface CaseFormProps {
  mode: "add" | "edit";
  caseId?: Id<"cases">;
  initialData?: Partial<CaseFormData>;
  onSuccess: (formDataOrCaseId: CaseFormData | Id<"cases">) => void | Promise<void>;
  onCancel: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function CaseForm({ mode, caseId, initialData, onSuccess, onCancel }: CaseFormProps) {
  const router = useRouter();
  const initialDataRef = useRef(JSON.stringify(initializeFormData(mode, initialData)));

  // ============================================================================
  // REACT HOOK FORM SETUP
  // ============================================================================

  const defaultValues = useMemo(
    () => initializeFormData(mode, initialData),
    [mode, initialData]
  );

  const form = useForm<CaseFormData>({
    resolver: zod4Resolver(caseFormSchema as unknown as Parameters<typeof zod4Resolver<CaseFormData>>[0]),
    defaultValues,
    mode: "onBlur",
    reValidateMode: "onChange",
  });

  const { setValue, getValues, watch, formState: { errors: rhfErrors, isSubmitting: rhfIsSubmitting }, clearErrors: rhfClearErrors } = form;
  const formData = watch();

  // ============================================================================
  // DATE FIELD VALIDATION
  // ============================================================================

  const {
    validateField,
    fieldStates,
    fieldErrors: dateFieldErrors,
    allFieldDisabledStates,
    revalidateAllFields,
    setServerErrors: setDateServerErrors,
  } = useDateFieldValidation(formData);

  const dateConstraints = getAllDateConstraints(formData);

  // Revalidate when constraints change
  const prevConstraintsRef = useRef<string>("");
  useEffect(() => {
    const constraintsKey = JSON.stringify(dateConstraints);
    if (prevConstraintsRef.current && prevConstraintsRef.current !== constraintsKey) {
      revalidateAllFields();
    }
    prevConstraintsRef.current = constraintsKey;
  }, [dateConstraints, revalidateAllFields]);

  // ============================================================================
  // UNIFIED ERROR MANAGEMENT
  // ============================================================================

  const {
    mergedErrors,
    errorCount: mergedErrorCount,
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
  } = useFormErrors(rhfErrors, dateFieldErrors);

  // Clear RFI/RFE errors when entries change
  const rfiEntriesJson = JSON.stringify(formData.rfiEntries);
  const rfeEntriesJson = JSON.stringify(formData.rfeEntries);

  useEffect(() => {
    clearErrorsByPrefix("rfiEntries");
    clearErrorsByPrefix("rfi");
  }, [rfiEntriesJson, clearErrorsByPrefix]);

  useEffect(() => {
    clearErrorsByPrefix("rfeEntries");
    clearErrorsByPrefix("rfe");
  }, [rfeEntriesJson, clearErrorsByPrefix]);

  // ============================================================================
  // AUTO-CALCULATION
  // ============================================================================

  const setFormData = useCallback(
    (data: CaseFormData) => {
      const current = getValues();
      for (const key of Object.keys(data) as (keyof CaseFormData)[]) {
        if (data[key] !== current[key]) {
          setValue(key, data[key] as CaseFormData[typeof key], { shouldDirty: true, shouldValidate: false });
        }
      }
    },
    [getValues, setValue]
  );

  const {
    autoCalculatedFields,
    triggerCalculation,
    suggestedProgressStatus,
    suggestedCaseStatus,
    isProgressStatusOverridden,
    markProgressStatusOverridden,
    clearProgressStatusOverride,
    isCaseStatusOverridden,
    markCaseStatusOverridden,
    clearCaseStatusOverride,
  } = useFormCalculations(formData, setFormData, initialData?.progressStatusOverride);

  // ============================================================================
  // UNSAVED CHANGES
  // ============================================================================

  const { isDirty, setDirty, shouldShowDialog, requestNavigation, confirmNavigation, cancelNavigation, markNavigating } = useUnsavedChanges({ isSubmitting: rhfIsSubmitting });

  useEffect(() => {
    setDirty(JSON.stringify(formData) !== initialDataRef.current);
  }, [formData, setDirty]);

  // Track cancel navigation loading state
  const [isCancelNavigating, setIsCancelNavigating] = useState(false);
  const handleCancelWithLoading = useCallback(() => {
    setIsCancelNavigating(true);
    onCancel();
  }, [onCancel]);

  // ============================================================================
  // SECTION STATE
  // ============================================================================

  const { sectionStates, toggleSection, enableOverride, openSection } = useSectionState(formData);

  // ============================================================================
  // AUTO STATUS
  // ============================================================================

  const isAutoStatusEnabled = !isProgressStatusOverridden && !isCaseStatusOverridden;

  useEffect(() => {
    if (suggestedProgressStatus && isAutoStatusEnabled) {
      setValue("progressStatus", suggestedProgressStatus, { shouldDirty: true });
    }
  }, [suggestedProgressStatus, isAutoStatusEnabled, setValue]);

  useEffect(() => {
    if (suggestedCaseStatus && isAutoStatusEnabled) {
      setValue("caseStatus", suggestedCaseStatus, { shouldDirty: true });
    }
  }, [suggestedCaseStatus, isAutoStatusEnabled, setValue]);

  const handleAutoStatusToggle = useCallback(
    (enabled: boolean) => {
      if (enabled) {
        clearProgressStatusOverride();
        clearCaseStatusOverride();
        setValue("progressStatusOverride", false, { shouldDirty: true });
        if (suggestedCaseStatus) setValue("caseStatus", suggestedCaseStatus, { shouldDirty: true });
        if (suggestedProgressStatus) setValue("progressStatus", suggestedProgressStatus, { shouldDirty: true });
        toast.info("Auto-status enabled. Status will update based on form data.");
      } else {
        markProgressStatusOverridden();
        markCaseStatusOverridden();
        setValue("progressStatusOverride", true, { shouldDirty: true });
        toast.info("Auto-status disabled. You can now set status manually.");
      }
    },
    [clearProgressStatusOverride, clearCaseStatusOverride, markProgressStatusOverridden, markCaseStatusOverridden, suggestedCaseStatus, suggestedProgressStatus, setValue]
  );

  const handleProgressStatusChange = useCallback(
    (value: string) => {
      const newProgressStatus = value as CaseFormData["progressStatus"];
      const validation = validateStatusSelection(formData.caseStatus, newProgressStatus, formData);
      if (!validation.valid && validation.warning) {
        toast.warning(validation.warning, { duration: 5000, description: "You can still proceed, but the data may be incomplete." });
      }
      markProgressStatusOverridden();
      markCaseStatusOverridden();
      setValue("progressStatus", newProgressStatus, { shouldDirty: true });
      setValue("progressStatusOverride", true, { shouldDirty: true });
    },
    [formData, markProgressStatusOverridden, markCaseStatusOverridden, setValue]
  );

  const handleCaseStatusChange = useCallback(
    (value: string) => {
      const newCaseStatus = value as CaseFormData["caseStatus"];
      const validation = validateStatusSelection(newCaseStatus, formData.progressStatus, formData);
      if (!validation.valid && validation.warning) {
        toast.warning(validation.warning, { duration: 5000, description: "You can still proceed, but the data may be incomplete." });
      }
      markCaseStatusOverridden();
      markProgressStatusOverridden();
      setValue("caseStatus", newCaseStatus, { shouldDirty: true });
      setValue("progressStatusOverride", true, { shouldDirty: true });
    },
    [formData, setValue, markCaseStatusOverridden, markProgressStatusOverridden]
  );

  // ============================================================================
  // FIELD HANDLERS
  // ============================================================================

  const handleChange = useCallback(
    (field: string, value: CaseFormData[keyof CaseFormData]) => {
      setValue(field as keyof CaseFormData, value as CaseFormData[keyof CaseFormData], { shouldDirty: true });
      clearFieldError(field);
      rhfClearErrors(field as keyof CaseFormData);
      if (field === "isProfessionalOccupation" && value === false) {
        clearProfessionalErrors();
      }
    },
    [setValue, rhfClearErrors, clearFieldError, clearProfessionalErrors]
  );

  const handleDateChange = useCallback(
    (field: string, value: string) => {
      handleChange(field, value);
      const clearedFields = triggerCalculation(field as keyof CaseFormData, value);
      for (const cleared of clearedFields) {
        toast.info(cleared.reason, { duration: 4000 });
      }
      // Validation happens on blur (handleFieldBlur) to prevent error flash while typing
    },
    [handleChange, triggerCalculation]
  );

  const handleFieldBlur = useCallback(
    (field: string, value: string | undefined) => {
      validateField(field, value);
    },
    [validateField]
  );

  const handleNotesChange = useCallback(
    (notes: NoteEntry[]) => setValue("notes", notes, { shouldDirty: true }),
    [setValue]
  );

  // ============================================================================
  // SUBMISSION
  // ============================================================================

  const { isSubmitting, handleSubmit: submitHandler } = useFormSubmission({
    mode,
    caseId,
    onSuccess,
    markNavigating,
    setDateServerErrors,
    setLegacyErrors,
    setWarnings,
    setShowErrorSummary,
    clearAllErrors,
  });

  const handleSubmit = useCallback(
    (event: React.FormEvent) => submitHandler(event, getValues),
    [submitHandler, getValues]
  );

  // ============================================================================
  // DELETE (EDIT MODE)
  // ============================================================================

  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const removeMutation = useMutation(api.cases.remove);

  const handleDeleteConfirm = useCallback(async () => {
    if (!caseId) return;
    setIsDeleting(true);
    try {
      await removeMutation({ id: caseId });
      toast.success("Case deleted successfully");
      setDeleteDialogOpen(false);
      router.push("/cases");
    } catch (error) {
      console.error("Failed to delete case:", error);
      toast.error("Failed to delete case. Please try again.");
      setIsDeleting(false);
    }
  }, [caseId, removeMutation, router]);

  // ============================================================================
  // SCROLL TO FIELD
  // ============================================================================

  const getFieldSection = useCallback((fieldName: string): SectionName | null => {
    if (fieldName.startsWith("pwd")) return "pwd";
    if (fieldName.startsWith("sundayAd") || fieldName.startsWith("jobOrder") || fieldName.startsWith("noticeOfFiling") || fieldName.startsWith("additional") || fieldName.startsWith("recruitment")) return "recruitment";
    if (fieldName.startsWith("eta9089") || fieldName.startsWith("rfi")) return "eta9089";
    if (fieldName.startsWith("i140") || fieldName.startsWith("rfe")) return "i140";
    if (fieldName.startsWith("notes")) return "notes";
    return null;
  }, []);

  const scrollToField = useCallback(
    (fieldName: string) => {
      const inputName = mapFieldToInputName(fieldName);
      const section = getFieldSection(fieldName);

      const doScroll = () => {
        const element = document.querySelector(`[name="${inputName}"]`);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
          if (element instanceof HTMLElement) setTimeout(() => element.focus(), 300);
        }
      };

      if (section && sectionStates[section] && !sectionStates[section].isOpen) {
        const state = sectionStates[section];
        if (state.isEnabled || state.isManualOverride) {
          openSection(section);
          setTimeout(doScroll, 150);
          return;
        }
      }
      doScroll();
    },
    [getFieldSection, sectionStates, openSection]
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <FormProvider {...form}>
      <FormSectionProvider
        mode={mode}
        formData={formData}
        errors={mergedErrors}
        warnings={warnings}
        autoCalculatedFields={autoCalculatedFields}
        dateConstraints={dateConstraints}
        validationStates={fieldStates}
        fieldDisabledStates={allFieldDisabledStates}
        onChange={handleChange}
        onDateChange={handleDateChange}
        onBlur={handleFieldBlur}
        isAutoStatusEnabled={isAutoStatusEnabled}
        onAutoStatusToggle={handleAutoStatusToggle}
        onCaseStatusChange={handleCaseStatusChange}
        onProgressStatusChange={handleProgressStatusChange}
        suggestedCaseStatus={suggestedCaseStatus}
        suggestedProgressStatus={suggestedProgressStatus}
      >
      <form onSubmit={handleSubmit} className="space-y-8 pb-24 animate-fade-in">
        {/* Error Summary */}
        {showErrorSummary && mergedErrorCount > 0 && (
          <ErrorSummary errors={mergedErrors} errorCount={mergedErrorCount} onDismiss={() => setShowErrorSummary(false)} onFieldClick={scrollToField} />
        )}

        {/* Warning Summary */}
        {warningCount > 0 && !showErrorSummary && (
          <WarningSummary warnings={warnings} warningCount={warningCount} />
        )}

        {/* Basic Info Section - uses context, no props needed */}
        <div className="animate-slide-up" style={{ animationDelay: "50ms" }}>
          <BasicInfoSection />
        </div>

        {/* PWD Section - uses context, no props needed */}
        <div className="animate-slide-up" style={{ animationDelay: "100ms" }}>
          <CollapsibleSection name="pwd" title="PWD (Prevailing Wage Determination)" state={sectionStates.pwd} onToggle={() => toggleSection("pwd")} onOverride={() => enableOverride("pwd")} icon={<FileText className="size-5" />} description="Prevailing wage filing and determination dates">
            <PWDSection />
          </CollapsibleSection>
        </div>

        {/* Recruitment Section - uses context, no props needed */}
        <div className="animate-slide-up" style={{ animationDelay: "150ms" }}>
          <CollapsibleSection name="recruitment" title="Recruitment" state={sectionStates.recruitment} onToggle={() => toggleSection("recruitment")} onOverride={() => enableOverride("recruitment")} icon={<ClipboardList className="size-5" />} description="Sunday ads, job order, and notice of filing">
            <RecruitmentSection />
          </CollapsibleSection>
        </div>

        {/* ETA 9089 Section - uses context, no props needed */}
        <div className="animate-slide-up" style={{ animationDelay: "200ms" }}>
          <CollapsibleSection name="eta9089" title="ETA 9089 (PERM Application)" state={sectionStates.eta9089} onToggle={() => toggleSection("eta9089")} onOverride={() => enableOverride("eta9089")} icon={<FileCheck className="size-5" />} description="PERM application filing, audit, and certification">
            <ETA9089Section />
          </CollapsibleSection>
        </div>

        {/* I-140 Section - uses context, no props needed */}
        <div className="animate-slide-up" style={{ animationDelay: "250ms" }}>
          <CollapsibleSection name="i140" title="I-140 (Immigrant Petition)" state={sectionStates.i140} onToggle={() => toggleSection("i140")} onOverride={() => enableOverride("i140")} icon={<Building2 className="size-5" />} description="I-140 petition filing, receipt, and approval">
            <I140Section />
          </CollapsibleSection>
        </div>

        {/* Notes Section */}
        <div className="animate-slide-up" style={{ animationDelay: "300ms" }}>
          <CollapsibleSection name="notes" title="Notes & Settings" state={sectionStates.notes} onToggle={() => toggleSection("notes")} onOverride={() => enableOverride("notes")} icon={<StickyNote className="size-5" />} description="Case notes, journal entries, and preferences">
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>Notes</Label>
                <NotesJournal notes={formData.notes} onChange={handleNotesChange} />
              </div>
              <SettingsToggles formData={formData} onChange={handleChange} />
            </div>
          </CollapsibleSection>
        </div>

        {/* Sticky Footer */}
        <StickyFooter mode={mode} caseId={caseId} isDirty={isDirty} isSubmitting={isSubmitting || rhfIsSubmitting} isDeleting={isDeleting} isCancelNavigating={isCancelNavigating} errorCount={mergedErrorCount} onCancel={() => requestNavigation(handleCancelWithLoading)} onDeleteClick={() => setDeleteDialogOpen(true)} />

        {/* Dialogs */}
        <UnsavedChangesDialog open={shouldShowDialog} onStay={cancelNavigation} onLeave={confirmNavigation} />

        {mode === "edit" && caseId && (
          <DeleteDialog open={deleteDialogOpen} isDeleting={isDeleting} caseName={`${formData.employerName} - ${formData.positionTitle}`} onCancel={() => setDeleteDialogOpen(false)} onConfirm={handleDeleteConfirm} />
        )}
      </form>
      </FormSectionProvider>
    </FormProvider>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function ErrorSummary({ errors, errorCount, onDismiss, onFieldClick }: { errors: Record<string, string>; errorCount: number; onDismiss: () => void; onFieldClick: (field: string) => void }) {
  return (
    <div className="rounded-lg border-4 border-destructive bg-destructive/10 p-4 animate-shake">
      <div className="flex items-start gap-3">
        <XCircle className="size-6 text-destructive shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h3 className="font-heading font-bold text-destructive">{errorCount} Validation Error{errorCount > 1 ? "s" : ""}</h3>
            <button type="button" onClick={onDismiss} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Dismiss</button>
          </div>
          <p className="text-sm text-muted-foreground mb-3">Please fix the following errors before saving:</p>
          <ul className="space-y-1">
            {Object.entries(errors).map(([field, message]) => (
              <li key={field} className="flex items-start gap-2">
                <span className="text-destructive font-bold shrink-0">-</span>
                <button type="button" onClick={() => onFieldClick(field)} className="text-sm text-left hover:underline hover:text-destructive transition-colors cursor-pointer flex-1">{message}</button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function WarningSummary({ warnings, warningCount }: { warnings: Record<string, string>; warningCount: number }) {
  return (
    <div className="rounded-lg border-2 border-orange-400 bg-orange-50 dark:bg-orange-950/20 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="size-5 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-orange-700 dark:text-orange-300 text-sm">{warningCount} Warning{warningCount > 1 ? "s" : ""}</h3>
          <ul className="mt-1 space-y-0.5">
            {Object.entries(warnings).map(([field, message]) => (
              <li key={field} className="text-sm text-orange-600 dark:text-orange-400">{message}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function SettingsToggles({ formData, onChange }: { formData: CaseFormData; onChange: (field: string, value: boolean) => void }) {
  return (
    <div className="pt-4 border-t-2 border-border space-y-4">
      <SettingsToggle id="calendarSync" label="Calendar Sync" description="Sync deadlines to your Google Calendar" checked={formData.calendarSyncEnabled} onChange={(checked) => onChange("calendarSyncEnabled", checked)} />
      <SettingsToggle id="favorite" label="Favorite" description="Mark as favorite for quick access" checked={formData.isFavorite} onChange={(checked) => onChange("isFavorite", checked)} />
      <SettingsToggle id="showOnTimeline" label="Show on Timeline" description="Display this case on the timeline view" checked={formData.showOnTimeline} onChange={(checked) => onChange("showOnTimeline", checked)} />
    </div>
  );
}

function SettingsToggle({ id, label, description, checked, onChange }: { id: string; label: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex-1">
        <Label htmlFor={id} className="cursor-pointer font-medium">{label}</Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function StickyFooter({ mode, caseId, isDirty, isSubmitting, isDeleting, isCancelNavigating, errorCount, onCancel, onDeleteClick }: { mode: "add" | "edit"; caseId?: Id<"cases">; isDirty: boolean; isSubmitting: boolean; isDeleting: boolean; isCancelNavigating: boolean; errorCount: number; onCancel: () => void; onDeleteClick: () => void }) {
  return (
    <div className="sticky bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t-4 border-border p-4 shadow-hard-lg z-10 animate-slide-up" style={{ animationDelay: "350ms" }}>
      {/* Mobile: stacked layout, Desktop: horizontal */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4 max-w-5xl mx-auto">
        <div className="flex items-center gap-3 md:gap-4 order-2 md:order-1">
          {mode === "edit" && caseId && (
            <Button type="button" variant="destructive" size="lg" onClick={onDeleteClick} disabled={isSubmitting || isDeleting || isCancelNavigating} className="gap-2 flex-1 md:flex-none">
              <Trash2 className="size-4" />Delete
            </Button>
          )}
          {isDirty && !isSubmitting && !isCancelNavigating && (
            <div className="flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400 animate-fade-in">
              <AlertTriangle className="size-4" /><span className="hidden sm:inline">Unsaved changes</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 md:gap-4 order-1 md:order-2">
          <Button type="button" variant="outline" size="lg" onClick={onCancel} disabled={isSubmitting || isDeleting || isCancelNavigating} loading={isCancelNavigating} loadingText="Cancelling..." className="flex-1 md:flex-none">Cancel</Button>
          <Button type="submit" size="lg" loading={isSubmitting} loadingText="Saving..." disabled={isSubmitting || isDeleting || isCancelNavigating || errorCount > 0} className="flex-1 md:flex-none">Save Case</Button>
        </div>
      </div>
    </div>
  );
}

function DeleteDialog({ open, isDeleting, caseName, onCancel, onConfirm }: { open: boolean; isDeleting: boolean; caseName: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Case</DialogTitle>
          <DialogDescription>Are you sure you want to delete &quot;{caseName}&quot;? This action cannot be undone.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isDeleting}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isDeleting}>{isDeleting ? "Deleting..." : "Delete Case"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
