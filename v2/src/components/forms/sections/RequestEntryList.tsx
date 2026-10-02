"use client";

import { useMemo, useCallback } from "react";
import { useWatch } from "react-hook-form";
import { PlusIcon, WarningCircleIcon as AlertCircle } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { RequestEntry, REQUEST_KINDS } from "./RequestEntry";
import { useRequestEntryArray, type RequestKind } from "@/components/forms/CaseFormContext";
import type { CaseFormData, RFIEntry, RFEEntry } from "@/lib/forms/case-form-schema";
import type { ISODateString } from "@/lib/perm";

/** The most entries of one kind a case holds; the add button says so when it stops. */
const REQUEST_ENTRIES_MAX = 50;

type Entry = RFIEntry | RFEEntry;

// ============================================================================
// TYPES
// ============================================================================

export interface RequestEntryListProps {
  /**
   * Which kind of request the list holds
   */
  kind: RequestKind;

  /**
   * Min date for received dates (the day after the filing the requests follow)
   */
  minReceivedDate?: string;

  /**
   * Max date for received dates
   */
  maxReceivedDate?: string;

  /**
   * Whether received date field is disabled (missing filing date)
   */
  receivedDisabled?: {
    disabled: boolean;
    reason?: string;
  };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Check if an entry is active (does not have a submitted date).
 * An entry without responseSubmittedDate blocks adding new entries,
 * regardless of whether other fields are filled.
 */
function isActiveEntry(entry: Entry): boolean {
  return !entry.responseSubmittedDate;
}

/**
 * Compute the sorted order of entries (returns array of indices).
 * Only changes when sorting-relevant data changes (count, completion, createdAt).
 */
function computeSortOrder(entries: Entry[]): number[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      const aActive = isActiveEntry(a.entry);
      const bActive = isActiveEntry(b.entry);

      // Active entries first
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;

      // Then by createdAt descending (newest first)
      return b.entry.createdAt - a.entry.createdAt;
    })
    .map((item) => item.index);
}

/**
 * Generate a sort key based on entry count and completion states.
 * Only changes when entries are added/removed or completion status changes.
 */
function getSortKey(entries: Entry[]): string {
  const completionStates = entries
    .map((e) => `${e.id}:${e.responseSubmittedDate ? "1" : "0"}`)
    .join(",");
  return `${entries.length}|${completionStates}`;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * RequestEntryList Component
 *
 * Manages a case's RFI or RFE entries using react-hook-form's useFieldArray.
 *
 * Features:
 * - Add button (disabled while an entry has no submitted date)
 * - Active entries first, then newest first
 * - Animated add/remove
 *
 * Each RequestEntry uses useWatch internally for field subscriptions,
 * so the list only re-renders when entries are added or removed, or when an
 * entry's completion changes.
 *
 * @example
 * ```tsx
 * <RequestEntryList
 *   kind="rfi"
 *   minReceivedDate={formData.eta9089FilingDate}
 *   maxReceivedDate={formData.pwdExpirationDate}
 * />
 * ```
 */
export function RequestEntryList({
  kind,
  minReceivedDate,
  maxReceivedDate,
  receivedDisabled,
}: RequestEntryListProps) {
  const { label, name, agency } = REQUEST_KINDS[kind];
  const { entries, addEntry, removeEntry } = useRequestEntryArray(kind);

  // Watch live form values to detect completion status changes.
  // useFieldArray's `fields` only contains default/initial values and doesn’t update
  // when setValue is called on individual fields (like responseSubmittedDate).
  const watchedEntries = useWatch<CaseFormData, `${RequestKind}Entries`>({ name: `${kind}Entries` });

  // Check if there’s already an active entry using LIVE watched values
  const hasActiveEntry = useMemo(
    () => (watchedEntries ?? []).some((e) => !e?.responseSubmittedDate),
    [watchedEntries]
  );

  // Generate a sort key that only changes when sorting-relevant data changes
  // This prevents re-sorting on every keystroke
  const sortKey = useMemo(() => getSortKey(entries), [entries]);

  // Compute sort order (array of indices) - only recomputes when sortKey changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sortedIndices = useMemo(() => computeSortOrder(entries), [sortKey]);

  /**
   * Add a new entry
   */
  const handleAdd = useCallback(() => {
    addEntry({
      receivedDate: "" as ISODateString,
      responseDueDate: "" as ISODateString,
      responseSubmittedDate: undefined,
    });
  }, [addEntry]);

  /**
   * Remove an entry by index
   * Note: useFieldArray automatically clears errors for removed entries!
   */
  const handleRemove = useCallback(
    (index: number) => {
      removeEntry(index);
    },
    [removeEntry]
  );

  return (
    <div className="space-y-4">
      {/* Add Button */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAdd}
          disabled={hasActiveEntry || entries.length >= REQUEST_ENTRIES_MAX}
          className="gap-1.5"
        >
          <PlusIcon className="h-4 w-4" />
          {`Add ${label}`}
        </Button>

        {hasActiveEntry && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground" title={`Add a response submitted date to the existing ${label} before adding another`}>
            <AlertCircle className="h-4 w-4" />
            <span>{`Submit or remove existing ${label} first`}</span>
          </div>
        )}

        {!hasActiveEntry && entries.length >= REQUEST_ENTRIES_MAX && (
          <p className="text-sm font-semibold text-foreground" role="status">
            {REQUEST_ENTRIES_MAX}{` ${label}s is the most a case can hold. Remove one to add another.`}
          </p>
        )}
      </div>

      {/* Entry List - initial={false} prevents re-animation on every keystroke */}
      <AnimatePresence initial={false}>
        {sortedIndices.map((originalIndex) => {
          const entry = entries[originalIndex];
          if (!entry) return null;

          return (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <RequestEntry
                kind={kind}
                index={originalIndex}
                minReceivedDate={minReceivedDate}
                maxReceivedDate={maxReceivedDate}
                receivedDisabled={receivedDisabled}
                onRemove={handleRemove}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Empty State */}
      {entries.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {`No ${label}s recorded. Click "Add ${label}" to track a ${name} from ${agency}.`}
          </p>
        </div>
      )}
    </div>
  );
}
