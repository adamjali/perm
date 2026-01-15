/**
 * TimelineGrid Component
 * Gantt-chart style grid showing case stages across time.
 *
 * Features:
 * - Fixed sticky left sidebar with case labels
 * - Scrollable right section with timeline bars
 * - Month headers row at top
 * - Overflow handling for horizontal scrolling
 * - Responsive design
 * - Staggered row entrance animations
 * - Click-to-navigate on case name
 * - Click-to-filter on row
 * - Dynamic row heights
 *
 * Phase: 24 (Timeline Visualization)
 * Created: 2025-12-26
 * Updated: 2025-12-27 - Added click handlers and dynamic row heights
 */

"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  addMonths,
  eachMonthOfInterval,
} from "date-fns";
import { cn } from "@/lib/utils";
import { SIDEBAR_WIDTH_CLASSES, SIDEBAR_WIDTHS, TIMELINE_ANIMATION } from "@/lib/timeline/constants";
import { TimelineHeader } from "./TimelineHeader";
import { TimelineRow } from "./TimelineRow";
import type { Id } from "../../../convex/_generated/dataModel";

// ============================================================================
// Types
// ============================================================================

interface TimelineRfiRfeEntry {
  id: string;
  title?: string;
  description?: string;
  notes?: string;
  receivedDate: string;
  responseDueDate: string;
  responseSubmittedDate?: string;
  createdAt: number;
}

interface TimelineCaseData {
  id: Id<"cases">;
  employerName: string;
  positionTitle: string;
  caseStatus: "pwd" | "recruitment" | "eta9089" | "i140" | "closed";
  progressStatus:
    | "working"
    | "waiting_intake"
    | "filed"
    | "approved"
    | "under_review"
    | "rfi_rfe";
  // PWD dates
  pwdFilingDate?: string;
  pwdDeterminationDate?: string;
  pwdExpirationDate?: string;
  // Recruitment dates
  jobOrderStartDate?: string;
  jobOrderEndDate?: string;
  sundayAdFirstDate?: string;
  sundayAdSecondDate?: string;
  additionalRecruitmentStartDate?: string;
  additionalRecruitmentEndDate?: string;
  noticeOfFilingStartDate?: string;
  noticeOfFilingEndDate?: string;
  // ETA 9089 dates
  eta9089FilingDate?: string;
  eta9089AuditDate?: string;
  eta9089CertificationDate?: string;
  eta9089ExpirationDate?: string;
  // I-140 dates
  i140FilingDate?: string;
  i140ReceiptDate?: string;
  i140ApprovalDate?: string;
  i140DenialDate?: string;
  // RFI/RFE entries
  rfiEntries: TimelineRfiRfeEntry[];
  rfeEntries: TimelineRfiRfeEntry[];
}

interface TimelineGridProps {
  cases: TimelineCaseData[];
  timeRange: number;
  /** Dynamic row height based on case count (48-80px) */
  rowHeight?: number;
  /** Callback when case name is clicked (navigate to detail) */
  onCaseNameClick?: (caseId: string) => void;
  /** Callback when row is clicked (filter to single case) */
  onRowClick?: (caseId: string) => void;
}

// ============================================================================
// Main Component
// ============================================================================

