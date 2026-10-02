"use client";

import * as React from "react";
import { memo, useCallback, useMemo, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { FormField } from "@/components/forms/FormField";
import { DateInput } from "@/components/forms/DateInput";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { CheckCircleIcon as CheckCircle2, XIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { getRfiRfeUrgency, type UrgencyLevelWithCompletion } from "@/lib/status/urgency";
import { calculateRFIDueDate } from "@/lib/perm";
import type { ISODateString } from "@/lib/perm";
import type { RequestKind } from "@/components/forms/CaseFormContext";
import type { CaseFormData, RFIEntry, RFEEntry } from "@/lib/forms/case-form-schema";
import { CharLimit } from "@/components/ui/char-limit";

// ============================================================================
// KINDS
// ============================================================================

interface RequestKindCopy {
  /** Short name: "RFI" or "RFE". */
  label: string;
  /** Full name: "Request for Information". */
  name: string;
  /** What the agency asks for, in lower case. */
  asks: string;
  /** The agency that sends it. */
  agency: string;
  /** The filing the request follows. */
  priorFiling: string;
  titlePlaceholder: string;
  dueHint: string;
  /** Present when the due date follows from the received date; absent when the user enters it. */
  calculateDueDate: ((receivedDate: string) => string) | null;
}

/**
 * What differs between the two kinds of request. An RFI comes from DOL during
 * ETA 9089 review and is due a strict 30 days after it arrives, so its due
 * date is calculated and locked. An RFE comes from USCIS during I-140 review
 * and is due when its notice says (typically 30 to 90 days, standard 87), so
 * the user enters the due date.
 */
export const REQUEST_KINDS: Record<RequestKind, RequestKindCopy> = {
  rfi: {
    label: "RFI",
    name: "Request for Information",
    asks: "information",
    agency: "DOL",
    priorFiling: "ETA 9089",
    titlePlaceholder: "e.g., Clarification on job duties",
    dueHint: "Strict 30 days from received (auto-calculated, not editable)",
    calculateDueDate: calculateRFIDueDate,
  },
  rfe: {
    label: "RFE",
    name: "Request for Evidence",
    asks: "evidence",
    agency: "USCIS",
    priorFiling: "I-140",
    titlePlaceholder: "e.g., Additional evidence of ability to pay",
    dueHint: "Typically 30-90 days (standard 87) - check RFE notice for exact deadline",
    calculateDueDate: null,
  },
};

type EntryKey = keyof (RFIEntry | RFEEntry);
type EntryPath<K extends EntryKey> = `${RequestKind}Entries.${number}.${K}`;

// ============================================================================
// TYPES
// ============================================================================

export interface RequestEntryProps {
  /**
   * Which kind of request this entry is
   */
  kind: RequestKind;

  /**
   * Index of this entry in the array (for field registration)
   */
  index: number;

  /**
   * Min date constraint for received date (the day after the filing the request follows)
   */
  minReceivedDate?: string;

  /**
   * Max date constraint for received date
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
  urgent: "border-destructive bg-destructive/10",
  soon: "border-data-warn bg-data-warn/15",
  normal: "border-border bg-background",
  completed: "border-primary bg-primary/10",
};

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * RequestEntry Component
 *
 * One RFI or RFE entry card. Reads its fields with useWatch and writes them
 * with setValue, so typing in one entry re-renders only that entry.
 *
 * Rules (from perm_flow.md):
 * - Received date must be after the filing the request follows
 * - RFI response due = received + 30 days (strict, not editable)
 * - RFE response due is entered from the notice
 * - Response submitted must be after received and before due
 * - Only one active request of a kind at a time (no submitted date = active)
 *
 * @example
 * ```tsx
 * <RequestEntry
 *   kind="rfi"
 *   index={0}
 *   minReceivedDate={formData.eta9089FilingDate}
 *   onRemove={(idx) => remove(idx)}
 * />
 * ```
 */
function RequestEntryComponent({
  kind,
  index,
  minReceivedDate,
  maxReceivedDate,
  receivedDisabled,
  onRemove,
}: RequestEntryProps) {
  const copy = REQUEST_KINDS[kind];
  const { setValue, formState: { errors } } = useFormContext<CaseFormData>();

  // Use useWatch to subscribe to specific fields - this is much more efficient
  // than passing the entire entry object from the parent, as it only re-renders
  // when the watched fields actually change
  const title = useWatch<CaseFormData, EntryPath<"title">>({
    name: `${kind}Entries.${index}.title`,
  });
  const description = useWatch<CaseFormData, EntryPath<"description">>({
    name: `${kind}Entries.${index}.description`,
  });
  const notes = useWatch<CaseFormData, EntryPath<"notes">>({
    name: `${kind}Entries.${index}.notes`,
  });
  const receivedDate = useWatch<CaseFormData, EntryPath<"receivedDate">>({
    name: `${kind}Entries.${index}.receivedDate`,
  });
  const responseDueDate = useWatch<CaseFormData, EntryPath<"responseDueDate">>({
    name: `${kind}Entries.${index}.responseDueDate`,
  });
  const responseSubmittedDate = useWatch<CaseFormData, EntryPath<"responseSubmittedDate">>({
    name: `${kind}Entries.${index}.responseSubmittedDate`,
  });

  // State for inline validation errors (e.g., responseSubmittedDate > responseDueDate)
  const [inlineErrors, setInlineErrors] = useState<Record<string, string>>({});

  // Get errors for this entry (merging RHF errors with inline validation errors)
  const entryErrors = errors[`${kind}Entries`]?.[index];
  const fieldErrors: Record<string, string> = { ...inlineErrors };
  if (entryErrors) {
    for (const [key, value] of Object.entries(entryErrors)) {
      if (value && typeof value === "object" && "message" in value) {
        fieldErrors[key] = (value as { message: string }).message;
      }
    }
  }

  // Memoized field ID generator
  const fieldId = useCallback((field: string) => `${kind}-${index}-${field}`, [kind, index]);

  // Stable handler for text input changes - uses setValue directly
  const handleInputChange = useCallback(
    (field: EntryKey) => (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
      const value = event.target.value;
      setValue(
        `${kind}Entries.${index}.${field}` as EntryPath<EntryKey>,
        value || undefined,
        { shouldDirty: true }
      );
    },
    [setValue, kind, index]
  );

  // Stable handler for date input changes. A calculated due date follows the
  // received date; either way, a new due date makes the submitted-date check stale.
  const handleDateChange = useCallback(
    (field: EntryKey) => (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setValue(
        `${kind}Entries.${index}.${field}` as EntryPath<EntryKey>,
        value || undefined,
        { shouldDirty: true }
      );

      const { calculateDueDate } = REQUEST_KINDS[kind];
      if (calculateDueDate && field === "receivedDate") {
        const dueDate = value ? calculateDueDate(value) : "";
        setValue(
          `${kind}Entries.${index}.responseDueDate` as EntryPath<"responseDueDate">,
          dueDate as ISODateString,
          { shouldDirty: true }
        );
      }
      if (field === (calculateDueDate ? "receivedDate" : "responseDueDate")) {
        setInlineErrors((prev) => {
          const { responseSubmittedDate: _, ...rest } = prev;
          return rest;
        });
      }

      // Validate responseSubmittedDate against responseDueDate
      if (field === "responseSubmittedDate" && value) {
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
    [setValue, kind, index, responseDueDate]
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
  const dueIsCalculated = copy.calculateDueDate !== null;
  const autoCalculatedDueDate = dueIsCalculated && !!receivedDate;

  // Memoized hint text to prevent recalculation
  const receivedHint = useMemo(() => {
    if (receivedDisabled?.disabled) return receivedDisabled.reason;
    if (minReceivedDate && maxReceivedDate) {
      return `Must be between ${minReceivedDate} and ${maxReceivedDate}`;
    }
    if (minReceivedDate) {
      return `Must be after ${copy.priorFiling} filing (${minReceivedDate})`;
    }
    return `Date ${copy.label} was received`;
  }, [receivedDisabled, minReceivedDate, maxReceivedDate, copy]);

  const submittedHint = useMemo(() => {
    if (!receivedDate) return "Enter received date first";
    if (responseDueDate) {
      return `Must be between received (${receivedDate}) and due (${responseDueDate})`;
    }
    return dueIsCalculated
      ? `Date response was submitted to ${copy.agency}`
      : "Enter response due date first";
  }, [receivedDate, responseDueDate, dueIsCalculated, copy]);

  return (
    <div
      className={cn(
        "relative rounded-lg border-2 p-4 shadow-hard-sm transition-all",
        URGENCY_CLASSES[urgency]
      )}
      data-testid={`${kind}-entry`}
    >
      {/* ========== STATUS BADGES ========== */}
      <div className="mb-3 flex items-center justify-between gap-2">
        {isActive && (
          <div className="flex items-center gap-1.5 rounded-md border-2 border-destructive bg-destructive px-2 py-1 text-sm font-bold text-white shadow-hard-sm">
            <span>{`Active ${copy.label}`}</span>
          </div>
        )}
        {isCompleted && (
          <div className="flex items-center gap-1.5 rounded-md border-2 border-primary bg-primary/10 px-2 py-1 text-sm font-semibold text-primary">
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
          aria-label={`Remove ${copy.label}`}
        >
          <XIcon className="h-4 w-4" />
        </Button>
      </div>

      {/* ========== FORM FIELDS ========== */}
      <div className="space-y-4">
        {/* Optional Text Fields */}
        <FormField label="Title" name={fieldId("title")} hint={`Brief description of ${copy.label} (optional)`}>
          <CharLimit max={200}>
            <Input
              id={fieldId("title")}
              name={fieldId("title")}
              type="text"
              value={title || ""}
              onChange={handleInputChange("title")}
              placeholder={copy.titlePlaceholder}
            />
          </CharLimit>
        </FormField>

        <FormField
          label="Description"
          name={fieldId("description")}
          hint={`What ${copy.agency} is requesting (optional)`}
        >
          <CharLimit max={2000}>
            <Textarea
              id={fieldId("description")}
              name={fieldId("description")}
              value={description || ""}
              onChange={handleInputChange("description")}
              placeholder={`Describe the ${copy.asks} requested...`}
              rows={2}
            />
          </CharLimit>
        </FormField>

        {/* Date Fields Grid */}
        <div className="grid [&>*]:min-w-0 grid-cols-1 gap-4 md:grid-cols-3">
          <FormField
            label="Received date"
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
            label="Response due"
            name={fieldId("responseDueDate")}
            error={fieldErrors?.responseDueDate}
            hint={copy.dueHint}
            autoCalculated={autoCalculatedDueDate}
          >
            <DateInput
              id={fieldId("responseDueDate")}
              name={fieldId("responseDueDate")}
              value={responseDueDate || ""}
              // A calculated due date is read-only
              onChange={dueIsCalculated ? () => {} : handleDateChange("responseDueDate")}
              minDate={dueIsCalculated ? undefined : receivedDate}
              error={!!fieldErrors?.responseDueDate}
              disabled={dueIsCalculated}
              autoCalculated={autoCalculatedDueDate}
            />
          </FormField>

          <FormField
            label="Response submitted"
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
              disabled={!receivedDate || (!dueIsCalculated && !responseDueDate)}
            />
          </FormField>
        </div>

        {/* Notes */}
        <FormField label="Notes" name={fieldId("notes")} hint="Additional notes (optional)">
          <CharLimit max={2000}>
            <Textarea
              id={fieldId("notes")}
              name={fieldId("notes")}
              value={notes || ""}
              onChange={handleInputChange("notes")}
              placeholder="Add any relevant notes..."
              rows={2}
            />
          </CharLimit>
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
function arePropsEqual(prevProps: RequestEntryProps, nextProps: RequestEntryProps): boolean {
  return (
    prevProps.kind === nextProps.kind &&
    prevProps.index === nextProps.index &&
    prevProps.minReceivedDate === nextProps.minReceivedDate &&
    prevProps.maxReceivedDate === nextProps.maxReceivedDate &&
    prevProps.receivedDisabled?.disabled === nextProps.receivedDisabled?.disabled &&
    prevProps.receivedDisabled?.reason === nextProps.receivedDisabled?.reason &&
    prevProps.onRemove === nextProps.onRemove
  );
}

/**
 * Memoized RequestEntry component with custom comparison.
 *
 * Uses useWatch for field subscriptions, so only re-renders when
 * layout-affecting props change.
 */
export const RequestEntry = memo(RequestEntryComponent, arePropsEqual);
