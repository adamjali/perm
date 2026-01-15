/**
 * Case List Types
 * TypeScript type definitions for case list functionality.
 */

import type { Id } from "../_generated/dataModel";
import type { CaseStatus, ProgressStatus } from "./dashboardTypes";

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Available sort fields for case list.
 */
export type CaseListSortField =
  | "deadline"
  | "updated"
  | "employer"
  | "status"
  | "pwdFiled"
  | "etaFiled"
  | "i140Filed"
  | "custom"
  | "favorites";

/**
 * Sort order direction.
 */
export type SortOrder = "asc" | "desc";

// ============================================================================
// CONST ARRAYS (for runtime validation)
// ============================================================================

export const CASE_LIST_SORT_FIELDS = [
  "deadline",
  "updated",
  "employer",
  "status",
  "pwdFiled",
  "etaFiled",
  "i140Filed",
  "custom",
  "favorites",
] as const satisfies readonly CaseListSortField[];

export const SORT_ORDERS = ["asc", "desc"] as const satisfies readonly SortOrder[];

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard for CaseListSortField.
 */
export function isCaseListSortField(value: unknown): value is CaseListSortField {
  return (
    typeof value === "string" &&
    (CASE_LIST_SORT_FIELDS as readonly string[]).includes(value)
  );
}

/**
 * Type guard for SortOrder.
 */
export function isSortOrder(value: unknown): value is SortOrder {
  return typeof value === "string" && (SORT_ORDERS as readonly string[]).includes(value);
}

// ============================================================================
// FILTER TYPES
// ============================================================================

/**
 * Filters for case list queries.
 * All fields are optional - undefined means "no filter applied".
 */
export interface CaseListFilters {
  readonly status?: CaseStatus;
  readonly progressStatus?: ProgressStatus;
  readonly searchQuery?: string;
  readonly favoritesOnly?: boolean;
  readonly duplicatesOnly?: boolean; // Show only cases marked as duplicates
}

// ============================================================================
// SORT TYPES
// ============================================================================

/**
 * Sort configuration for case list queries.
 */
export interface CaseListSort {
  readonly sortBy: CaseListSortField;
  readonly sortOrder: SortOrder;
}

// ============================================================================
// PAGINATION TYPES
// ============================================================================

/**
 * Brand symbol to prevent direct construction of CaseListPagination.
 * Use createCaseListPagination() factory to create instances.
 */
declare const CaseListPaginationBrand: unique symbol;

/**
 * Pagination metadata for case list queries.
 * Invariant: `totalPages` is always derived from `totalCount / pageSize` via factory.
 *
 * MUST be created via createCaseListPagination() factory function to guarantee
 * consistency between totalPages and other fields.
 */
export interface CaseListPagination {
  readonly page: number;
  readonly pageSize: number;
  readonly totalCount: number;
  readonly totalPages: number;
  /** @internal Brand to prevent direct construction */
  readonly [CaseListPaginationBrand]: true;
}

/**
 * Factory function to create CaseListPagination with calculated totalPages.
 */
export function createCaseListPagination(params: {
  page: number;
  pageSize: number;
  totalCount: number;
}): CaseListPagination {
  const totalPages = params.totalCount === 0 ? 0 : Math.ceil(params.totalCount / params.pageSize);

  return {
    page: params.page,
    pageSize: params.pageSize,
    totalCount: params.totalCount,
    totalPages,
  } as CaseListPagination;
}

// ============================================================================
// CASE CARD DATA TYPES
// ============================================================================

/**
 * Brand symbol to prevent direct construction of CaseCardData.
 * Use createCaseCardData() factory to create instances.
 */
declare const CaseCardDataBrand: unique symbol;

/**
 * Date badges to display on case cards.
 * All dates are optional - undefined means "not filed yet".
 */
export interface CaseCardDates {
  // PWD dates
  readonly pwdFiled?: string; // ISO date string (YYYY-MM-DD)
  readonly pwdDetermined?: string; // ISO date string (YYYY-MM-DD)
  readonly pwdExpires?: string; // ISO date string (YYYY-MM-DD)

  // Recruitment dates
  readonly recruitmentStart?: string; // ISO date string (YYYY-MM-DD)
  readonly recruitmentEnd?: string; // ISO date string (YYYY-MM-DD)

  // ETA 9089 dates
  readonly etaFiled?: string; // ISO date string (YYYY-MM-DD)
  readonly etaWindowOpens?: string; // ISO date string (YYYY-MM-DD) - calculated
  readonly etaCertified?: string; // ISO date string (YYYY-MM-DD)
  readonly etaExpires?: string; // ISO date string (YYYY-MM-DD)

  // I-140 dates
  readonly i140Filed?: string; // ISO date string (YYYY-MM-DD)
  readonly i140Approved?: string; // ISO date string (YYYY-MM-DD)

  // Metadata
  readonly created: number; // Unix timestamp
  readonly updated: number; // Unix timestamp
}

/**
 * Closed reason for terminal case states.
 * Matches schema closureReason values.
 */
