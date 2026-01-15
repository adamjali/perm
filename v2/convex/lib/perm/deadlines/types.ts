/**
 * Deadline Types and Interfaces
 *
 * Central type definitions for deadline extraction and supersession logic.
 * Used by dashboard, calendar, scheduled jobs, and timeline components.
 *
 * @module
 */

import type { Id } from "../../../_generated/dataModel";

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
  | "i140_filing_deadline"
  | "rfi_due"
  | "rfe_due";

/**
 * Human-readable labels for each deadline type.
 */
export const DEADLINE_LABELS: Record<DeadlineType, string> = {
  pwd_expiration: "PWD Expiration",
  filing_window_opens: "ETA 9089 Filing Window Opens",
  filing_window_closes: "ETA 9089 Filing Window Closes",
  recruitment_window_closes: "Recruitment Window Closes",
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

  /** Optional: ID of the RFI/RFE entry this deadline is for */
  entryId?: string;
}

/**
 * Factory function to create an ExtractedDeadline.
 *
 * Enforces the invariant that `label` is always derived from `type` via
 * DEADLINE_LABELS, ensuring consistency across the codebase.
 *
 * @param params - Deadline parameters (type, date, daysUntil, optional entryId)
 * @returns ExtractedDeadline with label derived from type
 */
export function createExtractedDeadline(params: {
  type: DeadlineType;
  date: string;
  daysUntil: number;
  entryId?: string;
}): ExtractedDeadline {
  return {
    type: params.type,
    label: DEADLINE_LABELS[params.type],
    date: params.date,
    daysUntil: params.daysUntil,
    entryId: params.entryId,
  };
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
  supersededReason?: string;
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
  NO_DATE: "No date set for this deadline",
  NOT_CERTIFIED: "ETA 9089 not yet certified",
} as const;

export type SupersessionReason =
  (typeof SUPERSESSION_REASONS)[keyof typeof SUPERSESSION_REASONS];
