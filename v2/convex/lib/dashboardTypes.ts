/**
 * Dashboard Types
 * TypeScript type definitions for dashboard helper functions.
 */

import type { Id } from "../_generated/dataModel";
import type { CaseStatus, ProgressStatus } from "./perm/statusTypes";

// ============================================================================
// STATUS TYPES (re-exported from canonical source)
// ============================================================================

export {
  type CaseStatus,
  type ProgressStatus,
  CASE_STATUSES,
  PROGRESS_STATUSES,
} from "./perm/statusTypes";

// ============================================================================
// ENUMS
// ============================================================================

export type UrgencyGroup = "overdue" | "thisWeek" | "thisMonth" | "later";

/**
 * Deadline types for dashboard widget (backend/Convex context).
 * Uses snake_case naming convention per Convex/database conventions.
 *
 * NOTE: This is distinct from calendar/types.ts DeadlineType which uses
 * camelCase for frontend timeline visualization. The two serve different purposes:
 * - Dashboard: Actionable deadlines requiring user attention (snake_case)
 * - Calendar: All case milestones for timeline display (camelCase)
 *
 * @see ./deadlineTypeMapping.ts for bidirectional conversion between conventions
 */
export type DeadlineType =
  | "pwd_expiration"
  | "rfi_due"
  | "rfe_due"
  | "rfi_response"
  | "rfe_response"
  | "i140_filing_deadline"
  | "eta9089_expiration"
  | "i140_filing_window"
  | "recruitment_window"
  | "filing_window_opens";

// ============================================================================
// CASE DATA TYPE (for deadline extraction)
// ============================================================================

/**
 * Subset of case fields needed for deadline extraction.
 * This interface matches the Convex schema but is defined separately
 * to keep helper functions pure and testable without Convex dependencies.
 */
export interface CaseDataForDeadlines {
  // Identification (optional - only used when building full DeadlineItem)
  _id?: string;
  caseNumber?: string;
  employerName: string;
  beneficiaryIdentifier?: string; // Optional - falls back to positionTitle for display

  // Status fields
  caseStatus: CaseStatus;
  progressStatus: ProgressStatus;
  deletedAt?: number;

  // PWD dates
  pwdExpirationDate?: string;

  // ETA 9089 dates
  eta9089FilingDate?: string;
  eta9089CertificationDate?: string;
  eta9089ExpirationDate?: string;

  // RFI/RFE entries (arrays)
  rfiEntries?: Array<{
    id: string;
    receivedDate: string;
    responseDueDate: string;
    responseSubmittedDate?: string;
    createdAt: number;
  }>;
  rfeEntries?: Array<{
    id: string;
    receivedDate: string;
    responseDueDate: string;
    responseSubmittedDate?: string;
    createdAt: number;
  }>;

  // I-140 dates
  i140FilingDate?: string;

  // Recruitment dates (for recruitment window deadline)
  // All dates needed to calculate complete recruitment end
  sundayAdSecondDate?: string;
  jobOrderEndDate?: string;
  noticeOfFilingEndDate?: string;
  additionalRecruitmentEndDate?: string;
  isProfessionalOccupation?: boolean;
  additionalRecruitmentMethods?: Array<{
    method: string;
    date: string;
    description?: string;
  }>;

  // First recruitment date (for 180-day filing window close)
  sundayAdFirstDate?: string;
  jobOrderStartDate?: string;
  noticeOfFilingStartDate?: string;

  /**
   * Stored derived fields (computed on save by derivedCalculations.ts)
   *
   * ⚠️ STALENESS WARNING: These fields are computed when the case is saved,
   * NOT on every read. They can become stale if:
   * - Recruitment dates change without a full case save
   * - PWD expiration changes (affects filingWindowCloses)
   * - Database migration doesn't recalculate
   *
   * If these fields are present, they should be used instead of recalculating
   * (for performance). If accuracy is critical, consider recalculating or
   * verifying these values against source dates.
   *
   * @see derivedCalculations.ts for the calculation logic
   */
  filingWindowOpens?: string;
  filingWindowCloses?: string;
}

