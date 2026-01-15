"use client";

/**
 * RecruitmentSection Sub-Components
 *
 * Extracted components for recruitment deadline display.
 */

import { addDays, differenceInDays, format, parseISO, subDays } from "date-fns";
import { AlertTriangle, Clock, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

export interface RecruitmentDeadlineIndicatorProps {
  pwdDeterminationDate?: string;
  pwdExpirationDate?: string;
  sundayAdFirstDate?: string;
  jobOrderStartDate?: string;
  noticeOfFilingStartDate?: string;
}

// ============================================================================
// RECRUITMENT DEADLINE INDICATOR
// ============================================================================

/**
 * Displays the recruitment deadline based on two constraints:
 * 1. PWD expiration: Must complete 30 days before PWD expires (for waiting period)
 * 2. 150-day rule: Must complete within 150 days of FIRST recruitment step
 *    (150 days accounts for the mandatory 30-day waiting period before ETA 9089 filing)
 *
 * The earlier of these two deadlines is shown, with indication of which is limiting.
 */
export function RecruitmentDeadlineIndicator({
  pwdDeterminationDate,
  pwdExpirationDate,
  sundayAdFirstDate,
  jobOrderStartDate,
  noticeOfFilingStartDate,
}: RecruitmentDeadlineIndicatorProps) {
  // If no PWD determination, show initial state
  if (!pwdDeterminationDate) {
    return (
      <div className="rounded-lg border-2 border-border bg-muted/30 p-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4" />
          <span>Enter PWD determination date to see recruitment deadline</span>
        </div>
      </div>
    );
  }

  // If we have determination but no expiration, something is off
  if (!pwdExpirationDate) {
    return (
      <div className="rounded-lg border-2 border-border bg-muted/30 p-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4" />
          <span>PWD expiration date will be calculated...</span>
        </div>
      </div>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expirationDate = parseISO(pwdExpirationDate);

  // Calculate PWD-based deadline: 30 days before PWD expires (for 30-day waiting period)
  const pwdDeadline = subDays(expirationDate, 30);

  // Calculate 150-day deadline from FIRST recruitment step
  // Per PERM_SYSTEM_ARCHITECTURE.md: recruitment_window_closes = MIN(first + 150, pwd - 30)
  // The 150-day rule (not 180) accounts for the mandatory 30-day waiting period before ETA 9089 filing
  const recruitmentDates = [sundayAdFirstDate, jobOrderStartDate, noticeOfFilingStartDate]
    .filter((d): d is string => !!d)
    .map((d) => parseISO(d));

  let firstRecruitmentDate: Date | null = null;
  let rule150Deadline: Date | null = null;

  if (recruitmentDates.length > 0) {
    // Get the earliest recruitment date
    firstRecruitmentDate = recruitmentDates.sort((a, b) => a.getTime() - b.getTime())[0]!;
    // 150 days from first recruitment (accounts for 30-day waiting period before filing)
    rule150Deadline = addDays(firstRecruitmentDate, 150);
  }

  // Determine which constraint is limiting: MIN(first + 150, pwd - 30)
  let recruitmentDeadline: Date;
  let limitingFactor: 'pwd' | '150-day';

  if (rule150Deadline && rule150Deadline < pwdDeadline) {
    recruitmentDeadline = rule150Deadline;
    limitingFactor = '150-day';
  } else {
    recruitmentDeadline = pwdDeadline;
    limitingFactor = 'pwd';
  }

  const daysRemaining = differenceInDays(recruitmentDeadline, today);

  // Determine status
  let status: "open" | "warning" | "urgent" | "expired";
  if (daysRemaining < 0) {
    status = "expired";
  } else if (daysRemaining <= 14) {
    status = "urgent";
  } else if (daysRemaining <= 30) {
    status = "warning";
  } else {
    status = "open";
  }

  const statusConfig = {
    open: {
      bgColor: "bg-green-50 dark:bg-green-900/20",
      borderColor: "border-green-300 dark:border-green-700",
      textColor: "text-green-700 dark:text-green-400",
      icon: Clock,
    },
    warning: {
      bgColor: "bg-amber-50 dark:bg-amber-900/20",
      borderColor: "border-amber-300 dark:border-amber-700",
      textColor: "text-amber-700 dark:text-amber-400",
      icon: AlertTriangle,
    },
    urgent: {
      bgColor: "bg-red-50 dark:bg-red-900/20",
      borderColor: "border-red-300 dark:border-red-700",
      textColor: "text-red-700 dark:text-red-400",
      icon: AlertTriangle,
    },
    expired: {
      bgColor: "bg-red-100 dark:bg-red-900/30",
      borderColor: "border-red-400 dark:border-red-600",
      textColor: "text-red-800 dark:text-red-300",
      icon: AlertTriangle,
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "rounded-lg border-2 p-4 space-y-2",
        config.bgColor,
        config.borderColor
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className={cn("h-5 w-5", config.textColor)} />
        <span className={cn("font-semibold text-sm", config.textColor)}>
          Recruitment Deadline
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-muted-foreground text-xs uppercase tracking-wide">
            Must Complete By
          </span>
          <p className="font-medium">
            {format(recruitmentDeadline, "MMM d, yyyy")}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {limitingFactor === '150-day'
              ? '(150 days from first recruitment)'
              : '(30 days before PWD expires)'}
          </p>
        </div>
        <div>
          <span className="text-muted-foreground text-xs uppercase tracking-wide">
            PWD Expires
          </span>
          <p className="font-medium">
            {format(expirationDate, "MMM d, yyyy")}
          </p>
        </div>
      </div>

      {status !== "expired" && (
        <div className="text-center pt-2">
          <span className={cn("text-2xl font-bold", config.textColor)}>
            {daysRemaining}
          </span>
          <span className="text-sm text-muted-foreground ml-1">
            days remaining
          </span>
        </div>
      )}

      {status === "expired" && (
        <div className={cn("text-center pt-2 font-semibold", config.textColor)}>
          Deadline has passed
        </div>
      )}

      <p className="text-xs text-muted-foreground pt-1">
        {(() => {
          // Build dynamic explanation based on available data and limiting factor
          // Note: At this point pwdExpirationDate is always defined (early returns above)
          if (!firstRecruitmentDate) {
            // No recruitment started yet - show both constraints
            return "Recruitment must complete within 150 days of first step OR 30 days before PWD expiration, whichever is first.";
          }
          if (limitingFactor === '150-day' && rule150Deadline) {
            return `Deadline based on 150-day rule from first recruitment (${format(firstRecruitmentDate, "MMM d, yyyy")}). This is earlier than the PWD constraint.`;
          }
          // limitingFactor === 'pwd'
          if (rule150Deadline) {
            return `Deadline based on PWD expiration (must complete 30 days before). This is earlier than the 150-day rule (${format(rule150Deadline, "MMM d, yyyy")}).`;
          }
          return "Must complete 30 days before PWD expiration to allow for ETA 9089 filing window.";
        })()}
      </p>
    </div>
  );
}
