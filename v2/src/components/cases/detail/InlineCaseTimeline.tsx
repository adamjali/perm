"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { formatISODate } from "@/lib/utils/date";
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

/** Minimum padding (months) around data so edges don't sit flush */
const MIN_PAD_MONTHS = 1;
/** Minimum total window size in months (never smaller than this) */
const MIN_WINDOW_MONTHS = 4;

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
function generateMonthHeaders(
  startDate: Date,
  endDate: Date,
  today: Date
): Array<{
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

  // Iterate from start month to end month
  const d = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  while (d <= endDate) {
    const monthIndex = d.getMonth();
    months.push({
      year: d.getFullYear(),
      month: monthIndex,
      label: MONTH_NAMES[monthIndex] ?? "???",
      isCurrentMonth:
        d.getFullYear() === currentYear && monthIndex === currentMonth,
    });
    d.setMonth(d.getMonth() + 1);
  }

  return months;
}

/**
 * Compute a window that fits ALL milestones and range bars, with padding.
 * Falls back to ±3 months around today if there's no data.
 */
function computeAutoWindow(
  milestones: Milestone[],
  rangeBars: RangeBar[],
  today: Date
): { startDate: Date; endDate: Date } {
  // Collect every date timestamp from milestones and range bars
  const timestamps: number[] = [];
  for (const m of milestones) {
    timestamps.push(new Date(m.date).getTime());
  }
  for (const rb of rangeBars) {
    timestamps.push(new Date(rb.startDate).getTime());
    timestamps.push(new Date(rb.endDate).getTime());
  }
  // Always include today so the "Today" marker is visible
  timestamps.push(today.getTime());

  if (timestamps.length === 0) {
    // Fallback: 3 months before/after today
    return {
      startDate: new Date(today.getFullYear(), today.getMonth() - 3, 1),
      endDate: new Date(today.getFullYear(), today.getMonth() + 3, 0, 23, 59, 59, 999),
    };
  }

  const minTs = Math.min(...timestamps);
  const maxTs = Math.max(...timestamps);
  const minDate = new Date(minTs);
  const maxDate = new Date(maxTs);

  // Expand to start-of-month / end-of-month, then add padding
  let startMonth = minDate.getMonth() - MIN_PAD_MONTHS;
  let startYear = minDate.getFullYear();
  let endMonth = maxDate.getMonth() + MIN_PAD_MONTHS;
  let endYear = maxDate.getFullYear();

  // Normalize overflow
  while (startMonth < 0) {
    startMonth += 12;
    startYear -= 1;
  }
  while (endMonth > 11) {
    endMonth -= 12;
    endYear += 1;
  }

  // Ensure minimum window size
  const totalMonths =
    (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
  if (totalMonths < MIN_WINDOW_MONTHS) {
    const deficit = MIN_WINDOW_MONTHS - totalMonths;
    const addBefore = Math.ceil(deficit / 2);
    const addAfter = deficit - addBefore;
    startMonth -= addBefore;
    endMonth += addAfter;
    // Re-normalize
    while (startMonth < 0) {
      startMonth += 12;
      startYear -= 1;
    }
    while (endMonth > 11) {
      endMonth -= 12;
      endYear += 1;
    }
  }

  return {
    startDate: new Date(startYear, startMonth, 1),
    endDate: new Date(endYear, endMonth + 1, 0, 23, 59, 59, 999),
  };
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
 * Filter range bars for a specific row/stage (includes relatedStages)
 */
function getRangeBarsForRow(
  rangeBars: RangeBar[],
  stage: Stage,
  relatedStages?: Stage[]
): RangeBar[] {
  const stages = [stage, ...(relatedStages || [])];
  return rangeBars.filter((rb) => stages.includes(rb.stage));
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
 * - Auto-fit window that spans the full date range of the case
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
  const today = useMemo(() => new Date(), []);

  // Extract milestones and range bars from case data
  const milestones = useMemo(
    () => extractMilestones(caseData),
    [caseData]
  );
  const rangeBars = useMemo(
    () => extractRangeBars(caseData),
    [caseData]
  );

  // Auto-fit window to include ALL milestones and range bars
  const { windowStartMs, windowDurationMs, windowStart, windowEnd } = useMemo(() => {
    const { startDate, endDate } = computeAutoWindow(milestones, rangeBars, today);
    return {
      windowStartMs: startDate.getTime(),
      windowDurationMs: endDate.getTime() - startDate.getTime(),
      windowStart: startDate,
      windowEnd: endDate,
    };
  }, [milestones, rangeBars, today]);

  // Generate month headers from the auto-fit window
  const monthHeaders = useMemo(
    () => generateMonthHeaders(windowStart, windowEnd, today),
    [windowStart, windowEnd, today]
  );

  // Calculate today's position for the marker
  const todayPosition = useMemo(() => {
    const todayStr = today.toISOString().split("T")[0] || "";
    return calculatePosition(todayStr, windowStartMs, windowDurationMs);
  }, [today, windowStartMs, windowDurationMs]);

  // Return null if no data to display
  if (milestones.length === 0 && rangeBars.length === 0) {
    return null;
  }

  // Pre-compute row data for dynamic heights
  const rowData = GANTT_ROWS.map((row) => {
    const rowMilestones = getMilestonesForRow(milestones, row.stage, row.relatedStages);
    const rowRangeBars = getRangeBarsForRow(rangeBars, row.stage, row.relatedStages);
    return { ...row, milestones: rowMilestones, rangeBars: rowRangeBars };
  });

  return (
    <div className={cn("w-full", className)}>
      {/* 4-Tier Gantt Chart Layout */}
      <div className="flex">
        {/* Row Labels - Left side */}
        <div className="flex flex-col shrink-0 w-20 sm:w-24">
          {/* Empty space for month headers */}
          <div className="h-8 border-b-2 border-border" />
          {/* Stage labels - height matches dynamic row content */}
          {rowData.map((row) => {
            // Row height: 20px milestone track + 24px per range bar + 8px padding
            const barCount = Math.max(row.rangeBars.length, 0);
            const rowHeight = 20 + barCount * 24 + 8;
            return (
              <div
                key={row.stage}
                className="flex items-center justify-start pl-1 sm:pl-2 border-b border-border last:border-b-0"
                style={{ height: `${Math.max(rowHeight, 40)}px` }}
              >
                <span className={cn("text-xs font-bold truncate", row.textClass)}>
                  {row.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Timeline Grid - Right side */}
        <div className="flex-1 relative overflow-visible">
          {/* Month headers */}
          <div className="flex border-b-2 border-border h-8">
            {monthHeaders.map((month, index) => (
              <div
                key={`${month.year}-${month.month}`}
                className={cn(
                  "flex-1 flex items-center justify-center text-xs font-medium",
                  "border-r border-border/20 last:border-r-0",
                  month.isCurrentMonth
                    ? "bg-foreground/8 text-foreground font-bold"
                    : "text-muted-foreground"
                )}
              >
                {month.label}
                {(index === 0 || month.month === 0) && (
                  <span className="ml-1 text-[10px] opacity-50">
                    {month.year.toString().slice(-2)}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Gantt Rows Container */}
          <div className="relative">
            {/* Today marker line */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-destructive/80 z-20 pointer-events-none"
              style={{ left: `${todayPosition}%` }}
              aria-hidden="true"
            />
            {/* Today label */}
            <div
              className="absolute top-0 z-30 pointer-events-none"
              style={{ left: `${todayPosition}%`, transform: "translateX(-50%) translateY(-50%)" }}
              aria-hidden="true"
            >
              <span className="text-[9px] font-bold text-destructive bg-background px-1.5 py-0.5 rounded-full whitespace-nowrap border-2 border-destructive shadow-sm">
                Today
              </span>
            </div>

            {/* Gantt Rows - 4 tiers with dynamic height */}
            {rowData.map((row, rowIndex) => {
              const barCount = Math.max(row.rangeBars.length, 0);
              const rowHeight = 20 + barCount * 24 + 8;

              return (
                <div
                  key={row.stage}
                  className={cn(
                    "relative border-b border-border last:border-b-0",
                    rowIndex % 2 === 0 ? "bg-muted/10" : "bg-muted/20"
                  )}
                  style={{ height: `${Math.max(rowHeight, 40)}px` }}
                >
                  {/* Vertical month grid lines */}
                  <div className="absolute inset-0 flex pointer-events-none" aria-hidden="true">
                    {monthHeaders.map((month) => (
                      <div
                        key={`grid-${month.year}-${month.month}`}
                        className="flex-1 border-r border-border/20 last:border-r-0"
                      />
                    ))}
                  </div>

                  {/* Range bars — stacked vertically, each 20px tall with 4px gap */}
                  {row.rangeBars.map((rangeBar, barIndex) => {
                    const startPos = calculatePosition(rangeBar.startDate, windowStartMs, windowDurationMs);
                    const endPos = calculatePosition(rangeBar.endDate, windowStartMs, windowDurationMs);
                    const clampedStart = Math.max(0, Math.min(100, startPos));
                    const clampedEnd = Math.max(0, Math.min(100, endPos));
                    const width = Math.max(0, clampedEnd - clampedStart);
                    // Stack below milestone track (top 20px reserved for dots)
                    const topOffset = 20 + barIndex * 24;

                    if (width <= 0) return null;

                    return (
                      <motion.div
                        key={`${rangeBar.field}-${rangeBar.startDate}`}
                        className="absolute group cursor-pointer z-10 hover:z-[100]"
                        style={{
                          left: `${clampedStart}%`,
                          width: `${width}%`,
                          top: `${topOffset}px`,
                          height: "20px",
                        }}
                        initial={false}
                        animate={{ scaleX: 1, opacity: 1 }}
                        transition={{
                          ...springConfig,
                          delay: rowIndex * 0.04 + barIndex * 0.02,
                        }}
                        aria-label={`${rangeBar.label}: ${rangeBar.startDate} to ${rangeBar.endDate}`}
                      >
                        {/* Bar background */}
                        <div
                          className={cn(
                            "absolute inset-0 rounded-sm",
                            "border border-current/20",
                            "transition-all duration-150",
                            "group-hover:brightness-110 group-hover:shadow-sm",
                            rangeBar.isCalculated && "border-dashed"
                          )}
                          style={{
                            backgroundColor: `${rangeBar.color}30`,
                            borderColor: `${rangeBar.color}60`,
                            color: rangeBar.color,
                          }}
                        />
                        {/* Left edge accent */}
                        <div
                          className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-sm"
                          style={{ backgroundColor: rangeBar.color }}
                        />
                        {/* Label — inside if bar is wide enough, outside with line if too narrow */}
                        {width > 8 ? (
                          <span
                            className="absolute inset-0 flex items-center pl-2 pr-1 text-[10px] font-semibold pointer-events-none overflow-hidden text-ellipsis whitespace-nowrap"
                            style={{ color: rangeBar.color }}
                          >
                            {rangeBar.label}
                          </span>
                        ) : (
                          <span
                            className="absolute flex items-center text-[10px] font-semibold pointer-events-none whitespace-nowrap"
                            style={{
                              left: "100%",
                              top: "50%",
                              transform: "translateY(-50%)",
                              color: rangeBar.color,
                            }}
                          >
                            <span
                              style={{
                                display: "inline-block",
                                width: 8,
                                height: 2,
                                background: rangeBar.color,
                                opacity: 0.5,
                                flexShrink: 0,
                              }}
                            />
                            <span style={{ marginLeft: 2 }}>{rangeBar.label}</span>
                          </span>
                        )}
                        {/* Hover tooltip */}
                        <div
                          className={cn(
                            "absolute bottom-full mb-2 left-1/2 -translate-x-1/2",
                            "px-2.5 py-1.5 bg-foreground text-background text-xs font-medium",
                            "whitespace-nowrap rounded-lg shadow-xl",
                            "opacity-0 group-hover:opacity-100",
                            "transition-opacity duration-150",
                            "pointer-events-none z-50"
                          )}
                          aria-hidden="true"
                        >
                          <span className="font-bold">{rangeBar.label}</span>
                          <span className="mx-1.5 opacity-40">|</span>
                          {formatISODate(rangeBar.startDate)} to {formatISODate(rangeBar.endDate)}
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-foreground" />
                        </div>
                      </motion.div>
                    );
                  })}

                  {/* Milestones — on the top milestone track (h-5 = 20px) */}
                  <div className="absolute inset-x-0 top-0 h-5">
                    {row.milestones.map((milestone, index) => {
                      const position = calculatePosition(milestone.date, windowStartMs, windowDurationMs);

                      return (
                        <motion.div
                          key={`${milestone.field}-${milestone.date}`}
                          initial={false}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{
                            ...springConfig,
                            delay: 0.08 + rowIndex * 0.04 + index * 0.02,
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
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3">
        {LEGEND_STAGES.map(({ stage, label }) => (
          <div key={stage} className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 shrink-0 rounded-full border-2 border-foreground"
              style={{ backgroundColor: STAGE_COLORS[stage] }}
            />
            <span className="text-xs text-muted-foreground font-medium">{label}</span>
          </div>
        ))}
        {/* Range bar legend item */}
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-2.5 rounded-sm bg-muted-foreground/20 border border-muted-foreground/40" />
          <span className="text-xs text-muted-foreground font-medium">Date Range</span>
        </div>
        {/* Calculated legend item */}
        <div className="flex items-center gap-1.5">
          <div
            className="w-3 h-3 shrink-0 rounded-full border-2 border-dashed border-foreground"
          />
          <span className="text-xs text-muted-foreground font-medium">Calculated</span>
        </div>
      </div>
    </div>
  );
}
