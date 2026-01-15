/**
 * Dashboard Helper Functions
 * Pure functions for dashboard data processing.
 *
 * All functions are testable without database dependencies.
 *
 * Uses centralized deadline supersession logic from perm/deadlines module.
 */

import type {
  UrgencyGroup,
  PwdBreakdown,
  RecruitmentBreakdown,
  Eta9089Breakdown,
  I140Breakdown,
  CaseDataForDeadlines,
  DeadlineType,
  DeadlineItem,
} from "./dashboardTypes";
import {
  calculateRecruitmentEndDate as calcRecruitmentEndDate,
  calculateRecruitmentStartDate as calcRecruitmentStartDate,
  calculateFilingWindowOpens as calcFilingWindowOpens,
  calculateFilingWindowCloses as calcFilingWindowCloses,
} from "./derivedCalculations";
import {
  isDeadlineActive,
  getActiveRfiEntry,
  getActiveRfeEntry,
  type CaseDataForDeadlines as PermCaseDataForDeadlines,
} from "./perm/deadlines";
import { daysBetween } from "./dateValidation";
import { loggers } from "./logging";

const log = loggers.dashboard;

// ============================================================================
// URGENCY CALCULATION
// ============================================================================

/**
 * Calculate urgency group based on days until deadline.
 *
 * @param daysUntil - Days until deadline (negative = overdue, positive = future)
 * @returns UrgencyGroup classification
 *
 * @example
 * calculateUrgency(-5)  // "overdue"
 * calculateUrgency(3)   // "thisWeek"
 * calculateUrgency(15)  // "thisMonth"
 * calculateUrgency(100) // "later"
 */
export function calculateUrgency(daysUntil: number): UrgencyGroup {
  if (daysUntil < 0) return "overdue";
  if (daysUntil <= 7) return "thisWeek";
  if (daysUntil <= 30) return "thisMonth";
  return "later";
}

/**
 * Input type for createDeadlineItem factory.
 * Excludes the brand symbol and urgency (which is computed).
 */
type DeadlineItemInput = {
  caseId: DeadlineItem["caseId"];
  caseNumber?: string;
  employerName: string;
  beneficiaryName: string;
  type: DeadlineItem["type"];
  label: string;
  dueDate: string;
  daysUntil: number;
  caseStatus: DeadlineItem["caseStatus"];
  progressStatus: DeadlineItem["progressStatus"];
};

/**
 * Factory function to create DeadlineItem with guaranteed urgency consistency.
 * Computes urgency from daysUntil to prevent inconsistent states.
 *
 * @param base - DeadlineItem data without urgency field
 * @returns Complete DeadlineItem with computed urgency
 */
export function createDeadlineItem(base: DeadlineItemInput): DeadlineItem {
  return {
    ...base,
    urgency: calculateUrgency(base.daysUntil),
  } as DeadlineItem;
}

// ============================================================================
// SORTING
// ============================================================================

/**
 * Sort items by daysUntil ascending (most urgent first).
 * Maintains stability for equal values.
 *
 * @param items - Array of items with daysUntil property
 * @returns Sorted array (new array, original unchanged)
 *
 * @example
 * sortByUrgency([
 *   { label: "Later", daysUntil: 100 },
 *   { label: "Overdue", daysUntil: -5 },
 *   { label: "ThisWeek", daysUntil: 3 },
 * ])
 * // Returns: [Overdue, ThisWeek, Later]
 */
export function sortByUrgency<T extends { daysUntil: number }>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => a.daysUntil - b.daysUntil);
}

// ============================================================================
// DEADLINE EXTRACTION
// ============================================================================


