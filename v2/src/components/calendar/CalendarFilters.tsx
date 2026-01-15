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
 * - Neobrutalist styling with stage colors
 *
 * Phase: 23.1 (Calendar UI)
 * Created: 2025-12-28
 */

"use client";

import * as React from "react";
import { useMutation } from "convex/react";
import { motion, AnimatePresence } from "motion/react";
import { Filter, ChevronDown, ChevronUp, ListFilter } from "lucide-react";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  CaseSelectionModal,
  type CaseForSelection,
} from "@/components/timeline";
import { TimelineLegend } from "@/components/timeline";
import { cn } from "@/lib/utils";
import type { DeadlineType } from "@/lib/calendar/types";

// ============================================================================
// Animation Constants
// ============================================================================

/**
 * Slide animation for filter panel
 */
const filterPanelVariants = {
  hidden: {
    opacity: 0,
    height: 0,
    marginTop: 0,
  },
  visible: {
    opacity: 1,
    height: "auto",
    marginTop: 16,
    transition: {
      duration: 0.2,
      ease: [0.165, 0.84, 0.44, 1] as const, // easeOutQuart for snappy feel
    },
  },
  exit: {
    opacity: 0,
    height: 0,
    marginTop: 0,
    transition: {
      duration: 0.15,
      ease: "easeInOut" as const,
    },
  },
};

/**
 * Stagger animation for filter groups
 */
const filterGroupVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.03,
      duration: 0.15,
    },
  }),
};

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
      { value: "pwdFiled", label: "PWD Filed" },
      { value: "pwdDetermined", label: "PWD Determined" },
      { value: "pwdExpires", label: "PWD Expiration" },
    ],
  },
  {
    stage: "Recruitment",
    color: "#9333ea",
    types: [
      { value: "jobOrderStart", label: "Job Order Start" },
      { value: "jobOrderEnd", label: "Job Order End" },
      { value: "sundayAdFirst", label: "1st Sunday Ad" },
      { value: "sundayAdSecond", label: "2nd Sunday Ad" },
      { value: "noticeOfFilingStart", label: "Notice Posted" },
      { value: "noticeOfFilingEnd", label: "Notice End" },
    ],
  },
  {
    stage: "Professional",
    color: "#9333ea", // Same purple as Recruitment (part of recruitment phase)
    types: [
      { value: "additionalRecruitmentStart", label: "Addl Recruitment Start" },
      { value: "additionalRecruitmentEnd", label: "Addl Recruitment End" },
      { value: "additionalMethod", label: "Addl Methods" },
    ],
  },
  {
    stage: "ETA 9089",
    color: "#ea580c",
    types: [
      { value: "eta9089Filed", label: "ETA Filed" },
      { value: "eta9089Certified", label: "ETA Certified" },
      { value: "eta9089Expires", label: "ETA Expiration" },
      { value: "filingWindowOpens", label: "Filing Window Opens" },
      { value: "filingWindowCloses", label: "Filing Window Closes" },
    ],
  },
  {
    stage: "I-140",
    color: "#16a34a",
    types: [
      { value: "i140Filed", label: "I-140 Filed" },
      { value: "i140Approved", label: "I-140 Approved" },
    ],
  },
  {
    stage: "RFI/RFE",
    color: "#DC2626",
    types: [
      { value: "rfiDue", label: "RFI Due Dates" },
      { value: "rfeDue", label: "RFE Due Dates" },
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
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 p-3 sm:p-4 bg-card border-2 border-border shadow-hard">
        {/* Top row on mobile: Cases button + Filters toggle */}
        <div className="flex items-center justify-between gap-3 w-full sm:w-auto">
          {/* Case Selection Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCaseModalOpen(true)}
            className="gap-2 min-h-[44px] flex-1 sm:flex-initial"
            data-testid="case-selection-btn"
          >
            <ListFilter className="size-4" />
            <span>Cases</span>
            <span
              className={cn(
                "ml-1 px-2 py-0.5 text-xs font-bold border-2 border-border",
                selectedCaseIds.size === allCases.length
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {selectionBadgeText}
            </span>
          </Button>

          {/* Expand/Collapse Filters Button - Right side on mobile */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
            className="gap-2 min-h-[44px] sm:ml-auto sm:order-last"
            data-testid="toggle-filters-btn"
          >
            <Filter className="size-4" />
            <span className="hidden sm:inline">Deadline Filters</span>
            {isFiltersExpanded ? (
              <ChevronUp className="size-4" />
            ) : (
              <ChevronDown className="size-4" />
            )}
          </Button>
        </div>

        {/* Show Completed Toggle (I-140 Approved) */}
        <div className="flex items-center gap-2 min-h-[44px]">
          <Checkbox
            id="show-completed"
            checked={showCompleted}
            onCheckedChange={(checked) =>
              onShowCompletedChange(checked === true)
            }
            className="border-2 size-5"
            data-testid="show-completed-checkbox"
          />
          <Label
            htmlFor="show-completed"
            className="text-sm cursor-pointer whitespace-nowrap"
          >
            Show Completed (I-140 Approved)
          </Label>
        </div>

        {/* Show Closed/Archived Toggle */}
        <div className="flex items-center gap-2 min-h-[44px]">
          <Checkbox
            id="show-closed"
            checked={showClosed}
            onCheckedChange={(checked) =>
              onShowClosedChange(checked === true)
            }
            className="border-2 size-5"
            data-testid="show-closed-checkbox"
          />
          <Label
            htmlFor="show-closed"
            className="text-sm cursor-pointer whitespace-nowrap"
          >
            Show Closed/Archived
          </Label>
        </div>
      </div>

      {/* Expandable Deadline Type Filters with animation */}
      <AnimatePresence mode="wait">
        {isFiltersExpanded && (
          <motion.div
            key="filter-panel"
            variants={filterPanelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="overflow-hidden"
          >
            <div
              className="p-4 bg-card border-2 border-border shadow-hard"
              data-testid="deadline-filters-panel"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {DEADLINE_TYPE_GROUPS.map((group, groupIndex) => (
                  <motion.div
                    key={group.stage}
                    custom={groupIndex}
                    variants={filterGroupVariants}
                    initial="hidden"
                    animate="visible"
                    className="space-y-2"
                    data-testid={`filter-group-${group.stage.toLowerCase().replace(" ", "-")}`}
                  >
                    {/* Group Header with Stage Color */}
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 border-2 border-border shrink-0"
                        style={{ backgroundColor: group.color }}
                        aria-hidden="true"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          handleGroupToggle(
                            group.types,
                            !isGroupAllVisible(group.types)
                          )
                        }
                        className="font-heading text-sm font-bold hover:text-primary transition-colors"
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
                            className="border-2"
                            data-testid={`filter-checkbox-${type.value}`}
                            aria-label={`Show ${type.label} deadlines`}
                          />
                          <Label
                            htmlFor={`filter-${type.value}`}
                            className="text-xs cursor-pointer font-normal"
                          >
                            {type.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stage Colors Legend */}
      <TimelineLegend sticky={false} className="border-2 border-border shadow-hard" />

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

export default CalendarFilters;
