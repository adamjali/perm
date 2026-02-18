/**
 * Deadline Types and Interfaces
 *
 * Central type definitions for deadline extraction and supersession logic.
 * Used by dashboard, calendar, scheduled jobs, and timeline components.
 *
 * @module
 */

import type { Id } from "../../../_generated/dataModel";
import type { TimezoneRule } from "./timezones";

// ============================================================================
// DEADLINE TYPE ENUM
// ============================================================================

/**
 * All possible deadline types in the PERM process.
 *
 * Uses snake_case naming convention per Convex/database conventions.
 */
export type DeadlineType =
  | "pwd_expiration"
  | "filing_window_opens"
  | "filing_window_closes"
  | "recruitment_window_closes"
  | "job_order_start_deadline"
  | "notice_of_filing_start_deadline"
  | "first_sunday_ad_deadline"
  | "second_sunday_ad_deadline"
  | "i140_filing_deadline"
  | "rfi_due"
  | "rfe_due";

/**
 * All deadline types as a constant array.
 * Used by hasAnyActiveDeadline, getActiveDeadlineTypes, etc.
 */
export const ALL_DEADLINE_TYPES: readonly DeadlineType[] = [
  "pwd_expiration",
  "filing_window_opens",
  "filing_window_closes",
  "recruitment_window_closes",
  "job_order_start_deadline",
  "notice_of_filing_start_deadline",
  "first_sunday_ad_deadline",
  "second_sunday_ad_deadline",
  "i140_filing_deadline",
  "rfi_due",
  "rfe_due",
] as const;

/**
 * Human-readable labels for each deadline type.
 */
export const DEADLINE_LABELS: Record<DeadlineType, string> = {
  pwd_expiration: "PWD Expiration",
  filing_window_opens: "ETA 9089 Filing Window Opens",
  filing_window_closes: "ETA 9089 Filing Window Closes",
  recruitment_window_closes: "Recruitment Window Closes",
  job_order_start_deadline: "Start Job Order By",
  notice_of_filing_start_deadline: "Start Notice of Filing By",
  first_sunday_ad_deadline: "First Sunday Ad By",
  second_sunday_ad_deadline: "Second Sunday Ad By",
  i140_filing_deadline: "I-140 Filing Deadline",
  rfi_due: "RFI Response Due",
  rfe_due: "RFE Response Due",
};

// ============================================================================
// RFI/RFE ENTRY TYPES (re-exported from shared types)
// ============================================================================

// Import canonical type definitions from shared types
// These are the source of truth; deadline extraction uses them via structural typing
import type {
  RfiEntry,
  RfeEntry,
  AdditionalRecruitmentMethod,
} from "../../../../src/lib/shared/types";

// Re-export for consumers of this module
export type { RfiEntry, RfeEntry, AdditionalRecruitmentMethod };

// ============================================================================
// CASE DATA FOR DEADLINE EXTRACTION
// ============================================================================

/**
 * Subset of case fields needed for deadline extraction and supersession checks.
 *
 * This is the minimal interface required to determine which deadlines are active.
 */
export interface CaseDataForDeadlines {
  // Identification
  _id?: Id<"cases">;
  caseNumber?: string;
  employerName?: string;
  beneficiaryIdentifier?: string;

  // Status fields (for filtering)
  caseStatus?: string;
  progressStatus?: string;
  deletedAt?: number;

  // PWD dates
  pwdExpirationDate?: string;

  // ETA 9089 dates (for supersession checks)
  eta9089FilingDate?: string;
  eta9089CertificationDate?: string;
  eta9089ExpirationDate?: string;

  // I-140 dates (for supersession checks)
  i140FilingDate?: string;

  // RFI/RFE entries
  rfiEntries?: RfiEntry[];
  rfeEntries?: RfeEntry[];

  // Recruitment dates (for filing window calculation fallback)
  sundayAdFirstDate?: string;
  sundayAdSecondDate?: string;
  jobOrderStartDate?: string;
  jobOrderEndDate?: string;
  noticeOfFilingStartDate?: string;
  noticeOfFilingEndDate?: string;
  additionalRecruitmentStartDate?: string;
  additionalRecruitmentEndDate?: string;
  isProfessionalOccupation?: boolean;
  additionalRecruitmentMethods?: AdditionalRecruitmentMethod[];

  // Stored derived fields (computed on save)
  filingWindowOpens?: string;
  filingWindowCloses?: string;
  recruitmentWindowCloses?: string;
}

// ============================================================================
// EXTRACTED DEADLINE
// ============================================================================

/**
 * A deadline extracted from a case.
 *
 * Contains the deadline type, date, and computed days until due.
 * This is the output of the extraction process.
 */
export interface ExtractedDeadline {
  /** The type of deadline */
  type: DeadlineType;

  /** Human-readable label (derived from type via DEADLINE_LABELS) */
  label: string;

  /** ISO date string (YYYY-MM-DD) */
  date: string;

  /** Days until deadline (negative = overdue) */
  daysUntil: number;

  /**
   * Timezone rule governing this deadline.
   *
   * - "local": Expires at 11:59 PM in the user's timezone
   * - "dol": Expires at 11:59 PM Eastern Time (DOL FLAG system)
   */
  timezoneRule: TimezoneRule;

  /** Optional: ID of the RFI/RFE entry this deadline is for */
  entryId?: string;
}

// ============================================================================
// SUPERSESSION STATUS
// ============================================================================

/**
 * Result of checking if a deadline is active (not superseded).
 */
export interface DeadlineActiveStatus {
  /** Whether the deadline is active */
  isActive: boolean;

  /** Reason why the deadline is inactive (if applicable) */
  supersededReason?: SupersessionReason;
}

/**
 * Reasons why a deadline may be superseded/inactive.
 */
export const SUPERSESSION_REASONS = {
  CASE_CLOSED: "Case is closed",
  CASE_DELETED: "Case is deleted",
  ETA9089_FILED: "ETA 9089 has been filed",
  I140_FILED: "I-140 has been filed",
  RFI_RESPONDED: "RFI response has been submitted",
  RFE_RESPONDED: "RFE response has been submitted",
  RECRUITMENT_INCOMPLETE: "Recruitment activities not yet complete",
  NO_DATE: "No date set for this deadline",
  NOT_CERTIFIED: "ETA 9089 not yet certified",
  JOB_ORDER_STARTED: "Job order has been started",
  NOTICE_OF_FILING_STARTED: "Notice of filing has been started",
  FIRST_SUNDAY_AD_PLACED: "First Sunday ad has been placed",
  SECOND_SUNDAY_AD_PLACED: "Second Sunday ad has been placed",
  NO_FIRST_RECRUITMENT: "No recruitment activity started yet",
  RECRUITMENT_COMPLETE: "All recruitment activities completed",
} as const;

export type SupersessionReason =
  (typeof SUPERSESSION_REASONS)[keyof typeof SUPERSESSION_REASONS];