/**
 * Extract all applicable deadlines from a case.
 *
 * Uses centralized supersession logic from perm/deadlines module to determine
 * which deadlines are active.
 *
 * Business rules (per perm_flow.md line 41):
 * - A deadline becomes inactive/met once the "filed" field has a value
 * - PWD expiration: Active until ETA 9089 is filed
 * - Filing window: Active until ETA 9089 is filed
 * - I-140 deadline: Active after ETA 9089 certification until I-140 is filed
 * - RFI/RFE: Active until response is submitted
 *
 * @param caseData - Case data from database
 * @param todayISO - Today's date as ISO string (YYYY-MM-DD)
 * @returns Array of deadline items (partial, missing some fields like urgency)
 *
 * @example
 * extractDeadlines({
 *   caseStatus: "pwd",
 *   pwdExpirationDate: "2025-06-30",
 *   eta9089FilingDate: undefined,
 *   // ... other fields
 * }, "2025-01-15")
 * // Returns: [{ type: "pwd_expiration", date: "2025-06-30", daysUntil: 166, ... }]
 */
/**
 * Partial deadline item returned by extractDeadlines.
 * Contains the raw extracted data before full DeadlineItem construction.
 */
export interface ExtractedDeadline {
  type: DeadlineType;
  label: string;
  date: string;
  daysUntil: number;
}

/**
 * Convert dashboard CaseDataForDeadlines to perm/deadlines CaseDataForDeadlines.
 * This bridges the two type systems for supersession checks.
 */
function toPermCaseData(caseData: CaseDataForDeadlines): PermCaseDataForDeadlines {
  return {
    _id: caseData._id as unknown as PermCaseDataForDeadlines["_id"],
    caseStatus: caseData.caseStatus,
    progressStatus: caseData.progressStatus,
    deletedAt: caseData.deletedAt,
    pwdExpirationDate: caseData.pwdExpirationDate,
    eta9089FilingDate: caseData.eta9089FilingDate,
    eta9089CertificationDate: caseData.eta9089CertificationDate,
    eta9089ExpirationDate: caseData.eta9089ExpirationDate,
    i140FilingDate: caseData.i140FilingDate,
    rfiEntries: caseData.rfiEntries,
    rfeEntries: caseData.rfeEntries,
    filingWindowOpens: caseData.filingWindowOpens,
    filingWindowCloses: caseData.filingWindowCloses,
  };
}

