/**
 * Calendar Event Type Definitions
 *
 * Type definitions for Google Calendar event formatting and sync.
 * Used by calendar sync actions to create, update, and delete events.
 *
 * @see /perm_flow.md - Source of truth for PERM workflow
 * @see ../schema.ts - userProfiles calendar sync preferences
 * @see ./perm/deadlines/types.ts - Deadline types
 * @module
 */

import type { Id } from "../_generated/dataModel";
import type { CaseDataForDeadlines } from "./perm/deadlines/types";

// ============================================================================
// CALENDAR EVENT TYPE
// ============================================================================

/**
 * Calendar event types that can be synced to Google Calendar.
 *
 * Each type corresponds to a deadline or date in the PERM process.
 * Uses snake_case naming convention per Convex/database conventions.
 */
export type CalendarEventType =
  | "pwd_expiration"
  | "eta9089_filing"
  | "filing_window_opens"
  | "filing_window_closes"
  | "recruitment_window_closes"
  | "job_order_start_deadline"
  | "notice_of_filing_start_deadline"
  | "first_sunday_ad_deadline"
  | "second_sunday_ad_deadline"
  | "i140_deadline"
  | "rfi_due"
  | "rfe_due";

/**
 * Human-readable labels for each calendar event type.
 */
export const CALENDAR_EVENT_LABELS: Record<CalendarEventType, string> = {
  pwd_expiration: "PWD expires",
  eta9089_filing: "ETA 9089 filing date",
  filing_window_opens: "ETA 9089 filing window opens",
  filing_window_closes: "ETA 9089 filing window closes",
  recruitment_window_closes: "Recruitment window closes",
  job_order_start_deadline: "Start job order by",
  notice_of_filing_start_deadline: "Start notice of filing by",
  first_sunday_ad_deadline: "First Sunday ad by",
  second_sunday_ad_deadline: "Second Sunday ad by",
  i140_deadline: "I-140 filing deadline",
  rfi_due: "RFI response due",
  rfe_due: "RFE response due",
};

// ============================================================================
// USER PREFERENCE MAPPING
// ============================================================================

/** The per-type calendar sync switches on userProfiles. */
export const CALENDAR_SYNC_PREFERENCES = [
  "calendarSyncPwd",
  "calendarSyncEta9089",
  "calendarSyncFilingWindow",
  "calendarSyncRecruitment",
  "calendarSyncI140",
  "calendarSyncRfi",
  "calendarSyncRfe",
] as const;
export type CalendarSyncPreference = (typeof CALENDAR_SYNC_PREFERENCES)[number];

/**
 * Maps calendar event types to their corresponding user preference fields.
 *
 * @example
 * const pref = EVENT_TYPE_TO_PREF["pwd_expiration"]; // "calendarSyncPwd"
 */
export const EVENT_TYPE_TO_PREF: Record<CalendarEventType, CalendarSyncPreference> = {
  pwd_expiration: "calendarSyncPwd",
  eta9089_filing: "calendarSyncEta9089",
  filing_window_opens: "calendarSyncFilingWindow",
  filing_window_closes: "calendarSyncFilingWindow",
  recruitment_window_closes: "calendarSyncRecruitment",
  job_order_start_deadline: "calendarSyncRecruitment",
  notice_of_filing_start_deadline: "calendarSyncRecruitment",
  first_sunday_ad_deadline: "calendarSyncRecruitment",
  second_sunday_ad_deadline: "calendarSyncRecruitment",
  i140_deadline: "calendarSyncI140",
  rfi_due: "calendarSyncRfi",
  rfe_due: "calendarSyncRfe",
};

/**
 * Where each event type's Google event id is kept on the case
 * (`calendarEventIds.<slot>`). One slot per type: two types sharing a slot is
 * how an event gets orphaned, its id overwritten and never deleted.
 */
export const EVENT_TYPE_TO_SLOT: Record<CalendarEventType, CalendarEventSlot> = {
  pwd_expiration: "pwd_expiration",
  eta9089_filing: "eta9089_filing",
  filing_window_opens: "eta9089_filing_window",
  filing_window_closes: "filing_window_closes",
  recruitment_window_closes: "recruitment_window_closes",
  job_order_start_deadline: "job_order_start_deadline",
  notice_of_filing_start_deadline: "notice_of_filing_start_deadline",
  first_sunday_ad_deadline: "first_sunday_ad_deadline",
  second_sunday_ad_deadline: "second_sunday_ad_deadline",
  i140_deadline: "i140_filing_deadline",
  rfi_due: "rfi_due",
  rfe_due: "rfe_due",
};

/**
 * Slots no event type writes any more, kept so ids already stored in them are
 * still deleted: `eta9089_expiration` (an ETA 9089 expiry event on the same
 * day as the I-140 deadline) and `recruitment_end` (the recruitment window,
 * now in `recruitment_window_closes`), both retired.
 */
export const RETIRED_SLOTS: Partial<Record<CalendarSyncPreference, CalendarEventSlot[]>> = {
  calendarSyncEta9089: ["eta9089_expiration"],
  calendarSyncRecruitment: ["recruitment_end"],
};

