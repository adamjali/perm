/**
 * Case List Helper Functions
 * Pure functions for case list data processing.
 *
 * All functions are testable without database dependencies.
 */

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
    recruitment_window: "ETA window closes",
    eta9089_expiration: "ETA expires",
    rfi_response: "RFI response",
    rfe_response: "RFE response",
    i140_filing_window: "I-140 window",
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
  _creationTime: number;
  updatedAt: number;
}

export function projectCaseForCard(caseData: CaseDataForProjection, todayISO: string): CaseCardData {
  const nextDeadline = calculateNextDeadline(caseData, todayISO);

  // Concatenate notes for preview (take first active note)
  const notesPreview = caseData.notes
    ?.filter((n) => n.status !== "deleted")
    ?.map((n) => n.content)
    ?.join(" | ")
    ?.substring(0, 200); // Truncate to 200 chars

  // Calculate ETA 9089 window opens date (30 days after recruitment ends)
  // Uses derived recruitmentEndDate (MAX of all end dates) as source of truth
  let eta9089WindowOpens: string | undefined;
  if (caseData.recruitmentEndDate) {
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
 * Sort cases by specified field and order.
 *
 * Sort fields:
 * - deadline: Next deadline date (nulls last)
 * - updated: Last updated timestamp
 * - employer: Employer name (case-insensitive)
 * - status: Case status (pwd → recruitment → eta9089 → i140 → closed)
 * - pwdFiled: PWD filing date (nulls last)
 * - etaFiled: ETA 9089 filing date (nulls last)
 * - i140Filed: I-140 filing date (nulls last)
 *
 * @param cases - Array of case card data
 * @param sortBy - Field to sort by
 * @param sortOrder - Sort direction ("asc" or "desc")
 * @returns Sorted array (new array, original unchanged)
 *
 * @example
 * sortCases(cases, "deadline", "asc")  // Soonest deadline first
 * sortCases(cases, "employer", "desc") // Z-A employer names
 * sortCases(cases, "updated", "desc")  // Most recently updated first
 */
export function sortCases(
  cases: readonly CaseCardData[],
  sortBy: CaseListSortField,
  sortOrder: SortOrder
): CaseCardData[] {
  const sorted = [...cases].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case "deadline":
        // Nulls last for both asc and desc
        if (!a.nextDeadline && !b.nextDeadline) return 0;
        if (!a.nextDeadline) return 1;
        if (!b.nextDeadline) return -1;
        comparison = a.nextDeadline.localeCompare(b.nextDeadline);
        break;

      case "updated":
        comparison = a.dates.updated - b.dates.updated;
        break;

      case "employer": {
        // Custom sort: alphabetic first (A-Z), then non-alphabetic (#)
        // This matches the client-side group display order
        const aName = a.employerName.toLowerCase();
        const bName = b.employerName.toLowerCase();
        const aFirstChar = aName.charAt(0);
        const bFirstChar = bName.charAt(0);
        const aIsAlpha = /[a-z]/.test(aFirstChar);
        const bIsAlpha = /[a-z]/.test(bFirstChar);

        // Non-alphabetic names go last
        if (aIsAlpha && !bIsAlpha) {
          comparison = -1; // a (alphabetic) comes before b (non-alphabetic)
        } else if (!aIsAlpha && bIsAlpha) {
          comparison = 1; // b (alphabetic) comes before a (non-alphabetic)
        } else {
          // Both same category - use standard alphabetic comparison
          comparison = aName.localeCompare(bName);
        }
        break;
      }

      case "status":
        comparison = compareCaseStatus(a.caseStatus, b.caseStatus);
        break;

      case "pwdFiled":
        // Nulls last
        if (!a.dates.pwdFiled && !b.dates.pwdFiled) return 0;
        if (!a.dates.pwdFiled) return 1;
        if (!b.dates.pwdFiled) return -1;
        comparison = a.dates.pwdFiled.localeCompare(b.dates.pwdFiled);
        break;

      case "etaFiled":
        // Nulls last
        if (!a.dates.etaFiled && !b.dates.etaFiled) return 0;
        if (!a.dates.etaFiled) return 1;
        if (!b.dates.etaFiled) return -1;
        comparison = a.dates.etaFiled.localeCompare(b.dates.etaFiled);
        break;

      case "i140Filed":
        // Nulls last
        if (!a.dates.i140Filed && !b.dates.i140Filed) return 0;
        if (!a.dates.i140Filed) return 1;
        if (!b.dates.i140Filed) return -1;
        comparison = a.dates.i140Filed.localeCompare(b.dates.i140Filed);
        break;

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
 * Calculate Levenshtein distance between two strings.
 * Measures the minimum number of single-character edits (insertions, deletions, substitutions)
 * required to change one string into another.
 *
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Edit distance (0 = identical, higher = more different)
 *
 * @example
 * levenshteinDistance("google", "gogle") // Returns 1 (one deletion)
 * levenshteinDistance("microsoft", "mircosoft") // Returns 2 (two substitutions)
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;

  // Create distance matrix
  const matrix: number[][] = Array.from({ length: len1 + 1 }, () =>
    Array(len2 + 1).fill(0)
  );

  // Initialize first row and column
  for (let i = 0; i <= len1; i++) {
    matrix[i]![0] = i;
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0]![j] = j;
  }

  // Calculate distances
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1, // deletion
        matrix[i]![j - 1]! + 1, // insertion
        matrix[i - 1]![j - 1]! + cost // substitution
      );
    }
  }

  return matrix[len1]![len2]!;
}

