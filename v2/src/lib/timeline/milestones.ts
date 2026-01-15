/**
 * Milestone calculation utilities for timeline visualization.
 *
 * Provides functions to extract and calculate milestones from case data
 * for display on the case timeline component.
 *
 * Uses centralized deadline supersession logic from lib/perm/deadlines.
 */

import { addDays, parseISO } from "date-fns";
import { format } from "date-fns";
import {
  MILESTONE_CONFIG,
  STAGE_COLORS,
  type CaseWithDates,
  type Milestone,
  type RangeBar,
  type RfiEntry,
  type RfeEntry,
  type AdditionalRecruitmentMethod,
} from "./types";
import {
  getFirstRecruitmentDate,
  getLastRecruitmentDate,
  FILING_WINDOW_WAIT_DAYS,
  FILING_WINDOW_CLOSE_DAYS,
  isDeadlineActive,
  type CaseDataForDeadlines,
} from "../perm";

// ============================================================================
// Static Milestone Extraction
// ============================================================================

/**
 * Extract all milestones from case data.
 *
 * Returns milestones for:
 * - All 12 static PERM milestones (PWD, Recruitment, ETA 9089, I-140)
 * - Calculated milestones (Ready to File, Recruitment Expires) if ETA 9089 not filed
 * - Active RFI/RFE deadline milestones
 *
 * @param caseData - Case data with date fields
 * @returns Array of Milestone objects sorted by date
 *
 * @example
 * const milestones = extractMilestones({
 *   pwdFilingDate: "2024-01-15",
 *   pwdDeterminationDate: "2024-02-15",
 *   sundayAdFirstDate: "2024-03-03",
 * });
 */
/**
 * Convert CaseWithDates to CaseDataForDeadlines for supersession checks.
 * This bridges the timeline types with the centralized perm/deadlines module.
 *
 * Note: CaseWithDates doesn't include caseStatus/deletedAt because timeline
 * is only shown for active cases (closed/deleted are filtered at a higher level).
 */
function toCaseDataForDeadlines(caseData: CaseWithDates): CaseDataForDeadlines {
  return {
    // Note: caseStatus and deletedAt not available in CaseWithDates
    // Timeline is only shown for active cases, so these are implicitly "not closed/deleted"
    pwdExpirationDate: caseData.pwdExpirationDate ?? undefined,
    eta9089FilingDate: caseData.eta9089FilingDate ?? undefined,
    eta9089CertificationDate: caseData.eta9089CertificationDate ?? undefined,
    eta9089ExpirationDate: caseData.eta9089ExpirationDate ?? undefined,
    i140FilingDate: caseData.i140FilingDate ?? undefined,
  };
}

export function extractMilestones(caseData: CaseWithDates): Milestone[] {
  const milestones: Milestone[] = [];

  // Extract static milestones from MILESTONE_CONFIG
  for (const config of MILESTONE_CONFIG) {
    const dateValue = caseData[config.field as keyof CaseWithDates];

    // Only include if date exists and is a non-empty string
    if (typeof dateValue === "string" && dateValue) {
      milestones.push({
        field: config.field,
        label: config.label,
        date: dateValue,
        stage: config.stage,
        color: STAGE_COLORS[config.stage],
        isCalculated: false,
      });
    }
  }

  // Add calculated milestones only if filing window deadlines are still active
  // Uses centralized supersession logic from perm/deadlines module
  const permCaseData = toCaseDataForDeadlines(caseData);
  const filingWindowActive = isDeadlineActive("filing_window_opens", permCaseData).isActive;

  if (filingWindowActive) {
    // Calculate Ready to File date (30 days after recruitment ends)
    // Uses eta9089 stage since it marks when ETA 9089 filing window opens
    const readyToFileDate = calculateReadyToFileDate(caseData);
    if (readyToFileDate) {
      milestones.push({
        field: "readyToFile",
        label: "Ready to File",
        date: readyToFileDate,
        stage: "eta9089",
        color: STAGE_COLORS.eta9089,
        isCalculated: true,
      });
    }

    // Calculate Recruitment Expires date (180 days from first recruitment step)
    // Uses eta9089 stage since it marks when ETA 9089 filing window closes
    const recruitmentExpiresDate = calculateRecruitmentExpiresDate(caseData);
    if (recruitmentExpiresDate) {
      milestones.push({
        field: "recruitmentExpires",
        label: "Filing Deadline",
        date: recruitmentExpiresDate,
        stage: "eta9089",
        color: STAGE_COLORS.eta9089,
        isCalculated: true,
      });
    }
  }

  // Extract additional recruitment method dates (only if isProfessionalOccupation)
  if (caseData.isProfessionalOccupation && caseData.additionalRecruitmentMethods) {
    const methodMilestones = extractAdditionalMethodMilestones(
      caseData.additionalRecruitmentMethods
    );
    milestones.push(...methodMilestones);
  }

  // Extract active RFI deadlines
  const rfiDeadlines = extractRfiDeadlines(caseData.rfiEntries ?? []);
  milestones.push(...rfiDeadlines);

  // Extract active RFE deadlines
  const rfeDeadlines = extractRfeDeadlines(caseData.rfeEntries ?? []);
  milestones.push(...rfeDeadlines);

  // Sort by date ascending
  milestones.sort((a, b) => a.date.localeCompare(b.date));

  return milestones;
}