/** Every slot on `calendarEventIds`, current and retired. */
export const CALENDAR_EVENT_SLOTS = [
  "pwd_expiration",
  "eta9089_filing",
  "eta9089_filing_window",
  "filing_window_closes",
  "eta9089_expiration",
  "i140_filing_deadline",
  "rfi_due",
  "rfe_due",
  "recruitment_end",
  "recruitment_window_closes",
  "job_order_start_deadline",
  "notice_of_filing_start_deadline",
  "first_sunday_ad_deadline",
  "second_sunday_ad_deadline",
] as const;
export type CalendarEventSlot = (typeof CALENDAR_EVENT_SLOTS)[number];

/** The slots a preference's events live in, so turning it off deletes all of them. */
export function slotsForPreference(pref: CalendarSyncPreference): CalendarEventSlot[] {
  const current = (Object.keys(EVENT_TYPE_TO_PREF) as CalendarEventType[])
    .filter((type) => EVENT_TYPE_TO_PREF[type] === pref)
    .map((type) => EVENT_TYPE_TO_SLOT[type]);
  return [...new Set([...current, ...(RETIRED_SLOTS[pref] ?? [])])];
}

// ============================================================================
// CALENDAR EVENT INPUT/OUTPUT TYPES
// ============================================================================

/**
 * Input data for formatting a calendar event.
 *
 * Contains the minimal fields needed to generate event title and description.
 */
export interface CalendarEventInput {
  /** The type of calendar event */
  eventType: CalendarEventType;

  /** ISO date string (YYYY-MM-DD) for the event */
  date: string;

  /** Case ID for linking back to the case */
  caseId: Id<"cases">;

  /** Employer name for display */
  employerName: string;

  /** Beneficiary identifier for display */
  beneficiaryIdentifier: string;

  /** Case number (if available) */
  caseNumber?: string;

  /** Internal case number (if available) */
  internalCaseNumber?: string;

  /** RFI/RFE entry ID (for rfi_due and rfe_due events) */
  entryId?: string;
}

/**
 * Result of formatting a calendar event for Google Calendar API.
 *
 * Contains all fields needed to create or update a Google Calendar event.
 */
export interface CalendarEventResult {
  /** Event summary/title */
  summary: string;

  /** Event description (multi-line) */
  description: string;

  /** Start date in Google Calendar format */
  start: GoogleCalendarDate;

  /** End date in Google Calendar format (same as start for all-day events) */
  end: GoogleCalendarDate;
}

/**
 * Google Calendar date format for all-day events.
 *
 * Uses `date` field (not `dateTime`) for full-day events.
 * @see https://developers.google.com/calendar/api/v3/reference/events
 */
export interface GoogleCalendarDate {
  /** ISO date string (YYYY-MM-DD) */
  date: string;
}

// ============================================================================
// CASE DATA FOR CALENDAR SYNC
// ============================================================================

/**
 * RFI entry subset needed for calendar event generation.
 */
export interface CalendarRfiEntry {
  id: string;
  receivedDate: string;
  responseDueDate: string;
  responseSubmittedDate?: string;
}

/**
 * RFE entry subset needed for calendar event generation.
 */
export interface CalendarRfeEntry {
  id: string;
  receivedDate: string;
  responseDueDate: string;
  responseSubmittedDate?: string;
}

/**
 * Case data fields needed for calendar event generation.
 *
 * This is the minimal interface required to determine which events to create.
 */
export interface CaseDataForCalendar {
  // Identification
  _id: Id<"cases">;
  caseNumber?: string;
  internalCaseNumber?: string;
  employerName: string;
  beneficiaryIdentifier: string;

  // Status (for filtering)
  caseStatus: string;
  progressStatus: string;
  deletedAt?: number;

  // PWD dates
  pwdExpirationDate?: string;

  // ETA 9089 dates
  eta9089FilingDate?: string;
  eta9089CertificationDate?: string;
  eta9089ExpirationDate?: string;

  // Filing window dates (stored derived fields)
  filingWindowOpens?: string;
  filingWindowCloses?: string;
  recruitmentWindowCloses?: string;

  // Recruitment dates (the central deadline rules read all of them)
  sundayAdFirstDate?: string;
  sundayAdSecondDate?: string;
  jobOrderStartDate?: string;
  jobOrderEndDate?: string;
  noticeOfFilingStartDate?: string;
  noticeOfFilingEndDate?: string;
  additionalRecruitmentStartDate?: string;
  additionalRecruitmentEndDate?: string;
  isProfessionalOccupation?: boolean;
  additionalRecruitmentMethods?: CaseDataForDeadlines["additionalRecruitmentMethods"];

  // I-140 dates
  i140FilingDate?: string;

  // RFI/RFE entries
  rfiEntries?: CalendarRfiEntry[];
  rfeEntries?: CalendarRfeEntry[];

  // Case-level calendar sync toggle
  calendarSyncEnabled: boolean;
}

/**
 * User calendar sync preferences subset.
 */
export interface UserCalendarPreferences {
  /** Master switch for calendar sync */
  calendarSyncEnabled: boolean;

  /** Individual event type toggles */
  calendarSyncPwd: boolean;
  calendarSyncEta9089: boolean;
  calendarSyncFilingWindow: boolean;
  calendarSyncRecruitment: boolean;
  calendarSyncI140: boolean;
  calendarSyncRfi: boolean;
  calendarSyncRfe: boolean;
}
