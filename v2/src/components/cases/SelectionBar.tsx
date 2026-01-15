/**
 * SelectionBar Component
 * Fixed bottom bar for bulk actions on selected cases.
 *
 * Design:
 * - Fixed at bottom of screen (z-[60], above footer's z-50)
 * - Neobrutalist: 4px black top border, hard shadow
 * - Left: Selected count
 * - Middle: Select All | Deselect All
 * - Right: Export CSV | Export JSON | Archive | Delete
 * - Cancel button to exit selection mode
 * - Dark mode compatible
 *
 * Responsive Layout:
 * - Desktop: Single row with all actions inline
 * - Mobile: Stacked rows grouped by action type:
 *   - Row 1: Export actions (CSV, JSON)
 *   - Row 2: Case management (Archive, Delete) + Calendar sync (when connected)
 *   - Row 3: Recovery actions (Re-open, when applicable)
 *
 * Phase: 21 (Case List - Selection Mode)
 * Created: 2025-12-25
 * Updated: 2026-01-03 - Reorganized mobile layout for consistency (ISS-027)
 */

"use client";

import { X, Download, FileJson, Archive, Trash2, RotateCcw, Calendar, CalendarOff } from "lucide-react";
import { Button } from "@/components/ui/button";

// ============================================================================
// TYPES
// ============================================================================

interface SelectionBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onExportCSV: () => void;
  onExportJSON: () => void;
  onBulkDelete: () => void;
  onBulkArchive: () => void;
  onBulkReopen: () => void;
  onCancel: () => void;
  /** Whether any selected cases are closed (enables Re-open button) */
  hasClosedCases?: boolean;
  /** Loading state for bulk operations */
  isLoading?: boolean;
  /** Handler for bulk calendar sync (true = sync, false = unsync) */
  onBulkCalendarSync?: (enable: boolean) => void;
  /** Whether calendar is connected (controls visibility of sync buttons) */
  isCalendarConnected?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function SelectionBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onExportCSV,
  onExportJSON,
  onBulkDelete,
  onBulkArchive,
  onBulkReopen,
  onCancel,
  hasClosedCases = false,
  isLoading = false,
  onBulkCalendarSync,
  isCalendarConnected = false,
}: SelectionBarProps) {
  // Don't render if no cases are selected
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div
      data-testid="selection-bar"
      className="fixed bottom-0 left-0 right-0 z-[60] border-t-4 border-black dark:border-white bg-background shadow-hard-lg"
    >
      <div className="container mx-auto px-6 py-4">
        {/* Desktop Layout */}
        <div className="hidden md:flex items-center justify-between gap-4">
          {/* Left: Count + Cancel */}
          <div className="flex items-center gap-3">
            <span className="font-heading font-bold text-lg">
              {selectedCount} {selectedCount === 1 ? "case" : "cases"} selected
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              aria-label="Cancel"
              className="text-muted-foreground"
            >
              <X className="size-4 mr-1.5" />
              Cancel
            </Button>
          </div>

          {/* Middle: Select/Deselect All */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onSelectAll}
              aria-label="Select All"
              disabled={selectedCount === totalCount}
            >
              Select All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onDeselectAll}
              aria-label="Deselect All"
            >
              Deselect All
            </Button>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={onExportCSV}
              aria-label="Export CSV"
              disabled={isLoading}
            >
              <Download className="size-4 mr-1.5" />
              Export CSV
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onExportJSON}
              aria-label="Export JSON"
              disabled={isLoading}
            >
              <FileJson className="size-4 mr-1.5" />
              Export JSON
            </Button>
            {hasClosedCases && (
              <Button
                variant="outline"
                size="sm"
                onClick={onBulkReopen}
                aria-label="Re-open"
                disabled={isLoading}
              >
                <RotateCcw className="size-4 mr-1.5" />
                Re-open
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={onBulkArchive}
              aria-label="Archive"
              disabled={isLoading}
            >
              <Archive className="size-4 mr-1.5" />
              Archive
            </Button>
            {isCalendarConnected && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onBulkCalendarSync?.(true)}
                  aria-label="Sync to Calendar"
                  disabled={isLoading}
                >
                  <Calendar className="size-4 mr-1.5" />
                  Sync
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onBulkCalendarSync?.(false)}
                  aria-label="Unsync from Calendar"
                  disabled={isLoading}
                >
                  <CalendarOff className="size-4 mr-1.5" />
                  Unsync
                </Button>
              </>
            )}
            <Button
              variant="destructive"
              size="sm"
              onClick={onBulkDelete}
              aria-label="Delete"
              disabled={isLoading}
            >
              <Trash2 className="size-4 mr-1.5" />
              Delete
            </Button>
          </div>
        </div>

        {/* Mobile Layout (Stacked) */}
        <div className="md:hidden space-y-3">
          {/* Count + Cancel */}
          <div className="flex items-center justify-between">
            <span className="font-heading font-bold text-base">
              {selectedCount} {selectedCount === 1 ? "case" : "cases"} selected
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              aria-label="Cancel"
              className="text-muted-foreground"
            >
              <X className="size-4 mr-1.5" />
              Cancel
            </Button>
          </div>

          {/* Select/Deselect All */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onSelectAll}
              aria-label="Select All"
              disabled={selectedCount === totalCount}
              className="flex-1"
            >
              Select All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onDeselectAll}
              aria-label="Deselect All"
              className="flex-1"
            >
              Deselect All
            </Button>
          </div>

          {/* Actions Row 1: Export */}
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={onExportCSV}
              aria-label="Export CSV"
              className="flex-1"
              disabled={isLoading}
            >
              <Download className="size-4 mr-1.5" />
              CSV
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onExportJSON}
              aria-label="Export JSON"
              className="flex-1"
              disabled={isLoading}
            >
              <FileJson className="size-4 mr-1.5" />
              JSON
            </Button>
          </div>

          {/* Actions Row 2: Case management + Calendar sync */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onBulkArchive}
              aria-label="Archive"
              className="flex-1"
              disabled={isLoading}
            >
              <Archive className="size-4 mr-1.5" />
              Archive
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={onBulkDelete}
              aria-label="Delete"
              className="flex-1"
              disabled={isLoading}
            >
              <Trash2 className="size-4 mr-1.5" />
              Delete
            </Button>
            {isCalendarConnected && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onBulkCalendarSync?.(true)}
                  aria-label="Sync to Calendar"
                  className="flex-1"
                  disabled={isLoading}
                >
                  <Calendar className="size-4 mr-1.5" />
                  Sync
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onBulkCalendarSync?.(false)}
                  aria-label="Unsync from Calendar"
                  className="flex-1"
                  disabled={isLoading}
                >
                  <CalendarOff className="size-4 mr-1.5" />
                  Unsync
                </Button>
              </>
            )}
          </div>

          {/* Actions Row 3: Recovery actions (conditional) */}
          {hasClosedCases && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onBulkReopen}
                aria-label="Re-open"
                className="flex-1"
                disabled={isLoading}
              >
                <RotateCcw className="size-4 mr-1.5" />
                Re-open Selected Cases
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
