"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { CaseWithDates } from "@/lib/timeline";
import { isRecruitmentComplete } from "@/lib/perm";

// ============================================================================
// TYPES
// ============================================================================

export interface WindowsDisplayProps {
  /**
   * Case data containing date fields for window calculations
   */
  caseData: CaseWithDates;

  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * Status types for recruitment window
 */
type RecruitmentWindowStatus = "ACTIVE" | "COMPLETED" | "EXPIRED" | "NOT_STARTED";

/**
 * Status types for ETA 9089 filing window
 */
type FilingWindowStatus =
  | "OPEN"
  | "OPENING_SOON"
  | "CLOSING_SOON"
  | "CLOSED"
  | "FILED"
  | "NOT_AVAILABLE";

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate the number of days between two dates
 */
function daysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round((date2.getTime() - date1.getTime()) / oneDay);
}

/**
 * Format date as "MMM d, yyyy"
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Parse an ISO date string to a Date object at start of day
 */
function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year!, month! - 1, day);
}

/**
 * Add days to a date string and return new ISO date string
 */
function addDays(dateStr: string, days: number): string {
  const date = parseDate(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0]!;
}

// ============================================================================
// CALCULATION FUNCTIONS
// ============================================================================

interface RecruitmentWindowResult {
  status: RecruitmentWindowStatus;
  startDate: string | null;
  endDate: string | null;
  daysRemaining: number | null;
  daysElapsed: number | null;
}

/**
 * Calculate recruitment window dates and status
 *
 * - Start: First recruitment activity date (sundayAdFirstDate or jobOrderStartDate, whichever is earlier)
 * - End: 180 days after start
 * - Status:
 *   - "COMPLETED" (blue) - all required recruitment steps finished
 *   - "ACTIVE" (green) - currently within window, still in progress
 *   - "EXPIRED" (red) - past end date without completion
 *   - "NOT_STARTED" (gray) - no recruitment dates
 */
function calculateRecruitmentWindow(caseData: CaseWithDates): RecruitmentWindowResult {
  // Get first recruitment activity date
  const recruitmentDates: string[] = [];

  if (caseData.sundayAdFirstDate) {
    recruitmentDates.push(caseData.sundayAdFirstDate);
  }
  if (caseData.jobOrderStartDate) {
    recruitmentDates.push(caseData.jobOrderStartDate);
  }

  // No recruitment dates - not started
  if (recruitmentDates.length === 0) {
    return {
      status: "NOT_STARTED",
      startDate: null,
      endDate: null,
      daysRemaining: null,
      daysElapsed: null,
    };
  }

  // Get earliest date as start
  const startDate = recruitmentDates.sort()[0]!;

  // End date is 180 days after start
  const endDate = addDays(startDate, 180);

  // Check if recruitment is complete (all steps done)
  // Convert null to undefined for compatibility with RecruitmentCheckInput
  if (isRecruitmentComplete({
    ...caseData,
    additionalRecruitmentMethods: caseData.additionalRecruitmentMethods ?? undefined,
  })) {
    return {
      status: "COMPLETED",
      startDate,
      endDate,
      daysRemaining: null,
      daysElapsed: null,
    };
  }

  // Calculate status based on current date
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const endDateObj = parseDate(endDate);

  // Check if expired (past end date without completion)
  if (today > endDateObj) {
    return {
      status: "EXPIRED",
      startDate,
      endDate,
      daysRemaining: null,
      daysElapsed: daysBetween(endDateObj, today),
    };
  }

  // Currently active (in progress)
  return {
    status: "ACTIVE",
    startDate,
    endDate,
    daysRemaining: daysBetween(today, endDateObj),
    daysElapsed: null,
  };
}

interface FilingWindowResult {
  status: FilingWindowStatus;
  opensDate: string | null;
  closesDate: string | null;
  daysUntilOpen: number | null;
  daysRemaining: number | null;
  daysElapsed: number | null;
}

