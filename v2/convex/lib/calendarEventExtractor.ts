/**
 * Calendar Event Extractor
 *
 * Extracts calendar events from case data based on user preferences.
 * Used by the bulk sync action to determine which events to create.
 *
 * @see ./calendarTypes.ts - Type definitions
 * @see ./calendarHelpers.ts - Event formatting utilities
 * @see ../lib/perm/calculators/i140.ts - I-140 deadline calculation
 * @module
 */

import { isFutureDate } from "./calendarHelpers";
import { buildDeadlineInput } from "./perm/deadlines/buildDeadlineInput";
import { extractActiveDeadlines } from "./perm/deadlines/extractActiveDeadlines";
import { getActiveRfeEntry, getActiveRfiEntry } from "./perm/deadlines/isDeadlineActive";
import type { DeadlineType } from "./perm/deadlines/types";
import type { CaseStatus, ProgressStatus } from "./perm/statusTypes";
import {
  EVENT_TYPE_TO_PREF,
} from "./calendarTypes";
import type {
  CalendarEventType,
  CalendarEventInput,
  CaseDataForCalendar,
  UserCalendarPreferences,
} from "./calendarTypes";

/** The calendar event each central deadline becomes. */
const CENTRAL_TO_EVENT: Record<DeadlineType, CalendarEventType> = {
  pwd_expiration: "pwd_expiration",
  filing_window_opens: "filing_window_opens",
  filing_window_closes: "filing_window_closes",
  recruitment_window_closes: "recruitment_window_closes",
  job_order_start_deadline: "job_order_start_deadline",
  notice_of_filing_start_deadline: "notice_of_filing_start_deadline",
  first_sunday_ad_deadline: "first_sunday_ad_deadline",
  second_sunday_ad_deadline: "second_sunday_ad_deadline",
  i140_filing_deadline: "i140_deadline",
  rfi_due: "rfi_due",
  rfe_due: "rfe_due",
};

/**
 * Result of event extraction with additional metadata
 */
export interface ExtractionResult {
  /** Events to create in Google Calendar */
  events: CalendarEventInput[];
  /** Event types that were skipped due to preferences */
  skippedByPreference: CalendarEventType[];
  /** Event types that were skipped due to past dates */
  skippedPastDates: CalendarEventType[];
}

/**
 * Check if a specific event type is enabled based on user preferences
 */
function isEventTypeEnabled(
  eventType: CalendarEventType,
  preferences: UserCalendarPreferences
): boolean {
  // Master switch must be on
  if (!preferences.calendarSyncEnabled) {
    return false;
  }

  // Check specific event type preference
  const prefKey = EVENT_TYPE_TO_PREF[eventType];
  return preferences[prefKey] === true;
}

/**
 * Create a CalendarEventInput for a specific event type
 */
function createEventInput(
  caseData: CaseDataForCalendar,
  eventType: CalendarEventType,
  date: string,
  entryId?: string
): CalendarEventInput {
  return {
    eventType,
    date,
    caseId: caseData._id,
    employerName: caseData.employerName,
    beneficiaryIdentifier: caseData.beneficiaryIdentifier,
    caseNumber: caseData.caseNumber,
    internalCaseNumber: caseData.internalCaseNumber,
    entryId,
  };
}

/**
 * Extract all calendar events from case data based on user preferences
 *
 * The deadlines come from the central rules (extractActiveDeadlines), the
 * same list the dashboard, case cards, in-app calendar and reminder emails
 * use, so a deadline the case no longer has (a PWD expiry after the ETA 9089
 * is filed, an answered RFI) never reaches the user's calendar. Past dates
 * are skipped. The one date that is not a deadline is the ETA 9089 filing
 * date when it is still ahead (a planned filing).
 *
 * @param caseData - Case data to extract events from
 * @param preferences - User's calendar sync preferences
 * @param todayISO - Optional today's date for testing (YYYY-MM-DD)
 * @returns Extraction result with events and metadata
 *
 * @example
 * const result = extractCalendarEvents(caseData, userPreferences);
 * console.log(result.events); // Array of CalendarEventInput
 */
export function extractCalendarEvents(
  caseData: CaseDataForCalendar,
  preferences: UserCalendarPreferences,
  todayISO?: string
): ExtractionResult {
  const events: CalendarEventInput[] = [];
  const skippedByPreference: CalendarEventType[] = [];
  const skippedPastDates: CalendarEventType[] = [];

  // Check case-level sync toggle
  if (!caseData.calendarSyncEnabled) {
    // All event types skipped by preference (case-level toggle is off)
    return {
      events: [],
      skippedByPreference: Object.keys(EVENT_TYPE_TO_PREF) as CalendarEventType[],
      skippedPastDates: [],
    };
  }

  // Check if case is closed or deleted - skip sync
  if (caseData.deletedAt || caseData.caseStatus === "closed") {
    return {
      events: [],
      skippedByPreference: [],
      skippedPastDates: [],
    };
  }

  // Helper to add event if conditions are met
  const tryAddEvent = (
    eventType: CalendarEventType,
    date: string | undefined,
    entryId?: string
  ) => {
    // Check preference
    if (!isEventTypeEnabled(eventType, preferences)) {
      skippedByPreference.push(eventType);
      return;
    }

    if (!date) return;

    // Check if date is in the future
    if (!isFutureDate(date, todayISO)) {
      skippedPastDates.push(eventType);
      return;
    }

    // Add the event
    events.push(createEventInput(caseData, eventType, date, entryId));
  };

  // A planned ETA 9089 filing date, while it is still ahead and uncertified.
  if (caseData.eta9089FilingDate && !caseData.eta9089CertificationDate) {
    tryAddEvent("eta9089_filing", caseData.eta9089FilingDate);
  }

  // Every deadline the central rules say the case still has. createdAt is not
  // part of the calendar's copy of an RFI/RFE and the rules never read it.
  const input = buildDeadlineInput({
    ...caseData,
    caseStatus: caseData.caseStatus as CaseStatus,
    progressStatus: caseData.progressStatus as ProgressStatus,
    rfiEntries: caseData.rfiEntries?.map((e) => ({ ...e, createdAt: 0 })),
    rfeEntries: caseData.rfeEntries?.map((e) => ({ ...e, createdAt: 0 })),
  });
  for (const d of extractActiveDeadlines(input, todayISO)) {
    const entryId =
      d.type === "rfi_due" ? getActiveRfiEntry(input.rfiEntries ?? [])?.id
      : d.type === "rfe_due" ? getActiveRfeEntry(input.rfeEntries ?? [])?.id
      : undefined;
    tryAddEvent(CENTRAL_TO_EVENT[d.type], d.date, entryId);
  }

  return {
    events,
    skippedByPreference,
    skippedPastDates,
  };
}

/**
 * Get the default user calendar preferences (all enabled)
 *
 * Useful for cases where user profile is not available.
 */
export function getDefaultCalendarPreferences(): UserCalendarPreferences {
  return {
    calendarSyncEnabled: true,
    calendarSyncPwd: true,
    calendarSyncEta9089: true,
    calendarSyncFilingWindow: true,
    calendarSyncRecruitment: true,
    calendarSyncI140: true,
    calendarSyncRfi: true,
    calendarSyncRfe: true,
  };
}
