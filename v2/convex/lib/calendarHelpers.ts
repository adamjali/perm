/**
 * Calendar Event Helper Functions
 *
 * Pure helper functions for formatting calendar events for Google Calendar sync.
 * All functions are testable without database dependencies.
 *
 * @see /perm_flow.md - Source of truth for PERM workflow
 * @see ./calendarTypes.ts - Type definitions
 * @module
 */

import type {
  CalendarEventType,
  CalendarEventInput,
  CalendarEventResult,
  GoogleCalendarDate,
} from "./calendarTypes";
import { CALENDAR_EVENT_LABELS } from "./calendarTypes";
import { loggers } from "./logging";

const log = loggers.calendar;

// ============================================================================
// DATE UTILITIES
// ============================================================================

/** ISO date format regex: YYYY-MM-DD */
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validate ISO date string format (YYYY-MM-DD).
 *
 * @param dateStr - Date string to validate
 * @returns true if valid YYYY-MM-DD format
 *
 * @example
 * isValidISODate("2024-12-31"); // true
 * isValidISODate("12/31/2024"); // false
 */
export function isValidISODate(dateStr: string): boolean {
  return ISO_DATE_REGEX.test(dateStr);
}

/**
 * Check if a date is in the future (after today).
 *
 * Uses UTC comparison to avoid timezone issues.
 *
 * @param dateStr - ISO date string (YYYY-MM-DD)
 * @param todayISO - Optional today's date for testing (YYYY-MM-DD), defaults to current date
 * @returns true if date is today or in the future
 *
 * @example
 * isFutureDate("2025-12-31"); // true (assuming today is before)
 * isFutureDate("2020-01-01"); // false
 */
export function isFutureDate(dateStr: string, todayISO?: string): boolean {
  if (!isValidISODate(dateStr)) {
    return false;
  }

  // Get today in YYYY-MM-DD format
  const today = todayISO ?? new Date().toISOString().split("T")[0];

  if (!today || !isValidISODate(today)) {
    return false;
  }

  // String comparison works for ISO dates
  return dateStr >= today;
}

/**
 * Convert an ISO date string to Google Calendar all-day event format.
 *
 * Google Calendar all-day events use the `date` field (not `dateTime`).
 *
 * @param dateStr - ISO date string (YYYY-MM-DD)
 * @returns Google Calendar date object
 *
 * @example
 * toGoogleCalendarDate("2024-12-31");
 * // Returns: { date: "2024-12-31" }
 */
export function toGoogleCalendarDate(dateStr: string): GoogleCalendarDate {
  if (!isValidISODate(dateStr)) {
    throw new Error(`Invalid ISO date format: "${dateStr}". Expected YYYY-MM-DD.`);
  }
  return { date: dateStr };
}

// ============================================================================
// EVENT TITLE FORMATTING
// ============================================================================

/**
 * Format a calendar event title.
 *
 * Pattern: "{Type}: {Employer}"
 * Example: "PWD Expiration: Acme Corp"
 *
 * @param input - Calendar event input data
 * @returns Formatted event title
 *
 * @example
 * formatEventTitle({
 *   eventType: "pwd_expiration",
 *   employerName: "Acme Corp",
 *   // ... other fields
 * });
 * // Returns: "PWD Expiration: Acme Corp"
 */
export function formatEventTitle(input: CalendarEventInput): string {
  const label = CALENDAR_EVENT_LABELS[input.eventType];
  return `${label}: ${input.employerName}`;
}

// ============================================================================
// EVENT DESCRIPTION FORMATTING
// ============================================================================

/**
 * Format a calendar event description.
 *
 * Multi-line format with case details:
 * - Employer name
 * - Beneficiary identifier
 * - Case number (if available)
 * - Internal case number (if available)
 * - Entry ID (for RFI/RFE events)
 *
 * @param input - Calendar event input data
 * @returns Multi-line event description
 *
 * @example
 * formatEventDescription({
 *   eventType: "pwd_expiration",
 *   employerName: "Acme Corp",
 *   beneficiaryIdentifier: "John D.",
 *   caseNumber: "A-12345-67890",
 *   // ... other fields
 * });
 * // Returns:
 * // "Employer: Acme Corp
 * //  Beneficiary: John D.
 * //  Case Number: A-12345-67890
 * //
 * //  PERM Tracker"
 */
export function formatEventDescription(input: CalendarEventInput): string {
  const lines: string[] = [];

  // Event type label as header
  const label = CALENDAR_EVENT_LABELS[input.eventType];
  lines.push(label);
  lines.push("");

  // Case details
  lines.push(`Employer: ${input.employerName}`);
  lines.push(`Beneficiary: ${input.beneficiaryIdentifier}`);

  if (input.caseNumber) {
    lines.push(`Case Number: ${input.caseNumber}`);
  }

  if (input.internalCaseNumber) {
    lines.push(`Internal Reference: ${input.internalCaseNumber}`);
  }

  // For RFI/RFE, include entry ID for reference
  if (input.entryId && (input.eventType === "rfi_due" || input.eventType === "rfe_due")) {
    const typeLabel = input.eventType === "rfi_due" ? "RFI" : "RFE";
    lines.push(`${typeLabel} Entry ID: ${input.entryId}`);
  }

  // Footer
  lines.push("");
  lines.push("PERM Tracker");

  return lines.join("\n");
}

// ============================================================================
// FULL EVENT FORMATTING
// ============================================================================

