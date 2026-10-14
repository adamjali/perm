/**
 * Case List Helper Functions
 * Pure functions for case list data processing.
 *
 * All functions are testable without database dependencies.
 */

import { FUZZY_MATCH_MIN, fuzzyScore } from "./fuzzy";
import type { CaseCardData, CaseListSortField, SortOrder, ClosedReason } from "./caseListTypes";
import type { UrgencyGroup, DeadlineType, CaseDataForDeadlines } from "./dashboardTypes";
import type { Id } from "../_generated/dataModel";
import {
  extractDeadlines,
  calculateUrgency,
  sortByUrgency,
  type ExtractedDeadline,
} from "./dashboardHelpers";
import { createCaseCardData } from "./caseListTypes";
import { isRecruitmentComplete } from "./perm";

// ============================================================================
// NEXT DEADLINE CALCULATION
// ============================================================================

/**
 * Next deadline result type.
 */
export interface NextDeadline {
  type: ExtractedDeadline["type"];
  date: string;
  daysUntil: number;
  urgency: UrgencyGroup;
}

/**
 * Calculate the most urgent upcoming deadline for a case.
 *
 * Business rules:
 * - Uses extractDeadlines to get all applicable deadlines
 * - Returns the deadline with minimum daysUntil (most urgent)
 * - Returns null if no deadlines exist
 * - Closed and deleted cases return null
 *
 * @param caseData - Case data from database
 * @param todayISO - Today's date as ISO string (YYYY-MM-DD)
 * @returns Most urgent deadline or null if none exist
 *
 * @example
 * calculateNextDeadline({
 *   caseStatus: "eta9089",
 *   pwdExpirationDate: "2025-06-30",
 *   rfiEntries: [{ id: "rfi-1", receivedDate: "2025-01-01", responseDueDate: "2025-01-20", createdAt: 0 }],
 *   // ... other fields
 * }, "2025-01-15")
 * // Returns: { type: "rfi_due", date: "2025-01-20", daysUntil: 5, urgency: "thisWeek" }
 */
export function calculateNextDeadline(
  caseData: CaseDataForDeadlines,
  todayISO: string
): NextDeadline | null {
  const deadlines = extractDeadlines(caseData, todayISO);

  if (deadlines.length === 0) {
    return null;
  }

  // Sort by urgency (most urgent first)
  const sorted = sortByUrgency(deadlines);
  const mostUrgent = sorted[0];

  if (!mostUrgent) {
    return null;
  }

  return {
    type: mostUrgent.type,
    date: mostUrgent.date,
    daysUntil: mostUrgent.daysUntil,
    urgency: calculateUrgency(mostUrgent.daysUntil),
  };
}

// ============================================================================
// CASE PROJECTION
// ============================================================================

/**
 * Project full case data to CaseCardData for case list display.
 *
 * Extracts only the fields needed for card rendering:
 * - Basic identification (id, employer, beneficiary)
 * - Status fields (caseStatus, progressStatus)
 * - Next deadline (calculated from all applicable deadlines)
 * - Key dates (pwdFiled, etaFiled, i140Filed, created, updated)
 * - UI flags (isFavorite)
 *
 * @param caseData - Full case data from database
 * @param todayISO - Today's date as ISO string (YYYY-MM-DD)
 * @returns Minimal case card data projection
 *
 * @example
 * projectCaseForCard({
 *   _id: "case123",
 *   employerName: "ACME Corp",
 *   beneficiaryIdentifier: "John Doe",
 *   caseStatus: "pwd",
 *   progressStatus: "working",
 *   pwdFilingDate: "2024-01-15",
 *   pwdExpirationDate: "2025-06-30",
 *   // ... other fields
 * }, "2025-01-15")
 * // Returns: CaseCardData with nextDeadline calculated
 */
/**
 * Convert deadline type to short card label.
 * Maps ExtractedDeadline labels to shorter versions suitable for card display.
 */
function getDeadlineCardLabel(deadlineType: ExtractedDeadline["type"]): string {
  const labelMap: Partial<Record<DeadlineType, string>> = {
    pwd_expiration: "PWD expires",
    rfi_due: "RFI due",
    rfe_due: "RFE due",
    i140_filing_deadline: "I-140 deadline",
    filing_window_opens: "Filing opens",
    recruitment_window: "ETA window closes",
    recruitment_window_closes: "Recruitment closes",
    eta9089_expiration: "ETA expires",
    rfi_response: "RFI response",
    rfe_response: "RFE response",
    i140_filing_window: "I-140 window",
    job_order_start_deadline: "Job order by",
    notice_of_filing_start_deadline: "Notice by",
    first_sunday_ad_deadline: "1st Sunday ad by",
    second_sunday_ad_deadline: "2nd Sunday ad by",
  };
  return labelMap[deadlineType] || "Deadline";
}

