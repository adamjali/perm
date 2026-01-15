"use client";

import * as React from "react";
import { useMemo, useCallback, useRef } from "react";
import { Plus, AlertCircle } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { RFIEntry } from "./RFIEntry";
import { useRfiFieldArray } from "@/components/forms/CaseFormContext";
import type { RFIEntry as RFIEntryType } from "@/lib/forms/case-form-schema";

// ============================================================================
// TYPES
// ============================================================================

export interface RFIEntryListProps {
  /**
   * Min date for received dates (ETA 9089 filing date)
   */
  minReceivedDate?: string;

  /**
   * Max date for received dates (PWD expiration date)
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
function isActiveEntry(entry: RFIEntryType): boolean {
  return !entry.responseSubmittedDate;
}

/**
 * Compute the sorted order of entries (returns array of indices).
 * Only changes when sorting-relevant data changes (count, completion, createdAt).
 */
function computeSortOrder(entries: RFIEntryType[]): number[] {
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
function getSortKey(entries: RFIEntryType[]): string {
  const completionStates = entries
    .map((e) => `${e.id}:${e.responseSubmittedDate ? "1" : "0"}`)
    .join(",");
  return `${entries.length}|${completionStates}`;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * RFIEntryList Component
 *
 * Manages an array of RFI entries using react-hook-form's useFieldArray.
 *
 * Features:
 * - Add new RFI button (disabled when active entry exists)
 * - Auto-calculates due date (+30 days) when received date is set (in RFIEntry)
 * - Sorts: active entries first, then by createdAt descending
 * - Animations for entry add/remove
 * - One active entry at a time rule
 * - **Automatic error cleanup when entries are removed (via useFieldArray)**
 *
 * The RFIEntry component uses useWatch internally for field subscriptions,
 * so it only re-renders when its own fields change - not when siblings update.
 *
 * @example
 * ```tsx
 * // Must be used within CaseFormProvider
 * <RFIEntryList
 *   minReceivedDate={formData.eta9089FilingDate}
 *   maxReceivedDate={formData.pwdExpirationDate}
 * />
 * ```
 */
export function RFIEntryList({
  minReceivedDate,
  maxReceivedDate,
  receivedDisabled,
}: RFIEntryListProps) {
  // Use the useFieldArray hook from CaseFormContext
  const { entries, addEntry, removeEntry } = useRfiFieldArray();

  // Check if there's already an active entry
  const hasActiveEntry = useMemo(() => entries.some(isActiveEntry), [entries]);

  // Generate a sort key that only changes when sorting-relevant data changes
  // This prevents re-sorting on every keystroke
  const sortKey = useMemo(() => getSortKey(entries), [entries]);

  // Compute sort order (array of indices) - only recomputes when sortKey changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sortedIndices = useMemo(() => computeSortOrder(entries), [sortKey]);

  // Stable entry IDs for AnimatePresence keying
  // Use a ref to track IDs without causing re-renders
  const entryIdsRef = useRef<string[]>([]);
  useMemo(() => {
    entryIdsRef.current = entries.map((e) => e.id);
  }, [entries]);

  /**
   * Add a new RFI entry
   */
  const handleAdd = useCallback(() => {
    addEntry({
      receivedDate: "",
      responseDueDate: "",
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
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAdd}
          disabled={hasActiveEntry}
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Add RFI
        </Button>

        {hasActiveEntry && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground" title="Add a response submitted date to the existing RFI before adding another">
            <AlertCircle className="h-4 w-4" />
            <span>Submit or remove existing RFI first</span>
          </div>
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
              <RFIEntry
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
            No RFIs recorded. Click &quot;Add RFI&quot; to track a Request for Information from DOL.
          </p>
        </div>
      )}
    </div>
  );
}
