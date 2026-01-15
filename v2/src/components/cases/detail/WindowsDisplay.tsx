"use client";

import * as React from "react";
import { Calendar, Clock, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
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
// STATUS STYLING
// ============================================================================

const RECRUITMENT_STATUS_STYLES: Record<
  RecruitmentWindowStatus,
  { bg: string; text: string; icon: React.ComponentType<{ className?: string }> }
> = {
  COMPLETED: {
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-400",
    icon: CheckCircle2,
  },
  ACTIVE: {
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-700 dark:text-green-400",
    icon: CheckCircle2,
  },
  EXPIRED: {
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-400",
    icon: XCircle,
  },
  NOT_STARTED: {
    bg: "bg-gray-100 dark:bg-gray-800/50",
    text: "text-gray-600 dark:text-gray-400",
    icon: Clock,
  },
};

const FILING_STATUS_STYLES: Record<
  FilingWindowStatus,
  { bg: string; text: string; icon: React.ComponentType<{ className?: string }> }
> = {
  OPEN: {
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-700 dark:text-green-400",
    icon: CheckCircle2,
  },
  OPENING_SOON: {
    bg: "bg-yellow-100 dark:bg-yellow-900/30",
    text: "text-yellow-700 dark:text-yellow-400",
    icon: Clock,
  },
  CLOSING_SOON: {
    bg: "bg-orange-100 dark:bg-orange-900/30",
    text: "text-orange-700 dark:text-orange-400",
    icon: AlertTriangle,
  },
  CLOSED: {
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-400",
    icon: XCircle,
  },
  FILED: {
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-400",
    icon: CheckCircle2,
  },
  NOT_AVAILABLE: {
    bg: "bg-gray-100 dark:bg-gray-800/50",
    text: "text-gray-600 dark:text-gray-400",
    icon: Clock,
  },
};

// Status display labels
const RECRUITMENT_STATUS_LABELS: Record<RecruitmentWindowStatus, string> = {
  COMPLETED: "Complete",
  ACTIVE: "Active",
  EXPIRED: "Expired",
  NOT_STARTED: "Not Started",
};

const FILING_STATUS_LABELS: Record<FilingWindowStatus, string> = {
  OPEN: "Open",
  OPENING_SOON: "Opening Soon",
  CLOSING_SOON: "Closing Soon",
  CLOSED: "Closed",
  FILED: "Filed",
  NOT_AVAILABLE: "Not Available",
};

// ============================================================================
// WINDOW CARD COMPONENT
// ============================================================================

interface WindowCardProps {
  title: string;
  icon: React.ReactNode;
  status: {
    label: string;
    bg: string;
    text: string;
    icon: React.ComponentType<{ className?: string }>;
  };
  startDate: string | null;
  endDate: string | null;
  startLabel: string;
  endLabel: string;
  helperText: string | null;
}

function WindowCard({
  title,
  icon,
  status,
  startDate,
  endDate,
  startLabel,
  endLabel,
  helperText,
}: WindowCardProps) {
  const StatusIcon = status.icon;

  return (
    <div
      className={cn(
        "rounded-lg border-2 border-border bg-card p-4",
        "shadow-hard-sm transition-all duration-150",
        "hover:shadow-hard hover:-translate-y-0.5"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <h3 className="font-heading font-semibold text-sm sm:text-base">{title}</h3>
        </div>

        {/* Status Badge */}
        <span
          className={cn(
            "inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold",
            status.bg,
            status.text
          )}
        >
          <StatusIcon className="h-3 w-3" />
          {status.label}
        </span>
      </div>

      {/* Date Range */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{startLabel}:</span>
          <span className="font-medium">
            {startDate ? formatDate(startDate) : "-"}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{endLabel}:</span>
          <span className="font-medium">
            {endDate ? formatDate(endDate) : "-"}
          </span>
        </div>
      </div>

      {/* Helper Text */}
      {helperText && (
        <p
          className={cn(
            "mt-3 pt-3 border-t border-border/50 text-xs",
            status.text
          )}
        >
          {helperText}
        </p>
      )}
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
  const recruitmentWindow = React.useMemo(
    () => calculateRecruitmentWindow(caseData),
    [caseData]
  );

  const filingWindow = React.useMemo(
    () => calculateFilingWindow(caseData),
    [caseData]
  );

  // Generate helper text for recruitment window
  const recruitmentHelperText = React.useMemo(() => {
    switch (recruitmentWindow.status) {
      case "COMPLETED":
        return "All recruitment steps finished";
      case "ACTIVE":
        return recruitmentWindow.daysRemaining !== null
          ? `${recruitmentWindow.daysRemaining} days remaining`
          : null;
      case "EXPIRED":
        return recruitmentWindow.daysElapsed !== null
          ? `Expired ${recruitmentWindow.daysElapsed} days ago`
          : null;
      case "NOT_STARTED":
        return "No recruitment activities recorded";
    }
  }, [recruitmentWindow]);

  // Generate helper text for filing window
  const filingHelperText = React.useMemo(() => {
    switch (filingWindow.status) {
      case "OPEN":
        return filingWindow.daysRemaining !== null
          ? `${filingWindow.daysRemaining} days remaining to file`
          : null;
      case "OPENING_SOON":
        return filingWindow.daysUntilOpen !== null
          ? `Opens in ${filingWindow.daysUntilOpen} days`
          : null;
      case "CLOSING_SOON":
        return filingWindow.daysRemaining !== null
          ? `Only ${filingWindow.daysRemaining} days left to file!`
          : null;
      case "CLOSED":
        return filingWindow.daysElapsed !== null
          ? `Closed ${filingWindow.daysElapsed} days ago`
          : null;
      case "FILED":
        return "ETA 9089 has been filed";
      case "NOT_AVAILABLE":
        if (filingWindow.daysUntilOpen !== null) {
          return `Opens in ${filingWindow.daysUntilOpen} days`;
        }
        return "Complete recruitment to calculate window";
    }
  }, [filingWindow]);

  // Get styling for recruitment status
  const recruitmentStyle = RECRUITMENT_STATUS_STYLES[recruitmentWindow.status];
  const recruitmentStatusData = {
    label: RECRUITMENT_STATUS_LABELS[recruitmentWindow.status],
    ...recruitmentStyle,
  };

  // Get styling for filing status
  const filingStyle = FILING_STATUS_STYLES[filingWindow.status];
  const filingStatusData = {
    label: FILING_STATUS_LABELS[filingWindow.status],
    ...filingStyle,
  };

  return (
    <div
      className={cn(
        "grid gap-4 grid-cols-1 sm:grid-cols-2",
        className
      )}
    >
      {/* Recruitment Window Card */}
      <WindowCard
        title="Recruitment Window"
        icon={<Calendar className="h-5 w-5" />}
        status={recruitmentStatusData}
        startDate={recruitmentWindow.startDate}
        endDate={recruitmentWindow.endDate}
        startLabel="Start"
        endLabel="Expires"
        helperText={recruitmentHelperText}
      />

      {/* Filing Window Card */}
      <WindowCard
        title="ETA 9089 Filing Window"
        icon={<Clock className="h-5 w-5" />}
        status={filingStatusData}
        startDate={filingWindow.opensDate}
        endDate={filingWindow.closesDate}
        startLabel="Opens"
        endLabel="Closes"
        helperText={filingHelperText}
      />
    </div>
  );
}
