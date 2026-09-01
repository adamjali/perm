"use client";

/**
 * RecruitmentSection Sub-Components
 *
 * Extracted components for recruitment deadline display.
 */

import { differenceInDays, format, parseISO } from "date-fns";
import { CalendarDotIcon as CalendarClock, ClockIcon, WarningIcon as AlertTriangle } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { calculateRecruitmentWindowCloses, getFirstRecruitmentDate } from "@/lib/perm";

// ============================================================================
// TYPES
// ============================================================================

export interface RecruitmentDeadlineIndicatorProps {
  pwdDeterminationDate?: string;
  pwdExpirationDate?: string;
  sundayAdFirstDate?: string;
  jobOrderStartDate?: string;
  noticeOfFilingStartDate?: string;
  isProfessionalOccupation?: boolean;
}

// ============================================================================
// RECRUITMENT DEADLINE INDICATOR
// ============================================================================

/**
 * Displays the recruitment deadline based on two constraints:
 * 1. PWD expiration: Must complete 30 days before PWD expires (for the 30-day waiting period)
 * 2. 150-day rule: Must complete within 150 days of FIRST recruitment step
 *    (the overall ETA 9089 window is 180 days; 150 + 30-day wait = 180 total)
 *
 * Individual recruitment steps (job order, notice of filing, Sunday ads) each have
 * their own per-step deadlines computed from the first recruitment date and PWD
 * expiration, these are shown in the What’s Next section on the case detail page.
 *
 * The earlier of the two overall constraints is shown, with indication of which is limiting.
 */
export function RecruitmentDeadlineIndicator({
  pwdDeterminationDate,
  pwdExpirationDate,
  sundayAdFirstDate,
  jobOrderStartDate,
  noticeOfFilingStartDate,
  isProfessionalOccupation,
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

  // Use central lib: calculateRecruitmentWindowCloses = MIN(first + 150, pwd - 30)
  const firstDate = getFirstRecruitmentDate({ sundayAdFirstDate, jobOrderStartDate, noticeOfFilingStartDate });
  const recWindow = calculateRecruitmentWindowCloses(firstDate, pwdExpirationDate);

  if (!recWindow) {
    // No first recruitment date yet — show PWD-only deadline
    const expirationDate = parseISO(pwdExpirationDate);
    const daysToExpiration = differenceInDays(expirationDate, today);
    return (
      <div className="rounded-lg border-2 border-border bg-muted/30 p-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4" />
          <span>PWD expires {format(expirationDate, "MMM d, yyyy")} ({daysToExpiration} days)</span>
        </div>
      </div>
    );
  }

  const recruitmentDeadline = parseISO(recWindow.closes);
  const limitingFactor: 'pwd' | '150-day' = recWindow.isPwdLimited ? 'pwd' : '150-day';
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
      icon: ClockIcon,
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
          </span>{" "}
          <p className="font-medium">
            {format(recruitmentDeadline, "MMM d, yyyy")}
          </p>{" "}
          <p className="text-xs text-muted-foreground mt-0.5">
            {limitingFactor === '150-day'
              ? '(150 days from first recruitment)'
              : '(30 days before PWD expires)'}
          </p>
        </div>
        <div>
          <span className="text-muted-foreground text-xs uppercase tracking-wide">
            PWD Expires
          </span>{" "}
          <p className="font-medium">
            {format(parseISO(pwdExpirationDate), "MMM d, yyyy")}
          </p>
        </div>
      </div>

      {status !== "expired" && (
        <div className="text-center pt-2">
          <span className={cn("text-2xl font-bold", config.textColor)}>
            {daysRemaining}
          </span>{" "}
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
        {limitingFactor === '150-day'
          ? `Recruitment must be complete within 150 days of the first recruitment step${firstDate ? ` (${format(parseISO(firstDate), "MMM d, yyyy")})` : ""}, leaving a 30-day quiet period (180 days total).${isProfessionalOccupation ? " One additional recruitment method for professional positions may be completed during the 30-day quiet period." : ""}`
          : firstDate
            ? `Recruitment must complete 30 days before PWD expires to preserve the filing window. This PWD constraint is earlier than the 150-day rule.${isProfessionalOccupation ? " One additional recruitment method for professional positions may be completed during the 30-day quiet period." : ""}`
            : `Recruitment must complete 30 days before PWD expires to allow for the mandatory waiting period before ETA 9089 filing.${isProfessionalOccupation ? " One additional recruitment method for professional positions may be completed during the 30-day quiet period." : ""}`}
      </p>
    </div>
  );
}
