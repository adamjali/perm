/**
 * Timeline milestone and range bar types for case visualization.
 *
 * Used by the timeline component to display case progress with milestones
 * and date ranges.
 */

import type { Id } from "../../../convex/_generated/dataModel";
import type { RfiEntry, RfeEntry, AdditionalRecruitmentMethod } from "../shared/types";

// Re-export shared types for convenience
export type { RfiEntry, RfeEntry, AdditionalRecruitmentMethod } from "../shared/types";

// ============================================================================
// Stage and Color Types
// ============================================================================

/**
 * Stage types for timeline milestones.
 * Only 4 main case stages + RFI/RFE indicators.
 * "calculated" was removed - calculated milestones now use "eta9089" stage
 * since they relate to ETA 9089 filing window.
 */
export type Stage =
  | "pwd"
  | "recruitment"
  | "eta9089"
  | "i140"
  | "rfi"
  | "rfe";

/**
 * Stage colors for timeline visualization.
 * Matches the design system color palette.
 * PWD=blue, Recruitment=purple, ETA9089=orange, I-140=green, RFI/RFE=red
 */
export const STAGE_COLORS: Record<Stage, string> = {
  pwd: "#0066FF",
  recruitment: "#9333ea",
  eta9089: "#ea580c",
  i140: "#16a34a",
  rfi: "#dc2626",
  rfe: "#dc2626",
} as const;

// ============================================================================
// Milestone Types
// ============================================================================

/**
 * Represents a single milestone on the timeline.
 */
export interface Milestone {
  /** Field name in case data, e.g., "pwdFilingDate", "readyToFile" */
  field: string;
  /** Human-readable label, e.g., "PWD Filed", "Ready to File" */
  label: string;
  /** ISO date string (YYYY-MM-DD) */
  date: string;
  /** Stage of the PERM process this milestone belongs to */
  stage: Stage;
  /** Hex color for the milestone marker */
  color: string;
  /** True for calculated milestones (Ready to File, Recruitment Expires) */
  isCalculated: boolean;
  /** Order number for RFI/RFE entries (1-based) */
  order?: number;
}

/**
 * Represents a date range bar on the timeline (e.g., job order period).
 */
export interface RangeBar {
  /** Field name prefix in case data, e.g., "jobOrder" */
  field: string;
  /** Human-readable label */
  label: string;
  /** Start date (ISO string YYYY-MM-DD) */
  startDate: string;
  /** End date (ISO string YYYY-MM-DD) */
  endDate: string;
  /** Stage this range belongs to */
  stage: "recruitment";
  /** Hex color for the range bar */
  color: string;
}

// ============================================================================
// Milestone Configuration
// ============================================================================

export interface MilestoneConfig {
  field: string;
  label: string;
  stage: Stage;
}

/**
 * Static milestone configuration for all standard PERM milestones.
 * Ordered by typical case progression.
 */
export const MILESTONE_CONFIG: readonly MilestoneConfig[] = [
  // PWD phase
  { field: "pwdFilingDate", label: "PWD Filed", stage: "pwd" },
  { field: "pwdDeterminationDate", label: "PWD Determined", stage: "pwd" },
  { field: "pwdExpirationDate", label: "PWD Expires", stage: "pwd" },

  // Recruitment phase
  { field: "sundayAdFirstDate", label: "1st Sunday Ad", stage: "recruitment" },
  { field: "sundayAdSecondDate", label: "2nd Sunday Ad", stage: "recruitment" },
  { field: "jobOrderStartDate", label: "Job Order Start", stage: "recruitment" },
  { field: "jobOrderEndDate", label: "Job Order End", stage: "recruitment" },
  { field: "noticeOfFilingStartDate", label: "Notice Posted", stage: "recruitment" },
  { field: "noticeOfFilingEndDate", label: "Notice End", stage: "recruitment" },
  // Professional occupation additional recruitment (only shown if isProfessionalOccupation)
  { field: "additionalRecruitmentStartDate", label: "Addl Recruitment Start", stage: "recruitment" },
  { field: "additionalRecruitmentEndDate", label: "Addl Recruitment End", stage: "recruitment" },

  // ETA 9089 phase
  { field: "eta9089FilingDate", label: "ETA 9089 Filed", stage: "eta9089" },
  {
    field: "eta9089CertificationDate",
    label: "ETA 9089 Certified",
    stage: "eta9089",
  },
  {
    field: "eta9089ExpirationDate",
    label: "ETA 9089 Expires",
    stage: "eta9089",
  },

  // I-140 phase
  { field: "i140FilingDate", label: "I-140 Filed", stage: "i140" },
  { field: "i140ApprovalDate", label: "I-140 Approved", stage: "i140" },
] as const;

// ============================================================================
// Case Data Types (matching Convex schema)
// ============================================================================

// NOTE: RfiEntry, RfeEntry, and AdditionalRecruitmentMethod are imported from
// ../shared/types.ts and re-exported above. See shared/types.ts for definitions.

/**
 * Subset of case data required for timeline milestone extraction.
 * Uses camelCase field names matching Convex schema.
 */
export interface CaseWithDates {
  _id?: Id<"cases">;

  // PWD phase
  pwdFilingDate?: string | null;
  pwdDeterminationDate?: string | null;
  pwdExpirationDate?: string | null;

  // Recruitment phase
  sundayAdFirstDate?: string | null;
  sundayAdSecondDate?: string | null;
  jobOrderStartDate?: string | null;
  jobOrderEndDate?: string | null;

  // Notice of filing (can affect recruitment start/end date)
  noticeOfFilingStartDate?: string | null;
  noticeOfFilingEndDate?: string | null;

  // Professional occupation additional recruitment
  isProfessionalOccupation?: boolean;
  additionalRecruitmentStartDate?: string | null;
  additionalRecruitmentEndDate?: string | null;
  additionalRecruitmentMethods?: AdditionalRecruitmentMethod[] | null;

  // ETA 9089 phase
  eta9089FilingDate?: string | null;
  eta9089CertificationDate?: string | null;
  eta9089ExpirationDate?: string | null;

  // I-140 phase
  i140FilingDate?: string | null;
  i140ApprovalDate?: string | null;

  // RFI/RFE entries
  rfiEntries?: RfiEntry[] | null;
  rfeEntries?: RfeEntry[] | null;
}