interface NoteEntry {
  id: string;
  content: string;
  createdAt: number;
  status: "pending" | "done" | "deleted";
}

/**
 * Full case data shape needed for projection to CaseCardData.
 * Extends CaseDataForDeadlines with all additional fields needed for display.
 */
interface CaseDataForProjection extends CaseDataForDeadlines {
  _id: Id<"cases">;
  positionTitle: string;
  internalCaseNumber?: string;
  pwdCaseNumber?: string;
  eta9089CaseNumber?: string;
  i140ReceiptNumber?: string;
  notes?: NoteEntry[];
  isFavorite?: boolean;
  isPinned?: boolean;
  isProfessionalOccupation?: boolean;
  calendarSyncEnabled?: boolean;
  pwdFilingDate?: string;
  pwdDeterminationDate?: string;
  // Derived recruitment dates (source of truth: MIN of starts, MAX of ends)
  recruitmentStartDate?: string;
  recruitmentEndDate?: string;
  i140ApprovalDate?: string;
  closureReason?: ClosedReason; // Reason case was closed (schema: closureReason)
  closedAt?: number; // Timestamp from DB, converted to ISO string for card
  duplicateOf?: Id<"cases">; // ID of the case this is a duplicate of
  isSample?: boolean; // Whether this is a sample/demo case
  _creationTime: number;
  updatedAt: number;
}

/** Every number a case carries, space-joined, for the case list's search. */
export function caseSearchNumbers(caseData: {
  caseNumber?: string;
  internalCaseNumber?: string;
  pwdCaseNumber?: string;
  eta9089CaseNumber?: string;
  i140ReceiptNumber?: string;
}): string | undefined {
  const numbers = [
    caseData.caseNumber,
    caseData.internalCaseNumber,
    caseData.pwdCaseNumber,
    caseData.eta9089CaseNumber,
    caseData.i140ReceiptNumber,
  ].filter((n): n is string => typeof n === "string" && n.trim().length > 0);
  return numbers.length > 0 ? numbers.join(" ") : undefined;
}

/** Letters and digits only: "G-100-26254-230507" and "g10026254230507" are one number. */
const compactNumber = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function projectCaseForCard(caseData: CaseDataForProjection, todayISO: string): CaseCardData {
  const nextDeadline = calculateNextDeadline(caseData, todayISO);

  // Concatenate notes for preview (take first active note)
  const notesPreview = caseData.notes
    ?.filter((n) => n.status !== "deleted")
    ?.map((n) => n.content)
    ?.join(" | ")
    ?.substring(0, 200); // Truncate to 200 chars

  // Calculate ETA 9089 window opens date (30 days after recruitment ends)
  // Only show when ALL basic recruitment steps are complete (not just end dates)
  let eta9089WindowOpens: string | undefined;
  if (caseData.recruitmentEndDate && isRecruitmentComplete(caseData) && !caseData.eta9089FilingDate) {
    const endDate = new Date(caseData.recruitmentEndDate);
    endDate.setDate(endDate.getDate() + 30);
    eta9089WindowOpens = endDate.toISOString().split("T")[0];
  }

  return createCaseCardData({
    _id: caseData._id,
    employerName: caseData.employerName,
    beneficiaryIdentifier: caseData.beneficiaryIdentifier,
    positionTitle: caseData.positionTitle,
    caseStatus: caseData.caseStatus,
    progressStatus: caseData.progressStatus,
    nextDeadline: nextDeadline?.date,
    nextDeadlineLabel: nextDeadline ? getDeadlineCardLabel(nextDeadline.type) : undefined,
    isFavorite: caseData.isFavorite ?? false,
    isPinned: caseData.isPinned ?? false,
    isProfessionalOccupation: caseData.isProfessionalOccupation,
    hasActiveRfi: (caseData.rfiEntries ?? []).some(
      (e: { receivedDate?: string; responseSubmittedDate?: string }) => !!e.receivedDate && !e.responseSubmittedDate
    ),
    hasActiveRfe: (caseData.rfeEntries ?? []).some(
      (e: { receivedDate?: string; responseSubmittedDate?: string }) => !!e.receivedDate && !e.responseSubmittedDate
    ),
    calendarSyncEnabled: caseData.calendarSyncEnabled,
    notes: notesPreview,
    searchNumbers: caseSearchNumbers(caseData),
    // PWD dates
    pwdFilingDate: caseData.pwdFilingDate,
    pwdDeterminationDate: caseData.pwdDeterminationDate,
    pwdExpirationDate: caseData.pwdExpirationDate,
    // Recruitment dates (derived: MIN of starts, MAX of ends)
    recruitmentStartDate: caseData.recruitmentStartDate,
    recruitmentEndDate: caseData.recruitmentEndDate,
    // ETA 9089 dates
    eta9089FilingDate: caseData.eta9089FilingDate,
    eta9089WindowOpens,
    eta9089CertificationDate: caseData.eta9089CertificationDate,
    eta9089ExpirationDate: caseData.eta9089ExpirationDate,
    // I-140 dates
    i140FilingDate: caseData.i140FilingDate,
    i140ApprovalDate: caseData.i140ApprovalDate,
    // Closed case fields (map schema's closureReason → closedReason for output)
    closedReason: caseData.closureReason,
    closedAt: caseData.closedAt ? new Date(caseData.closedAt).toISOString().split("T")[0] : undefined,
    // Duplicate tracking
    duplicateOf: caseData.duplicateOf,
    // Sample case
    isSample: caseData.isSample,
    // Metadata
    _creationTime: caseData._creationTime,
    updatedAt: caseData.updatedAt,
  });
}

