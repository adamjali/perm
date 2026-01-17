/**
 * TimelineRow Component
 * Individual case row in the timeline grid.
 *
 * Features:
 * - Sticky left sidebar with employer name + position title (truncated)
 * - Scrollable right section with timeline bars
 * - Milestone markers and range bars
 * - Hover effect with primary color tint
 * - Responsive sidebar widths
 * - Click on case name to navigate to detail page
 * - Click on row to filter to single case
 * - Dynamic row height support
 *
 * Phase: 24 (Timeline Visualization)
 * Created: 2025-12-26
 * Updated: 2025-12-27 - Added click handlers and dynamic height
 */

"use client";

import { parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { extractMilestones, extractRangeBars } from "@/lib/timeline/milestones";
import { calculatePosition, calculateRangePosition } from "@/lib/timeline/positioning";
import { SIDEBAR_WIDTH_CLASSES } from "@/lib/timeline/constants";
import type { Milestone, RangeBar, CaseWithDates } from "@/lib/timeline/types";
import type { Id } from "../../../convex/_generated/dataModel";
import { TimelineMilestoneMarker } from "./TimelineMilestoneMarker";
import { TimelineRangeBar } from "./TimelineRangeBar";

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

interface TimelineRowProps {
  caseData: TimelineCaseData;
  startDate: Date;
  endDate: Date;
  months: Date[];
  isEven: boolean;
  /** Dynamic row height (48-80px) */
  rowHeight?: number;
  /** Callback when case name is clicked (navigate to detail) */
  onCaseNameClick?: (caseId: string) => void;
  /** Callback when row is clicked (filter to single case) */
  onRowClick?: (caseId: string) => void;
  /** Callback when a milestone is clicked for navigation */
  onNavigate?: (caseId: string) => void;
}

// ============================================================================
// Main Component
// ============================================================================

export function TimelineRow({
  caseData,
  startDate,
  endDate,
  months,
  isEven,
  rowHeight = 48,
  onCaseNameClick,
  onRowClick,
  onNavigate,
}: TimelineRowProps) {
  // Handle click on case name (navigate to detail)
  const handleCaseNameClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click
    if (onCaseNameClick) {
      onCaseNameClick(caseData.id);
    }
  };

  // Handle click on row (filter to single case)
  const handleRowClick = () => {
    if (onRowClick) {
      onRowClick(caseData.id);
    }
  };

  // Convert case data to CaseWithDates format for milestone extraction
  const caseWithDates: CaseWithDates = {
    pwdFilingDate: caseData.pwdFilingDate,
    pwdDeterminationDate: caseData.pwdDeterminationDate,
    pwdExpirationDate: caseData.pwdExpirationDate,
    sundayAdFirstDate: caseData.sundayAdFirstDate,
    sundayAdSecondDate: caseData.sundayAdSecondDate,
    jobOrderStartDate: caseData.jobOrderStartDate,
    jobOrderEndDate: caseData.jobOrderEndDate,
    eta9089FilingDate: caseData.eta9089FilingDate,
    eta9089CertificationDate: caseData.eta9089CertificationDate,
    eta9089ExpirationDate: caseData.eta9089ExpirationDate,
    i140FilingDate: caseData.i140FilingDate,
    i140ApprovalDate: caseData.i140ApprovalDate,
    rfiEntries: caseData.rfiEntries,
    rfeEntries: caseData.rfeEntries,
  };

  // Extract milestones and range bars
  const milestones = extractMilestones(caseWithDates);
  const rangeBars = extractRangeBars(caseWithDates);

  // Calculate visible milestones with positions
  const visibleMilestones = milestones
    .map((milestone) => {
      const date = parseISO(milestone.date);
      const position = calculatePosition(date, startDate, endDate);
      return { milestone, position };
    })
    .filter(
      (item): item is { milestone: Milestone; position: number } =>
        item.position !== null
    );

  // Calculate visible range bars with positions
  const visibleRangeBars = rangeBars
    .map((rangeBar) => {
      const start = parseISO(rangeBar.startDate);
      const end = parseISO(rangeBar.endDate);
      const positions = calculateRangePosition(start, end, startDate, endDate);

      if (!positions) return null;

      return { rangeBar, ...positions };
    })
    .filter(
      (
        item
      ): item is {
        rangeBar: RangeBar;
        startPosition: number;
        endPosition: number;
      } => item !== null
    );

  // Compute row height style
  const heightStyle = { height: `${rowHeight}px`, minHeight: `${rowHeight}px` };

  return (
    <div
      className={cn(
        // Dynamic height based on rowHeight prop
        "flex relative",
        "border-b border-foreground/20",
        "group transition-colors duration-150",
        "hover:bg-primary/5",
        // Alternating row background
        isEven ? "bg-muted/20" : "bg-transparent",
        // Cursor pointer when row click is enabled
        onRowClick && "cursor-pointer"
      )}
      style={heightStyle}
      role="row"
      onClick={handleRowClick}
      data-testid={`timeline-row-${caseData.id}`}
    >
      {/* Sticky Sidebar - Case Label */}
      <div
        className={cn(
          "sticky left-0 z-20",
          "flex flex-col justify-center px-3",
          "bg-card border-r-[3px] border-foreground",
          SIDEBAR_WIDTH_CLASSES,
          // Match row hover (theme-aware)
          "group-hover:bg-primary/5"
        )}
        role="rowheader"
      >
        {/* Case name - clickable to navigate */}
        <button
          type="button"
          onClick={handleCaseNameClick}
          className={cn(
            "truncate font-semibold text-sm text-foreground leading-tight text-left",
            "hover:text-primary hover:underline transition-colors",
            "cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-sm"
          )}
          data-testid={`timeline-case-name-${caseData.id}`}
        >
          {caseData.employerName}
        </button>
        <div className="truncate text-xs text-muted-foreground leading-tight">
          {caseData.positionTitle}
        </div>
      </div>

      {/* Timeline Content Area */}
      <div className="flex-1 relative">
        {/* Month grid lines */}
        <div className="absolute inset-0 flex">
          {months.map((month) => (
            <div
              key={month.toISOString()}
              className={cn(
                "flex-1",
                "border-r border-foreground/10 last:border-r-0"
              )}
            />
          ))}
        </div>

        {/* Range Bars Layer */}
        {visibleRangeBars.map((item) => (
          <TimelineRangeBar
            key={`${item.rangeBar.field}-${item.rangeBar.startDate}`}
            rangeBar={item.rangeBar}
            startPosition={item.startPosition}
            endPosition={item.endPosition}
          />
        ))}

        {/* Milestone Markers Layer */}
        {visibleMilestones.map((item) => (
          <TimelineMilestoneMarker
            key={`${item.milestone.field}-${item.milestone.date}`}
            milestone={item.milestone}
            position={item.position}
            caseId={caseData.id}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </div>
  );
}