export function extractDeadlines(
  caseData: CaseDataForDeadlines,
  todayISO: string
): ExtractedDeadline[] {
  // Convert to perm module type for supersession checks
  const permCaseData = toPermCaseData(caseData);

  // Skip closed cases (using centralized check)
  if (caseData.caseStatus === "closed") {
    return [];
  }

  // Skip deleted cases (using centralized check)
  if (caseData.deletedAt !== undefined) {
    return [];
  }

  const deadlines: ExtractedDeadline[] = [];

  // PWD expiration deadline (using centralized supersession check)
  const pwdStatus = isDeadlineActive("pwd_expiration", permCaseData);
  if (pwdStatus.isActive && caseData.pwdExpirationDate) {
    try {
      const daysUntil = daysBetween(todayISO, caseData.pwdExpirationDate);

      deadlines.push({
        type: "pwd_expiration",
        label: "PWD Expiration",
        date: caseData.pwdExpirationDate,
        daysUntil,
      });
    } catch (error) {
      log.error('Failed to extract PWD expiration deadline', {
        resourceId: caseData._id,
        pwdExpirationDate: caseData.pwdExpirationDate,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // RFI due deadline (using centralized active entry finder)
  const activeRfi = getActiveRfiEntry(caseData.rfiEntries ?? []);
  if (activeRfi?.responseDueDate) {
    try {
      const daysUntil = daysBetween(todayISO, activeRfi.responseDueDate);

      deadlines.push({
        type: "rfi_due",
        label: "RFI Response Due",
        date: activeRfi.responseDueDate,
        daysUntil,
      });
    } catch (error) {
      log.error('Failed to extract RFI deadline', {
        resourceId: caseData._id,
        responseDueDate: activeRfi.responseDueDate,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // RFE due deadline (using centralized active entry finder)
  const activeRfe = getActiveRfeEntry(caseData.rfeEntries ?? []);
  if (activeRfe?.responseDueDate) {
    try {
      const daysUntil = daysBetween(todayISO, activeRfe.responseDueDate);

      deadlines.push({
        type: "rfe_due",
        label: "RFE Response Due",
        date: activeRfe.responseDueDate,
        daysUntil,
      });
    } catch (error) {
      log.error('Failed to extract RFE deadline', {
        resourceId: caseData._id,
        responseDueDate: activeRfe.responseDueDate,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // I-140 filing deadline (using centralized supersession check)
  const i140Status = isDeadlineActive("i140_filing_deadline", permCaseData);
  if (i140Status.isActive && caseData.eta9089ExpirationDate) {
    try {
      const daysUntil = daysBetween(todayISO, caseData.eta9089ExpirationDate);

      deadlines.push({
        type: "i140_filing_deadline",
        label: "I-140 Filing Deadline",
        date: caseData.eta9089ExpirationDate,
        daysUntil,
      });
    } catch (error) {
      log.error('Failed to extract I-140 deadline', {
        resourceId: caseData._id,
        eta9089ExpirationDate: caseData.eta9089ExpirationDate,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Filing window deadlines (using centralized supersession check)
  const filingWindowStatus = isDeadlineActive("filing_window_opens", permCaseData);
  if (filingWindowStatus.isActive) {
    // Filing window opens (30 days after last recruitment ends)
    // Prefer stored value if available, otherwise calculate
    let windowOpensISO: string | null = null;

    if (caseData.filingWindowOpens) {
      // Use stored derived value
      windowOpensISO = caseData.filingWindowOpens;
    } else {
      // Fall back to calculation using derivedCalculations.ts (for backwards compatibility)
      const recruitmentEndDate = calcRecruitmentEndDate({
        sundayAdSecondDate: caseData.sundayAdSecondDate ?? null,
        jobOrderEndDate: caseData.jobOrderEndDate ?? null,
        noticeOfFilingEndDate: caseData.noticeOfFilingEndDate ?? null,
        additionalRecruitmentEndDate: caseData.additionalRecruitmentEndDate ?? null,
        additionalRecruitmentMethods: caseData.additionalRecruitmentMethods,
        isProfessionalOccupation: caseData.isProfessionalOccupation ?? false,
      });
      windowOpensISO = calcFilingWindowOpens(recruitmentEndDate);
    }

    if (windowOpensISO) {
      try {
        const daysUntilOpen = daysBetween(todayISO, windowOpensISO);
        deadlines.push({
          type: "filing_window_opens",
          label: "ETA 9089 Filing Window Opens",
          date: windowOpensISO,
          daysUntil: daysUntilOpen,
        });
      } catch (error) {
        log.error('Failed to extract filing window opens', {
          resourceId: caseData._id,
          windowOpensISO,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // ETA 9089 Filing window closes: MIN(180 days after FIRST recruitment, PWD expiration)
    // Per perm_flow.md: "pwded trumps" the 180-day window
    // Prefer stored value if available, otherwise calculate
    let windowCloseISO: string | null = null;

    if (caseData.filingWindowCloses) {
      // Use stored derived value
      windowCloseISO = caseData.filingWindowCloses;
    } else {
      // Fall back to calculation using derivedCalculations.ts (for backwards compatibility)
      const recruitmentStartDate = calcRecruitmentStartDate({
        sundayAdFirstDate: caseData.sundayAdFirstDate ?? null,
        jobOrderStartDate: caseData.jobOrderStartDate ?? null,
        noticeOfFilingStartDate: caseData.noticeOfFilingStartDate ?? null,
      });
      windowCloseISO = calcFilingWindowCloses(
        recruitmentStartDate,
        caseData.pwdExpirationDate ?? null
      );
    }

    if (windowCloseISO) {
      try {
        const daysUntilClose = daysBetween(todayISO, windowCloseISO);
        deadlines.push({
          type: "recruitment_window",
          label: "ETA 9089 Filing Window Closes",
          date: windowCloseISO,
          daysUntil: daysUntilClose,
        });
      } catch (error) {
        log.error('Failed to extract filing window closes', {
          resourceId: caseData._id,
          windowCloseISO,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return deadlines;
}

// NOTE: calculateRecruitmentEndDate has been removed from this file.
// Use calcRecruitmentEndDate from derivedCalculations.ts as the canonical source.
// See: convex/lib/derivedCalculations.ts

// ============================================================================
// DEADLINE GROUPING
// ============================================================================

/**
 * Group deadlines by urgency and sort within each group.
 *
 * @param deadlines - Array of deadline items
 * @returns Grouped and sorted deadlines
 *
 * @example
 * groupDeadlinesByUrgency([
 *   { daysUntil: -5, ... },
 *   { daysUntil: 3, ... },
 *   { daysUntil: 15, ... },
 *   { daysUntil: 100, ... },
 * ])
 * // Returns:
 * // {
 * //   overdue: [{ daysUntil: -5 }],
 * //   thisWeek: [{ daysUntil: 3 }],
 * //   thisMonth: [{ daysUntil: 15 }],
 * //   later: [{ daysUntil: 100 }],
 * //   totalCount: 4
 * // }
 */
/**
 * Generic grouped result type for any deadline-like object.
 */
export interface GroupedDeadlines<T> {
  overdue: T[];
  thisWeek: T[];
  thisMonth: T[];
  later: T[];
  totalCount: number;
}

export function groupDeadlinesByUrgency<T extends { daysUntil: number }>(
  deadlines: T[]
): GroupedDeadlines<T> {
  const groups: GroupedDeadlines<T> = {
    overdue: [],
    thisWeek: [],
    thisMonth: [],
    later: [],
    totalCount: deadlines.length,
  };

  for (const deadline of deadlines) {
    const urgency = calculateUrgency(deadline.daysUntil);
    groups[urgency].push(deadline);
  }

  // Sort each group by daysUntil ascending (most urgent first)
  groups.overdue = sortByUrgency(groups.overdue);
  groups.thisWeek = sortByUrgency(groups.thisWeek);
  groups.thisMonth = sortByUrgency(groups.thisMonth);
  groups.later = sortByUrgency(groups.later);

  return groups;
}

// ============================================================================
// DEADLINE TYPE MAPPING
// ============================================================================

/**
 * Map extracted deadline types to dashboard display types.
 *
 * The helper extracts "rfi_due" and "rfe_due" but dashboard/tests expect
 * "rfi_response" and "rfe_response". The helper extracts "i140_filing_deadline"
 * but tests expect different names based on urgency:
 *   - "eta9089_expiration" when urgent (< 30 days)
 *   - "i140_filing_window" when not urgent (>= 30 days)
 *
 * @param type - The extracted deadline type
 * @param daysUntil - Days until deadline (used for I-140 urgency naming)
 * @returns The mapped deadline type for dashboard display
 */
export function mapDeadlineType(
  type: DeadlineType,
  daysUntil: number
): DeadlineType {
  if (type === "rfi_due") return "rfi_response";
  if (type === "rfe_due") return "rfe_response";
  if (type === "i140_filing_deadline") {
    return daysUntil < 30 ? "eta9089_expiration" : "i140_filing_window";
  }
  return type;
}

// ============================================================================
// SUBTEXT BUILDERS
// ============================================================================

/**
 * Build PWD stage subtext.
 *
 * Formula (per perm_flow.md):
 * - working = working + waiting_intake + under_review
 * - filed = filed + approved
 *
 * @param breakdown - PWD progress breakdown
 * @returns Formatted subtext (e.g., "5 working, 3 filed")
 *
 * @example
 * buildPwdSubtext({ working: 5, filed: 3 })  // "5 working, 3 filed"
 * buildPwdSubtext({ working: 0, filed: 0 })  // ""
 * buildPwdSubtext({ working: 1, filed: 0 })  // "1 working"
 */
export function buildPwdSubtext(breakdown: PwdBreakdown): string {
  const parts: string[] = [];

  if (breakdown.working > 0) {
    parts.push(`${breakdown.working} working`);
  }

  if (breakdown.filed > 0) {
    parts.push(`${breakdown.filed} filed`);
  }

  return parts.join(", ");
}

/**
 * Build Recruitment stage subtext.
 *
 * Formula (per perm_flow.md):
 * - ready = working + waiting_intake
 * - inProgress = under_review + filed + approved
 *
 * @param breakdown - Recruitment progress breakdown
 * @returns Formatted subtext (e.g., "5 ready, 3 in progress")
 *
 * @example
 * buildRecruitmentSubtext({ ready: 5, inProgress: 3 })  // "5 ready, 3 in progress"
 * buildRecruitmentSubtext({ ready: 0, inProgress: 0 })  // ""
 * buildRecruitmentSubtext({ ready: 1, inProgress: 0 })  // "1 ready"
 */
export function buildRecruitmentSubtext(
  breakdown: RecruitmentBreakdown
): string {
  const parts: string[] = [];

  if (breakdown.ready > 0) {
    parts.push(`${breakdown.ready} ready`);
  }

  if (breakdown.inProgress > 0) {
    parts.push(`${breakdown.inProgress} in progress`);
  }

  return parts.join(", ");
}

/**
 * Build ETA 9089 stage subtext.
 *
 * Formula (per perm_flow.md):
 * - prep = working + waiting_intake + under_review
 * - rfi = rfi_rfe
 * - filed = filed + approved
 *
 * @param breakdown - ETA 9089 progress breakdown
 * @returns Formatted subtext (e.g., "3 prep, 1 RFI, 2 filed")
 *
 * @example
 * buildEta9089Subtext({ prep: 3, rfi: 1, filed: 2 })  // "3 prep, 1 RFI, 2 filed"
 * buildEta9089Subtext({ prep: 0, rfi: 0, filed: 0 })  // ""
 * buildEta9089Subtext({ prep: 3, rfi: 0, filed: 2 })  // "3 prep, 2 filed"
 */
export function buildEta9089Subtext(breakdown: Eta9089Breakdown): string {
  const parts: string[] = [];

  if (breakdown.prep > 0) {
    parts.push(`${breakdown.prep} prep`);
  }

  if (breakdown.rfi > 0) {
    parts.push(`${breakdown.rfi} RFI`);
  }

  if (breakdown.filed > 0) {
    parts.push(`${breakdown.filed} filed`);
  }

  return parts.join(", ");
}

/**
 * Build I-140 stage subtext.
 *
 * Formula (per perm_flow.md):
 * - prep = working + waiting_intake + under_review
 * - rfe = rfi_rfe
 * - filed = filed + approved
 *
 * @param breakdown - I-140 progress breakdown
 * @returns Formatted subtext (e.g., "4 prep, 2 RFE, 3 filed")
 *
 * @example
 * buildI140Subtext({ prep: 4, rfe: 2, filed: 3 })  // "4 prep, 2 RFE, 3 filed"
 * buildI140Subtext({ prep: 0, rfe: 0, filed: 0 })  // ""
 * buildI140Subtext({ prep: 4, rfe: 0, filed: 3 })  // "4 prep, 3 filed"
 */
export function buildI140Subtext(breakdown: I140Breakdown): string {
  const parts: string[] = [];

  if (breakdown.prep > 0) {
    parts.push(`${breakdown.prep} prep`);
  }

  if (breakdown.rfe > 0) {
    parts.push(`${breakdown.rfe} RFE`);
  }

  if (breakdown.filed > 0) {
    parts.push(`${breakdown.filed} filed`);
  }

  return parts.join(", ");
}
