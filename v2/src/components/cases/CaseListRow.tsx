/**
 * CaseListRow Component
 *
 * Compact row for list view displaying case info.
 * Neobrutalist design with hover lift effect.
 *
 * @module components/cases/CaseListRow
 */

"use client";

import { useCallback, useTransition, useState, memo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { ProgressStatusBadge } from "@/components/status/progress-status-badge";
import {
  formatDeadline,
  formatCaseStatus,
  getStageColorVar,
} from "./case-card.utils";
import type { CaseCardData } from "../../../convex/lib/caseListTypes";

export interface CaseListRowProps {
  /** Case data */
  caseData: CaseCardData;
  /** Whether row is selected */
  isSelected?: boolean;
  /** Selection callback */
  onSelect?: (id: string) => void;
  /** Whether selection mode is active */
  selectionMode?: boolean;
  /** Animation index for stagger effect */
  index?: number;
}

export const CaseListRow = memo(function CaseListRow({
  caseData,
  isSelected = false,
  onSelect,
  selectionMode = false,
  index = 0,
}: CaseListRowProps) {
  const {
    _id,
    employerName,
    positionTitle,
    caseStatus,
    progressStatus,
    nextDeadline,
    nextDeadlineLabel,
  } = caseData;

  const router = useRouter();
  const [isNavigating, startNavigation] = useTransition();
  const [isHovered, setIsHovered] = useState(false);

  const stageColor = getStageColorVar(caseStatus);

  const handleRowClick = useCallback(
    (e: React.MouseEvent) => {
      // Don't navigate if clicking checkbox
      if ((e.target as HTMLElement).closest('[role="checkbox"]')) {
        return;
      }
      // In selection mode, toggle selection instead of navigating
      if (selectionMode && onSelect) {
        onSelect(_id);
        return;
      }
      startNavigation(() => router.push(`/cases/${_id}`));
    },
    [_id, router, selectionMode, onSelect]
  );

  const handleCheckboxChange = useCallback(() => {
    if (onSelect) {
      onSelect(_id);
    }
  }, [_id, onSelect]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (selectionMode && onSelect) {
          onSelect(_id);
        } else {
          startNavigation(() => router.push(`/cases/${_id}`));
        }
      }
    },
    [_id, router, selectionMode, onSelect]
  );

  // Deadline urgency styling
  const deadlineUrgency = nextDeadline ? getDeadlineUrgency(nextDeadline) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.12, delay: index * 0.05 }}
      className={cn(
        // Base row styling
        "relative flex items-center gap-3 px-4 py-3",
        "border-b border-border bg-background",
        "cursor-pointer select-none",
        // Hover effect
        "transition-all duration-150",
        isHovered && "-translate-y-0.5 shadow-hard-sm",
        // Selected state
        isSelected && "bg-muted/50",
        // Navigating state
        isNavigating && "opacity-70 pointer-events-none"
      )}
      onClick={handleRowClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-selected={isSelected}
      aria-label={`${employerName} - ${positionTitle}`}
    >
      {/* Selection checkbox */}
      {selectionMode && (
        <Checkbox
          checked={isSelected}
          onCheckedChange={handleCheckboxChange}
          className="shrink-0"
          aria-label={`Select ${employerName}`}
        />
      )}

      {/* Stage indicator dot */}
      <div
        className="shrink-0 w-2 h-2 rounded-full"
        style={{ backgroundColor: stageColor }}
        aria-hidden="true"
      />

      {/* Main content */}
      <div className="flex-1 min-w-0 flex items-center gap-4">
        {/* Employer & Position */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{employerName}</div>
          <div className="text-xs text-muted-foreground truncate">
            {positionTitle}
          </div>
        </div>

        {/* Stage badge */}
        <div className="shrink-0 hidden sm:block">
          <span
            className={cn(
              "inline-flex items-center px-2 py-0.5 text-xs font-medium",
              "border-2 border-border"
            )}
            style={{
              backgroundColor: stageColor,
              color: caseStatus === "closed" ? "var(--foreground)" : "white",
            }}
          >
            {formatCaseStatus(caseStatus)}
          </span>
        </div>

        {/* Deadline */}
        {nextDeadline && (
          <div className="shrink-0 hidden md:block">
            <span
              className={cn(
                "inline-flex items-center px-2 py-0.5 text-xs",
                "border border-border",
                deadlineUrgency === "overdue" &&
                  "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
                deadlineUrgency === "urgent" &&
                  "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800",
                deadlineUrgency === "soon" &&
                  "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800",
                !deadlineUrgency && "bg-muted text-muted-foreground"
              )}
              title={nextDeadlineLabel}
            >
              {formatDeadline(nextDeadline)}
            </span>
          </div>
        )}

        {/* Progress status */}
        <div className="shrink-0">
          <ProgressStatusBadge status={progressStatus} className="text-[10px]" />
        </div>
      </div>
    </motion.div>
  );
});

// ============================================================================
// Helpers
// ============================================================================

type DeadlineUrgency = "overdue" | "urgent" | "soon" | null;

function getDeadlineUrgency(deadline: string): DeadlineUrgency {
  const now = new Date();
  const deadlineDate = new Date(`${deadline}T12:00:00`);
  const daysUntil = Math.ceil(
    (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntil < 0) return "overdue";
  if (daysUntil <= 3) return "urgent";
  if (daysUntil <= 7) return "soon";
  return null;
}
