"use client";

/**
 * RecruitmentSection Sub-Components
 *
 * Extracted components for recruitment deadline display.
 */

import { differenceInDays, format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import {
  calculateRecruitmentWindowCloses,
  FILING_WINDOW_CLOSE_DAYS,
  FILING_WINDOW_WAIT_DAYS,
  getFirstRecruitmentDate,
  PWD_RECRUITMENT_BUFFER_DAYS,
  RECRUITMENT_WINDOW_DAYS,
} from "@/lib/perm";
import { CLOSING_SOON_DAYS, DEADLINE_WARNING_DAYS } from "@/components/forms/FilingWindowIndicator";

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
  const note = (text: string) => <p className="border border-border p-3 text-sm text-muted-foreground">{text}</p>;

  if (!pwdDeterminationDate) return note("Enter PWD determination date to see recruitment deadline");
  if (!pwdExpirationDate) return note("PWD expiration date will be calculated...");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Use central lib: calculateRecruitmentWindowCloses = MIN(first + 150, pwd - 30)
  const firstDate = getFirstRecruitmentDate({ sundayAdFirstDate, jobOrderStartDate, noticeOfFilingStartDate });
  const recWindow = calculateRecruitmentWindowCloses(firstDate, pwdExpirationDate);

  if (!recWindow) {
    // No first recruitment date yet: show the PWD-only deadline
    const expirationDate = parseISO(pwdExpirationDate);
    return note(`PWD expires ${format(expirationDate, "MMM d, yyyy")} (${differenceInDays(expirationDate, today)} days)`);
  }

  const recruitmentDeadline = parseISO(recWindow.closes);
  const daysRemaining = differenceInDays(recruitmentDeadline, today);
  const ink =
    daysRemaining <= CLOSING_SOON_DAYS
      ? "text-destructive-text"
      : daysRemaining <= DEADLINE_WARNING_DAYS
        ? "text-data-warn-ink"
        : "text-foreground";
  const professionalNote = isProfessionalOccupation
    ? ` One additional recruitment method for professional positions may be completed during the ${FILING_WINDOW_WAIT_DAYS}-day quiet period.`
    : "";

  return (
    <div className="space-y-3 border border-border p-4">
      <p className="text-sm font-semibold">Recruitment deadline</p>

      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-muted-foreground">Must complete by</dt>{" "}
          <dd className="font-medium">{format(recruitmentDeadline, "MMM d, yyyy")}</dd>{" "}
          <dd className="mt-0.5 text-muted-foreground">
            {recWindow.isPwdLimited
              ? `(${PWD_RECRUITMENT_BUFFER_DAYS} days before PWD expires)`
              : `(${RECRUITMENT_WINDOW_DAYS} days from first recruitment)`}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">PWD expires</dt>{" "}
          <dd className="font-medium">{format(parseISO(pwdExpirationDate), "MMM d, yyyy")}</dd>
        </div>
      </dl>

      {daysRemaining >= 0 ? (
        <p className="text-sm text-muted-foreground">
          <span className={cn("font-heading text-lg font-bold tabular-nums", ink)}>{daysRemaining}</span> days remaining
        </p>
      ) : (
        <p className="text-sm font-semibold text-destructive-text">Deadline has passed</p>
      )}

      <p className="text-sm text-muted-foreground">
        {!recWindow.isPwdLimited
          ? `Recruitment must be complete within ${RECRUITMENT_WINDOW_DAYS} days of the first recruitment step${firstDate ? ` (${format(parseISO(firstDate), "MMM d, yyyy")})` : ""}, leaving a ${FILING_WINDOW_WAIT_DAYS}-day quiet period (${FILING_WINDOW_CLOSE_DAYS} days total).${professionalNote}`
          : firstDate
            ? `Recruitment must complete ${PWD_RECRUITMENT_BUFFER_DAYS} days before PWD expires to preserve the filing window. This PWD constraint is earlier than the ${RECRUITMENT_WINDOW_DAYS}-day rule.${professionalNote}`
            : `Recruitment must complete ${PWD_RECRUITMENT_BUFFER_DAYS} days before PWD expires to allow for the mandatory waiting period before ETA 9089 filing.${professionalNote}`}
      </p>
    </div>
  );
}
