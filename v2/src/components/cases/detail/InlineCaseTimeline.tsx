"use client";

import * as React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import {
  extractMilestones,
  extractRangeBars,
  STAGE_COLORS,
  type CaseWithDates,
  type Stage,
  type Milestone,
  type RangeBar,
} from "@/lib/timeline";
import { TimelineMilestone } from "./TimelineMilestone";
import { TimelineRangeBar } from "./TimelineRangeBar";

// Animation configuration
const springConfig = {
  type: "spring" as const,
  stiffness: 500,
  damping: 30,
};

// ============================================================================
// TYPES
// ============================================================================

export interface InlineCaseTimelineProps {
  /**
   * Case data containing date fields for timeline visualization
   */
  caseData: CaseWithDates;

  /**
   * Additional CSS classes
   */
  className?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MONTHS_BEFORE = 3;
const MONTHS_AFTER = 3;

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/**
 * Gantt chart row configuration - 4 tier layout
 * Each row represents a stage of the PERM process
 * RFI appears in ETA 9089 row (audit happens during ETA 9089)
 * RFE appears in I-140 row (RFE happens during I-140)
 */
const GANTT_ROWS: Array<{
  stage: Stage;
  label: string;
  color: string;
  /** Tailwind classes for text color that work in both light and dark mode */
  textClass: string;
  relatedStages?: Stage[]; // Stages to also include in this row
}> = [
  { stage: "pwd", label: "PWD", color: STAGE_COLORS.pwd, textClass: "text-blue-600 dark:text-blue-400" },
  { stage: "recruitment", label: "Recruitment", color: STAGE_COLORS.recruitment, textClass: "text-purple-600 dark:text-purple-400" },
  { stage: "eta9089", label: "ETA 9089", color: STAGE_COLORS.eta9089, textClass: "text-orange-600 dark:text-orange-400", relatedStages: ["rfi"] },
  { stage: "i140", label: "I-140", color: STAGE_COLORS.i140, textClass: "text-green-600 dark:text-green-400", relatedStages: ["rfe"] },
];

/**
 * Legend items for the timeline
 * Excludes calculated, rfi, rfe stages - shows only main 4 stages
 */
const LEGEND_STAGES: Array<{ stage: Stage; label: string }> = [
  { stage: "pwd", label: "PWD" },
  { stage: "recruitment", label: "Recruitment" },
  { stage: "eta9089", label: "ETA 9089" },
  { stage: "i140", label: "I-140" },
];

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Generate array of month data for the timeline window
 */
function generateMonthHeaders(today: Date): Array<{
  year: number;
  month: number;
  label: string;
  isCurrentMonth: boolean;
}> {
  const months: Array<{
    year: number;
    month: number;
    label: string;
    isCurrentMonth: boolean;
  }> = [];

  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  for (let i = -MONTHS_BEFORE; i < MONTHS_AFTER; i++) {
    const date = new Date(currentYear, currentMonth + i, 1);
    const monthIndex = date.getMonth();
    months.push({
      year: date.getFullYear(),
      month: monthIndex,
      label: MONTH_NAMES[monthIndex] ?? "???",
      isCurrentMonth: i === 0,
    });
  }

  return months;
}

/**
 * Calculate position percentage for a date within the timeline window
 */
function calculatePosition(
  dateStr: string,
  windowStartMs: number,
  windowDurationMs: number
): number {
  const dateMs = new Date(dateStr).getTime();
  const position = ((dateMs - windowStartMs) / windowDurationMs) * 100;
  return position;
}

/**
 * Check if a date is within the visible timeline window
 */
function isDateInWindow(
  dateStr: string,
  windowStartMs: number,
  windowEndMs: number
): boolean {
  const dateMs = new Date(dateStr).getTime();
  return dateMs >= windowStartMs && dateMs <= windowEndMs;
}

/**
 * Filter milestones for a specific row/stage
 */
function getMilestonesForRow(
  milestones: Milestone[],
  stage: Stage,
  relatedStages?: Stage[]
): Milestone[] {
  const stages = [stage, ...(relatedStages ?? [])];
  return milestones.filter((m) => stages.includes(m.stage));
}

/**
 * Filter range bars for a specific row/stage
 */
function getRangeBarsForRow(rangeBars: RangeBar[], stage: Stage): RangeBar[] {
  return rangeBars.filter((rb) => rb.stage === stage);
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * InlineCaseTimeline Component
 *
 * Displays a horizontal timeline visualization of case milestones and date ranges.
 *
 * Features:
 * - 6-month window centered on today (3 months before + 3 months after)
 * - Month headers with current month highlighted
 * - Case milestones as colored dots
 * - Job order period as semi-transparent range bar
 * - Legend showing stage colors
 * - Returns null if case has no dates
 *
 * @example
 * ```tsx
 * <InlineCaseTimeline caseData={caseData} />
 * ```
 */
export function InlineCaseTimeline({
  caseData,
  className,
}: InlineCaseTimelineProps) {
  // Get today's date for window calculation
  const today = React.useMemo(() => new Date(), []);

  // Calculate timeline window (3 months before + 3 months after today)
  const { windowStartMs, windowEndMs, windowDurationMs } = React.useMemo(() => {
    const startDate = new Date(
      today.getFullYear(),
      today.getMonth() - MONTHS_BEFORE,
      1
    );
    const endDate = new Date(
      today.getFullYear(),
      today.getMonth() + MONTHS_AFTER,
      0, // Last day of the month before
      23,
      59,
      59,
      999
    );

    return {
      windowStartMs: startDate.getTime(),
      windowEndMs: endDate.getTime(),
      windowDurationMs: endDate.getTime() - startDate.getTime(),
    };
  }, [today]);

  // Generate month headers
  const monthHeaders = React.useMemo(() => generateMonthHeaders(today), [today]);

  // Extract milestones and range bars from case data
  const milestones = React.useMemo(
    () => extractMilestones(caseData),
    [caseData]
  );
  const rangeBars = React.useMemo(
    () => extractRangeBars(caseData),
    [caseData]
  );

  // Filter to only milestones visible in the window
  const visibleMilestones = React.useMemo(
    () =>
      milestones.filter((m) =>
        isDateInWindow(m.date, windowStartMs, windowEndMs)
      ),
    [milestones, windowStartMs, windowEndMs]
  );

  // Filter range bars that overlap with the window
  const visibleRangeBars = React.useMemo(
    () =>
      rangeBars.filter((rb) => {
        const startMs = new Date(rb.startDate).getTime();
        const endMs = new Date(rb.endDate).getTime();
        // Range overlaps if start is before window end AND end is after window start
        return startMs <= windowEndMs && endMs >= windowStartMs;
      }),
    [rangeBars, windowStartMs, windowEndMs]
  );

  // Calculate today's position for the marker
  const todayPosition = React.useMemo(() => {
    const todayStr = today.toISOString().split("T")[0] ?? "";
    return calculatePosition(todayStr, windowStartMs, windowDurationMs);
  }, [today, windowStartMs, windowDurationMs]);

  // Return null if no data to display
  if (visibleMilestones.length === 0 && visibleRangeBars.length === 0) {
    return null;
  }

  return (
    <div className={cn("w-full", className)}>
      {/* 4-Tier Gantt Chart Layout */}
      <div className="flex">
        {/* Row Labels - Left side */}
        <div className="flex flex-col shrink-0 w-20 sm:w-24">
          {/* Empty space for month headers */}
          <div className="h-8 border-b-2 border-border" />
          {/* Stage labels */}
          {GANTT_ROWS.map((row) => (
            <div
              key={row.stage}
              className="h-12 flex items-center justify-start pl-1 sm:pl-2 border-b border-border last:border-b-0"
            >
              <span
                className={cn("text-xs font-semibold truncate", row.textClass)}
              >
                {row.label}
              </span>
            </div>
          ))}
        </div>

        {/* Timeline Grid - Right side */}
        {/* overflow-visible allows dots and tooltips to escape container boundaries */}
        <div className="flex-1 relative overflow-visible">
          {/* Month headers */}
          <div className="flex border-b-2 border-border h-8">
            {monthHeaders.map((month, index) => (
              <div
                key={`${month.year}-${month.month}`}
                className={cn(
                  "flex-1 flex items-center justify-center text-xs font-medium",
                  "border-r border-border last:border-r-0",
                  month.isCurrentMonth
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-muted-foreground"
                )}
              >
                {month.label}
                {/* Show year for first month or January */}
                {(index === 0 || month.month === 0) && (
                  <span className="ml-1 text-[10px] opacity-60">
                    {month.year.toString().slice(-2)}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Gantt Rows Container - contains today marker and rows */}
          <div className="relative">
            {/* Today marker - spans only the Gantt rows, not headers */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-destructive z-20 pointer-events-none"
              style={{ left: `${todayPosition}%` }}
              title="Today"
            />
            {/* Today label - positioned at top of Gantt rows */}
            <div
              className="absolute top-0 z-30 pointer-events-none -translate-y-1/2"
              style={{ left: `${todayPosition}%`, transform: `translateX(-50%) translateY(-50%)` }}
            >
              <span className="text-[10px] font-bold text-destructive bg-background px-1.5 py-0.5 rounded-full whitespace-nowrap border-2 border-destructive shadow-sm">
                Today
              </span>
            </div>

            {/* Gantt Rows - 4 tiers */}
          {GANTT_ROWS.map((row, rowIndex) => {
            const rowMilestones = getMilestonesForRow(
              visibleMilestones,
              row.stage,
              row.relatedStages
            );
            const rowRangeBars = getRangeBarsForRow(visibleRangeBars, row.stage);

            return (
              <div
                key={row.stage}
                className={cn(
                  "relative h-12 border-b border-border last:border-b-0",
                  "bg-muted/20",
                  rowIndex % 2 === 1 && "bg-muted/30"
                )}
              >
                {/* Range bars for this row */}
                {rowRangeBars.map((rangeBar, index) => {
                  const startPos = calculatePosition(
                    rangeBar.startDate,
                    windowStartMs,
                    windowDurationMs
                  );
                  const endPos = calculatePosition(
                    rangeBar.endDate,
                    windowStartMs,
                    windowDurationMs
                  );

                  return (
                    <motion.div
                      key={`${rangeBar.field}-${rangeBar.startDate}`}
                      initial={{ scaleX: 0, opacity: 0 }}
                      animate={{ scaleX: 1, opacity: 1 }}
                      transition={{
                        ...springConfig,
                        delay: rowIndex * 0.05 + index * 0.02,
                      }}
                      style={{ originX: 0 }}
                    >
                      <TimelineRangeBar
                        rangeBar={rangeBar}
                        startPosition={Math.max(0, startPos)}
                        endPosition={Math.min(100, endPos)}
                      />
                    </motion.div>
                  );
                })}

                {/* Milestones for this row */}
                {rowMilestones.map((milestone, index) => {
                  const position = calculatePosition(
                    milestone.date,
                    windowStartMs,
                    windowDurationMs
                  );

                  return (
                    <motion.div
                      key={`${milestone.field}-${milestone.date}`}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{
                        ...springConfig,
                        delay: 0.1 + rowIndex * 0.05 + index * 0.03,
                      }}
                    >
                      <TimelineMilestone
                        milestone={milestone}
                        position={position}
                      />
                    </motion.div>
                  );
                })}
              </div>
            );
          })}
          </div>
        </div>
      </div>

      {/* Legend - 2 columns on mobile, flex on larger */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3 text-sm sm:flex sm:flex-wrap sm:gap-4">
        {LEGEND_STAGES.map(({ stage, label }) => (
          <div key={stage} className="flex items-center gap-1.5 min-h-[28px]">
            <div
              className="w-4 h-4 shrink-0 rounded-full border-2 border-foreground"
              style={{ backgroundColor: STAGE_COLORS[stage] }}
            />
            <span className="text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
