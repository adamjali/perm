"use client";

/**
 * QuickEditFields Component
 *
 * Renders editable fields for quick inline editing of case actions.
 * Uses a submit button pattern - user fills fields, then clicks submit.
 *
 * Features:
 * - Fill date fields inline
 * - Submit button to save all changes
 * - Auto-calculates dependent fields via useFormCalculations hook (same as CaseForm)
 * - Auto-calculates case/progress status on submit (same as CaseForm)
 * - Closes card and updates via real-time sync after save
 */

import * as React from "react";
import { useState, useCallback, useMemo } from "react";
import { useMutation } from "convex/react";
import { motion } from "motion/react";
import { Check, Loader2, AlertCircle, ExternalLink, Info, Clock } from "lucide-react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { DateInput } from "@/components/forms/DateInput";
import { getAllDateConstraints } from "@/lib/forms/date-constraints";
import { useFormCalculations } from "@/hooks/useFormCalculations";
import type { CaseFormData } from "@/lib/forms/case-form-schema";
import type { ISODateString } from "@/lib/perm";
import type { NextUpCaseData } from "../next-up-section.utils";
import {
  type ActionConfig,
  getActionConfig,
  isWaitingAction,
  isComplexAction,
} from "./action-config";

// ============================================================================
// TYPES
// ============================================================================

interface QuickEditFieldsProps {
  /** The action name from NextAction */
  actionName: string;
  /** Case ID for mutations */
  caseId: Id<"cases">;
  /** Current case data for constraints and initial values */
  caseData: NextUpCaseData;
  /** Called when save completes (to close the card) */
  onComplete?: () => void;
  /** Called when user clicks link to full form */
  onNavigateToForm?: () => void;
  /** Additional CSS classes */
  className?: string;
}

type SubmitStatus = "idle" | "saving" | "saved" | "error";

// ============================================================================
// ANIMATION VARIANTS
// ============================================================================