/**
 * Format a complete calendar event for Google Calendar API.
 *
 * Creates an all-day event with formatted title and description.
 * Start and end dates are the same for single-day deadline events.
 *
 * @param input - Calendar event input data
 * @returns Complete calendar event result
 *
 * @example
 * formatCalendarEvent({
 *   eventType: "pwd_expiration",
 *   date: "2024-12-31",
 *   caseId: "...",
 *   employerName: "Acme Corp",
 *   beneficiaryIdentifier: "John D.",
 * });
 * // Returns: {
 * //   summary: "PWD Expiration: Acme Corp",
 * //   description: "...",
 * //   start: { date: "2024-12-31" },
 * //   end: { date: "2024-12-31" }
 * // }
 */
export function formatCalendarEvent(input: CalendarEventInput): CalendarEventResult {
  if (!isValidISODate(input.date)) {
    throw new Error(`Invalid date format: "${input.date}". Expected YYYY-MM-DD.`);
  }

  return {
    summary: formatEventTitle(input),
    description: formatEventDescription(input),
    start: toGoogleCalendarDate(input.date),
    end: toGoogleCalendarDate(input.date),
  };
}

// ============================================================================
// EVENT TYPE UTILITIES
// ============================================================================

/**
 * Get the human-readable label for a calendar event type.
 *
 * @param eventType - Calendar event type
 * @returns Human-readable label
 *
 * @example
 * getEventTypeLabel("pwd_expiration"); // "PWD Expiration"
 * getEventTypeLabel("i140_deadline"); // "I-140 Deadline"
 */
export function getEventTypeLabel(eventType: CalendarEventType): string {
  return CALENDAR_EVENT_LABELS[eventType];
}

/**
 * Check if an event type is related to RFI/RFE entries.
 *
 * @param eventType - Calendar event type
 * @returns true if the event type is rfi_due or rfe_due
 */
export function isRfiRfeEventType(eventType: CalendarEventType): boolean {
  return eventType === "rfi_due" || eventType === "rfe_due";
}

/**
 * All calendar event types as an array.
 * Useful for iteration and validation.
 */
export const ALL_CALENDAR_EVENT_TYPES: CalendarEventType[] = [
  "pwd_expiration",
  "eta9089_filing",
  "eta9089_expiration",
  "filing_window_opens",
  "recruitment_expires",
  "i140_deadline",
  "rfi_due",
  "rfe_due",
];

/**
 * Check if a string is a valid calendar event type.
 *
 * @param value - String to check
 * @returns true if valid CalendarEventType
 */
export function isCalendarEventType(value: string): value is CalendarEventType {
  return ALL_CALENDAR_EVENT_TYPES.includes(value as CalendarEventType);
}

// ============================================================================
// RATE LIMIT AND ERROR HANDLING
// ============================================================================

/**
 * Check if an error is retryable (rate limit or server error).
 *
 * Google API returns:
 * - 429: Rate limit exceeded
 * - 403 with reason "rateLimitExceeded": Quota exceeded
 * - 408, 500, 502, 503, 504: Server errors
 *
 * @param error - The error to check
 * @returns true if the error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const err = error as Record<string, unknown>;

  // Check status code from various error formats
  const status =
    err.code ??
    err.status ??
    (err.response as Record<string, unknown> | undefined)?.status;

  // Check for specific Google API error reason
  const reason = (
    (err.response as Record<string, unknown> | undefined)?.data as
      | Record<string, unknown>
      | undefined
  )?.error as Record<string, unknown> | undefined;
  const errorReason = (reason?.errors as Array<{ reason?: string }> | undefined)?.[0]?.reason;

  // Rate limits
  if (status === 429) return true;
  if (status === 403 && errorReason === "rateLimitExceeded") return true;

  // Server errors
  if (
    typeof status === "number" &&
    [408, 500, 502, 503, 504].includes(status)
  ) {
    return true;
  }

  return false;
}

/**
 * Execute a function with exponential backoff for rate limits.
 *
 * Implements Google's recommended backoff strategy:
 * - Delay: min((2^n * baseDelay) + jitter, 64000ms)
 * - Jitter: random 0-1000ms
 * - Max retries: configurable (default 3)
 *
 * Only retries on:
 * - 429: Rate limit exceeded
 * - 403 with reason "rateLimitExceeded"
 * - 408, 500, 502, 503, 504: Server errors
 *
 * @param fn - The async function to execute
 * @param maxRetries - Maximum number of retries (default: 3)
 * @param baseDelayMs - Base delay in milliseconds (default: 1000)
 * @returns The result of the function
 * @throws The last error if all retries are exhausted
 *
 * @example
 * const result = await withExponentialBackoff(
 *   () => fetch('https://api.google.com/...'),
 *   3,
 *   1000
 * );
 */
export async function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (!isRetryableError(error)) {
        throw error;
      }

      if (attempt === maxRetries) {
        log.error('Rate limit: exhausted retries', { maxRetries });
        throw error;
      }

      // Exponential backoff with jitter: (2^n * base) + random(0-1000)ms, max 64s
      const delay = Math.min(
        Math.pow(2, attempt) * baseDelayMs + Math.random() * 1000,
        64000
      );

      const errorCode =
        (error as Record<string, unknown>)?.code ??
        (error as Record<string, unknown>)?.status ??
        "unknown";

      log.info('Retryable error, backing off', {
        errorCode,
        delayMs: Math.round(delay),
        attempt: attempt + 1,
        maxRetries,
      });

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
