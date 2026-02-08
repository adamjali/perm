/**
 * Calendar event mapper utility.
 *
 * Converts case data into calendar events for react-big-calendar display.
 * Reuses extractMilestones() from timeline for consistency.
 */

import { differenceInDays, parseISO } from "date-fns";
import { extractMilestones } from "../timeline/milestones";
import type { CaseWithDates, Milestone } from "../timeline/types";
import {
  FIELD_TO_DEADLINE_TYPE,
  DEADLINE_TYPE_LABELS,
  calculateUrgency,
  createCalendarEvent,
  type CalendarEvent,
  type CalendarCaseData,
  type DeadlineType,
} from "./types";

// Re-export calculateUrgency for backward compatibility with tests
export { calculateUrgency };

// ============================================================================
// Title Formatting
// ============================================================================

/**
 * Format calendar event title using employer name.
 *
 * @param deadlineType - Type of deadline
 * @param employerName - Employer name for the case
 * @returns Formatted title like "PWD Exp: Acme Corp"
 */
function formatEventTitle(
  deadlineType: DeadlineType,
  employerName: string
): string {
  const label = DEADLINE_TYPE_LABELS[deadlineType];
  if (!employerName) {
    return label;
  }
  return `${label}: ${employerName}`;
}

// ============================================================================
// Event ID Generation
// ============================================================================

/**
 * Generate unique event ID.
 *
 * @param caseId - Case ID
 * @param deadlineType - Type of deadline
 * @param dateStr - ISO date string
 * @returns Unique event ID
 */
function generateEventId(
  caseId: string,
  deadlineType: DeadlineType,
  dateStr: string
): string {
  return `${caseId}-${deadlineType}-${dateStr}`;
}

// ============================================================================
// Main Event Mapper
// ============================================================================

/**
 * Convert case data to calendar events.
 *
 * Extracts all milestones from case data and converts them to calendar events.
 * Reuses extractMilestones() from timeline for consistency.
 * Handles filing windows specially, creating separate open/close events.
 *
 * @param caseData - Case data with milestone dates
 * @returns Array of calendar events
 *
 * @example
 * const events = caseToCalendarEvents({
 *   _id: "case-123",
 *   employerName: "Acme Corp",
 *   beneficiaryIdentifier: "Smith, John",
 *   caseStatus: "pwd",
 *   progressStatus: "working",
 *   pwdExpirationDate: "2024-08-15",
 * });
 */
export function caseToCalendarEvents(
  caseData: CalendarCaseData
): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const employerLabel = caseData.employerName?.trim() || "";
  const caseId = caseData._id;

  // Convert CalendarCaseData to CaseWithDates for extractMilestones
  const caseWithDates: CaseWithDates = {
    pwdFilingDate: caseData.pwdFilingDate,
    pwdDeterminationDate: caseData.pwdDeterminationDate,
    pwdExpirationDate: caseData.pwdExpirationDate,
    sundayAdFirstDate: caseData.sundayAdFirstDate,
    sundayAdSecondDate: caseData.sundayAdSecondDate,
    jobOrderStartDate: caseData.jobOrderStartDate,
    jobOrderEndDate: caseData.jobOrderEndDate,
    noticeOfFilingStartDate: caseData.noticeOfFilingStartDate,
    noticeOfFilingEndDate: caseData.noticeOfFilingEndDate,
    isProfessionalOccupation: caseData.isProfessionalOccupation,
    additionalRecruitmentStartDate: caseData.additionalRecruitmentStartDate,
    additionalRecruitmentEndDate: caseData.additionalRecruitmentEndDate,
    additionalRecruitmentMethods: caseData.additionalRecruitmentMethods,
    eta9089FilingDate: caseData.eta9089FilingDate,
    eta9089CertificationDate: caseData.eta9089CertificationDate,
    eta9089ExpirationDate: caseData.eta9089ExpirationDate,
    i140FilingDate: caseData.i140FilingDate,
    i140ApprovalDate: caseData.i140ApprovalDate,
    rfiEntries: caseData.rfiEntries ?? undefined,
    rfeEntries: caseData.rfeEntries ?? undefined,
  };

  // Extract milestones using shared function
  const milestones = extractMilestones(caseWithDates);

  // Convert each milestone to a calendar event
  for (const milestone of milestones) {
    const event = milestoneToCalendarEvent(
      milestone,
      caseId as string,
      employerLabel,
      today,
      // Pass case data for hover tooltips
      caseData.employerName,
      caseData.positionTitle,
      caseData.caseStatus
    );
    if (event) {
      events.push(event);
    }
  }

  return events;
}