// ============================================================================
// Range Bar Extraction
// ============================================================================

/**
 * Extract range bars from case data.
 *
 * Currently extracts the Job Order period as a range bar.
 *
 * @param caseData - Case data with date fields
 * @returns Array of RangeBar objects
 *
 * @example
 * const rangeBars = extractRangeBars({
 *   jobOrderStartDate: "2024-03-01",
 *   jobOrderEndDate: "2024-03-31",
 * });
 */
export function extractRangeBars(caseData: CaseWithDates): RangeBar[] {
  const rangeBars: RangeBar[] = [];

  // Job Order period
  if (caseData.jobOrderStartDate && caseData.jobOrderEndDate) {
    rangeBars.push({
      field: "jobOrder",
      label: "Job Order Period",
      startDate: caseData.jobOrderStartDate,
      endDate: caseData.jobOrderEndDate,
      stage: "recruitment",
      color: STAGE_COLORS.recruitment,
    });
  }

  return rangeBars;
}

// ============================================================================
// Calculated Milestone Functions
// ============================================================================

/**
 * Calculate the "Ready to File" date for ETA 9089.
 *
 * Ready to File = 30 days after recruitment ends.
 * Uses canonical getLastRecruitmentDate() from lib/perm.
 *
 * @param caseData - Case data with recruitment date fields
 * @returns ISO date string or null if insufficient data
 */
export function calculateReadyToFileDate(
  caseData: CaseWithDates
): string | null {
  // Use canonical function from lib/perm
  // Convert null to undefined for lib/perm compatibility
  const lastRecruitmentDate = getLastRecruitmentDate(
    {
      sundayAdSecondDate: caseData.sundayAdSecondDate ?? undefined,
      jobOrderEndDate: caseData.jobOrderEndDate ?? undefined,
      noticeOfFilingEndDate: caseData.noticeOfFilingEndDate ?? undefined,
      additionalRecruitmentEndDate: caseData.additionalRecruitmentEndDate ?? undefined,
      additionalRecruitmentMethods: caseData.additionalRecruitmentMethods ?? undefined,
    },
    caseData.isProfessionalOccupation ?? false
  );

  if (!lastRecruitmentDate) {
    return null;
  }

  // Ready to File = 30 days after recruitment ends
  const recruitmentEnd = parseISO(lastRecruitmentDate);
  const readyToFile = addDays(recruitmentEnd, FILING_WINDOW_WAIT_DAYS);

  return format(readyToFile, "yyyy-MM-dd");
}

/**
 * Calculate when recruitment expires (filing window closes).
 *
 * Recruitment Expires = 180 days from first recruitment step.
 * Uses canonical getFirstRecruitmentDate() from lib/perm.
 *
 * @param caseData - Case data with recruitment date fields
 * @returns ISO date string or null if no recruitment dates exist
 */
export function calculateRecruitmentExpiresDate(
  caseData: CaseWithDates
): string | null {
  // Use canonical function from lib/perm
  // Convert null to undefined for lib/perm compatibility
  const firstRecruitmentDate = getFirstRecruitmentDate({
    sundayAdFirstDate: caseData.sundayAdFirstDate ?? undefined,
    jobOrderStartDate: caseData.jobOrderStartDate ?? undefined,
    noticeOfFilingStartDate: caseData.noticeOfFilingStartDate ?? undefined,
  });

  if (!firstRecruitmentDate) {
    return null;
  }

  // Recruitment expires 180 days from first step
  const recruitmentStart = parseISO(firstRecruitmentDate);
  const expiresDate = addDays(recruitmentStart, FILING_WINDOW_CLOSE_DAYS);

  return format(expiresDate, "yyyy-MM-dd");
}

