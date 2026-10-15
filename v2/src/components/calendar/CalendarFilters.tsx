"use client";

// `convex/react` is a CLIENT-ONLY module: its hooks reach `React.createContext`,
// which exists only in React's client build. Declared here rather
// than inherited from whichever importer happened to cross a boundary first.
// Without it this module works until the chunk graph shifts, then fails with
// `TypeError: (0 , d.createContext) is not a function` naming webpack bootstrap
// and no source file. See components/layout/Footer.tsx.

/**
 * CalendarFilters Component
 *
 * Filter bar for calendar deadlines and case selection.
 * Persists filter state to calendarPreferences via Convex mutation.
 *
 * Features:
 * - Deadline type toggles grouped by stage
 * - "Show Completed (I-140 Approved)" toggle
 * - "Show Closed/Archived" toggle
 * - "Case Selection" button with badge showing selection status
 * - Collapsible filter sections on mobile
 */

"use client";

import * as React from "react";
import { useMutation } from "convex/react";
import { CaretDownIcon, CaretUpIcon, FunnelIcon as Filter, FunnelSimpleIcon } from "@phosphor-icons/react/ssr";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  CaseSelectionModal,
  type CaseForSelection,
} from "@/components/timeline";
import { TimelineLegendCompact } from "@/components/timeline";
import type { DeadlineType } from "@/lib/calendar/types";

// ============================================================================
// Types
// ============================================================================