/**
 * Calculate ETA 9089 filing window dates and status
 *
 * - Opens: 30 days after last recruitment activity (sundayAdSecondDate or jobOrderEndDate, whichever is later)
 * - Closes: PWD expiration date OR 180 days from first recruitment, whichever is earlier
 * - Status:
 *   - "OPEN" (green) - within filing window
 *   - "OPENING_SOON" (yellow) - within 7 days of opening
 *   - "CLOSING_SOON" (orange) - within 14 days of closing
 *   - "CLOSED" (red) - past closing date
 *   - "FILED" (blue) - already filed (eta9089FilingDate exists)
 *   - "NOT_AVAILABLE" (gray) - can't calculate (missing required dates)
 */
function calculateFilingWindow(caseData: CaseWithDates): FilingWindowResult {
  const isFiled = !!caseData.eta9089FilingDate;

  // Get last recruitment activity date
  const recruitmentEndDates: string[] = [];

  if (caseData.sundayAdSecondDate) {
    recruitmentEndDates.push(caseData.sundayAdSecondDate);
  }
  if (caseData.jobOrderEndDate) {
    recruitmentEndDates.push(caseData.jobOrderEndDate);
  }

  // Can't calculate without end dates
  if (recruitmentEndDates.length === 0) {
    return {
      status: isFiled ? "FILED" : "NOT_AVAILABLE",
      opensDate: null,
      closesDate: null,
      daysUntilOpen: null,
      daysRemaining: null,
      daysElapsed: null,
    };
  }

  // Get latest date as last recruitment
  const lastRecruitmentDate = recruitmentEndDates.sort().pop()!;

  // Window opens 30 days after last recruitment
  const opensDate = addDays(lastRecruitmentDate, 30);

  // Calculate close date (PWD expiration or 180 days from first recruitment, whichever is earlier)
  let closesDate: string | null = null;

  // Get first recruitment start date for 180-day calculation
  const recruitmentStartDates: string[] = [];
  if (caseData.sundayAdFirstDate) {
    recruitmentStartDates.push(caseData.sundayAdFirstDate);
  }
  if (caseData.jobOrderStartDate) {
    recruitmentStartDates.push(caseData.jobOrderStartDate);
  }

  const firstRecruitmentDate = recruitmentStartDates.length > 0
    ? recruitmentStartDates.sort()[0]!
    : null;

  const closeDateFrom180 = firstRecruitmentDate
    ? addDays(firstRecruitmentDate, 180)
    : null;

  // Use PWD expiration if available
  if (caseData.pwdExpirationDate && closeDateFrom180) {
    // Take earlier of the two
    closesDate = caseData.pwdExpirationDate < closeDateFrom180
      ? caseData.pwdExpirationDate
      : closeDateFrom180;
  } else if (caseData.pwdExpirationDate) {
    closesDate = caseData.pwdExpirationDate;
  } else if (closeDateFrom180) {
    closesDate = closeDateFrom180;
  }

  // Can't calculate without close date
  if (!closesDate) {
    return {
      status: isFiled ? "FILED" : "NOT_AVAILABLE",
      opensDate,
      closesDate: null,
      daysUntilOpen: null,
      daysRemaining: null,
      daysElapsed: null,
    };
  }

  // If already filed, return FILED status with calculated dates
  if (isFiled) {
    return {
      status: "FILED",
      opensDate,
      closesDate,
      daysUntilOpen: null,
      daysRemaining: null,
      daysElapsed: null,
    };
  }

  // Calculate status based on current date
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const opensDateObj = parseDate(opensDate);
  const closesDateObj = parseDate(closesDate);

  // Check if closed (past close date)
  if (today > closesDateObj) {
    return {
      status: "CLOSED",
      opensDate,
      closesDate,
      daysUntilOpen: null,
      daysRemaining: null,
      daysElapsed: daysBetween(closesDateObj, today),
    };
  }

  // Check if not yet open
  if (today < opensDateObj) {
    const daysUntilOpen = daysBetween(today, opensDateObj);

    // Opening soon (within 7 days)
    if (daysUntilOpen <= 7) {
      return {
        status: "OPENING_SOON",
        opensDate,
        closesDate,
        daysUntilOpen,
        daysRemaining: null,
        daysElapsed: null,
      };
    }

    // Not yet open
    return {
      status: "NOT_AVAILABLE",
      opensDate,
      closesDate,
      daysUntilOpen,
      daysRemaining: null,
      daysElapsed: null,
    };
  }

  // Window is open - check if closing soon
  const daysRemaining = daysBetween(today, closesDateObj);

  if (daysRemaining <= 14) {
    return {
      status: "CLOSING_SOON",
      opensDate,
      closesDate,
      daysUntilOpen: null,
      daysRemaining,
      daysElapsed: null,
    };
  }

  // Window is open and not closing soon
  return {
    status: "OPEN",
    opensDate,
    closesDate,
    daysUntilOpen: null,
    daysRemaining,
    daysElapsed: null,
  };
}