export type ClosedReason =
  | "withdrawn"
  | "denied"
  | "pwd_expired"
  | "recruitment_window_missed"
  | "filing_window_missed"
  | "eta9089_expired"
  | "manual"
  | "other";

/**
 * Minimal projection of case data for display in case list cards.
 * Only includes fields needed for rendering the card UI.
 *
 * MUST be created via createCaseCardData() factory function.
 */
export interface CaseCardData {
  readonly _id: Id<"cases">;
  readonly employerName: string;
  readonly beneficiaryIdentifier: string;
  readonly caseStatus: CaseStatus;
  readonly progressStatus: ProgressStatus;
  readonly nextDeadline?: string; // ISO date string (YYYY-MM-DD)
  readonly nextDeadlineLabel?: string; // Human-readable label (e.g., "PWD expires", "RFI due")
  readonly isFavorite: boolean;
  readonly isPinned: boolean;
  readonly isProfessionalOccupation?: boolean;
  readonly hasActiveRfi?: boolean;
  readonly hasActiveRfe?: boolean;
  readonly calendarSyncEnabled?: boolean;
  readonly showOnTimeline?: boolean;
  readonly notes?: string; // Concatenated notes for preview
  readonly dates: CaseCardDates;
  // Closed case fields
  readonly closedReason?: ClosedReason;
  readonly closedAt?: string; // ISO date string (YYYY-MM-DD)
  // Duplicate tracking
  readonly duplicateOf?: Id<"cases">; // ID of the case this is a duplicate of
  /** @internal Brand to prevent direct construction */
  readonly [CaseCardDataBrand]: true;
}

/**
 * Factory function to create CaseCardData with properly structured dates.
 */
export function createCaseCardData(params: {
  _id: Id<"cases">;
  employerName: string;
  beneficiaryIdentifier: string;
  caseStatus: CaseStatus;
  progressStatus: ProgressStatus;
  nextDeadline?: string;
  nextDeadlineLabel?: string;
  isFavorite: boolean;
  isPinned: boolean;
  isProfessionalOccupation?: boolean;
  hasActiveRfi?: boolean;
  hasActiveRfe?: boolean;
  calendarSyncEnabled?: boolean;
  showOnTimeline?: boolean;
  notes?: string;
  // PWD dates
  pwdFilingDate?: string;
  pwdDeterminationDate?: string;
  pwdExpirationDate?: string;
  // Recruitment dates (derived: MIN of starts, MAX of ends)
  recruitmentStartDate?: string;
  recruitmentEndDate?: string;
  // ETA 9089 dates
  eta9089FilingDate?: string;
  eta9089WindowOpens?: string;
  eta9089CertificationDate?: string;
  eta9089ExpirationDate?: string;
  // I-140 dates
  i140FilingDate?: string;
  i140ApprovalDate?: string;
  // Closed case fields
  closedReason?: ClosedReason;
  closedAt?: string;
  // Duplicate tracking
  duplicateOf?: Id<"cases">;
  // Metadata
  _creationTime: number;
  updatedAt: number;
}): CaseCardData {
  return {
    _id: params._id,
    employerName: params.employerName,
    beneficiaryIdentifier: params.beneficiaryIdentifier,
    caseStatus: params.caseStatus,
    progressStatus: params.progressStatus,
    nextDeadline: params.nextDeadline,
    nextDeadlineLabel: params.nextDeadlineLabel,
    isFavorite: params.isFavorite,
    isPinned: params.isPinned,
    isProfessionalOccupation: params.isProfessionalOccupation,
    hasActiveRfi: params.hasActiveRfi,
    hasActiveRfe: params.hasActiveRfe,
    calendarSyncEnabled: params.calendarSyncEnabled,
    showOnTimeline: params.showOnTimeline,
    notes: params.notes,
    dates: {
      // PWD
      pwdFiled: params.pwdFilingDate,
      pwdDetermined: params.pwdDeterminationDate,
      pwdExpires: params.pwdExpirationDate,
      // Recruitment (derived fields: MIN of starts, MAX of ends)
      recruitmentStart: params.recruitmentStartDate,
      recruitmentEnd: params.recruitmentEndDate,
      // ETA 9089
      etaFiled: params.eta9089FilingDate,
      etaWindowOpens: params.eta9089WindowOpens,
      etaCertified: params.eta9089CertificationDate,
      etaExpires: params.eta9089ExpirationDate,
      // I-140
      i140Filed: params.i140FilingDate,
      i140Approved: params.i140ApprovalDate,
      // Metadata
      created: params._creationTime,
      updated: params.updatedAt,
    },
    closedReason: params.closedReason,
    closedAt: params.closedAt,
    duplicateOf: params.duplicateOf,
  } as CaseCardData;
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

/**
 * Response type for case list queries.
 * Contains paginated case data and metadata.
 */
export interface CaseListResponse {
  readonly cases: readonly CaseCardData[];
  readonly pagination: CaseListPagination;
}
