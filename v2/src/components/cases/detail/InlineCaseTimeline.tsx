"use client";

import { useMemo, useRef } from "react";
import { eachMonthOfInterval } from "date-fns";
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
import { Z_INDEX } from "@/lib/timeline/constants";
import { groupMarkers, groupPosition, MIN_MONTH_PX } from "@/lib/timeline/positioning";
import { useScrollToToday } from "@/lib/timeline/useScrollToToday";
import { TimelineHeader } from "@/components/timeline/TimelineHeader";
import { TimelineMilestoneMarker } from "@/components/timeline/TimelineMilestoneMarker";
import { TimelineRangeBar } from "@/components/timeline/TimelineRangeBar";
import { TimelineLegend } from "@/components/timeline/TimelineLegend";
import { TodayIndicator } from "@/components/timeline/TimelineGrid";

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

/** The stage column's width (w-28: "Recruitment" fits whole), which the
 *  Today line is offset by and --tl-label repeats. */
const LABEL_WIDTH = 112;
/** The marker track at the top of each lane (a grouped marker is 22px, with
 *  room for its hover growth), and one band's slot below it. */
const TRACK = 44;
const SLOT = 20;

/** Minimum padding (months) around data so edges don’t sit flush */
const MIN_PAD_MONTHS = 1;
/** Minimum total window size in months (never smaller than this) */
const MIN_WINDOW_MONTHS = 4;


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
  { stage: "pwd", label: "PWD", color: STAGE_COLORS.pwd, textClass: "text-stage-pwd-ink" },
  { stage: "recruitment", label: "Recruitment", color: STAGE_COLORS.recruitment, textClass: "text-stage-recruitment-ink" },
  { stage: "eta9089", label: "ETA 9089", color: STAGE_COLORS.eta9089, textClass: "text-data-warn-ink", relatedStages: ["rfi"] },
  { stage: "i140", label: "I-140", color: STAGE_COLORS.i140, textClass: "text-primary", relatedStages: ["rfe"] },
];


// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Compute a window that fits ALL milestones and range bars, with padding.
 * Falls back to ±3 months around today if there’s no data.
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

  // The window's months, drawn by the timeline page's own header.
  const months = useMemo(
    () => eachMonthOfInterval({ start: windowStart, end: windowEnd }),
    [windowStart, windowEnd]
  );

  // Opens scrolled so today is in view when the case spans more months than
  // fit (before the early return: hooks run on every render).
  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollToToday(scrollRef, windowStart, windowEnd, today);

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
      {/* The timeline page's grid, one case at a time: the same frame, month
          header, square markers, stage bands, Today line and legend (Adam,
          Sep 30 2026: the two "should match"). The lanes are the case's four
          stages, and the stage column sticks while the months scroll under it
          on a phone, exactly as the case column does on the timeline. */}
      <div className="border-2 border-foreground bg-card shadow-hard [--tl-label:112px]">
        <div ref={scrollRef} className="overflow-x-auto overscroll-x-none">
          {/* Every month at least MIN_MONTH_PX wide, as on the timeline page. */}
          <div style={{ minWidth: `calc(var(--tl-label) + ${months.length * MIN_MONTH_PX}px)` }}>
            {/* Header row */}
            <div className="flex">
              <div
                className="sticky left-0 flex h-11 min-h-[44px] w-28 shrink-0 items-center border-r-[3px] border-b-2 border-foreground bg-card px-2 sm:px-3"
                style={{ zIndex: Z_INDEX.stickyLabel + 5 }}
              >
                <span className="text-sm font-bold uppercase tracking-wide text-foreground">
                  Stage
                </span>
              </div>
              <div className="flex-1">
                <TimelineHeader months={months} today={today} />
              </div>
            </div>

            {/* Stage lanes */}
            <div className="relative">
              {rowData.map((row, rowIndex) => {
                // The first band runs through the markers, as on the timeline
                // page; any further bands take a 20px slot each below them.
                const laneHeight = TRACK + Math.max(0, row.rangeBars.length - 1) * SLOT + 8;
                const markerPositions = row.milestones.map((m) =>
                  calculatePosition(m.date, windowStartMs, windowDurationMs)
                );
                const markerGroups = groupMarkers(markerPositions, months.length);
                return (
                  <div
                    key={row.stage}
                    data-stage-lane={row.stage}
                    className={cn(
                      "relative flex border-b border-foreground/20 last:border-b-0",
                      rowIndex % 2 === 0 ? "bg-muted/20" : "bg-transparent"
                    )}
                    style={{ height: `${laneHeight}px` }}
                  >
                    <div
                      className="sticky left-0 flex w-28 shrink-0 items-center border-r-[3px] border-foreground bg-card px-2 sm:px-3"
                      style={{ zIndex: Z_INDEX.stickyLabel }}
                    >
                      <span className={cn("truncate text-sm font-bold", row.textClass)}>
                        {row.label}
                      </span>
                    </div>

                    {/* No z-index here, so the markers and bands stack against
                        the sticky stage column one by one (see Z_INDEX). */}
                    <div className="relative flex-1">
                      <div className="absolute inset-0 flex" aria-hidden="true">
                        {months.map((month) => (
                          <div
                            key={month.toISOString()}
                            className="flex-1 border-r border-foreground/10 last:border-r-0"
                          />
                        ))}
                      </div>

                      {row.rangeBars.map((rangeBar, barIndex) => (
                        <TimelineRangeBar
                          key={`${rangeBar.field}-${rangeBar.startDate}`}
                          rangeBar={rangeBar}
                          startPosition={calculatePosition(rangeBar.startDate, windowStartMs, windowDurationMs)}
                          endPosition={calculatePosition(rangeBar.endDate, windowStartMs, windowDurationMs)}
                          // The first band through the markers; the rest in slots.
                          centerY={
                            barIndex === 0
                              ? TRACK / 2
                              : TRACK + (barIndex - 1) * SLOT + SLOT / 2
                          }
                        />
                      ))}

                      <div className="absolute inset-x-0 top-0" style={{ height: `${TRACK}px` }}>
                        {markerGroups.map((group) => {
                          const [first, ...rest] = group.map((j) => row.milestones[j]!);
                          return (
                            <TimelineMilestoneMarker
                              key={`${first!.field}-${first!.date}`}
                              milestone={first!}
                              position={groupPosition(markerPositions, group)}
                              grouped={rest}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}

              <TodayIndicator
                startDate={windowStart}
                endDate={windowEnd}
                today={today}
                labelWidth={LABEL_WIDTH}
              />
            </div>
          </div>
        </div>

        <TimelineLegend />
      </div>
    </div>
  );
}
