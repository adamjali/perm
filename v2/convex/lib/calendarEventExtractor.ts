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
import { calculateI140FilingDeadline } from "./perm/calculators/i140";
import { calculateRecruitmentDeadlines } from "./perm/calculators/recruitment";
import { getFirstRecruitmentDate } from "./perm/dates";
import {
  EVENT_TYPE_TO_PREF,
} from "./calendarTypes";
import type {
  CalendarEventType,
  CalendarEventInput,
  CaseDataForCalendar,
  UserCalendarPreferences,
  CalendarRfiEntry,
  CalendarRfeEntry,
} from "./calendarTypes";

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
  /** Event types that were skipped due to missing data */
  skippedMissingData: CalendarEventType[];
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
 * Check if an RFI entry is unresolved (no response submitted)
 */
function isRfiUnresolved(entry: CalendarRfiEntry): boolean {
  return !entry.responseSubmittedDate;
}

/**
 * Check if an RFE entry is unresolved (no response submitted)
 */
function isRfeUnresolved(entry: CalendarRfeEntry): boolean {
  return !entry.responseSubmittedDate;
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
 * This function:
 * 1. Checks if the case has calendar sync enabled
 * 2. Iterates through all possible event types
 * 3. Filters by user preferences
 * 4. Filters out past dates (only future dates are synced)
 * 5. For I-140, calculates the deadline if not already stored
 * 6. For RFI/RFE, only includes unresolved entries
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
  const skippedMissingData: CalendarEventType[] = [];

  // Check case-level sync toggle
  if (!caseData.calendarSyncEnabled) {
    // All event types skipped by preference (case-level toggle is off)
    return {
      events: [],
      skippedByPreference: Object.keys(EVENT_TYPE_TO_PREF) as CalendarEventType[],
      skippedPastDates: [],
      skippedMissingData: [],
    };
  }

  // Check if case is closed or deleted - skip sync
  if (caseData.deletedAt || caseData.caseStatus === "closed") {
    return {
      events: [],
      skippedByPreference: [],
      skippedPastDates: [],
      skippedMissingData: Object.keys(EVENT_TYPE_TO_PREF) as CalendarEventType[],
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

    // Check if date exists
    if (!date) {
      skippedMissingData.push(eventType);
      return;
    }

    // Check if date is in the future
    if (!isFutureDate(date, todayISO)) {
      skippedPastDates.push(eventType);
      return;
    }

    // Add the event
    events.push(createEventInput(caseData, eventType, date, entryId));
  };

  // PWD Expiration
  tryAddEvent("pwd_expiration", caseData.pwdExpirationDate);

  // ETA 9089 Filing (filing date is when they plan to file, if set)
  // Note: This is the actual filing date, not the window
  if (caseData.eta9089FilingDate && !caseData.eta9089CertificationDate) {
    // Only show filing date if not yet certified
    tryAddEvent("eta9089_filing", caseData.eta9089FilingDate);
  }

  // ETA 9089 Expiration
  tryAddEvent("eta9089_expiration", caseData.eta9089ExpirationDate);

  // Filing Window Opens (when 30-day waiting period ends)
  tryAddEvent("filing_window_opens", caseData.filingWindowOpens);

  // Recruitment Window Closes (overall 180-day window)
  tryAddEvent("recruitment_expires", caseData.recruitmentWindowCloses);

  // Per-step recruitment deadlines (computed from first recruitment + PWD)
  const firstRecruitDate = getFirstRecruitmentDate({
    sundayAdFirstDate: caseData.sundayAdFirstDate,
    jobOrderStartDate: caseData.jobOrderStartDate,
    noticeOfFilingStartDate: caseData.noticeOfFilingStartDate,
  });
  if (firstRecruitDate && caseData.pwdExpirationDate) {
    try {
      const deadlines = calculateRecruitmentDeadlines(firstRecruitDate, caseData.pwdExpirationDate);
      if (!caseData.jobOrderStartDate) {
        tryAddEvent("job_order_start_deadline", deadlines.job_order_start_deadline);
      }
      if (!caseData.noticeOfFilingStartDate) {
        tryAddEvent("notice_of_filing_start_deadline", deadlines.notice_of_filing_start_deadline);
      }
      if (!caseData.sundayAdFirstDate) {
        tryAddEvent("first_sunday_ad_deadline", deadlines.first_sunday_ad_deadline);
      }
      if (!caseData.sundayAdSecondDate) {
        tryAddEvent("second_sunday_ad_deadline", deadlines.second_sunday_ad_deadline);
      }
    } catch (error) {
      console.error("[calendarEventExtractor] Failed to compute per-step recruitment deadlines:", error instanceof Error ? error.message : String(error));
    }
  }

  // I-140 Filing Deadline
  // Calculate if ETA 9089 is certified but I-140 not yet filed
  if (caseData.eta9089CertificationDate && !caseData.i140FilingDate) {
    const i140Deadline = calculateI140FilingDeadline(caseData.eta9089CertificationDate);
    tryAddEvent("i140_deadline", i140Deadline);
  }

  // RFI Due Dates - only for unresolved entries
  if (caseData.rfiEntries) {
    for (const entry of caseData.rfiEntries) {
      if (isRfiUnresolved(entry)) {
        tryAddEvent("rfi_due", entry.responseDueDate, entry.id);
      }
    }
  }

  // RFE Due Dates - only for unresolved entries
  if (caseData.rfeEntries) {
    for (const entry of caseData.rfeEntries) {
      if (isRfeUnresolved(entry)) {
        tryAddEvent("rfe_due", entry.responseDueDate, entry.id);
      }
    }
  }

  return {
    events,
    skippedByPreference,
    skippedPastDates,
    skippedMissingData,
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
