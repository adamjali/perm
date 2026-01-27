"use client";

import * as React from "react";
import { memo, useCallback, useMemo, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { FormField } from "@/components/forms/FormField";
import { DateInput } from "@/components/forms/DateInput";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getRfiRfeUrgency, type UrgencyLevelWithCompletion } from "@/lib/status/urgency";
import { calculateRFIDueDate } from "@/lib/perm";
import type { ISODateString } from "@/lib/perm";
import type { CaseFormData, RFIEntry as RFIEntryType } from "@/lib/forms/case-form-schema";

// ============================================================================
// TYPES
// ============================================================================

export interface RFIEntryProps {
  /**
   * Index of this entry in the array (for field registration)
   */
  index: number;

  /**
   * Min date constraint for received date (e.g., ETA 9089 filing date)
   */
  minReceivedDate?: string;

  /**
   * Max date constraint for received date (e.g., PWD expiration date)
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
 * RFIEntry Component
 *
 * Individual RFI (Request for Information) entry card for DOL requests during ETA 9089 review.
 * Uses direct react-hook-form integration via useWatch and setValue to prevent flickering
 * that occurs with the parent-child update pattern.
 *
 * Features:
 * - Active/Completed status badge
 * - Auto-calculated due date (strict +30 days, NOT editable)
 * - Urgency styling based on days remaining
 * - Remove button with confirmation
 * - All optional text fields (title, description, notes)
 * - Framer Motion slide-in/fade-out animations (handled by parent)
 * - **Uses useWatch for efficient field-level subscriptions (no jitter)**
 *
 * RFI Rules (from perm_flow.md):
 * - Received date must be after ETA 9089 filing date
 * - Response due = received + 30 days (STRICT, not editable)
 * - Response submitted must be after received and before due
 * - Only one active RFI at a time (no submitted date = active)
 *
 * @example
 * ```tsx
 * <RFIEntry
 *   index={0}
 *   minReceivedDate={formData.eta9089FilingDate}
 *   onRemove={(idx) => remove(idx)}
 * />
 * ```
 */
function RFIEntryComponent({
  index,
  minReceivedDate,
  maxReceivedDate,
  receivedDisabled,
  onRemove,
}: RFIEntryProps) {
  const { setValue, formState: { errors } } = useFormContext<CaseFormData>();

  // Use useWatch to subscribe to specific fields - this is much more efficient
  // than passing the entire entry object from the parent, as it only re-renders
  // when the watched fields actually change
  const title = useWatch<CaseFormData, `rfiEntries.${number}.title`>({
    name: `rfiEntries.${index}.title`,
  });
  const description = useWatch<CaseFormData, `rfiEntries.${number}.description`>({
    name: `rfiEntries.${index}.description`,
  });
  const notes = useWatch<CaseFormData, `rfiEntries.${number}.notes`>({
    name: `rfiEntries.${index}.notes`,
  });
  const receivedDate = useWatch<CaseFormData, `rfiEntries.${number}.receivedDate`>({
    name: `rfiEntries.${index}.receivedDate`,
  });
  const responseDueDate = useWatch<CaseFormData, `rfiEntries.${number}.responseDueDate`>({
    name: `rfiEntries.${index}.responseDueDate`,
  });
  const responseSubmittedDate = useWatch<CaseFormData, `rfiEntries.${number}.responseSubmittedDate`>({
    name: `rfiEntries.${index}.responseSubmittedDate`,
  });

  // State for inline validation errors (e.g., responseSubmittedDate > responseDueDate)
  const [inlineErrors, setInlineErrors] = useState<Record<string, string>>({});

  // Get errors for this entry (merging RHF errors with inline validation errors)
  const entryErrors = errors.rfiEntries?.[index];
  const fieldErrors: Record<string, string> = { ...inlineErrors };
  if (entryErrors) {
    for (const [key, value] of Object.entries(entryErrors)) {
      if (value && typeof value === "object" && "message" in value) {
        fieldErrors[key] = (value as { message: string }).message;
      }
    }
  }

  // Memoized field ID generator
  const fieldId = useCallback((field: string) => `rfi-${index}-${field}`, [index]);

  // Stable handler for text input changes - uses setValue directly
  const handleInputChange = useCallback(
    (field: keyof RFIEntryType) => (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
      const value = event.target.value;
      setValue(
        `rfiEntries.${index}.${field}` as `rfiEntries.${number}.${keyof RFIEntryType}`,
        value || undefined,
        { shouldDirty: true }
      );
    },
    [setValue, index]
  );

  // Stable handler for date input changes - auto-calculates due date for received
  const handleDateChange = useCallback(
    (field: keyof RFIEntryType) => (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setValue(
        `rfiEntries.${index}.${field}` as `rfiEntries.${number}.${keyof RFIEntryType}`,
        value || undefined,
        { shouldDirty: true }
      );

      // Auto-calculate due date when received date changes
      if (field === "receivedDate") {
        const dueDate = value ? calculateRFIDueDate(value) : "";
        setValue(
          `rfiEntries.${index}.responseDueDate` as const,
          dueDate as ISODateString,
          { shouldDirty: true }
        );
        // Clear any inline errors for responseSubmittedDate since due date changed
        setInlineErrors((prev) => {
          const { responseSubmittedDate: _, ...rest } = prev;
          return rest;
        });
      }

      // Validate responseSubmittedDate against responseDueDate
      if (field === "responseSubmittedDate" && value) {
        // Get the current due date (may have been auto-calculated)
        const currentDueDate = responseDueDate;
        if (currentDueDate && value > currentDueDate) {
          setInlineErrors((prev) => ({
            ...prev,
            responseSubmittedDate: `Response submitted date cannot be after due date (${currentDueDate})`,
          }));
        } else {
          setInlineErrors((prev) => {
            const { responseSubmittedDate: _, ...rest } = prev;
            return rest;
          });
        }
      }
    },
    [setValue, index, responseDueDate]
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
  const autoCalculatedDueDate = !!receivedDate;

  // Memoized hint text to prevent recalculation
  const receivedHint = useMemo(() => {
    if (receivedDisabled?.disabled) return receivedDisabled.reason;
    if (minReceivedDate && maxReceivedDate) {
      return `Must be between ${minReceivedDate} and ${maxReceivedDate}`;
    }
    if (minReceivedDate) {
      return `Must be after ETA 9089 filing (${minReceivedDate})`;
    }
    return "Date RFI was received";
  }, [receivedDisabled, minReceivedDate, maxReceivedDate]);

  const submittedHint = useMemo(() => {
    if (!receivedDate) return "Enter received date first";
    if (responseDueDate) {
      return `Must be between received (${receivedDate}) and due (${responseDueDate})`;
    }
    return "Date response was submitted to DOL";
  }, [receivedDate, responseDueDate]);

  return (
    <div
      className={cn(
        "relative rounded-lg border-2 p-4 shadow-hard-sm transition-all",
        URGENCY_CLASSES[urgency]
      )}
      data-testid="rfi-entry"
    >
      {/* ========== STATUS BADGES ========== */}
      <div className="mb-3 flex items-center justify-between gap-2">
        {isActive && (
          <div className="flex items-center gap-1.5 rounded-md border-2 border-red-600 bg-red-600 px-2 py-1 text-sm font-bold text-white shadow-hard-sm">
            <span>Active RFI</span>
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
          aria-label="Remove RFI"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* ========== FORM FIELDS ========== */}
      <div className="space-y-4">
        {/* Optional Text Fields */}
        <FormField label="Title" name={fieldId("title")} hint="Brief description of RFI (optional)">
          <Input
            id={fieldId("title")}
            name={fieldId("title")}
            type="text"
            value={title || ""}
            onChange={handleInputChange("title")}
            placeholder="e.g., Clarification on job duties"
          />
        </FormField>

        <FormField
          label="Description"
          name={fieldId("description")}
          hint="What DOL is requesting (optional)"
        >
          <Textarea
            id={fieldId("description")}
            name={fieldId("description")}
            value={description || ""}
            onChange={handleInputChange("description")}
            placeholder="Describe the information requested..."
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
            hint="Strict 30 days from received (auto-calculated, not editable)"
            autoCalculated={autoCalculatedDueDate}
          >
            <DateInput
              id={fieldId("responseDueDate")}
              name={fieldId("responseDueDate")}
              value={responseDueDate || ""}
              onChange={() => {}} // No-op - field is auto-calculated
              error={!!fieldErrors?.responseDueDate}
              disabled
              autoCalculated={autoCalculatedDueDate}
            />
          </FormField>

          <FormField
            label="Response Submitted"
            name={fieldId("responseSubmittedDate")}
            error={fieldErrors?.responseSubmittedDate}
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
              disabled={!receivedDate}
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
function arePropsEqual(prevProps: RFIEntryProps, nextProps: RFIEntryProps): boolean {
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
 * Memoized RFIEntry component with custom comparison.
 *
 * Uses useWatch for field subscriptions, so only re-renders when
 * layout-affecting props change.
 */
export const RFIEntry = memo(RFIEntryComponent, arePropsEqual);