// ============================================================================
// DEADLINE TYPES
// ============================================================================

/**
 * Brand symbol to prevent direct construction of DeadlineItem.
 * Use createDeadlineItem() factory to create instances.
 */
declare const DeadlineItemBrand: unique symbol;

/**
 * DeadlineItem represents a single deadline with computed urgency.
 * Invariant: `urgency` is always derived from `daysUntil` via calculateUrgency().
 *
 * MUST be created via createDeadlineItem() factory function to guarantee
 * consistency between urgency and daysUntil values.
 */
export interface DeadlineItem {
  readonly caseId: Id<"cases">;
  readonly caseNumber?: string;
  readonly employerName: string;
  readonly beneficiaryName: string;
  readonly positionTitle: string;
  readonly type: DeadlineType;
  readonly label: string;
  readonly dueDate: string; // ISO date string (YYYY-MM-DD)
  readonly daysUntil: number;
  readonly urgency: UrgencyGroup;
  readonly caseStatus: CaseStatus;
  readonly progressStatus: ProgressStatus;
  /** @internal Brand to prevent direct construction */
  readonly [DeadlineItemBrand]: true;
}

export interface DeadlineGroups {
  overdue: DeadlineItem[];
  thisWeek: DeadlineItem[];
  thisMonth: DeadlineItem[];
  later: DeadlineItem[];
  totalCount: number;
}

// ============================================================================
// PROGRESS BREAKDOWN TYPES
// ============================================================================

export type ProgressBreakdown = Record<ProgressStatus, number>;

// PWD breakdown (working = working + waiting_intake + under_review, filed = filed + approved)
export interface PwdBreakdown {
  working: number;
  filed: number;
}

// Recruitment breakdown (ready = working + waiting_intake, inProgress = under_review + filed + approved)
export interface RecruitmentBreakdown {
  ready: number;
  inProgress: number;
}

// ETA 9089 breakdown (prep = working + waiting_intake + under_review, rfi = rfi_rfe, filed = filed + approved)
export interface Eta9089Breakdown {
  prep: number;
  rfi: number;
  filed: number;
}

// I-140 breakdown (prep = working + waiting_intake + under_review, rfe = rfi_rfe, filed = filed + approved)
export interface I140Breakdown {
  prep: number;
  rfe: number;
  filed: number;
}

// ============================================================================
// DASHBOARD SUMMARY TYPES
// ============================================================================

export interface StatusCount {
  count: number;
  subtext: string;
}

export interface DashboardSummary {
  pwd: StatusCount;
  recruitment: StatusCount;
  eta9089: StatusCount;
  i140: StatusCount;
  complete: StatusCount;
  closed: StatusCount;
  duplicates: StatusCount;
  total: number;
}

/**
 * Factory function to create a DashboardSummary with computed total.
 *
 * Enforces the invariant that `total` equals the sum of all stage counts
 * (excluding duplicates as they overlap with other stages).
 *
 * @param counts - Individual stage counts
 * @returns DashboardSummary with computed total
 */
export function createDashboardSummary(counts: {
  pwd: StatusCount;
  recruitment: StatusCount;
  eta9089: StatusCount;
  i140: StatusCount;
  complete: StatusCount;
  closed: StatusCount;
  duplicates: StatusCount;
}): DashboardSummary {
  // Total excludes duplicates since they're already counted in their respective stages
  const total =
    counts.pwd.count +
    counts.recruitment.count +
    counts.eta9089.count +
    counts.i140.count +
    counts.complete.count +
    counts.closed.count;

  return {
    ...counts,
    total,
  };
}

// ============================================================================
// ACTIVITY TYPES
// ============================================================================

export interface RecentActivityItem {
  id: Id<"cases">;
  caseNumber?: string;
  employerName: string;
  beneficiaryIdentifier: string;
  positionTitle: string;
  action: string;
  timestamp: number;
  caseStatus: CaseStatus;
  progressStatus: ProgressStatus;
}
