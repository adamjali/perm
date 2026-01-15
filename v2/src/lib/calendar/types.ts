/**
 * Calendar event types for PERM case deadline visualization.
 *
 * Defines types for converting case milestones into calendar events
 * compatible with react-big-calendar.
 */

import type { Id } from "../../../convex/_generated/dataModel";
import type { Stage } from "../timeline/types";
import type { RfiEntry, RfeEntry, AdditionalRecruitmentMethod } from "../shared/types";

// Re-export Stage and STAGE_COLORS for consistency
export { STAGE_COLORS, type Stage } from "../timeline/types";

// Re-export shared types for convenience
export type { RfiEntry, RfeEntry, AdditionalRecruitmentMethod } from "../shared/types";

// ============================================================================
// Urgency Types
// ============================================================================

/**
 * Urgency levels for calendar events based on days until deadline.
 *
 * - overdue: Past due (negative days)
 * - urgent: 0-7 days (needs immediate attention)
 * - soon: 8-30 days (coming up)
 * - normal: 31+ days (no immediate concern)
 */
export type Urgency = "overdue" | "urgent" | "soon" | "normal";

/**
 * Urgency threshold constants (in days).
 */
export const URGENCY_THRESHOLDS = {
  /** Urgent threshold: 7 days or less */
  URGENT: 7,
  /** Soon threshold: 8-30 days */
  SOON: 30,
} as const;

/**
 * Urgency colors matching the design system.
 */
export const URGENCY_COLORS: Record<Urgency, string> = {
  overdue: "#DC2626", // Red-600
  urgent: "#DC2626", // Red-600
  soon: "#EA580C", // Orange-600
  normal: "#059669", // Emerald-600
} as const;

// ============================================================================
// Deadline Type Enum
// ============================================================================

/**
 * Deadline types for calendar events (frontend/UI context).
 * Uses camelCase naming convention per TypeScript/React conventions.
 *
 * NOTE: This is distinct from convex/lib/dashboardTypes.ts DeadlineType which uses
 * snake_case for backend/database conventions. The two serve different purposes:
 * - Calendar: All case milestones for timeline visualization (camelCase)
 * - Dashboard: Actionable deadlines requiring user attention (snake_case)
 *
 * For bidirectional conversion between conventions, use the mapping utilities:
 * @see convex/lib/deadlineTypeMapping.ts
 *
 * Extended with filing window types for calendar-specific events.
 */
export type DeadlineType =
  // PWD milestones
  | "pwdFiled"
  | "pwdDetermined"
  | "pwdExpires"
  // Recruitment milestones
  | "sundayAdFirst"
  | "sundayAdSecond"
  | "jobOrderStart"
  | "jobOrderEnd"
  | "noticeOfFilingStart"
  | "noticeOfFilingEnd"
  // Professional occupation additional recruitment
  | "additionalRecruitmentStart"
  | "additionalRecruitmentEnd"
  | "additionalMethod"
  // ETA 9089 milestones
  | "eta9089Filed"
  | "eta9089Certified"
  | "eta9089Expires"
  // I-140 milestones
  | "i140Filed"
  | "i140Approved"
  // Filing window (calculated)
  | "filingWindowOpens"
  | "filingWindowCloses"
  // RFI/RFE deadlines
  | "rfiDue"
  | "rfeDue";

/**
 * Mapping from milestone field names to DeadlineType.
 */
export const FIELD_TO_DEADLINE_TYPE: Record<string, DeadlineType> = {
  pwdFilingDate: "pwdFiled",
  pwdDeterminationDate: "pwdDetermined",
  pwdExpirationDate: "pwdExpires",
  sundayAdFirstDate: "sundayAdFirst",
  sundayAdSecondDate: "sundayAdSecond",
  jobOrderStartDate: "jobOrderStart",
  jobOrderEndDate: "jobOrderEnd",
  noticeOfFilingStartDate: "noticeOfFilingStart",
  noticeOfFilingEndDate: "noticeOfFilingEnd",
  additionalRecruitmentStartDate: "additionalRecruitmentStart",
  additionalRecruitmentEndDate: "additionalRecruitmentEnd",
  additionalMethod: "additionalMethod",
  eta9089FilingDate: "eta9089Filed",
  eta9089CertificationDate: "eta9089Certified",
  eta9089ExpirationDate: "eta9089Expires",
  i140FilingDate: "i140Filed",
  i140ApprovalDate: "i140Approved",
  readyToFile: "filingWindowOpens",
  recruitmentExpires: "filingWindowCloses",
} as const;

/**
 * Labels for calendar event titles.
 */
export const DEADLINE_TYPE_LABELS: Record<DeadlineType, string> = {
  pwdFiled: "PWD Filed",
  pwdDetermined: "PWD Determined",
  pwdExpires: "PWD Exp",
  sundayAdFirst: "1st Sunday Ad",
  sundayAdSecond: "2nd Sunday Ad",
  jobOrderStart: "Job Order Start",
  jobOrderEnd: "Job Order End",
  noticeOfFilingStart: "Notice Posted",
  noticeOfFilingEnd: "Notice End",
  additionalRecruitmentStart: "Addl Recruitment Start",
  additionalRecruitmentEnd: "Addl Recruitment End",
  additionalMethod: "Addl Method",
  eta9089Filed: "ETA Filed",
  eta9089Certified: "ETA Certified",
  eta9089Expires: "ETA Expires",
  i140Filed: "I-140 Filed",
  i140Approved: "I-140 Approved",
  filingWindowOpens: "ETA Window Opens",
  filingWindowCloses: "ETA Window Closes",
  rfiDue: "RFI Due",
  rfeDue: "RFE Due",
} as const;