const fieldVariants = {
  hidden: { opacity: 0, y: 8, height: 0 },
  visible: {
    opacity: 1,
    y: 0,
    height: "auto",
    transition: { duration: 0.15, ease: [0.25, 0.1, 0.25, 1] as const },
  },
  exit: {
    opacity: 0,
    y: -8,
    height: 0,
    transition: { duration: 0.1 },
  },
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert NextUpCaseData to CaseFormData format for the useFormCalculations hook.
 * Fills in required fields with defaults where not present.
 */
function convertToCaseFormData(caseData: NextUpCaseData): CaseFormData {
  return {
    // Required fields - use empty strings as defaults
    employerName: "",
    beneficiaryIdentifier: "",
    positionTitle: "",
    // Status fields
    caseStatus: caseData.caseStatus,
    progressStatus: caseData.progressStatus,
    // PWD fields
    pwdFilingDate: caseData.pwdFilingDate ?? undefined,
    pwdDeterminationDate: caseData.pwdDeterminationDate ?? undefined,
    pwdExpirationDate: caseData.pwdExpirationDate ?? undefined,
    // Recruitment fields
    jobOrderStartDate: caseData.jobOrderStartDate ?? undefined,
    jobOrderEndDate: caseData.jobOrderEndDate ?? undefined,
    sundayAdFirstDate: caseData.sundayAdFirstDate ?? undefined,
    sundayAdSecondDate: caseData.sundayAdSecondDate ?? undefined,
    noticeOfFilingStartDate: caseData.noticeOfFilingStartDate ?? undefined,
    noticeOfFilingEndDate: caseData.noticeOfFilingEndDate ?? undefined,
    // ETA 9089 fields
    eta9089FilingDate: caseData.eta9089FilingDate ?? undefined,
    eta9089CertificationDate: caseData.eta9089CertificationDate ?? undefined,
    eta9089ExpirationDate: caseData.eta9089ExpirationDate ?? undefined,
    // I-140 fields
    i140FilingDate: caseData.i140FilingDate ?? undefined,
    i140ApprovalDate: caseData.i140ApprovalDate ?? undefined,
    i140DenialDate: caseData.i140DenialDate ?? undefined,
    // RFI/RFE entries - cast dates from plain strings to ISODateString branded type
    rfiEntries: caseData.rfiEntries?.map(e => ({
      id: crypto.randomUUID(),
      receivedDate: e.receivedDate as ISODateString,
      responseDueDate: e.responseDueDate as ISODateString,
      responseSubmittedDate: e.responseSubmittedDate as ISODateString | undefined,
      createdAt: Date.now(),
    })) ?? [],
    rfeEntries: caseData.rfeEntries?.map(e => ({
      id: crypto.randomUUID(),
      receivedDate: e.receivedDate as ISODateString,
      responseDueDate: e.responseDueDate as ISODateString,
      responseSubmittedDate: e.responseSubmittedDate as ISODateString | undefined,
      createdAt: Date.now(),
    })) ?? [],
    // Professional occupation
    isProfessionalOccupation: caseData.isProfessionalOccupation ?? false,
    additionalRecruitmentMethods: caseData.additionalRecruitmentMethods ?? [],
    // Default values for other required fields
    priorityLevel: "normal",
    isFavorite: false,
    recruitmentApplicantsCount: 0,
    tags: [],
    notes: [],
    calendarSyncEnabled: true,
    showOnTimeline: true,
  };
}

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

interface WaitingInfoDisplayProps {
  waitingInfo: NonNullable<ActionConfig["waitingInfo"]>;
}

function WaitingInfoDisplay({ waitingInfo }: WaitingInfoDisplayProps) {
  return (
    <motion.div
      variants={fieldVariants}
      initial="hidden"
      animate="visible"
      className="space-y-3"
    >
      <div className="flex items-center gap-2 text-sm">
        <Clock className="h-4 w-4 text-primary" />
        <span className="font-medium">Estimated: {waitingInfo.estimatedTime}</span>
      </div>
      <div className="space-y-1.5">
        {waitingInfo.tips.map((tip, idx) => (
          <div
            key={idx}
            className="flex items-start gap-2 text-xs text-muted-foreground"
          >
            <Info className="h-3 w-3 mt-0.5 shrink-0" />
            <span>{tip}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

interface ComplexActionDisplayProps {
  message: string;
  onNavigateToForm?: () => void;
}

function ComplexActionDisplay({ message, onNavigateToForm }: ComplexActionDisplayProps) {
  return (
    <motion.div
      variants={fieldVariants}
      initial="hidden"
      animate="visible"
      className="space-y-3"
    >
      <p className="text-sm text-muted-foreground">{message}</p>
      {onNavigateToForm && (
        <button
          onClick={onNavigateToForm}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          Open full edit form
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      )}
    </motion.div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function QuickEditFields({
  actionName,
  caseId,
  caseData,
  onComplete,
  onNavigateToForm,
  className,
}: QuickEditFieldsProps) {
  const config = getActionConfig(actionName);
  const updateCase = useMutation(api.cases.update);

  // Form data state - initialized from caseData, same pattern as CaseForm
  const [formData, setFormData] = useState<CaseFormData>(() =>
    convertToCaseFormData(caseData)
  );

  // Use the same hook as CaseForm for auto-calculations
  const {
    triggerCalculation,
    suggestedCaseStatus,
    suggestedProgressStatus,
    autoCalculatedFields,
  } = useFormCalculations(formData, setFormData);

  // Submit status
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Calculate date constraints based on current form data
  const constraints = useMemo(() => {
    return getAllDateConstraints(formData);
  }, [formData]);

  // Check if all required fields are filled (for enabling submit button)
  const canSubmit = useMemo(() => {
    if (!config?.fields) return false;
    return config.fields
      .filter(f => !f.autoCalculated) // Only check user-editable fields
      .every(f => {
        const value = formData[f.name as keyof CaseFormData];
        return typeof value === "string" && value.length > 0;
      });
  }, [config, formData]);

  // Check if any values have changed from original
  const hasChanges = useMemo(() => {
    if (!config?.fields) return false;
    const originalFormData = convertToCaseFormData(caseData);
    return config.fields.some(f => {
      const original = originalFormData[f.name as keyof CaseFormData];
      const current = formData[f.name as keyof CaseFormData];
      return current !== original;
    });
  }, [config, formData, caseData]);

  /**
   * Handle field value change - same pattern as CaseForm
   * Updates form data and triggers dependent field calculations
   */
  const handleFieldChange = useCallback((fieldName: string, value: string) => {
    // Update form data
    setFormData(prev => ({ ...prev, [fieldName]: value }));

    // Trigger dependent field calculations (same as CaseForm)
    triggerCalculation(fieldName as keyof CaseFormData, value);

    // Reset any error state when user makes changes
    if (submitStatus === "error") {
      setSubmitStatus("idle");
      setSubmitError(null);
    }
  }, [triggerCalculation, submitStatus]);

  /**
   * Handle submit - save all fields to database including auto-calculated status
   * Same pattern as CaseForm - includes suggestedCaseStatus and suggestedProgressStatus
   */
  const handleSubmit = useCallback(async () => {
    if (!config?.fields || !canSubmit) return;

    setSubmitStatus("saving");
    setSubmitError(null);

    try {
      // Build update payload from formData for configured fields
      const updateData: Record<string, unknown> = {};

      for (const field of config.fields) {
        const value = formData[field.name as keyof CaseFormData];
        if (value !== undefined && value !== null && value !== "") {
          updateData[field.name] = value;
        }
      }

      // Include auto-calculated status (same as CaseForm)
      const newCaseStatus = suggestedCaseStatus ?? formData.caseStatus;
      const newProgressStatus = suggestedProgressStatus ?? formData.progressStatus;

      // Save to database with status update
      await updateCase({
        id: caseId,
        ...updateData,
        caseStatus: newCaseStatus,
        progressStatus: newProgressStatus,
      });

      setSubmitStatus("saved");

      // Close the card after a brief success indication
      setTimeout(() => {
        onComplete?.();
      }, 500);
    } catch (error) {
      console.error("[QuickEdit] Save failed:", error);
      setSubmitStatus("error");
      setSubmitError(error instanceof Error ? error.message : "Save failed");
    }
  }, [config, formData, canSubmit, updateCase, caseId, onComplete, suggestedCaseStatus, suggestedProgressStatus]);

  // Handle different action types
  if (!config) {
    return null;
  }

  // Waiting action - show info only
  if (isWaitingAction(actionName) && config.waitingInfo) {
    return (
      <div className={cn("py-2", className)}>
        <WaitingInfoDisplay waitingInfo={config.waitingInfo} />
      </div>
    );
  }

  // Complex action - show message and link
  if (isComplexAction(actionName) && config.complexMessage) {
    return (
      <div className={cn("py-2", className)}>
        <ComplexActionDisplay
          message={config.complexMessage}
          onNavigateToForm={onNavigateToForm}
        />
      </div>
    );
  }

  // Complete action - nothing to show
  if (config.type === "complete") {
    return null;
  }

  // Editable action - render fields
  if (!config.fields || config.fields.length === 0) {
    return null;
  }

  return (
    <motion.div
      variants={fieldVariants}
      initial="hidden"
      animate="visible"
      className={cn("space-y-4", className)}
    >
      {/* Fields */}
      <div className="space-y-3">
        {config.fields.map((field) => {
          const fieldValue = formData[field.name as keyof CaseFormData];
          const value = typeof fieldValue === "string" ? fieldValue : "";
          const constraint = constraints[field.name];
          const isAutoCalculated = autoCalculatedFields.has(field.name as keyof CaseFormData);

          return (
            <div key={field.name} className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                {field.label}
              </label>
              <DateInput
                value={value}
                onChange={(e) => handleFieldChange(field.name, e.target.value)}
                disabled={field.autoCalculated || submitStatus === "saving"}
                autoCalculated={field.autoCalculated || isAutoCalculated}
                minDate={constraint?.min}
                maxDate={constraint?.max}
                sundayOnly={field.sundayOnly}
                placeholder={field.placeholder}
                className="w-full"
              />
              {constraint?.hint && (
                <p className="text-xs text-muted-foreground">{constraint.hint}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Error message */}
      {submitError && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>{submitError}</span>
        </div>
      )}

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit || !hasChanges || submitStatus === "saving"}
        className={cn(
          "w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg",
          "font-medium text-sm transition-colors",
          "border-2",
          canSubmit && hasChanges && submitStatus !== "saving"
            ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
            : "bg-muted text-muted-foreground border-border cursor-not-allowed"
        )}
      >
        {submitStatus === "saving" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Saving...</span>
          </>
        ) : submitStatus === "saved" ? (
          <>
            <Check className="h-4 w-4" />
            <span>Saved!</span>
          </>
        ) : (
          <span>Save & Complete</span>
        )}
      </button>
    </motion.div>
  );
}