// ============================================================================
// SORTING
// ============================================================================

/**
 * Case status order for sorting.
 * Order: pwd → recruitment → eta9089 → i140 → closed
 */
const CASE_STATUS_ORDER = {
  pwd: 0,
  recruitment: 1,
  eta9089: 2,
  i140: 3,
  closed: 4,
} as const;

/**
 * Compare function for case status.
 */
function compareCaseStatus(a: string, b: string): number {
  const aOrder = CASE_STATUS_ORDER[a as keyof typeof CASE_STATUS_ORDER] ?? 999;
  const bOrder = CASE_STATUS_ORDER[b as keyof typeof CASE_STATUS_ORDER] ?? 999;
  return aOrder - bOrder;
}

/**
 * Null-safe comparison: nulls always sort last regardless of sort direction.
 * Returns a number if one/both values are null (handling complete),
 * or undefined if both values are present (caller should compare normally).
 */
function compareNullsLast<T>(a: T | null | undefined, b: T | null | undefined): number | undefined {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return undefined;
}

/**
 * Sort cases by specified field and order.
 */
export function sortCases(
  cases: readonly CaseCardData[],
  sortBy: CaseListSortField,
  sortOrder: SortOrder
): CaseCardData[] {
  const sorted = [...cases].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case "deadline": {
        const nullResult = compareNullsLast(a.nextDeadline, b.nextDeadline);
        if (nullResult !== undefined) return nullResult;
        comparison = a.nextDeadline!.localeCompare(b.nextDeadline!);
        break;
      }

      case "updated":
        comparison = a.dates.updated - b.dates.updated;
        break;

      case "employer": {
        const aName = a.employerName.toLowerCase();
        const bName = b.employerName.toLowerCase();
        const aIsAlpha = /[a-z]/.test(aName.charAt(0));
        const bIsAlpha = /[a-z]/.test(bName.charAt(0));
        if (aIsAlpha && !bIsAlpha) comparison = -1;
        else if (!aIsAlpha && bIsAlpha) comparison = 1;
        else comparison = aName.localeCompare(bName);
        break;
      }

      case "status":
        comparison = compareCaseStatus(a.caseStatus, b.caseStatus);
        break;

      case "pwdFiled": {
        const nullResult = compareNullsLast(a.dates.pwdFiled, b.dates.pwdFiled);
        if (nullResult !== undefined) return nullResult;
        comparison = a.dates.pwdFiled!.localeCompare(b.dates.pwdFiled!);
        break;
      }

      case "etaFiled": {
        const nullResult = compareNullsLast(a.dates.etaFiled, b.dates.etaFiled);
        if (nullResult !== undefined) return nullResult;
        comparison = a.dates.etaFiled!.localeCompare(b.dates.etaFiled!);
        break;
      }

      case "i140Filed": {
        const nullResult = compareNullsLast(a.dates.i140Filed, b.dates.i140Filed);
        if (nullResult !== undefined) return nullResult;
        comparison = a.dates.i140Filed!.localeCompare(b.dates.i140Filed!);
        break;
      }

      case "favorites":
        // Favorites first (true before false)
        // When a is favorite and b is not, a comes first (-1)
        // When b is favorite and a is not, b comes first (1)
        if (a.isFavorite === b.isFavorite) {
          comparison = 0;
        } else if (a.isFavorite) {
          comparison = -1; // a comes first (favorites first)
        } else {
          comparison = 1; // b comes first
        }
        break;

      case "custom":
        // Custom order is handled by drag-and-drop, don't change order here
        comparison = 0;
        break;

      default:
        // Should never happen (TypeScript prevents invalid sortBy)
        comparison = 0;
    }

    return sortOrder === "asc" ? comparison : -comparison;
  });

  return sorted;
}