// ============================================================================
// Urgency Calculation
// ============================================================================

/**
 * Calculate urgency level based on days until deadline.
 *
 * @param daysUntil - Number of days until the deadline (negative if overdue)
 * @returns Urgency level
 *
 * @example
 * calculateUrgency(-1)  // "overdue"
 * calculateUrgency(0)   // "urgent"
 * calculateUrgency(7)   // "urgent"
 * calculateUrgency(15)  // "soon"
 * calculateUrgency(45)  // "normal"
 */
export function calculateUrgency(daysUntil: number): Urgency {
  if (daysUntil < 0) {
    return "overdue";
  }
  if (daysUntil <= URGENCY_THRESHOLDS.URGENT) {
    return "urgent";
  }
  if (daysUntil <= URGENCY_THRESHOLDS.SOON) {
    return "soon";
  }
  return "normal";
}

// ============================================================================
// Calendar Event Interface
// ============================================================================

/**
 * Brand symbol to prevent direct construction of CalendarEvent.
 * Use createCalendarEvent() factory to create instances.
 */
declare const CalendarEventBrand: unique symbol;

/**
 * Calendar event for react-big-calendar.
 *
 * Represents a single deadline or milestone as a calendar event.
 * Invariant: `urgency` is always derived from `daysUntil` via calculateUrgency().
 *
 * MUST be created via createCalendarEvent() factory function to guarantee
 * consistency between urgency and daysUntil values.
 */
export interface CalendarEvent {
  /** Unique event identifier */
  id: string;
  /** Event title displayed on the calendar */
  title: string;
  /** Event start date/time */
  start: Date;
  /** Event end date/time */
  end: Date;
  /** True for all-day events (all PERM deadlines are all-day) */
  allDay: boolean;
  /** Source case ID */
  caseId: Id<"cases">;
  /** Type of deadline */
  deadlineType: DeadlineType;
  /** PERM process stage */
  stage: Stage;
  /** Urgency level based on days until deadline */
  urgency: Urgency;
  /** True for filing window events (open/close) */
  isFilingWindow: boolean;
  /** Number of days until the event (can be negative for overdue) */
  daysUntil: number;

  // === Case data for hover tooltips (V1 parity) ===
  /** Employer name from the case */
  employerName?: string;
  /** Position title from the case */
  positionTitle?: string;
  /** Current case status */
  caseStatus?: string;
  /** @internal Brand to prevent direct construction */
  readonly [CalendarEventBrand]: true;
}

/**
 * Input for creating a CalendarEvent via factory function.
 * Urgency is NOT included as it's derived from daysUntil.
 */
export interface CalendarEventInput {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  caseId: Id<"cases">;
  deadlineType: DeadlineType;
  stage: Stage;
  isFilingWindow: boolean;
  daysUntil: number;
  employerName?: string;
  positionTitle?: string;
  caseStatus?: string;
}

/**
 * Factory function to create a CalendarEvent with guaranteed urgency/daysUntil consistency.
 *
 * This function enforces the invariant that `urgency` is always derived from `daysUntil`
 * via calculateUrgency(), preventing manual specification that could lead to inconsistency.
 *
 * @param input - Event data without urgency (urgency is calculated automatically)
 * @returns CalendarEvent with urgency derived from daysUntil
 *
 * @example
 * const event = createCalendarEvent({
 *   id: "case123-pwdExpires-2024-01-15",
 *   title: "PWD Exp: Smith J.",
 *   start: new Date("2024-01-15"),
 *   end: new Date("2024-01-15"),
 *   allDay: true,
 *   caseId: "case123" as Id<"cases">,
 *   deadlineType: "pwdExpires",
 *   stage: "pwd",
 *   isFilingWindow: false,
 *   daysUntil: 10,
 * });
 * // event.urgency === "soon" (automatically calculated)
 */
export function createCalendarEvent(input: CalendarEventInput): CalendarEvent {
  const urgency = calculateUrgency(input.daysUntil);
  return {
    ...input,
    urgency,
  } as CalendarEvent;
}

// ============================================================================
// Case Data Interface (for event mapping)
// ============================================================================

// NOTE: RfiEntry, RfeEntry, and AdditionalRecruitmentMethod are imported from
// ../shared/types.ts and re-exported above. See shared/types.ts for definitions.

/**
 * Subset of case data required for calendar event extraction.
 * Extends CaseWithDates from timeline with additional identification fields.
 */
export interface CalendarCaseData {
  _id: Id<"cases">;

  // Case identification
  employerName: string;
  beneficiaryIdentifier: string;
  positionTitle?: string;

  // Case status (for filtering)
  caseStatus: string;
  progressStatus: string;

  // PWD phase
  pwdFilingDate?: string | null;
  pwdDeterminationDate?: string | null;
  pwdExpirationDate?: string | null;

  // Recruitment phase
  sundayAdFirstDate?: string | null;
  sundayAdSecondDate?: string | null;
  jobOrderStartDate?: string | null;
  jobOrderEndDate?: string | null;

  // Notice of filing (affects recruitment start/end date)
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
