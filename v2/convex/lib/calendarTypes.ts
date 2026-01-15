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
  | "eta9089_expiration"
  | "filing_window_opens"
  | "recruitment_expires"
  | "i140_deadline"
  | "rfi_due"
  | "rfe_due";

/**
 * Human-readable labels for each calendar event type.
 */
export const CALENDAR_EVENT_LABELS: Record<CalendarEventType, string> = {
  pwd_expiration: "PWD Expiration",
  eta9089_filing: "ETA 9089 Filing",
  eta9089_expiration: "ETA 9089 Expiration",
  filing_window_opens: "Ready to File",
  recruitment_expires: "Recruitment Expires",
  i140_deadline: "I-140 Deadline",
  rfi_due: "RFI Response Due",
  rfe_due: "RFE Response Due",
};

// ============================================================================
// USER PREFERENCE MAPPING
// ============================================================================

/**
 * Calendar sync preference fields from userProfiles schema.
 */
export type CalendarSyncPreference =
  | "calendarSyncPwd"
  | "calendarSyncEta9089"
  | "calendarSyncFilingWindow"
  | "calendarSyncRecruitment"
  | "calendarSyncI140"
  | "calendarSyncRfi"
  | "calendarSyncRfe";

/**
 * Maps calendar event types to their corresponding user preference fields.
 *
 * Some preferences control multiple event types:
 * - calendarSyncEta9089: eta9089_filing, eta9089_expiration
 *
 * @example
 * const pref = EVENT_TYPE_TO_PREF["pwd_expiration"]; // "calendarSyncPwd"
 */
export const EVENT_TYPE_TO_PREF: Record<CalendarEventType, CalendarSyncPreference> = {
  pwd_expiration: "calendarSyncPwd",
  eta9089_filing: "calendarSyncEta9089",
  eta9089_expiration: "calendarSyncEta9089",
  filing_window_opens: "calendarSyncFilingWindow",
  recruitment_expires: "calendarSyncRecruitment",
  i140_deadline: "calendarSyncI140",
  rfi_due: "calendarSyncRfi",
  rfe_due: "calendarSyncRfe",
};

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
  recruitmentWindowCloses?: string;

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