// ============================================================================
// FILTERING
// ============================================================================

/**
 * Filter cases by search query with fuzzy matching.
 *
 * Searches across:
 * - employerName (case-insensitive, fuzzy)
 * - beneficiaryIdentifier (case-insensitive, fuzzy)
 * - notes (case-insensitive, fuzzy)
 *
 * It uses the site's one matcher (./fuzzy.ts), so a typo the public
 * searches forgive is forgiven here too: "Gogle" finds Google, "Mircosoft"
 * Microsoft. Results are sorted by relevance, best first.
 *
 * @param cases - Array of case card data
 * @param query - Search query string
 * @returns Filtered and sorted array (new array, original unchanged)
 *
 * @example
 * filterBySearch(cases, "acme")       // Matches "ACME Corp"
 * filterBySearch(cases, "gogle")      // Matches "Google" (fuzzy)
 * filterBySearch(cases, "john doe")   // Matches "John Doe"
 * filterBySearch(cases, "")           // Returns all cases
 */
export function filterBySearch(
  cases: readonly CaseCardData[],
  query: string
): CaseCardData[] {
  const trimmedQuery = query.trim().toLowerCase();

  // Empty query returns all cases
  if (trimmedQuery === "") {
    return [...cases];
  }


  // A case number is matched exactly, with its dashes and spaces ignored, and
  // ranks above any name match. Four characters, so "g" alone matches nothing.
  const compactQuery = compactNumber(trimmedQuery);
  const numberMatch = (caseData: CaseCardData) =>
    compactQuery.length >= 4 &&
    !!caseData.searchNumbers &&
    caseData.searchNumbers.split(" ").some((n) => compactNumber(n).includes(compactQuery));

  // Calculate match scores for each case
  const casesWithScores = cases
    .map((caseData) => {
      const fields = [caseData.employerName, caseData.beneficiaryIdentifier, caseData.positionTitle, caseData.notes];
      const nameScore = Math.max(0, ...fields.map((f) => (f ? fuzzyScore(trimmedQuery, f) : 0)));

      // Best score across all fields; a number match outranks every name
      const score = numberMatch(caseData)
        ? 2
        : nameScore;

      return {
        caseData,
        score,
      };
    })
    .filter((item) => item.score >= FUZZY_MATCH_MIN)
    .sort((a, b) => b.score - a.score); // Sort by score descending (best matches first)

  return casesWithScores.map((item) => item.caseData);
}

// ============================================================================
// REOPEN STATUS DETERMINATION
// ============================================================================

/**
 * RFI/RFE entry shape for status determination.
 */
interface RfiRfeEntry {
  receivedDate?: string;
  responseSubmittedDate?: string;
}

/**
 * Case data needed for determining reopen status.
 * Contains the minimum fields needed to determine what status
 * a closed case should have when reopened.
 */
export interface CaseDataForReopenStatus {
  // I-140 stage fields
  i140ApprovalDate?: string;
  i140FilingDate?: string;
  // ETA 9089 stage fields
  eta9089CertificationDate?: string;
  eta9089FilingDate?: string;
  // Recruitment stage fields
  jobOrderStartDate?: string;
  jobOrderEndDate?: string;
  sundayAdFirstDate?: string;
  sundayAdSecondDate?: string;
  noticeOfFilingStartDate?: string;
  noticeOfFilingEndDate?: string;
  additionalRecruitmentEndDate?: string;
  // PWD stage fields
  pwdDeterminationDate?: string;
  pwdFilingDate?: string;
  // RFI/RFE entries
  rfiEntries?: RfiRfeEntry[];
  rfeEntries?: RfiRfeEntry[];
}

/**
 * Result of status determination for reopening a case.
 */
export interface ReopenStatusResult {
  caseStatus: "pwd" | "recruitment" | "eta9089" | "i140";
  progressStatus: "working" | "waiting_intake" | "filed" | "approved" | "under_review" | "rfi_rfe";
}

