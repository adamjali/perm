"use client";

import * as React from "react";
import { memo, useCallback, useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { FormField } from "@/components/forms/FormField";
import { DateInput } from "@/components/forms/DateInput";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getRfiRfeUrgency, type UrgencyLevelWithCompletion } from "@/lib/status/urgency";
import type { CaseFormData, RFEEntry as RFEEntryType } from "@/lib/forms/case-form-schema";

// ============================================================================
// TYPES
// ============================================================================

export interface RFEEntryProps {
  /**
   * Index of this entry in the array (for field registration)
   */
  index: number;

  /**
   * Min date constraint for received date (e.g., I-140 filing date)
   */
  minReceivedDate?: string;

  /**
   * Max date constraint for received date (e.g., ETA 9089 expiration date)
   */
  maxReceivedDate?: string;

  /**
   * Whether received date field is disabled (missing filing date)
   */
  receivedDisabled?: {
    disabled: boolean;
    reason?: string;
  };

  /**
   * Remove handler - takes index so parent can pass stable callback.
   */
  onRemove: (index: number) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Urgency-based styling classes for the entry card.
 * Memoized outside component to prevent recreation.
 */
const URGENCY_CLASSES: Record<UrgencyLevelWithCompletion, string> = {
  urgent: "border-red-600 bg-red-50 dark:bg-red-950/30",
  soon: "border-orange-500 bg-orange-50 dark:bg-orange-950/30",
  normal: "border-border bg-background",
  completed: "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30",
};

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * RFEEntry Component
 *
 * Individual RFE (Request for Evidence) entry card for USCIS requests during I-140 review.
 * Uses direct react-hook-form integration via useWatch and setValue to prevent flickering
 * that occurs with the parent-child update pattern.
 *
 * Features:
 * - Active/Completed status badge
 * - EDITABLE due date (manual entry, typically ~87 days hint)
 * - Urgency styling based on days remaining
 * - Remove button with confirmation
 * - All optional text fields (title, description, notes)
 * - Framer Motion slide-in/fade-out animations (handled by parent)
 * - **Uses useWatch for efficient field-level subscriptions (no jitter)**
 *
 * RFE Rules (from perm_flow.md):
 * - Received date must be after I-140 filing date
 * - Response due IS editable (no auto-calculation, ~87 days as hint)
 * - Response submitted must be after received and before due
 * - Only one active RFE at a time (no submitted date = active)
 *
 * KEY DIFFERENCE vs RFI:
 * - RFI: due date = received + 30 days (STRICT, not editable)
 * - RFE: due date IS editable (user sets based on RFE notice, typically 30-90 days, standard 87)
 *
 * @example
 * ```tsx
 * <RFEEntry
 *   index={0}
 *   minReceivedDate={formData.i140FilingDate}
 *   onRemove={(idx) => remove(idx)}
 * />
 * ```
 */
function RFEEntryComponent({
  index,
  minReceivedDate,
  maxReceivedDate,
  receivedDisabled,
  onRemove,
}: RFEEntryProps) {
  const { setValue, formState: { errors } } = useFormContext<CaseFormData>();

  // Use useWatch to subscribe to specific fields - this is much more efficient
  // than passing the entire entry object from the parent, as it only re-renders
  // when the watched fields actually change
  const title = useWatch<CaseFormData, `rfeEntries.${number}.title`>({
    name: `rfeEntries.${index}.title`,
  });
  const description = useWatch<CaseFormData, `rfeEntries.${number}.description`>({
    name: `rfeEntries.${index}.description`,
  });
  const notes = useWatch<CaseFormData, `rfeEntries.${number}.notes`>({
    name: `rfeEntries.${index}.notes`,
  });
  const receivedDate = useWatch<CaseFormData, `rfeEntries.${number}.receivedDate`>({
    name: `rfeEntries.${index}.receivedDate`,
  });
  const responseDueDate = useWatch<CaseFormData, `rfeEntries.${number}.responseDueDate`>({
    name: `rfeEntries.${index}.responseDueDate`,
  });
  const responseSubmittedDate = useWatch<CaseFormData, `rfeEntries.${number}.responseSubmittedDate`>({
    name: `rfeEntries.${index}.responseSubmittedDate`,
  });

  // Get errors for this entry
  const entryErrors = errors.rfeEntries?.[index];
  const fieldErrors: Record<string, string> = {};
  const fieldWarnings: Record<string, string> = {};
  if (entryErrors) {
    for (const [key, value] of Object.entries(entryErrors)) {
      if (value && typeof value === "object" && "message" in value) {
        // RHF doesn't distinguish warnings from errors, but we could add a "type" check here
        fieldErrors[key] = (value as { message: string }).message;
      }
    }
  }

  // Memoized field ID generator
  const fieldId = useCallback((field: string) => `rfe-${index}-${field}`, [index]);

  // Stable handler for text input changes - uses setValue directly
  const handleInputChange = useCallback(
    (field: keyof RFEEntryType) => (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
      const value = event.target.value;
      setValue(
        `rfeEntries.${index}.${field}` as `rfeEntries.${number}.${keyof RFEEntryType}`,
        value || undefined,
        { shouldDirty: true }
      );
    },
    [setValue, index]
  );

  // Stable handler for date input changes (RFE due date is NOT auto-calculated)
  const handleDateChange = useCallback(
    (field: keyof RFEEntryType) => (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setValue(
        `rfeEntries.${index}.${field}` as `rfeEntries.${number}.${keyof RFEEntryType}`,
        value || undefined,
        { shouldDirty: true }
      );
    },
    [setValue, index]
  );

  // Stable handler for remove button
  const handleRemove = useCallback(() => {
    onRemove(index);
  }, [onRemove, index]);

  // Memoized urgency calculation - uses centralized module
  const urgency = useMemo(
    () => getRfiRfeUrgency(responseDueDate, responseSubmittedDate),
    [responseDueDate, responseSubmittedDate]
  );

  // Memoized derived states
  const isActive = useMemo(
    () => !responseSubmittedDate && !!receivedDate,
    [responseSubmittedDate, receivedDate]
  );
  const isCompleted = !!responseSubmittedDate;

  // Memoized hint text to prevent recalculation
  const receivedHint = useMemo(() => {
    if (receivedDisabled?.disabled) return receivedDisabled.reason;
    if (minReceivedDate && maxReceivedDate) {
      return `Must be between ${minReceivedDate} and ${maxReceivedDate}`;
    }
    if (minReceivedDate) {
      return `Must be after I-140 filing (${minReceivedDate})`;
    }
    return "Date RFE was received";
  }, [receivedDisabled, minReceivedDate, maxReceivedDate]);

  const submittedHint = useMemo(() => {
    if (!receivedDate) return "Enter received date first";
    if (!responseDueDate) return "Enter response due date first";
    return `Must be between received (${receivedDate}) and due (${responseDueDate})`;
  }, [receivedDate, responseDueDate]);

  return (
    <div
      className={cn(
        "relative rounded-lg border-2 p-4 shadow-hard-sm transition-all",
        URGENCY_CLASSES[urgency]
      )}
      data-testid="rfe-entry"
    >
      {/* ========== STATUS BADGES ========== */}
      <div className="mb-3 flex items-center justify-between gap-2">
        {isActive && (
          <div className="flex items-center gap-1.5 rounded-md border-2 border-red-600 bg-red-600 px-2 py-1 text-sm font-bold text-white shadow-hard-sm">
            <span>Active RFE</span>
          </div>
        )}
        {isCompleted && (
          <div className="flex items-center gap-1.5 rounded-md border-2 border-emerald-600 bg-emerald-100 px-2 py-1 text-sm font-semibold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            <span>Completed</span>
          </div>
        )}

        {/* Remove Button */}
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={handleRemove}
          className="ml-auto"
          aria-label="Remove RFE"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* ========== FORM FIELDS ========== */}
      <div className="space-y-4">
        {/* Optional Text Fields */}
        <FormField label="Title" name={fieldId("title")} hint="Brief description of RFE (optional)">
          <Input
            id={fieldId("title")}
            name={fieldId("title")}
            type="text"
            value={title || ""}
            onChange={handleInputChange("title")}
            placeholder="e.g., Additional evidence of ability to pay"
          />
        </FormField>

        <FormField
          label="Description"
          name={fieldId("description")}
          hint="What USCIS is requesting (optional)"
        >
          <Textarea
            id={fieldId("description")}
            name={fieldId("description")}
            value={description || ""}
            onChange={handleInputChange("description")}
            placeholder="Describe the evidence requested..."
            rows={2}
          />
        </FormField>

        {/* Date Fields Grid */}
        <div className="grid gap-4 md:grid-cols-3">
          <FormField
            label="Received Date"
            name={fieldId("receivedDate")}
            error={fieldErrors?.receivedDate}
            hint={receivedHint}
          >
            <DateInput
              id={fieldId("receivedDate")}
              name={fieldId("receivedDate")}
              value={receivedDate || ""}
              onChange={handleDateChange("receivedDate")}
              minDate={minReceivedDate}
              maxDate={maxReceivedDate}
              error={!!fieldErrors?.receivedDate}
              disabled={receivedDisabled?.disabled}
            />
          </FormField>

          <FormField
            label="Response Due"
            name={fieldId("responseDueDate")}
            error={fieldErrors?.responseDueDate}
            hint="Typically 30-90 days (standard 87) - check RFE notice for exact deadline"
          >
            <DateInput
              id={fieldId("responseDueDate")}
              name={fieldId("responseDueDate")}
              value={responseDueDate || ""}
              onChange={handleDateChange("responseDueDate")}
              minDate={receivedDate}
              error={!!fieldErrors?.responseDueDate}
            />
          </FormField>

          <FormField
            label="Response Submitted"
            name={fieldId("responseSubmittedDate")}
            error={fieldErrors?.responseSubmittedDate}
            warning={fieldWarnings?.responseSubmittedDate}
            hint={submittedHint}
          >
            <DateInput
              id={fieldId("responseSubmittedDate")}
              name={fieldId("responseSubmittedDate")}
              value={responseSubmittedDate || ""}
              onChange={handleDateChange("responseSubmittedDate")}
              minDate={receivedDate}
              maxDate={responseDueDate}
              error={!!fieldErrors?.responseSubmittedDate}
              disabled={!receivedDate || !responseDueDate}
            />
          </FormField>
        </div>

        {/* Notes */}
        <FormField label="Notes" name={fieldId("notes")} hint="Additional notes (optional)">
          <Textarea
            id={fieldId("notes")}
            name={fieldId("notes")}
            value={notes || ""}
            onChange={handleInputChange("notes")}
            placeholder="Add any relevant notes..."
            rows={2}
          />
        </FormField>
      </div>
    </div>
  );
}

/**
 * Custom comparison function for React.memo.
 * Only re-render when props that affect the layout change.
 * The field values are handled via useWatch subscriptions internally.
 */
function arePropsEqual(prevProps: RFEEntryProps, nextProps: RFEEntryProps): boolean {
  return (
    prevProps.index === nextProps.index &&
    prevProps.minReceivedDate === nextProps.minReceivedDate &&
    prevProps.maxReceivedDate === nextProps.maxReceivedDate &&
    prevProps.receivedDisabled?.disabled === nextProps.receivedDisabled?.disabled &&
    prevProps.receivedDisabled?.reason === nextProps.receivedDisabled?.reason &&
    prevProps.onRemove === nextProps.onRemove
  );
}

/**
 * Memoized RFEEntry component with custom comparison.
 *
 * Uses useWatch for field subscriptions, so only re-renders when
 * layout-affecting props change.
 */
export const RFEEntry = memo(RFEEntryComponent, arePropsEqual);