/**
 * Calculate fuzzy match score between query and target string.
 * Returns a similarity score between 0 (no match) and 1 (perfect match).
 *
 * Algorithm:
 * 1. Exact substring match → score 1.0
 * 2. Fuzzy match using Levenshtein distance → score based on similarity
 *
 * Tolerances (based on word length):
 * - 3-5 chars: max 1 typo (20% of length)
 * - 6-8 chars: max 2 typos (25% of length)
 * - 9+ chars: max 3 typos (30% of length)
 *
 * @param query - Search query (already lowercased)
 * @param target - Target string to match against (already lowercased)
 * @returns Similarity score 0-1 (higher = better match)
 *
 * @example
 * fuzzyMatchScore("gogle", "google") // ~0.83 (1 typo, close match)
 * fuzzyMatchScore("googel", "google") // ~0.67 (2 typos, decent match)
 * fuzzyMatchScore("mircosoft", "microsoft") // ~0.78 (2 typos, decent match)
 * fuzzyMatchScore("xyz", "google") // 0 (no match)
 */
function fuzzyMatchScore(query: string, target: string): number {
  // Exact substring match gets perfect score
  if (target.includes(query)) {
    return 1.0;
  }

  // Split target into words for word-level matching
  const words = target.split(/\s+/);

  let bestScore = 0;

  for (const word of words) {
    // Skip very short words for fuzzy matching
    if (word.length < 3) continue;

    // Calculate edit distance
    const distance = levenshteinDistance(query, word);

    // Only consider words that are close in length to the query
    // (within ±3 characters to avoid false positives)
    const lengthDiff = Math.abs(word.length - query.length);
    if (lengthDiff > 3) continue;

    // Calculate max allowed distance based on query length
    // 3-5 chars: 1 typo, 6-8 chars: 2 typos, 9+ chars: 3 typos
    let maxDistance: number;
    const minLen = Math.min(query.length, word.length);
    if (minLen <= 5) {
      maxDistance = 1;
    } else if (minLen <= 8) {
      maxDistance = 2;
    } else {
      maxDistance = 3;
    }

    // If distance is within tolerance, calculate similarity score
    if (distance <= maxDistance) {
      // Similarity = 1 - (distance / word_length)
      // Use word length for normalization (more consistent)
      const similarity = 1 - distance / word.length;
      bestScore = Math.max(bestScore, similarity);
    }
  }

  return bestScore;
}

/**
 * Filter cases by search query with fuzzy matching.
 *
 * Searches across:
 * - employerName (case-insensitive, fuzzy)
 * - beneficiaryIdentifier (case-insensitive, fuzzy)
 * - notes (case-insensitive, fuzzy)
 *
 * Fuzzy matching tolerates typos:
 * - "Gogle" matches "Google"
 * - "Mircosoft" matches "Microsoft"
 * - "Amzon" matches "Amazon"
 *
 * Results are sorted by relevance (best matches first).
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

  // Minimum similarity threshold for fuzzy matches
  // 0.65 allows for 2-char typos in 6-char words (e.g., "googel" -> "google")
  const SIMILARITY_THRESHOLD = 0.65;

  // Calculate match scores for each case
  const casesWithScores = cases
    .map((caseData) => {
      const employerScore = fuzzyMatchScore(
        trimmedQuery,
        caseData.employerName.toLowerCase()
      );
      const beneficiaryScore = fuzzyMatchScore(
        trimmedQuery,
        caseData.beneficiaryIdentifier.toLowerCase()
      );
      const positionScore = fuzzyMatchScore(
        trimmedQuery,
        caseData.positionTitle.toLowerCase()
      );

      // Also search in notes if available
      let notesScore = 0;
      if (caseData.notes) {
        notesScore = fuzzyMatchScore(trimmedQuery, caseData.notes.toLowerCase());
      }

      // Best score across all fields
      const score = Math.max(employerScore, beneficiaryScore, positionScore, notesScore);

      return {
        caseData,
        score,
      };
    })
    .filter((item) => item.score >= SIMILARITY_THRESHOLD)
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