// ============================================================================
// STATUS STYLING — accent color, text color, status label
// ============================================================================

interface StatusStyle {
  /** CSS color string for accent bar + progress fill */
  accent: string;
  /** Tailwind classes for status chip bg + text */
  chipBg: string;
  chipText: string;
  label: string;
}

const RECRUITMENT_STYLES: Record<RecruitmentWindowStatus, StatusStyle> = {
  COMPLETED: {
    accent: "var(--stage-recruitment)",
    chipBg: "bg-purple-100 dark:bg-purple-900/40",
    chipText: "text-purple-700 dark:text-purple-300",
    label: "Complete",
  },
  ACTIVE: {
    accent: "var(--stage-recruitment)",
    chipBg: "bg-emerald-100 dark:bg-emerald-900/40",
    chipText: "text-emerald-700 dark:text-emerald-300",
    label: "Active",
  },
  EXPIRED: {
    accent: "var(--destructive)",
    chipBg: "bg-red-100 dark:bg-red-900/40",
    chipText: "text-red-700 dark:text-red-300",
    label: "Expired",
  },
  NOT_STARTED: {
    accent: "var(--border)",
    chipBg: "bg-muted",
    chipText: "text-muted-foreground",
    label: "Not Started",
  },
};

const FILING_STYLES: Record<FilingWindowStatus, StatusStyle> = {
  OPEN: {
    accent: "var(--stage-eta9089)",
    chipBg: "bg-emerald-100 dark:bg-emerald-900/40",
    chipText: "text-emerald-700 dark:text-emerald-300",
    label: "Open",
  },
  OPENING_SOON: {
    accent: "var(--stage-eta9089)",
    chipBg: "bg-amber-100 dark:bg-amber-900/40",
    chipText: "text-amber-700 dark:text-amber-300",
    label: "Opening Soon",
  },
  CLOSING_SOON: {
    accent: "var(--stage-eta9089)",
    chipBg: "bg-orange-100 dark:bg-orange-900/40",
    chipText: "text-orange-700 dark:text-orange-300",
    label: "Closing Soon",
  },
  CLOSED: {
    accent: "var(--destructive)",
    chipBg: "bg-red-100 dark:bg-red-900/40",
    chipText: "text-red-700 dark:text-red-300",
    label: "Closed",
  },
  FILED: {
    accent: "var(--stage-eta9089)",
    chipBg: "bg-blue-100 dark:bg-blue-900/40",
    chipText: "text-blue-700 dark:text-blue-300",
    label: "Filed",
  },
  NOT_AVAILABLE: {
    accent: "var(--border)",
    chipBg: "bg-muted",
    chipText: "text-muted-foreground",
    label: "Not Available",
  },
};

// ============================================================================
// SHORT DATE FORMATTER
// ============================================================================

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatShortDate(isoDate: string): string {
  const month = SHORT_MONTHS[parseInt(isoDate.substring(5, 7), 10) - 1] ?? "???";
  const day = parseInt(isoDate.substring(8, 10), 10);
  return `${month} ${day}`;
}

/**
 * Calculate progress percentage through a date window (0-100)
 */
