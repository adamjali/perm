/**
 * CaseListRow Component
 *
 * Compact row for list view displaying case info.
 * Neobrutalist design with hover lift effect.
 *
 * @module components/cases/CaseListRow
 */

"use client";

import { useCallback, useState, memo } from "react";
import { useNavigationLoading } from "@/hooks/useNavigationLoading";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { ProgressStatusBadge } from "@/components/status/progress-status-badge";
import { CaseStageBadge } from "@/components/status/case-stage-badge";
import { STAGE_VISUALS } from "@/components/status/stage-visuals";
import { deadlineCountdown, formatDeadlineDate } from "./case-card.utils";
import { getUrgencyFromDeadlineExtended } from "@/lib/status/urgency";
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
    isSample,
  } = caseData;

  const { isNavigating, navigateTo } = useNavigationLoading();
  const [isHovered, setIsHovered] = useState(false);

  const stageFill = STAGE_VISUALS[caseStatus]?.fill ?? "bg-muted";

  const handleRowClick = useCallback(
    (e: React.MouseEvent) => {
      // Don’t navigate if clicking checkbox
      if ((e.target as HTMLElement).closest('[role="checkbox"]')) {
        return;
      }
      // In selection mode, toggle selection instead of navigating
      if (selectionMode && onSelect) {
        onSelect(_id);
        return;
      }
      navigateTo(`/cases/${_id}`);
    },
    [_id, navigateTo, selectionMode, onSelect]
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
          navigateTo(`/cases/${_id}`);
        }
      }
    },
    [_id, navigateTo, selectionMode, onSelect]
  );

  // Deadline urgency: canonical thresholds from @/lib/status/urgency.
  const deadlineUrgency = nextDeadline && caseStatus !== "closed" ? getUrgencyFromDeadlineExtended(nextDeadline) : null;
  const countdown = nextDeadline && caseStatus !== "closed" ? deadlineCountdown(nextDeadline) : null;
  const deadlineDate = nextDeadline ? formatDeadlineDate(nextDeadline) : "";
  const late = deadlineUrgency === "overdue";
  const soon = deadlineUrgency === "urgent" || deadlineUrgency === "soon";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.12, delay: index * 0.05 }}
      className={cn(
        "relative",
        isHovered && "z-20"
      )}
    >
      <div
        className={cn(
          // Base row styling
          "relative flex items-center gap-3 px-4 py-3",
          "border-b border-t border-border border-t-transparent bg-background",
          "cursor-pointer select-none",
          // Hover effect
          "transition-all duration-150",
          isHovered && "-translate-y-0.5 shadow-hard-sm border-t-border",
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
        aria-pressed={isSelected}
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

      {/* Stage swatch: the folder tab's colour, square like everything else */}
      <div className={cn("size-3 shrink-0 border-2 border-border", stageFill)} aria-hidden="true" />

      {/* Main content */}
      <div className="flex-1 min-w-0 flex items-center gap-4">
        {/* Employer & Position (and, on phones, what is due next) */}
        <div className="flex-1 min-w-0">
          <div className="font-heading font-bold text-base truncate flex items-center gap-2" title={employerName}>
            <span className="truncate">{employerName}</span>{" "}
            {isSample && (
              <span className="shrink-0 inline-flex items-center px-1.5 py-px text-sm font-semibold border-2 border-dashed border-muted-foreground/50 text-muted-foreground">
                Sample
              </span>
            )}
          </div>{" "}
          <div className="text-sm text-muted-foreground truncate" title={positionTitle}>
            {positionTitle}
          </div>
          {countdown && nextDeadlineLabel && (
            <div className="md:hidden mt-1 text-sm font-semibold truncate">
              <span className={cn("tabular-nums", late ? "text-destructive-text" : soon ? "text-data-warn-ink" : "")}>
                {countdown.value} {countdown.unit}
              </span>{" "}
              <span className="text-muted-foreground font-normal">· {nextDeadlineLabel}</span>
            </div>
          )}
        </div>

        {/* Stage badge */}
        <div className="shrink-0 hidden sm:block">
          <CaseStageBadge stage={caseStatus} bordered />
        </div>

        {/* Next deadline: the number of days leads, then what is due and when */}
        {countdown && (
          <div className="shrink-0 hidden md:flex w-64 items-stretch border-2 border-border bg-card" title={nextDeadlineLabel}>
            <div
              className={cn(
                "flex w-16 shrink-0 flex-col items-center justify-center border-r-2 border-border px-1",
                late ? "bg-data-bad text-black" : soon ? "bg-data-warn text-black" : "bg-foreground text-background",
              )}
            >
              <span className="font-heading text-lg font-black leading-none tabular-nums">{countdown.value}</span>{" "}
              <span className="text-sm font-bold leading-tight">{countdown.unit}</span>
            </div>{" "}
            <div className="flex min-w-0 flex-col justify-center px-2.5 py-1">
              <span className="truncate text-sm font-semibold">{nextDeadlineLabel}</span>{" "}
              <span className="font-mono text-sm text-muted-foreground">{deadlineDate}</span>
            </div>
          </div>
        )}

        {/* Progress status */}
        <div className="shrink-0">
          <ProgressStatusBadge status={progressStatus} className="text-sm" />
        </div>
      </div>
      </div>
    </motion.div>
  );
});