export interface CalendarFiltersProps {
  /** All available cases for selection */
  allCases: CaseForSelection[];
  /** Currently hidden case IDs */
  hiddenCases: Id<"cases">[];
  /** Currently hidden deadline types */
  hiddenDeadlineTypes: DeadlineType[];
  /** Whether to show completed cases (I-140 Approved) */
  showCompleted: boolean;
  /** Callback when showCompleted changes */
  onShowCompletedChange: (value: boolean) => void;
  /** Whether to show closed/archived cases */
  showClosed: boolean;
  /** Callback when showClosed changes */
  onShowClosedChange: (value: boolean) => void;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Deadline types grouped by PERM stage for organized display
 */
const DEADLINE_TYPE_GROUPS: {
  stage: string;
  color: string;
  types: { value: DeadlineType; label: string }[];
}[] = [
  {
    stage: "PWD",
    color: "#0066FF",
    types: [
      { value: "pwdFiled", label: "PWD filed" },
      { value: "pwdDetermined", label: "PWD determined" },
      { value: "pwdExpires", label: "PWD expiration" },
    ],
  },
  {
    stage: "Recruitment",
    color: "#9333ea",
    types: [
      { value: "jobOrderStart", label: "Job order start" },
      { value: "jobOrderEnd", label: "Job order end" },
      { value: "sundayAdFirst", label: "1st Sunday Ad" },
      { value: "sundayAdSecond", label: "2nd Sunday Ad" },
      { value: "noticeOfFilingStart", label: "Notice posted" },
      { value: "noticeOfFilingEnd", label: "Notice end" },
    ],
  },
  {
    stage: "Professional",
    color: "#9333ea", // Same purple as Recruitment (part of recruitment phase)
    types: [
      { value: "additionalRecruitmentStart", label: "Addl recruitment start" },
      { value: "additionalRecruitmentEnd", label: "Addl recruitment end" },
      { value: "additionalMethod", label: "Addl methods" },
    ],
  },
  {
    stage: "ETA 9089",
    color: "#D97706",
    types: [
      { value: "eta9089Filed", label: "ETA filed" },
      { value: "eta9089Certified", label: "ETA certified" },
      { value: "eta9089Expires", label: "ETA expiration" },
      { value: "filingWindowOpens", label: "Filing window opens" },
      { value: "filingWindowCloses", label: "Filing window closes" },
    ],
  },
  {
    stage: "I-140",
    color: "#059669",
    types: [
      { value: "i140Filed", label: "I-140 filed" },
      { value: "i140Approved", label: "I-140 approved" },
    ],
  },
  {
    stage: "RFI/RFE",
    color: "#DC2626",
    types: [
      { value: "rfiDue", label: "RFI due dates" },
      { value: "rfeDue", label: "RFE due dates" },
    ],
  },
];

// ============================================================================
// Component
// ============================================================================

export function CalendarFilters({
  allCases,
  hiddenCases,
  hiddenDeadlineTypes,
  showCompleted,
  onShowCompletedChange,
  showClosed,
  onShowClosedChange,
}: CalendarFiltersProps) {
  // State for modal and filter expansion
  const [isCaseModalOpen, setIsCaseModalOpen] = React.useState(false);
  const [isFiltersExpanded, setIsFiltersExpanded] = React.useState(false);

  // Mutation for persisting preferences
  const updatePreferences = useMutation(api.calendar.updateCalendarPreferences);

  // Calculate selected cases (inverse of hidden)
  const selectedCaseIds = React.useMemo(() => {
    const hiddenSet = new Set(hiddenCases.map(String));
    return new Set(
      allCases.filter((c) => !hiddenSet.has(c._id)).map((c) => c._id)
    );
  }, [allCases, hiddenCases]);

  // Calculate selection badge text
  const selectionBadgeText = React.useMemo(() => {
    const selectedCount = selectedCaseIds.size;
    const totalCount = allCases.length;
    if (selectedCount === totalCount) {
      return "All cases";
    }
    return `${selectedCount}/${totalCount} cases`;
  }, [selectedCaseIds.size, allCases.length]);

  /**
   * Handle case selection change from modal
   */
  const handleCaseSelectionChange = React.useCallback(
    async (selectedIds: string[]) => {
      // Convert selected IDs to hidden IDs (inverse)
      const selectedSet = new Set(selectedIds);
      const newHiddenCases = allCases
        .filter((c) => !selectedSet.has(c._id))
        .map((c) => c._id as Id<"cases">);

      await updatePreferences({ hiddenCases: newHiddenCases });
    },
    [allCases, updatePreferences]
  );

  /**
   * Handle deadline type toggle
   */
  const handleDeadlineTypeToggle = React.useCallback(
    async (type: DeadlineType, checked: boolean) => {
      let newHiddenTypes: DeadlineType[];
      if (checked) {
        // Remove from hidden (show it)
        newHiddenTypes = hiddenDeadlineTypes.filter((t) => t !== type);
      } else {
        // Add to hidden (hide it)
        newHiddenTypes = [...hiddenDeadlineTypes, type];
      }

      await updatePreferences({ hiddenDeadlineTypes: newHiddenTypes });
    },
    [hiddenDeadlineTypes, updatePreferences]
  );

  /**
   * Toggle all deadline types in a group
   */
  const handleGroupToggle = React.useCallback(
    async (
      groupTypes: { value: DeadlineType; label: string }[],
      showAll: boolean
    ) => {
      const groupTypeValues = groupTypes.map((t) => t.value);
      let newHiddenTypes: DeadlineType[];

      if (showAll) {
        // Remove group types from hidden
        newHiddenTypes = hiddenDeadlineTypes.filter(
          (t) => !groupTypeValues.includes(t)
        );
      } else {
        // Add all group types to hidden (if not already)
        const currentHiddenSet = new Set(hiddenDeadlineTypes);
        groupTypeValues.forEach((t) => currentHiddenSet.add(t));
        newHiddenTypes = Array.from(currentHiddenSet) as DeadlineType[];
      }

      await updatePreferences({ hiddenDeadlineTypes: newHiddenTypes });
    },
    [hiddenDeadlineTypes, updatePreferences]
  );

  /**
   * Check if a deadline type is visible (not hidden)
   */
  const isTypeVisible = React.useCallback(
    (type: DeadlineType) => !hiddenDeadlineTypes.includes(type),
    [hiddenDeadlineTypes]
  );

  /**
   * Check if all types in a group are visible
   */
  const isGroupAllVisible = React.useCallback(
    (groupTypes: { value: DeadlineType; label: string }[]) => {
      return groupTypes.every((t) => !hiddenDeadlineTypes.includes(t.value));
    },
    [hiddenDeadlineTypes]
  );

  return (
    <div className="space-y-4">
      {/* Filter Controls Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center border-2 shadow-hard p-3 sm:p-4 bg-card border-border">
        {/* One row on a phone: which cases, and the filters fold */}
        <div className="flex w-full items-center gap-2 sm:w-auto">
          {/* Case Selection Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCaseModalOpen(true)}
            className="gap-2 min-h-[44px] flex-1 sm:flex-initial"
            data-testid="case-selection-btn"
          >
            <FunnelSimpleIcon className="size-4" />
            <span>Cases</span>{" "}
            <span className="text-muted-foreground">{selectionBadgeText}</span>
          </Button>

          {/* Expand/Collapse Filters Button - Right side on mobile */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
            className="gap-2 min-h-[44px] sm:ml-auto sm:order-last"
            aria-expanded={isFiltersExpanded}
            aria-label="Deadline filters"
            data-testid="toggle-filters-btn"
          >
            <Filter className="size-4" />
            <span className="sm:hidden">Filters</span>{" "}
            <span className="hidden sm:inline">Deadline filters</span>
            {isFiltersExpanded ? (
              <CaretUpIcon className="size-4" />
            ) : (
              <CaretDownIcon className="size-4" />
            )}
          </Button>
        </div>

        {/* Two switches for what the calendar includes */}
        <div className={cn("flex-col sm:flex sm:flex-row sm:items-center sm:gap-6", isFiltersExpanded ? "flex" : "hidden")}>
          <div className="flex items-center gap-2 min-h-[44px]">
            <Checkbox
              id="show-completed"
              checked={showCompleted}
              onCheckedChange={(checked) =>
                onShowCompletedChange(checked === true)
              }
              className="size-5 border"
              data-testid="show-completed-checkbox"
            />
            <Label
              htmlFor="show-completed"
              className="text-sm cursor-pointer whitespace-nowrap"
            >
              Show completed (I-140 approved)
            </Label>
          </div>

          <div className="flex items-center gap-2 min-h-[44px]">
            <Checkbox
              id="show-closed"
              checked={showClosed}
              onCheckedChange={(checked) =>
                onShowClosedChange(checked === true)
              }
              className="size-5 border"
              data-testid="show-closed-checkbox"
            />
            <Label
              htmlFor="show-closed"
              className="text-sm cursor-pointer whitespace-nowrap"
            >
              Show closed or archived
            </Label>
          </div>
        </div>

        {/* What the colours mean, in the same bar instead of a box of its own */}
        <TimelineLegendCompact className={cn("sm:ml-auto", !isFiltersExpanded && "max-sm:hidden")} />
      </div>

      {/* Deadline types, shown when the reader opens them */}
      {isFiltersExpanded && (
        <div className="bg-tint p-4" data-testid="deadline-filters-panel">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {DEADLINE_TYPE_GROUPS.map((group) => (
              <div
                key={group.stage}
                className="space-y-2"
                data-testid={`filter-group-${group.stage.toLowerCase().replace(" ", "-")}`}
              >
                {/* Group Header with Stage Color */}
                <div className="flex items-center gap-2">
                  <div className="size-2.5 shrink-0" style={{ backgroundColor: group.color }} aria-hidden="true" />
                  <button
                    type="button"
                    onClick={() =>
                      handleGroupToggle(
                        group.types,
                        !isGroupAllVisible(group.types)
                      )
                    }
                    className="min-h-11 text-sm font-semibold transition-colors hover:text-primary-text"
                    aria-label={`Toggle all ${group.stage} deadline types`}
                  >
                    {group.stage}
                  </button>
                </div>

                {/* Deadline Type Checkboxes */}
                <div className="space-y-1.5 pl-5">
                  {group.types.map((type) => (
                    <div key={type.value} className="flex items-center gap-2">
                      <Checkbox
                        id={`filter-${type.value}`}
                        checked={isTypeVisible(type.value)}
                        onCheckedChange={(checked) =>
                          handleDeadlineTypeToggle(type.value, checked === true)
                        }
                        className="border"
                        data-testid={`filter-checkbox-${type.value}`}
                        aria-label={`Show ${type.label} deadlines`}
                      />
                      <Label
                        htmlFor={`filter-${type.value}`}
                        className="text-sm cursor-pointer font-normal"
                      >
                        {type.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Case Selection Modal */}
      <CaseSelectionModal
        isOpen={isCaseModalOpen}
        onClose={() => setIsCaseModalOpen(false)}
        allCases={allCases}
        selectedIds={selectedCaseIds}
        onSelectionChange={handleCaseSelectionChange}
      />
    </div>
  );
}
