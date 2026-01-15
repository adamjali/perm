/**
 * Recruitment Status Calculator
 *
 * Calculates recruitment filing window status based on PERM regulations.
 * Per 20 CFR 656.17: ETA 9089 must be filed 30-180 days after recruitment ends.
 */

import { addDays, differenceInDays, parseISO, format } from "date-fns";
import { getLastRecruitmentDate, countBusinessDays } from "../perm";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Recruitment status enum representing the current state of the filing window.
 */
export type RecruitmentStatusType =
  | "waiting" // Must wait until 30 days passed
  | "ready" // In the 30-180 day filing window
  | "incomplete" // Missing mandatory recruitment steps
  | "expired"; // Past 180 days - must restart

/**
 * Mandatory recruitment steps status.
 */
export interface MandatoryStepsStatus {
  noticeOfFiling: {
    complete: boolean;
    startDate?: string;
    endDate?: string;
    businessDays?: number;
  };
  jobOrder: {
    complete: boolean;
    startDate?: string;
    endDate?: string;
    durationDays?: number;
  };
  sundayAdFirst: {
    complete: boolean;
    date?: string;
  };
  sundayAdSecond: {
    complete: boolean;
    date?: string;
  };
  allComplete: boolean;
}

/**
 * Professional occupation additional methods status.
 */
export interface ProfessionalMethodsStatus {
  required: boolean;
  completedCount: number;
  requiredCount: number;
  methods: Array<{
    method: string;
    date: string;
    description?: string;
  }>;
  allComplete: boolean;
}

/**
 * Complete recruitment status result.
 */
export interface RecruitmentStatus {
  status: RecruitmentStatusType;
  message: string;
  filingWindowOpens?: string; // ISO date
  filingWindowCloses?: string; // ISO date
  daysUntilWindowOpens?: number;
  daysRemainingInWindow?: number;
  recruitmentEndDate?: string; // ISO date
  mandatorySteps: MandatoryStepsStatus;
  professionalMethods: ProfessionalMethodsStatus;
}

// ============================================================================
// INPUT TYPE
// ============================================================================

/**
 * Case data needed for recruitment status calculation.
 */
export interface RecruitmentCaseData {
  // Notice of Filing
  noticeOfFilingStartDate?: string;
  noticeOfFilingEndDate?: string;

  // Job Order
  jobOrderStartDate?: string;
  jobOrderEndDate?: string;

  // Sunday Ads
  sundayAdFirstDate?: string;
  sundayAdSecondDate?: string;

  // Additional recruitment methods
  additionalRecruitmentMethods?: Array<{
    method: string;
    date: string;
    description?: string;
  }>;
  additionalRecruitmentEndDate?: string;

  // Professional occupation flag
  isProfessionalOccupation: boolean;

