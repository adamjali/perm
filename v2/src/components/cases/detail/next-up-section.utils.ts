/**
 * NextUpSection Utility Functions
 *
 * Pure calculation functions for determining next actions and deadlines,
 * extracted for better maintainability and testing.
 */

import { createElement, type ReactNode } from "react";
import { BriefcaseIcon, CertificateIcon as Award, CheckCircleIcon as CheckCircle2, ClockIcon, FileArrowUpIcon as FileCheck, FileTextIcon, GraduationCapIcon, HourglassIcon as HourglassIcon, WarningIcon as AlertTriangle } from "@phosphor-icons/react/ssr";
import type { CaseStatus, ProgressStatus } from "@/lib/perm";
import {
  isProfessionalRecruitmentComplete,
  calculateFilingWindowFromCase,
  extractActiveDeadlines,
  buildDeadlineInput,
  type LooseDeadlineCaseData,
} from "@/lib/perm";
import { getUrgencyLevelExtended, type UrgencyLevelExtended } from "@/lib/status";
import type { AdditionalRecruitmentMethod } from "@/lib/shared/types";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Case data shape required for next action/deadline calculations
 */
export interface NextUpCaseData {
  caseStatus: CaseStatus;
  progressStatus: ProgressStatus;
  // PWD
  pwdFilingDate?: string | null;
  pwdDeterminationDate?: string | null;
  pwdExpirationDate?: string | null;
  // Recruitment
  jobOrderStartDate?: string | null;
  jobOrderEndDate?: string | null;
  sundayAdFirstDate?: string | null;
  sundayAdSecondDate?: string | null;
  noticeOfFilingStartDate?: string | null;
  noticeOfFilingEndDate?: string | null;
  // ETA 9089
  eta9089FilingDate?: string | null;
  eta9089CertificationDate?: string | null;
  eta9089ExpirationDate?: string | null;
  // I-140
  i140FilingDate?: string | null;
  i140ApprovalDate?: string | null;
  i140DenialDate?: string | null;
  // RFI/RFE
  rfiEntries?: Array<{
    id?: string;
    receivedDate: string;
    responseDueDate: string;
    responseSubmittedDate?: string;
    createdAt?: number;
  }> | null;
  rfeEntries?: Array<{
    id?: string;
    receivedDate: string;
    responseDueDate: string;
    responseSubmittedDate?: string;
    createdAt?: number;
  }> | null;
  // Professional occupation
  isProfessionalOccupation?: boolean;
  additionalRecruitmentMethods?: AdditionalRecruitmentMethod[] | null;
}

/** All known action names returned by calculateNextAction. */
export type NextActionName =
  | "File PWD" | "Wait for PWD" | "Start recruitment"
  | "Post job order" | "Post notice of filing" | "Place Sunday ads"
  | "Complete additional recruitment" | "Wait for filing window" | "File ETA 9089"
  | "Wait for certification" | "File I-140" | "Wait for I-140 decision"
  | "Case complete" | "Respond to RFI" | "Respond to RFE";

export interface NextAction {
  action: NextActionName;
  description: string;
  icon: ReactNode;
  urgency: "normal" | "soon" | "urgent" | "overdue";
}

export interface Deadline {
  label: string;
  date: string;
  daysUntil: number;
}

// Note: UrgencyLevel is re-exported from @/lib/status as UrgencyLevelExtended
export type UrgencyLevel = UrgencyLevelExtended;