/**
 * Convert a single milestone to a calendar event.
 *
 * @param milestone - Milestone from extractMilestones()
 * @param caseId - Case ID
 * @param employerLabel - Employer name for event title
 * @param today - Current date for urgency calculation
 * @param employerName - Employer name for tooltip
 * @param positionTitle - Position title for tooltip
 * @param caseStatus - Case status for tooltip
 * @returns Calendar event or null if invalid
 */
function milestoneToCalendarEvent(
  milestone: Milestone,
  caseId: string,
  employerLabel: string,
  today: Date,
  employerName?: string,
  positionTitle?: string,
  caseStatus?: string
): CalendarEvent | null {
  // Parse the date
  let eventDate: Date;
  try {
    eventDate = parseISO(milestone.date);
    if (isNaN(eventDate.getTime())) {
      console.error(
        `[event-mapper] Invalid date for case ${caseId}, field ${milestone.field}: "${milestone.date}"`
      );
      return null;
    }
  } catch (error) {
    console.error(
      `[event-mapper] Failed to parse date for case ${caseId}, field ${milestone.field}: "${milestone.date}"`,
      error
    );
    return null;
  }

  // Determine deadline type
  let deadlineType: DeadlineType;

  if (milestone.field.startsWith("rfiDeadline_")) {
    deadlineType = "rfiDue";
  } else if (milestone.field.startsWith("rfeDeadline_")) {
    deadlineType = "rfeDue";
  } else if (milestone.field.startsWith("additionalMethod_")) {
    // Additional recruitment method dates (e.g., additionalMethod_0, additionalMethod_1)
    deadlineType = "additionalMethod";
  } else {
    const mappedType = FIELD_TO_DEADLINE_TYPE[milestone.field];
    if (mappedType) {
      deadlineType = mappedType;
    } else {
      // Unknown field - log for debugging, skip creating event
      console.error(
        `[event-mapper] Unknown milestone field "${milestone.field}" for case ${caseId}, date ${milestone.date}`
      );
      return null;
    }
  }

  // Calculate days until deadline
  const daysUntil = differenceInDays(eventDate, today);

  // Determine if this is a filing window event
  const isFilingWindow =
    deadlineType === "filingWindowOpens" ||
    deadlineType === "filingWindowCloses";

  // Format title - use milestone label for RFI/RFE/additionalMethod, otherwise standard format
  let title: string;
  if (
    deadlineType === "rfiDue" ||
    deadlineType === "rfeDue" ||
    deadlineType === "additionalMethod"
  ) {
    // Use the specific label (e.g., "RFI Due #1" or "Campus Recruitment")
    title = employerLabel
      ? `${milestone.label}: ${employerLabel}`
      : milestone.label;
  } else {
    title = formatEventTitle(deadlineType, employerLabel);
  }

  // Use factory function to ensure urgency/daysUntil consistency
  return createCalendarEvent({
    id: generateEventId(caseId, deadlineType, milestone.date),
    title,
    start: eventDate,
    end: eventDate,
    allDay: true,
    caseId: caseId as CalendarEvent["caseId"],
    deadlineType,
    stage: milestone.stage,
    isFilingWindow,
    daysUntil,
    // Case data for hover tooltips
    employerName,
    positionTitle,
    caseStatus,
  });
}
