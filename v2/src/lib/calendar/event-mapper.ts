/**
 * Calendar event mapper utility.
 *
 * Converts case data into calendar events for react-big-calendar display.
 *
 * Two kinds of event, from two sources:
 * - Dates that happened (a form filed, an ad run) come from extractMilestones().
 * - Deadlines come ONLY from the central rules (extractActiveDeadlines), the same
 *   list the dashboard, the case cards, the next-up box and the reminder emails
 *   read. So a deadline that no longer applies (a PWD expiration once the ETA
 *   9089 is filed, an answered RFI, a filing window that has opened) cannot
 *   show here as overdue while every other surface calls it done.
 */

import { differenceInDays, parseISO } from "date-fns";
import { buildDeadlineInput, extractActiveDeadlines, type ExtractedDeadline, type LooseDeadlineCaseData } from "@/lib/perm";
import { extractMilestones } from "../timeline/milestones";
import type { CaseWithDates, Milestone } from "../timeline/types";
import {
  FIELD_TO_DEADLINE_TYPE,
  DEADLINE_TYPE_LABELS,
  RECORDED_EVENT_TYPES,
  calculateUrgency,
  createCalendarEvent,
  type CalendarEvent,
  type CalendarCaseData,
  type DeadlineType,
} from "./types";
import { captureError } from "@/lib/sentry";

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

  // Dates that happened. Deadlines (expirations, windows, RFI/RFE due dates and
  // the calculated filing-window milestones) are skipped here and come from the
  // central rules below instead.
  const milestones = extractMilestones(caseWithDates).filter(isRecordedMilestone);

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

  // Deadlines: the central list, nothing else.
  const deadlines = extractActiveDeadlines(
    buildDeadlineInput({ ...caseData, _id: caseId } as unknown as LooseDeadlineCaseData),
  );
  for (const deadline of deadlines) {
    const event = deadlineToCalendarEvent(deadline, caseData, employerLabel);
    if (event) events.push(event);
  }

  return events;
}

/** A milestone that records a date that happened, not a deadline. */
function isRecordedMilestone(milestone: Milestone): boolean {
  if (milestone.isCalculated) return false;
  if (milestone.field.startsWith("rfiDeadline_") || milestone.field.startsWith("rfeDeadline_")) return false;
  if (milestone.field.startsWith("additionalMethod_")) return true;
  const type = FIELD_TO_DEADLINE_TYPE[milestone.field as keyof typeof FIELD_TO_DEADLINE_TYPE];
  return type !== undefined && RECORDED_EVENT_TYPES.has(type);
}

/** Central deadline type -> the calendar's event type and stage colour. */
const CENTRAL_TO_CALENDAR: Record<ExtractedDeadline["type"], { type: DeadlineType; stage: CalendarEvent["stage"] }> = {
  pwd_expiration: { type: "pwdExpires", stage: "pwd" },
  filing_window_opens: { type: "filingWindowOpens", stage: "eta9089" },
  filing_window_closes: { type: "filingWindowCloses", stage: "eta9089" },
  recruitment_window_closes: { type: "recruitmentWindowCloses", stage: "recruitment" },
  job_order_start_deadline: { type: "jobOrderStartDeadline", stage: "recruitment" },
  notice_of_filing_start_deadline: { type: "noticeOfFilingStartDeadline", stage: "recruitment" },
  first_sunday_ad_deadline: { type: "firstSundayAdDeadline", stage: "recruitment" },
  second_sunday_ad_deadline: { type: "secondSundayAdDeadline", stage: "recruitment" },
  i140_filing_deadline: { type: "eta9089Expires", stage: "eta9089" },
  rfi_due: { type: "rfiDue", stage: "rfi" },
  rfe_due: { type: "rfeDue", stage: "rfe" },
};

function deadlineToCalendarEvent(
  deadline: ExtractedDeadline,
  caseData: CalendarCaseData,
  employerLabel: string,
): CalendarEvent | null {
  const eventDate = parseISO(deadline.date);
  if (isNaN(eventDate.getTime())) return null;
  const { type, stage } = CENTRAL_TO_CALENDAR[deadline.type];

  // A named RFI/RFE keeps its own title, as the milestone did.
  const entries = type === "rfiDue" ? caseData.rfiEntries : type === "rfeDue" ? caseData.rfeEntries : undefined;
  const entryTitle = deadline.entryId ? entries?.find((e) => e.id === deadline.entryId)?.title : undefined;
  const label = entryTitle || DEADLINE_TYPE_LABELS[type];

  return createCalendarEvent({
    id: generateEventId(caseData._id as string, type, deadline.date),
    title: employerLabel ? `${label}: ${employerLabel}` : label,
    start: eventDate,
    end: eventDate,
    allDay: true,
    caseId: caseData._id as CalendarEvent["caseId"],
    deadlineType: type,
    stage,
    isFilingWindow: type === "filingWindowOpens" || type === "filingWindowCloses",
    // The central count, in the deadline's own time zone, so the calendar and
    // the dashboard agree on "2 days left".
    daysUntil: deadline.daysUntil,
    employerName: caseData.employerName,
    positionTitle: caseData.positionTitle,
    caseStatus: caseData.caseStatus,
  });
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
    captureError(error);
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
    const mappedType = FIELD_TO_DEADLINE_TYPE[milestone.field as keyof typeof FIELD_TO_DEADLINE_TYPE];
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