export interface UrgencyColors {
  bg: string;
  text: string;
  border: string;
  ring: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Milliseconds per day for date calculations */
const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Build the 9-field input for calculateFilingWindowFromCase from NextUpCaseData. */
function buildFilingWindowInput(caseData: NextUpCaseData) {
  return {
    sundayAdFirstDate: caseData.sundayAdFirstDate || undefined,
    sundayAdSecondDate: caseData.sundayAdSecondDate || undefined,
    jobOrderStartDate: caseData.jobOrderStartDate || undefined,
    jobOrderEndDate: caseData.jobOrderEndDate || undefined,
    noticeOfFilingStartDate: caseData.noticeOfFilingStartDate || undefined,
    noticeOfFilingEndDate: caseData.noticeOfFilingEndDate || undefined,
    additionalRecruitmentMethods: caseData.additionalRecruitmentMethods || undefined,
    pwdExpirationDate: caseData.pwdExpirationDate || undefined,
    isProfessionalOccupation: !!caseData.isProfessionalOccupation,
  };
}

// ============================================================================
// DATE UTILITIES (UTC-safe to avoid DST issues)
// ============================================================================

/**
 * Get today's date normalized to UTC midnight.
 * This ensures consistent date comparisons regardless of local timezone.
 */
function getTodayUTC(): Date {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return today;
}

/**
 * Calculate days until a target date from today (UTC-normalized).
 * Returns negative number if date is in the past.
 */
function calculateDaysUntil(dateStr: string): number {
  const today = getTodayUTC();
  const targetDate = new Date(dateStr);
  targetDate.setUTCHours(0, 0, 0, 0);
  return Math.floor((targetDate.getTime() - today.getTime()) / MS_PER_DAY);
}

/**
 * Format days-until as human-readable text, handling the "0 days" edge case.
 */
function formatDaysText(daysUntil: number): string {
  if (daysUntil === 0) return "today";
  if (daysUntil < 0) return `${Math.abs(daysUntil)} days ago`;
  return `in ${daysUntil} days`;
}

// ============================================================================
// RFI/RFE HELPERS (DRY)
// ============================================================================

/** Entry type for RFI/RFE with response tracking */
interface ResponseEntry {
  receivedDate: string;
  responseDueDate: string;
  responseSubmittedDate?: string;
}

/**
 * Find the first active (unanswered) entry from a list of RFI/RFE entries.
 * An entry is active if it has a receivedDate but no responseSubmittedDate.
 */
function findActiveEntry(
  entries: ResponseEntry[] | null | undefined
): ResponseEntry | null {
  return (entries ?? []).find(
    (e) => e.receivedDate && !e.responseSubmittedDate
  ) ?? null;
}

// ============================================================================
// STAGE & URGENCY UTILITIES
// ============================================================================

/**
 * Get the current stage index based on case status.
 * pwd=0, recruitment=1, eta9089=2, i140=3, closed=4
 */
export function getStageIndex(status: CaseStatus): number {
  switch (status) {
    case "pwd":
      return 0;
    case "recruitment":
      return 1;
    case "eta9089":
      return 2;
    case "i140":
      return 3;
    case "closed":
      return 4; // Beyond all stages
    default:
      return 0;
  }
}

/**
 * Get urgency level based on days until deadline.
 * Uses centralized urgency module from @/lib/status.
 *
 * Note: This uses the extended urgency level which includes "overdue".
 * Thresholds: overdue (<0), urgent (≤7), soon (≤30), normal (>30)
 */
export function getUrgencyLevel(daysUntil: number): UrgencyLevel {
  return getUrgencyLevelExtended(daysUntil);
}

/**
 * Get urgency color classes
 */
export function getUrgencyColors(urgency: UrgencyLevel): UrgencyColors {
  switch (urgency) {
    case "overdue":
      return {
        bg: "bg-red-100 dark:bg-red-950",
        text: "text-red-700 dark:text-red-400",
        border: "border-red-500",
        ring: "ring-red-500/50",
      };
    case "urgent":
      return {
        bg: "bg-red-50 dark:bg-red-950",
        text: "text-red-600 dark:text-red-400",
        border: "border-red-400",
        ring: "ring-red-400/50",
      };
    case "soon":
      return {
        bg: "bg-orange-50 dark:bg-orange-950",
        text: "text-orange-600 dark:text-orange-400",
        border: "border-orange-400",
        ring: "ring-orange-400/50",
      };
    default:
      return {
        bg: "bg-green-50 dark:bg-green-950",
        text: "text-green-600 dark:text-green-400",
        border: "border-green-500",
        ring: "ring-green-500/50",
      };
  }
}

/**
 * Calculate the next required action based on case data.
 *
 * Date-driven: walks PERM steps sequentially by checking which dates exist,
 * NOT by gating on caseStatus. This handles broken/out-of-sync states
 * gracefully (e.g. status reverted to "pwd" but recruitment dates exist).
 */
export function calculateNextAction(caseData: NextUpCaseData): NextAction | null {
  // Case is closed - no next action
  if (caseData.caseStatus === "closed") {
    return null;
  }

  // Check for active RFI/RFE first (highest priority)
  const activeRfi = findActiveEntry(caseData.rfiEntries);
  if (activeRfi) {
    const daysUntil = calculateDaysUntil(activeRfi.responseDueDate);
    return {
      action: "Respond to RFI",
      description: `RFI response due ${formatDaysText(daysUntil)}`,
      icon: createElement(AlertTriangle, { className: "h-5 w-5" }),
      urgency: getUrgencyLevel(daysUntil),
    };
  }

  const activeRfe = findActiveEntry(caseData.rfeEntries);
  if (activeRfe) {
    const daysUntil = calculateDaysUntil(activeRfe.responseDueDate);
    return {
      action: "Respond to RFE",
      description: `RFE response due ${formatDaysText(daysUntil)}`,
      icon: createElement(AlertTriangle, { className: "h-5 w-5" }),
      urgency: getUrgencyLevel(daysUntil),
    };
  }

  // --- Walk PERM steps by dates (not by caseStatus) ---

  // 1. PWD
  if (!caseData.pwdFilingDate) {
    return {
      action: "File PWD",
      description: "Submit Prevailing Wage Determination request to DOL",
      icon: createElement(FileTextIcon, { className: "h-5 w-5" }),
      urgency: "normal",
    };
  }
  if (!caseData.pwdDeterminationDate) {
    return {
      action: "Wait for PWD",
      description: "Awaiting DOL determination (typically 4-6 months)",
      icon: createElement(HourglassIcon, { className: "h-5 w-5" }),
      urgency: "normal",
    };
  }

  // 2. Recruitment steps — check each independently
  const hasJobOrder = caseData.jobOrderStartDate && caseData.jobOrderEndDate;
  const hasNoticeOfFiling = caseData.noticeOfFilingStartDate && caseData.noticeOfFilingEndDate;
  const hasSundayAds = caseData.sundayAdFirstDate && caseData.sundayAdSecondDate;
  const hasAnyRecruitment = caseData.jobOrderStartDate || caseData.sundayAdFirstDate || caseData.noticeOfFilingStartDate;

  // "Start recruitment" only if NO recruitment has begun at all
  if (!hasAnyRecruitment) {
    return {
      action: "Start recruitment",
      description: "Begin recruitment activities for labor certification",
      icon: createElement(BriefcaseIcon, { className: "h-5 w-5" }),
      urgency: "normal",
    };
  }

  if (!hasJobOrder) {
    return {
      action: "Post job order",
      description: "Submit job posting to State Workforce Agency (30+ days)",
      icon: createElement(BriefcaseIcon, { className: "h-5 w-5" }),
      urgency: "normal",
    };
  }

  if (!hasNoticeOfFiling) {
    return {
      action: "Post notice of filing",
      description: "Post internal notice for 10 consecutive business days",
      icon: createElement(FileTextIcon, { className: "h-5 w-5" }),
      urgency: "normal",
    };
  }

  if (!hasSundayAds) {
    return {
      action: "Place Sunday ads",
      description: "Publish two newspaper ads on consecutive Sundays",
      icon: createElement(FileTextIcon, { className: "h-5 w-5" }),
      urgency: "normal",
    };
  }

  // Additional Recruitment for Professional Occupations
  if (caseData.isProfessionalOccupation) {
    const methods = caseData.additionalRecruitmentMethods || [];
    const professionalComplete = isProfessionalRecruitmentComplete({
      isProfessionalOccupation: caseData.isProfessionalOccupation,
      additionalRecruitmentMethods: methods,
    });

    if (!professionalComplete) {
      const completedCount = methods.filter((m) => m.method && m.date).length;
      return {
        action: "Complete additional recruitment",
        description: `${completedCount}/3 professional recruitment methods completed`,
        icon: createElement(GraduationCapIcon, { className: "h-5 w-5" }),
        urgency: "normal",
      };
    }
  }

  // Filing window check (30-day quiet period)
  const filingWindow = calculateFilingWindowFromCase(buildFilingWindowInput(caseData));
  if (filingWindow) {
    const daysUntilOpens = calculateDaysUntil(filingWindow.opens);
    if (daysUntilOpens > 0) {
      return {
        action: "Wait for filing window",
        description: `ETA 9089 filing window opens in ${daysUntilOpens} days`,
        icon: createElement(ClockIcon, { className: "h-5 w-5" }),
        urgency: "normal",
      };
    }
  }

  // 3. ETA 9089
  if (!caseData.eta9089FilingDate) {
    return {
      action: "File ETA 9089",
      description: "Filing window is open: submit labor certification",
      icon: createElement(FileCheck, { className: "h-5 w-5" }),
      urgency: "soon",
    };
  }
  if (!caseData.eta9089CertificationDate) {
    return {
      action: "Wait for certification",
      description: "Awaiting DOL certification decision",
      icon: createElement(HourglassIcon, { className: "h-5 w-5" }),
      urgency: "normal",
    };
  }

  // 4. I-140
  if (!caseData.i140FilingDate) {
    const daysUntilExpiration = caseData.eta9089ExpirationDate
      ? calculateDaysUntil(caseData.eta9089ExpirationDate)
      : 180;
    return {
      action: "File I-140",
      description: "Submit immigrant petition to USCIS",
      icon: createElement(Award, { className: "h-5 w-5" }),
      urgency: getUrgencyLevel(daysUntilExpiration),
    };
  }
  if (!caseData.i140ApprovalDate && !caseData.i140DenialDate) {
    return {
      action: "Wait for I-140 decision",
      description: "Awaiting USCIS adjudication",
      icon: createElement(HourglassIcon, { className: "h-5 w-5" }),
      urgency: "normal",
    };
  }
  if (caseData.i140ApprovalDate) {
    return {
      action: "Case complete",
      description: "I-140 approved. PERM process complete.",
      icon: createElement(CheckCircle2, { className: "h-5 w-5" }),
      urgency: "normal",
    };
  }

  return null;
}

/**
 * Calculate the most urgent upcoming deadline.
 *
 * Delegates to the central extractActiveDeadlines system which handles
 * all supersession logic, per-step recruitment deadlines, and filing window gating.
 */
/**
 * How many deadlines the central rules count as due within `days`, and how
 * many of those are already late. Same list as the next-up box, so the two
 * can never disagree about what is due.
 */
export function countDueDeadlines(caseData: NextUpCaseData, days = 30): { due: number; late: number } {
  const deadlines = extractActiveDeadlines(buildDeadlineInput(caseData as LooseDeadlineCaseData));
  return {
    due: deadlines.filter((d) => d.daysUntil <= days).length,
    late: deadlines.filter((d) => d.daysUntil < 0).length,
  };
}

export function calculateNextDeadline(caseData: NextUpCaseData): Deadline | null {
  // The central rules decide what is still a deadline. A negative daysUntil is
  // a real miss (an RFI response, a PWD expiring unfiled) and leads the list:
  // the central list already drops the one date that passes harmlessly, the
  // filing window OPENING.
  const deadlines = extractActiveDeadlines(buildDeadlineInput(caseData as LooseDeadlineCaseData));
  const first = deadlines[0];
  if (!first) return null;

  return {
    label: first.label,
    date: first.date,
    daysUntil: first.daysUntil,
  };
}
