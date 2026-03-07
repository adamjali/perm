/**
 * NextUpSection Utility Functions
 *
 * Pure calculation functions for determining next actions and deadlines,
 * extracted for better maintainability and testing.
 */

import { createElement, type ReactNode } from "react";
import {
  AlertTriangle,
  HourglassIcon,
  FileText,
  Briefcase,
  FileCheck,
  Award,
  CheckCircle2,
  Clock,
  GraduationCap,
} from "lucide-react";
import type { CaseStatus, ProgressStatus } from "@/lib/perm";
import {
  isProfessionalRecruitmentComplete,
  calculateFilingWindowFromCase,
  calculateRecruitmentWindowCloses,
  getFirstRecruitmentDate,
  extractActiveDeadlines,
  type CaseDataForDeadlines,
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
    receivedDate: string;
    responseDueDate: string;
    responseSubmittedDate?: string;
  }> | null;
  rfeEntries?: Array<{
    receivedDate: string;
    responseDueDate: string;
    responseSubmittedDate?: string;
  }> | null;
  // Professional occupation
  isProfessionalOccupation?: boolean;
  additionalRecruitmentMethods?: AdditionalRecruitmentMethod[] | null;
}

export interface NextAction {
  action: string;
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
 * Calculate the next required action based on case data
 */
export function calculateNextAction(caseData: NextUpCaseData): NextAction | null {
  const { caseStatus } = caseData;

  // Case is closed - no next action
  if (caseStatus === "closed") {
    return null;
  }

  // Check for active RFI/RFE first (highest priority)
  // Uses DRY helper functions
  const activeRfi = findActiveEntry(caseData.rfiEntries);
  if (activeRfi) {
    const daysUntil = calculateDaysUntil(activeRfi.responseDueDate);
    return {
      action: "Respond to RFI",
      description: `RFI response due ${daysUntil < 0 ? `${Math.abs(daysUntil)} days ago` : `in ${Math.abs(daysUntil)} days`}`,
      icon: createElement(AlertTriangle, { className: "h-5 w-5" }),
      urgency: getUrgencyLevel(daysUntil),
    };
  }

  const activeRfe = findActiveEntry(caseData.rfeEntries);
  if (activeRfe) {
    const daysUntil = calculateDaysUntil(activeRfe.responseDueDate);
    return {
      action: "Respond to RFE",
      description: `RFE response due ${daysUntil < 0 ? `${Math.abs(daysUntil)} days ago` : `in ${Math.abs(daysUntil)} days`}`,
      icon: createElement(AlertTriangle, { className: "h-5 w-5" }),
      urgency: getUrgencyLevel(daysUntil),
    };
  }

  // PWD Stage
  if (caseStatus === "pwd") {
    if (!caseData.pwdFilingDate) {
      return {
        action: "File PWD",
        description: "Submit Prevailing Wage Determination request to DOL",
        icon: createElement(FileText, { className: "h-5 w-5" }),
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
    // PWD determined, ready to move to recruitment
    return {
      action: "Start Recruitment",
      description: "Begin recruitment activities for labor certification",
      icon: createElement(Briefcase, { className: "h-5 w-5" }),
      urgency: "normal",
    };
  }

  // Recruitment Stage
  // Order: Job Order → Notice of Filing → Sunday Ads → Additional Recruitment → 30-day wait
  if (caseStatus === "recruitment") {
    // Check required recruitment steps
    const hasJobOrder =
      caseData.jobOrderStartDate && caseData.jobOrderEndDate;
    const hasNoticeOfFiling =
      caseData.noticeOfFilingStartDate && caseData.noticeOfFilingEndDate;
    const hasSundayAds =
      caseData.sundayAdFirstDate && caseData.sundayAdSecondDate;

    // 1. Job Order (first)
    if (!hasJobOrder) {
      return {
        action: "Post Job Order",
        description: "Submit job posting to State Workforce Agency (30+ days)",
        icon: createElement(Briefcase, { className: "h-5 w-5" }),
        urgency: "normal",
      };
    }

    // 2. Notice of Filing (second)
    if (!hasNoticeOfFiling) {
      return {
        action: "Post Notice of Filing",
        description: "Post internal notice for 10 consecutive business days",
        icon: createElement(FileText, { className: "h-5 w-5" }),
        urgency: "normal",
      };
    }

    // 3. Sunday Ads (third)
    if (!hasSundayAds) {
      return {
        action: "Place Sunday Ads",
        description: "Publish two newspaper ads on consecutive Sundays",
        icon: createElement(FileText, { className: "h-5 w-5" }),
        urgency: "normal",
      };
    }

    // 4. Additional Recruitment for Professional Occupations (fourth)
    // Use canonical isProfessionalRecruitmentComplete() check
    if (caseData.isProfessionalOccupation) {
      const methods = caseData.additionalRecruitmentMethods || [];
      const professionalComplete = isProfessionalRecruitmentComplete({
        isProfessionalOccupation: caseData.isProfessionalOccupation,
        additionalRecruitmentMethods: methods,
      });

      if (!professionalComplete) {
        const completedCount = methods
          .filter((m) => m.method && m.date).length;
        return {
          action: "Complete Additional Recruitment",
          description: `${completedCount}/3 professional recruitment methods completed`,
          icon: createElement(GraduationCap, { className: "h-5 w-5" }),
          urgency: "normal",
        };
      }
    }

    // 5. Check if 30-day waiting period has passed (use central filing window calculation)
    const filingWindow = calculateFilingWindowFromCase({
      sundayAdFirstDate: caseData.sundayAdFirstDate || undefined,
      sundayAdSecondDate: caseData.sundayAdSecondDate || undefined,
      jobOrderStartDate: caseData.jobOrderStartDate || undefined,
      jobOrderEndDate: caseData.jobOrderEndDate || undefined,
      noticeOfFilingStartDate: caseData.noticeOfFilingStartDate || undefined,
      noticeOfFilingEndDate: caseData.noticeOfFilingEndDate || undefined,
      additionalRecruitmentMethods: caseData.additionalRecruitmentMethods || undefined,
      pwdExpirationDate: caseData.pwdExpirationDate || undefined,
      isProfessionalOccupation: !!caseData.isProfessionalOccupation,
    });

    if (filingWindow) {
      const daysUntilOpens = calculateDaysUntil(filingWindow.opens);
      if (daysUntilOpens > 0) {
        return {
          action: "Wait for Filing Window",
          description: `ETA 9089 filing window opens in ${daysUntilOpens} days`,
          icon: createElement(Clock, { className: "h-5 w-5" }),
          urgency: "normal",
        };
      }
    }

    return {
      action: "File ETA 9089",
      description: "Filing window is open - submit labor certification",
      icon: createElement(FileCheck, { className: "h-5 w-5" }),
      urgency: "soon",
    };
  }

  // ETA 9089 Stage
  if (caseStatus === "eta9089") {
    if (!caseData.eta9089FilingDate) {
      return {
        action: "File ETA 9089",
        description: "Submit labor certification application",
        icon: createElement(FileCheck, { className: "h-5 w-5" }),
        urgency: "normal",
      };
    }
    if (!caseData.eta9089CertificationDate) {
      return {
        action: "Wait for Certification",
        description: "Awaiting DOL certification decision",
        icon: createElement(HourglassIcon, { className: "h-5 w-5" }),
        urgency: "normal",
      };
    }
    // Certified, ready for I-140
    // Use helper for consistent UTC date calculation
    const daysUntilExpiration = caseData.eta9089ExpirationDate
      ? calculateDaysUntil(caseData.eta9089ExpirationDate)
      : 180; // Default if no expiration set

    return {
      action: "File I-140",
      description: "Submit immigrant petition to USCIS",
      icon: createElement(Award, { className: "h-5 w-5" }),
      // Pass raw days - getUrgencyLevel handles thresholds consistently
      urgency: getUrgencyLevel(daysUntilExpiration),
    };
  }

  // I-140 Stage
  if (caseStatus === "i140") {
    if (!caseData.i140FilingDate) {
      return {
        action: "File I-140",
        description: "Submit immigrant petition to USCIS",
        icon: createElement(Award, { className: "h-5 w-5" }),
        urgency: "normal",
      };
    }
    if (!caseData.i140ApprovalDate && !caseData.i140DenialDate) {
      return {
        action: "Wait for I-140 Decision",
        description: "Awaiting USCIS adjudication",
        icon: createElement(HourglassIcon, { className: "h-5 w-5" }),
        urgency: "normal",
      };
    }
    if (caseData.i140ApprovalDate) {
      return {
        action: "Case Complete",
        description: "I-140 approved - PERM process complete!",
        icon: createElement(CheckCircle2, { className: "h-5 w-5" }),
        urgency: "normal",
      };
    }
  }

  return null;
}

/**
 * Calculate the most urgent upcoming deadline.
 *
 * Delegates to the central extractActiveDeadlines system which handles
 * all supersession logic, per-step recruitment deadlines, and filing window gating.
 */
export function calculateNextDeadline(caseData: NextUpCaseData): Deadline | null {
  // Pre-compute derived fields that extractActiveDeadlines expects as stored values
  const firstRecruit = getFirstRecruitmentDate({
    sundayAdFirstDate: caseData.sundayAdFirstDate || undefined,
    jobOrderStartDate: caseData.jobOrderStartDate || undefined,
    noticeOfFilingStartDate: caseData.noticeOfFilingStartDate || undefined,
  });

  const recruitWindow = firstRecruit
    ? calculateRecruitmentWindowCloses(firstRecruit, caseData.pwdExpirationDate || undefined)
    : undefined;

  const filingWindow = calculateFilingWindowFromCase({
    sundayAdFirstDate: caseData.sundayAdFirstDate || undefined,
    sundayAdSecondDate: caseData.sundayAdSecondDate || undefined,
    jobOrderStartDate: caseData.jobOrderStartDate || undefined,
    jobOrderEndDate: caseData.jobOrderEndDate || undefined,
    noticeOfFilingStartDate: caseData.noticeOfFilingStartDate || undefined,
    noticeOfFilingEndDate: caseData.noticeOfFilingEndDate || undefined,
    additionalRecruitmentMethods: caseData.additionalRecruitmentMethods || undefined,
    pwdExpirationDate: caseData.pwdExpirationDate || undefined,
    isProfessionalOccupation: !!caseData.isProfessionalOccupation,
  });

  // Build CaseDataForDeadlines with pre-computed derived fields
  const centralData: CaseDataForDeadlines = {
    caseStatus: caseData.caseStatus,
    progressStatus: caseData.progressStatus,
    pwdExpirationDate: caseData.pwdExpirationDate || undefined,
    eta9089FilingDate: caseData.eta9089FilingDate || undefined,
    eta9089CertificationDate: caseData.eta9089CertificationDate || undefined,
    eta9089ExpirationDate: caseData.eta9089ExpirationDate || undefined,
    i140FilingDate: caseData.i140FilingDate || undefined,
    sundayAdFirstDate: caseData.sundayAdFirstDate || undefined,
    sundayAdSecondDate: caseData.sundayAdSecondDate || undefined,
    jobOrderStartDate: caseData.jobOrderStartDate || undefined,
    jobOrderEndDate: caseData.jobOrderEndDate || undefined,
    noticeOfFilingStartDate: caseData.noticeOfFilingStartDate || undefined,
    noticeOfFilingEndDate: caseData.noticeOfFilingEndDate || undefined,
    isProfessionalOccupation: caseData.isProfessionalOccupation || undefined,
    additionalRecruitmentMethods: caseData.additionalRecruitmentMethods || undefined,
    // Runtime data has full RfiEntry/RfeEntry shape; inline type is narrower
    rfiEntries: (caseData.rfiEntries || undefined) as CaseDataForDeadlines["rfiEntries"],
    rfeEntries: (caseData.rfeEntries || undefined) as CaseDataForDeadlines["rfeEntries"],
    // Derived fields (extractActiveDeadlines reads these directly)
    filingWindowOpens: filingWindow ? filingWindow.opens : undefined,
    filingWindowCloses: filingWindow ? filingWindow.closes : undefined,
    recruitmentWindowCloses: recruitWindow ? recruitWindow.closes : undefined,
  };

  // Central system handles all supersession, per-step deadlines, and sorting
  const deadlines = extractActiveDeadlines(centralData);
  // Filter to future/current deadlines only — past deadlines (negative daysUntil)
  // are not "next up" (e.g. filing_window_opens after the window already opened)
  const upcoming = deadlines.filter(d => d.daysUntil >= 0);
  if (upcoming.length === 0) return null;

  const first = upcoming[0];
  if (!first) return null;

  return {
    label: first.label,
    date: first.date,
    daysUntil: first.daysUntil,
  };
}
