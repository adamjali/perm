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
  pwdBearingFromCase,
  pwdFilingLimitFromCase,
  type MethodDateFields,
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
  additionalRecruitmentStartDate?: string;
  additionalRecruitmentMethods?: ReadonlyArray<MethodDateFields>;
}

// ============================================================================
// RECRUITMENT DEADLINE INDICATOR
// ============================================================================

/**
 * Displays the recruitment deadline based on two constraints:
 * 1. 150-day rule: Must complete within 150 days of FIRST recruitment step
 *    (the overall ETA 9089 window is 180 days; 150 + 30-day wait = 180 total)
 * 2. PWD expiration (20 CFR 656.40(c), dates/pwdValidity.ts): before recruitment
 *    begins, it has to begin by the expiry; once it has begun inside the PWD's
 *    validity the expiry no longer limits it; begun before the determination,
 *    it must complete 30 days before the expiry
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
  additionalRecruitmentStartDate,
  additionalRecruitmentMethods,
}: RecruitmentDeadlineIndicatorProps) {
  const note = (text: string) => <p className="bg-tint p-3 text-sm text-muted-foreground">{text}</p>;

  if (!pwdDeterminationDate) return note("Enter PWD determination date to see recruitment deadline");
  if (!pwdExpirationDate) return note("PWD expiration date will be calculated...");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Central lib: first + 150, and PWD - 30 only while the PWD still limits the case
  const firstDate = getFirstRecruitmentDate({ sundayAdFirstDate, jobOrderStartDate, noticeOfFilingStartDate });
  const caseDates = {
    pwdDeterminationDate,
    pwdExpirationDate,
    sundayAdFirstDate,
    jobOrderStartDate,
    additionalRecruitmentStartDate,
    additionalRecruitmentMethods,
    isProfessionalOccupation,
  };
  const bearing = pwdBearingFromCase(caseDates);
  const pwdLimit = pwdFilingLimitFromCase(caseDates);
  const recWindow = firstDate ? calculateRecruitmentWindowCloses(firstDate, pwdLimit) : null;

  if (!recWindow || bearing === "not-begun") {
    // Recruitment hasn't begun: the PWD expiry is the day it has to begin by
    const expirationDate = parseISO(pwdExpirationDate);
    return note(
      `Recruitment has to begin by ${format(expirationDate, "MMM d, yyyy")}, when the PWD expires (${differenceInDays(expirationDate, today)} days)`,
    );
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
    <div className="space-y-3 bg-tint p-4">
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
          ? `Recruitment must be complete within ${RECRUITMENT_WINDOW_DAYS} days of the first recruitment step${firstDate ? ` (${format(parseISO(firstDate), "MMM d, yyyy")})` : ""}, leaving a ${FILING_WINDOW_WAIT_DAYS}-day quiet period (${FILING_WINDOW_CLOSE_DAYS} days total).${bearing === "began-inside" ? " Recruitment began while the PWD was valid, so its expiry no longer limits the filing (20 CFR 656.40(c))." : ""}${professionalNote}`
          : firstDate
            ? `Recruitment must complete ${PWD_RECRUITMENT_BUFFER_DAYS} days before PWD expires to preserve the filing window. This PWD constraint is earlier than the ${RECRUITMENT_WINDOW_DAYS}-day rule.${professionalNote}`
            : `Recruitment must complete ${PWD_RECRUITMENT_BUFFER_DAYS} days before PWD expires to allow for the mandatory waiting period before ETA 9089 filing.${professionalNote}`}
      </p>
    </div>
  );
}