function getWindowProgress(startDate: string, endDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const total = end.getTime() - start.getTime();
  if (total <= 0) return 100;
  const elapsed = today.getTime() - start.getTime();
  return Math.max(0, Math.min(100, (elapsed / total) * 100));
}

// ============================================================================
// WINDOW CARD COMPONENT — Redesigned
// ============================================================================

interface WindowCardProps {
  title: string;
  style: StatusStyle;
  /** Hero number to display prominently (e.g. days remaining) */
  heroNumber: number | null;
  /** Unit for hero number */
  heroUnit: string;
  /** Subtitle beneath hero (e.g. "days remaining") */
  heroLabel: string;
  /** Start date ISO */
  startDate: string | null;
  /** End date ISO */
  endDate: string | null;
  /** Whether to show progress bar */
  showProgress: boolean;
  /** Whether the window is terminal (complete/expired/filed/closed) */
  isTerminal: boolean;
}

function WindowCard({
  title,
  style,
  heroNumber,
  heroUnit,
  heroLabel,
  startDate,
  endDate,
  showProgress,
  isTerminal,
}: WindowCardProps) {
  const progress = startDate && endDate ? getWindowProgress(startDate, endDate) : 0;

  return (
    <div
      className={cn(
        "border-2 border-border bg-card overflow-hidden",
        "shadow-hard-sm transition-all duration-150",
        "hover:shadow-hard hover:-translate-y-0.5"
      )}
    >
      {/* Accent strip at top */}
      <div className="h-[3px]" style={{ backgroundColor: style.accent }} />

      <div className="p-4">
        {/* Row 1: Title + Status chip */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            {title}
          </span>
          <span
            className={cn(
              "text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 border-2 border-border",
              style.chipBg,
              style.chipText
            )}
          >
            {style.label}
          </span>
        </div>

        {/* Row 2: Hero metric */}
        <div className="mb-3">
          {heroNumber !== null ? (
            <div className="flex items-baseline gap-1.5">
              <span
                className="text-3xl font-heading font-bold tabular-nums leading-none"
                style={{ color: style.accent }}
              >
                {heroNumber}
              </span>
              <span className="text-sm font-medium text-muted-foreground">
                {heroUnit}
              </span>
            </div>
          ) : (
            <div className="flex items-baseline gap-1.5">
              <span
                className="text-lg font-heading font-bold leading-none"
                style={{ color: style.accent }}
              >
                {heroLabel}
              </span>
            </div>
          )}
          {heroNumber !== null && (
            <span className="text-[11px] text-muted-foreground mt-0.5 block">
              {heroLabel}
            </span>
          )}
        </div>

        {/* Row 3: Progress bar with date labels */}
        {showProgress && startDate && endDate ? (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-muted-foreground shrink-0">
              {formatShortDate(startDate)}
            </span>
            <div className="flex-1 h-1.5 bg-border/50 relative overflow-hidden">
              <div
                className="absolute left-0 top-0 bottom-0 transition-[width] duration-1000"
                style={{
                  width: `${isTerminal ? 100 : progress}%`,
                  backgroundColor: style.accent,
                  opacity: isTerminal ? 0.5 : 1,
                }}
              />
            </div>
            <span className="text-[11px] font-mono text-muted-foreground shrink-0">
              {formatShortDate(endDate)}
            </span>
          </div>
        ) : startDate || endDate ? (
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono">
            {startDate && <span>{formatDate(startDate)}</span>}
            {startDate && endDate && <span className="text-border">→</span>}
            {endDate && <span>{formatDate(endDate)}</span>}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * WindowsDisplay Component
 *
 * Displays recruitment and ETA 9089 filing window information on the case detail view.
 *
 * Features:
 * - Two side-by-side cards with neobrutalist styling
 * - Each card shows date range with status
 * - Color-coded status badges
 * - Responsive: stacks vertically on mobile
 *
 * @example
 * ```tsx
 * <WindowsDisplay caseData={caseData} />
 * ```
 */
export function WindowsDisplay({ caseData, className }: WindowsDisplayProps) {
  // Calculate windows
  const recruitmentWindow = useMemo(
    () => calculateRecruitmentWindow(caseData),
    [caseData]
  );

  const filingWindow = useMemo(
    () => calculateFilingWindow(caseData),
    [caseData]
  );

  // Recruitment card props
  const rStyle = RECRUITMENT_STYLES[recruitmentWindow.status];
  const rTerminal = recruitmentWindow.status === "COMPLETED" || recruitmentWindow.status === "EXPIRED";

  let rHeroNumber: number | null = null;
  let rHeroUnit = "";
  let rHeroLabel = "";

  switch (recruitmentWindow.status) {
    case "ACTIVE":
      rHeroNumber = recruitmentWindow.daysRemaining;
      rHeroUnit = rHeroNumber === 1 ? "day" : "days";
      rHeroLabel = "remaining in window";
      break;
    case "EXPIRED":
      rHeroNumber = recruitmentWindow.daysElapsed;
      rHeroUnit = rHeroNumber === 1 ? "day" : "days";
      rHeroLabel = "past expiration";
      break;
    case "COMPLETED":
      rHeroNumber = null;
      rHeroUnit = "";
      rHeroLabel = "All steps finished";
      break;
    case "NOT_STARTED":
      rHeroNumber = null;
      rHeroUnit = "";
      rHeroLabel = "No activities yet";
      break;
  }

  // Filing card props
  const fStyle = FILING_STYLES[filingWindow.status];
  const fTerminal = filingWindow.status === "FILED" || filingWindow.status === "CLOSED";

  let fHeroNumber: number | null = null;
  let fHeroUnit = "";
  let fHeroLabel = "";

  switch (filingWindow.status) {
    case "OPEN":
      fHeroNumber = filingWindow.daysRemaining;
      fHeroUnit = fHeroNumber === 1 ? "day" : "days";
      fHeroLabel = "remaining to file";
      break;
    case "OPENING_SOON":
      fHeroNumber = filingWindow.daysUntilOpen;
      fHeroUnit = fHeroNumber === 1 ? "day" : "days";
      fHeroLabel = "until window opens";
      break;
    case "CLOSING_SOON":
      fHeroNumber = filingWindow.daysRemaining;
      fHeroUnit = fHeroNumber === 1 ? "day" : "days";
      fHeroLabel = "left to file";
      break;
    case "CLOSED":
      fHeroNumber = filingWindow.daysElapsed;
      fHeroUnit = fHeroNumber === 1 ? "day" : "days";
      fHeroLabel = "since window closed";
      break;
    case "FILED":
      fHeroNumber = null;
      fHeroUnit = "";
      fHeroLabel = "ETA 9089 filed";
      break;
    case "NOT_AVAILABLE":
      if (filingWindow.daysUntilOpen !== null) {
        fHeroNumber = filingWindow.daysUntilOpen;
        fHeroUnit = fHeroNumber === 1 ? "day" : "days";
        fHeroLabel = "until window opens";
      } else {
        fHeroNumber = null;
        fHeroUnit = "";
        fHeroLabel = "Awaiting recruitment";
      }
      break;
  }

  return (
    <div
      className={cn(
        "grid gap-4 grid-cols-1 sm:grid-cols-2",
        className
      )}
    >
      <WindowCard
        title="Recruitment Window"
        style={rStyle}
        heroNumber={rHeroNumber}
        heroUnit={rHeroUnit}
        heroLabel={rHeroLabel}
        startDate={recruitmentWindow.startDate}
        endDate={recruitmentWindow.endDate}
        showProgress={!!recruitmentWindow.startDate && !!recruitmentWindow.endDate}
        isTerminal={rTerminal}
      />

      <WindowCard
        title="ETA 9089 Filing"
        style={fStyle}
        heroNumber={fHeroNumber}
        heroUnit={fHeroUnit}
        heroLabel={fHeroLabel}
        startDate={filingWindow.opensDate}
        endDate={filingWindow.closesDate}
        showProgress={!!filingWindow.opensDate && !!filingWindow.closesDate}
        isTerminal={fTerminal}
      />
    </div>
  );
}