export function TimelineGrid({
  cases,
  timeRange,
  rowHeight = 48,
  onCaseNameClick,
  onRowClick,
}: TimelineGridProps) {
  // Calculate date range centered around current month
  const { startDate, endDate, months, today } = useMemo(() => {
    const now = new Date();
    const todayDate = now;

    // Center the view: half the range before today, half after
    const halfRange = Math.floor(timeRange / 2);
    const start = startOfMonth(subMonths(now, halfRange));
    const end = endOfMonth(addMonths(start, timeRange - 1));

    // Generate array of month start dates
    const monthArray = eachMonthOfInterval({ start, end });

    return {
      startDate: start,
      endDate: end,
      months: monthArray,
      today: todayDate,
    };
  }, [timeRange]);

  // Empty state
  if (cases.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center",
          "min-h-[200px] p-8",
          "bg-muted/30 border-2 border-dashed border-foreground/20 rounded-none"
        )}
      >
        <div className="text-center">
          <p className="text-lg font-medium text-muted-foreground">
            No cases to display
          </p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Select cases using the filter to view their timeline
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "border-2 border-foreground",
        "bg-card shadow-hard",
        "overflow-hidden"
      )}
      role="grid"
      aria-label={`Timeline showing ${cases.length} cases over ${timeRange} months`}
    >
      {/* Scrollable container */}
      <div className="overflow-x-auto">
        {/* Minimum width to prevent squishing on small screens */}
        <div className="min-w-[600px]">
          {/* Header Row */}
          <div className="flex sticky top-0 z-30 bg-card">
            {/* Sidebar Header - minimum 44px height for touch targets */}
            <div
              className={cn(
                "sticky left-0 z-40",
                "flex items-center px-2 sm:px-3",
                "bg-card border-r-[3px] border-b-2 border-foreground",
                "h-11 min-h-[44px]",
                SIDEBAR_WIDTH_CLASSES
              )}
            >
              <span className="text-sm font-bold text-foreground uppercase tracking-wide">
                Case
              </span>
            </div>

            {/* Month Headers */}
            <div className="flex-1">
              <TimelineHeader months={months} today={today} />
            </div>
          </div>

          {/* Case Rows - with staggered entrance animation */}
          <div role="rowgroup" className="relative">
            {cases.map((caseData, index) => (
              <motion.div
                key={caseData.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  ...TIMELINE_ANIMATION.spring,
                  delay: index * TIMELINE_ANIMATION.staggerDelay,
                }}
              >
                <TimelineRow
                  caseData={caseData}
                  startDate={startDate}
                  endDate={endDate}
                  months={months}
                  isEven={index % 2 === 0}
                  rowHeight={rowHeight}
                  onCaseNameClick={onCaseNameClick}
                  onRowClick={onRowClick}
                />
              </motion.div>
            ))}

            {/* Today indicator line - positioned within the row group */}
            <TodayIndicator startDate={startDate} endDate={endDate} today={today} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Today Indicator Component
// ============================================================================

interface TodayIndicatorProps {
  startDate: Date;
  endDate: Date;
  today: Date;
}

function TodayIndicator({ startDate, endDate, today }: TodayIndicatorProps) {
  // Calculate position as percentage within the timeline area
  if (today < startDate || today > endDate) {
    return null;
  }

  const totalMs = endDate.getTime() - startDate.getTime();
  const todayMs = today.getTime() - startDate.getTime();
  const positionPercent = (todayMs / totalMs) * 100;

  const createIndicatorStyle = (sidebarWidth: number) => ({
    left: `calc(${sidebarWidth}px + (100% - ${sidebarWidth}px) * ${positionPercent / 100})`,
  });

  const labelBaseClasses = "text-[10px] font-bold text-destructive bg-background px-1.5 py-0.5 rounded-full whitespace-nowrap border-2 border-destructive shadow-sm";

  return (
    <>
      {/* Responsive indicators for each breakpoint */}
      {[
        { width: SIDEBAR_WIDTHS.mobile, className: "sm:hidden" },
        { width: SIDEBAR_WIDTHS.tablet, className: "hidden sm:block md:hidden" },
        { width: SIDEBAR_WIDTHS.desktop, className: "hidden md:block" },
      ].map(({ width, className }, i) => (
        <div key={i}>
          <div
            className={`absolute top-0 bottom-0 w-0.5 bg-destructive pointer-events-none z-20 ${className}`}
            style={createIndicatorStyle(width)}
            aria-hidden="true"
          />
          <div
            className={`absolute z-30 pointer-events-none -top-3 ${className}`}
            style={{ ...createIndicatorStyle(width), transform: "translateX(-50%)" }}
          >
            <span className={labelBaseClasses}>Today</span>
          </div>
        </div>
      ))}
    </>
  );
}

// Re-export types for consumers
export type { TimelineCaseData, TimelineRfiRfeEntry };