  // PWD expiration for window calculation
  pwdExpirationDate?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Calculate the recruitment end date (latest of all recruitment activities).
 * Uses canonical getLastRecruitmentDate() from lib/perm.
 */
function calculateRecruitmentEndDate(data: RecruitmentCaseData): string | null {
  return getLastRecruitmentDate(data, data.isProfessionalOccupation) ?? null;
}

/**
 * Build status for a step with start/end dates and duration calculation
 */
function buildDateRangeStepStatus<T extends { complete: boolean; startDate?: string; endDate?: string }>(
  startDate: string | undefined,
  endDate: string | undefined,
  calculateDuration: (start: string, end: string) => number,
  durationKey: string
): T {
  const complete = !!(startDate && endDate);
  const result: Record<string, unknown> = {
    complete,
    startDate,
    endDate,
  };

  if (complete) {
    result[durationKey] = calculateDuration(startDate!, endDate!);
  }

  return result as T;
}

/**
 * Build status for a simple date field step
 */
function buildSimpleStepStatus(date: string | undefined): { complete: boolean; date?: string } {
  return {
    complete: !!date,
    date,
  };
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Calculate comprehensive recruitment status.
 *
 * @param data - Case data with recruitment dates
 * @returns RecruitmentStatus with complete status information
 *
 * @example
 * ```ts
 * const status = calculateRecruitmentStatus({
 *   noticeOfFilingStartDate: "2024-01-15",
 *   noticeOfFilingEndDate: "2024-01-29",
 *   jobOrderStartDate: "2024-01-10",
 *   jobOrderEndDate: "2024-02-10",
 *   sundayAdFirstDate: "2024-01-14",
 *   sundayAdSecondDate: "2024-01-21",
 *   isProfessionalOccupation: true,
 *   additionalRecruitmentMethods: [...],
 * });
 * ```
 */
export function calculateRecruitmentStatus(
  data: RecruitmentCaseData
): RecruitmentStatus {
  const today = new Date();

  // -------------------------------------------------------------------------
  // Step 1: Check mandatory steps
  // -------------------------------------------------------------------------

  const mandatorySteps: MandatoryStepsStatus = {
    noticeOfFiling: buildDateRangeStepStatus(
      data.noticeOfFilingStartDate,
      data.noticeOfFilingEndDate,
      countBusinessDays,
      'businessDays'
    ),
    jobOrder: buildDateRangeStepStatus(
      data.jobOrderStartDate,
      data.jobOrderEndDate,
      (start, end) => differenceInDays(parseISO(end), parseISO(start)),
      'durationDays'
    ),
    sundayAdFirst: buildSimpleStepStatus(data.sundayAdFirstDate),
    sundayAdSecond: buildSimpleStepStatus(data.sundayAdSecondDate),
    allComplete: false,
  };

  mandatorySteps.allComplete =
    mandatorySteps.noticeOfFiling.complete &&
    mandatorySteps.jobOrder.complete &&
    mandatorySteps.sundayAdFirst.complete &&
    mandatorySteps.sundayAdSecond.complete;

  // -------------------------------------------------------------------------
  // Step 2: Check professional occupation methods (if applicable)
  // -------------------------------------------------------------------------

  const professionalMethods: ProfessionalMethodsStatus = {
    required: data.isProfessionalOccupation,
    completedCount: data.additionalRecruitmentMethods?.length ?? 0,
    requiredCount: data.isProfessionalOccupation ? 3 : 0,
    methods: data.additionalRecruitmentMethods ?? [],
    allComplete: false,
  };

  professionalMethods.allComplete = data.isProfessionalOccupation
    ? professionalMethods.completedCount >= 3
    : true;

  // -------------------------------------------------------------------------
  // Step 3: Check overall completeness
  // -------------------------------------------------------------------------

  const isComplete =
    mandatorySteps.allComplete && professionalMethods.allComplete;

  if (!isComplete) {
    const missingSteps: string[] = [];
    const stepChecks = [
      { condition: !mandatorySteps.noticeOfFiling.complete, label: "Notice of Filing" },
      { condition: !mandatorySteps.jobOrder.complete, label: "Job Order" },
      { condition: !mandatorySteps.sundayAdFirst.complete, label: "First Sunday Ad" },
      { condition: !mandatorySteps.sundayAdSecond.complete, label: "Second Sunday Ad" },
    ];

    stepChecks.forEach(({ condition, label }) => {
      if (condition) missingSteps.push(label);
    });

    if (!professionalMethods.allComplete && data.isProfessionalOccupation) {
      const remaining = 3 - professionalMethods.completedCount;
      missingSteps.push(
        `${remaining} additional recruitment method${remaining > 1 ? "s" : ""}`
      );
    }

    return {
      status: "incomplete",
      message: `Complete recruitment steps first: ${missingSteps.join(", ")}`,
      mandatorySteps,
      professionalMethods,
    };
  }

  // -------------------------------------------------------------------------
  // Step 4: Calculate filing window
  // -------------------------------------------------------------------------

  const recruitmentEndDate = calculateRecruitmentEndDate(data);

  if (!recruitmentEndDate) {
    return {
      status: "incomplete",
      message: "Unable to determine recruitment end date",
      mandatorySteps,
      professionalMethods,
    };
  }

  const recruitmentEnd = parseISO(recruitmentEndDate);

  // Validate parsed date - parseISO can return Invalid Date
  if (isNaN(recruitmentEnd.getTime())) {
    console.error(
      `[statusCalculator] Invalid recruitment end date: "${recruitmentEndDate}"`
    );
    return {
      status: "incomplete",
      message: "Invalid recruitment end date format",
      mandatorySteps,
      professionalMethods,
    };
  }

  const windowOpens = addDays(recruitmentEnd, 30);
  const windowCloses = addDays(recruitmentEnd, 180);

  // Apply PWD expiration constraint (window cannot extend past PWD expiration)
  let pwdExpiration: Date | null = null;
  if (data.pwdExpirationDate) {
    const parsed = parseISO(data.pwdExpirationDate);
    if (!isNaN(parsed.getTime())) {
      pwdExpiration = parsed;
    } else {
      console.warn(
        `[statusCalculator] Invalid PWD expiration date: "${data.pwdExpirationDate}", ignoring for window calculation`
      );
    }
  }
  const effectiveWindowCloses =
    pwdExpiration && pwdExpiration < windowCloses ? pwdExpiration : windowCloses;

  const windowOpensStr = format(windowOpens, "yyyy-MM-dd");
  const windowClosesStr = format(effectiveWindowCloses, "yyyy-MM-dd");

  const daysUntilWindowOpens = differenceInDays(windowOpens, today);
  const daysRemainingInWindow = differenceInDays(effectiveWindowCloses, today);

  // -------------------------------------------------------------------------
  // Step 5: Determine status based on current date
  // -------------------------------------------------------------------------

  const determineStatus = (): { status: RecruitmentStatusType; message: string } => {
    if (today < windowOpens) {
      return {
        status: "waiting",
        message: `Must wait until ${format(windowOpens, "MMM d, yyyy")} to file`,
      };
    }

    if (today <= effectiveWindowCloses) {
      return {
        status: "ready",
        message: `Ready to file! ${Math.max(0, daysRemainingInWindow)} days remaining`,
      };
    }

    return {
      status: "expired",
      message: "Filing window closed - must restart recruitment",
    };
  };

  const { status, message } = determineStatus();

  return {
    status,
    message,
    filingWindowOpens: windowOpensStr,
    filingWindowCloses: windowClosesStr,
    daysUntilWindowOpens: Math.max(0, daysUntilWindowOpens),
    daysRemainingInWindow: Math.max(0, daysRemainingInWindow),
    recruitmentEndDate,
    mandatorySteps,
    professionalMethods,
  };
}

/**
 * Format a filing window date range for display.
 *
 * @param opensDate - ISO date when window opens
 * @param closesDate - ISO date when window closes
 * @returns Formatted string like "Jan 31, 2026 - Jun 30, 2026"
 */
export function formatFilingWindowRange(
  opensDate: string,
  closesDate: string
): string {
  const opens = format(parseISO(opensDate), "MMM d, yyyy");
  const closes = format(parseISO(closesDate), "MMM d, yyyy");
  return `${opens} - ${closes}`;
}