// ============================================================================
// RFI/RFE Deadline Extraction
// ============================================================================

/**
 * Extract active RFI deadlines from RFI entries.
 *
 * Active RFI = has responseDueDate but no responseSubmittedDate.
 *
 * @param entries - Array of RFI entries from case data
 * @returns Array of Milestone objects for active RFI deadlines
 *
 * @example
 * extractRfiDeadlines([
 *   { id: "1", receivedDate: "2024-03-01", responseDueDate: "2024-03-31" },
 *   { id: "2", receivedDate: "2024-02-01", responseDueDate: "2024-03-01", responseSubmittedDate: "2024-02-28" },
 * ])
 * // Returns milestone only for first entry (second is resolved)
 */
export function extractRfiDeadlines(entries: RfiEntry[]): Milestone[] {
  const milestones: Milestone[] = [];

  // Filter to active entries (has due date, no submitted date)
  const activeEntries = entries.filter(
    (entry) => entry.responseDueDate && !entry.responseSubmittedDate
  );

  // Sort by received date to determine order
  const sortedEntries = [...activeEntries].sort((a, b) =>
    a.receivedDate.localeCompare(b.receivedDate)
  );

  sortedEntries.forEach((entry, index) => {
    milestones.push({
      field: `rfiDeadline_${entry.id}`,
      label: entry.title || `RFI Due${sortedEntries.length > 1 ? ` #${index + 1}` : ""}`,
      date: entry.responseDueDate,
      stage: "rfi",
      color: STAGE_COLORS.rfi,
      isCalculated: false,
      order: index + 1,
    });
  });

  return milestones;
}

/**
 * Extract active RFE deadlines from RFE entries.
 *
 * Active RFE = has responseDueDate but no responseSubmittedDate.
 *
 * @param entries - Array of RFE entries from case data
 * @returns Array of Milestone objects for active RFE deadlines
 *
 * @example
 * extractRfeDeadlines([
 *   { id: "1", receivedDate: "2024-03-01", responseDueDate: "2024-04-15" },
 * ])
 * // Returns milestone for the active RFE
 */
export function extractRfeDeadlines(entries: RfeEntry[]): Milestone[] {
  const milestones: Milestone[] = [];

  // Filter to active entries (has due date, no submitted date)
  const activeEntries = entries.filter(
    (entry) => entry.responseDueDate && !entry.responseSubmittedDate
  );

  // Sort by received date to determine order
  const sortedEntries = [...activeEntries].sort((a, b) =>
    a.receivedDate.localeCompare(b.receivedDate)
  );

  sortedEntries.forEach((entry, index) => {
    milestones.push({
      field: `rfeDeadline_${entry.id}`,
      label: entry.title || `RFE Due${sortedEntries.length > 1 ? ` #${index + 1}` : ""}`,
      date: entry.responseDueDate,
      stage: "rfe",
      color: STAGE_COLORS.rfe,
      isCalculated: false,
      order: index + 1,
    });
  });

  return milestones;
}

// ============================================================================
// Additional Recruitment Method Extraction
// ============================================================================

/**
 * Extract milestones from additional recruitment methods (professional occupations only).
 *
 * Each additional recruitment method with a date becomes a milestone.
 *
 * @param methods - Array of additional recruitment methods from case data
 * @returns Array of Milestone objects for each method with a date
 *
 * @example
 * extractAdditionalMethodMilestones([
 *   { method: "Campus Recruitment", date: "2024-03-15" },
 *   { method: "Job Fair", date: "2024-03-20" },
 * ])
 * // Returns milestones for both methods
 */
export function extractAdditionalMethodMilestones(
  methods: AdditionalRecruitmentMethod[]
): Milestone[] {
  const milestones: Milestone[] = [];

  // Filter to methods with dates and sort by date
  const methodsWithDates = methods
    .filter((m) => m.date)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  methodsWithDates.forEach((method, index) => {
    if (method.date) {
      milestones.push({
        field: `additionalMethod_${index}`,
        label: method.method || `Addl Method #${index + 1}`,
        date: method.date,
        stage: "recruitment",
        color: STAGE_COLORS.recruitment,
        isCalculated: false,
        order: index + 1,
      });
    }
  });

  return milestones;
}