/**
 * Determine appropriate case status and progress status when reopening a closed case.
 *
 * Business rules (checked in reverse order - most advanced stage first):
 * 1. I-140 Approved → i140 / approved
 * 2. I-140 Filed → i140 / filed (or rfi_rfe if active RFE)
 * 3. ETA 9089 Certified → i140 / working
 * 4. ETA 9089 Filed → eta9089 / filed (or rfi_rfe if active RFI)
 * 5. Recruitment ended + 30 days passed → eta9089 / working
 * 6. Recruitment ended but < 30 days → recruitment / working
 * 7. PWD determined + any recruitment started → recruitment / working
 * 8. PWD determined but no recruitment → recruitment / working
 * 9. PWD filed but not determined → pwd / filed
 * 10. Default → pwd / working
 *
 * @param caseData - Case data to analyze
 * @param today - Today's date (for calculating 30-day window)
 * @returns Appropriate case status and progress status
 *
 * @example
 * determineReopenStatus({
 *   i140ApprovalDate: "2024-06-15",
 *   i140FilingDate: "2024-03-01",
 *   // ... other fields
 * }, new Date("2024-07-01"))
 * // Returns: { caseStatus: "i140", progressStatus: "approved" }
 */
export function determineReopenStatus(
  caseData: CaseDataForReopenStatus,
  today: Date = new Date()
): ReopenStatusResult {
  // Check for active RFI (ETA 9089 stage)
  const hasActiveRfi = (caseData.rfiEntries ?? []).some(
    (e) => !!e.receivedDate && !e.responseSubmittedDate
  );

  // Check for active RFE (I-140 stage)
  const hasActiveRfe = (caseData.rfeEntries ?? []).some(
    (e) => !!e.receivedDate && !e.responseSubmittedDate
  );

  // Check in reverse order - most advanced stage first
  if (caseData.i140ApprovalDate) {
    // I-140 Approved - reopen as I-140 approved
    return { caseStatus: "i140", progressStatus: "approved" };
  }

  if (caseData.i140FilingDate) {
    // I-140 Filed - check for active RFE
    return { caseStatus: "i140", progressStatus: hasActiveRfe ? "rfi_rfe" : "filed" };
  }

  if (caseData.eta9089CertificationDate) {
    // ETA 9089 Certified - move to I-140 working
    return { caseStatus: "i140", progressStatus: "working" };
  }

  if (caseData.eta9089FilingDate) {
    // ETA 9089 Filed - check for active RFI
    return { caseStatus: "eta9089", progressStatus: hasActiveRfi ? "rfi_rfe" : "filed" };
  }

  // Check recruitment progress to determine if in ETA 9089 or Recruitment stage
  const recruitmentEndDates = [
    caseData.jobOrderEndDate,
    caseData.sundayAdSecondDate,
    caseData.noticeOfFilingEndDate,
    caseData.additionalRecruitmentEndDate,
  ].filter((d): d is string => !!d);

  const lastRecruitmentDate = recruitmentEndDates.length > 0
    ? recruitmentEndDates.sort().pop()
    : undefined;

  if (lastRecruitmentDate) {
    // Recruitment has ended - check if 30-day waiting period has passed
    const endDate = new Date(lastRecruitmentDate);
    const windowOpensDate = new Date(endDate);
    windowOpensDate.setDate(windowOpensDate.getDate() + 30);

    if (today >= windowOpensDate) {
      // 30 days have passed - ETA 9089 window is open
      return { caseStatus: "eta9089", progressStatus: "working" };
    } else {
      // Still in waiting period
      return { caseStatus: "recruitment", progressStatus: "working" };
    }
  }

  if (caseData.pwdDeterminationDate) {
    // PWD determined but no recruitment completed - check if any started
    const hasAnyRecruitment = !!(
      caseData.jobOrderStartDate ||
      caseData.sundayAdFirstDate ||
      caseData.noticeOfFilingStartDate
    );

    // Either in progress or ready to start - both are "working" on recruitment
    if (hasAnyRecruitment) {
      return { caseStatus: "recruitment", progressStatus: "working" };
    } else {
      return { caseStatus: "recruitment", progressStatus: "working" };
    }
  }

  if (caseData.pwdFilingDate) {
    // PWD filed but not determined
    return { caseStatus: "pwd", progressStatus: "filed" };
  }

  // Default: PWD working
  return { caseStatus: "pwd", progressStatus: "working" };
}
