/**
 * Deadline Timezone Rules
 *
 * Central source of truth for which timezone governs each deadline type.
 *
 * Rules:
 * - "local": Deadline is active for the entire calendar day in the user's
 *   local timezone. Used for administrative deadlines and activities at the
 *   employer's location (recruitment, PWD validity, USCIS filings).
 *   Displayed as "11:59 PM your time" in the UI.
 *
 * - "dol": Deadline is active for the entire calendar day in Eastern Time
 *   (America/New_York). Used for deadlines involving the DOL FLAG system
 *   or DOL submissions (ETA-9089 filing, RFI responses).
 *   Displayed as "11:59 PM ET" in the UI.
 *
 * @see https://flag.dol.gov - FLAG system operates on Eastern Time
 * @module
 */

import type { DeadlineType } from "./types";
import type { ViolationType } from "../../deadlineEnforcementHelpers";
import { loggers } from "../../logging";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Timezone rule for a deadline.
 *
 * - "local": User's configured timezone (from userProfile.timezone)
 * - "dol": DOL Eastern Time (America/New_York)
 */
export type TimezoneRule = "local" | "dol";

// ============================================================================
// CONSTANTS
// ============================================================================

/** DOL operates on Eastern Time (Washington, DC) */
export const DOL_TIMEZONE = "America/New_York";

/** Default timezone when user hasn't configured one */
export const DEFAULT_USER_TIMEZONE = "America/New_York";

/**
 * Timezone rule for each deadline type.
 *
 * This is the SINGLE SOURCE OF TRUTH for which timezone governs each deadline.
 * To change a rule, update it here — all consumers read from this map.
 */
export const DEADLINE_TIMEZONE_RULES = {
  pwd_expiration: "local",
  filing_window_opens: "local",
  filing_window_closes: "dol", // ETA-9089 filed through DOL FLAG system
  recruitment_window_closes: "local",
  i140_filing_deadline: "local", // I-140 filed with USCIS
  rfi_due: "dol", // Response submitted to DOL
  rfe_due: "local", // Response submitted to USCIS
} as const satisfies Record<DeadlineType, TimezoneRule>;

/**
 * Timezone rule for each enforcement violation type.
 *
 * Maps violation checks to the appropriate timezone for "today" resolution.
 */
export const ENFORCEMENT_TIMEZONE_RULES = {
  pwd_expired: "local",
  recruitment_window_missed: "local",
  filing_window_missed: "dol",
  eta9089_expired: "local",
} as const satisfies Record<ViolationType, TimezoneRule>;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the effective IANA timezone string for a deadline.
 *
 * @param rule - The timezone rule ("local" or "dol")
 * @param userTimezone - User's configured IANA timezone
 * @returns IANA timezone string
 *
 * @example
 * getEffectiveTimezone("dol", "America/Los_Angeles") // "America/New_York"
 * getEffectiveTimezone("local", "America/Los_Angeles") // "America/Los_Angeles"
 */
export function getEffectiveTimezone(
  rule: TimezoneRule,
  userTimezone: string
): string {
  return rule === "dol" ? DOL_TIMEZONE : userTimezone;
}

/**
 * Get today's date (YYYY-MM-DD) in a specific timezone.
 *
 * Uses Intl.DateTimeFormat for reliable timezone conversion without
 * external dependencies. Uses formatToParts for guaranteed YYYY-MM-DD format.
 *
 * @param timezone - IANA timezone string (e.g., "America/New_York")
 * @returns ISO date string (YYYY-MM-DD) representing "today" in that timezone
 *
 * @example
 * // At 11:30 PM Pacific on June 30:
 * getTodayInTimezone("America/Los_Angeles") // "2025-06-30"
 * getTodayInTimezone("America/New_York")    // "2025-07-01" (already July 1 ET)
 */
export function getTodayInTimezone(timezone: string): string {
  try {
    const now = new Date();
    // "en-CA" locale natively produces YYYY-MM-DD ordering in formatToParts
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);

    const year = parts.find((p) => p.type === "year")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;

    if (!year || !month || !day) {
      loggers.deadline.warn("getTodayInTimezone: formatToParts missing components, using default timezone", {
        timezone,
      });
      return getTodayInTimezone(DEFAULT_USER_TIMEZONE);
    }

    return `${year}-${month}-${day}`;
  } catch (error) {
    loggers.deadline.error("getTodayInTimezone: invalid timezone, using default timezone", {
      timezone,
      error: error instanceof Error ? error.message : String(error),
    });
    // Fall back to DEFAULT_USER_TIMEZONE instead of UTC for consistency
    // with how missing profile timezone is handled elsewhere
    try {
      return getTodayInTimezone(DEFAULT_USER_TIMEZONE);
    } catch {
      // Last resort: UTC (should never happen since DEFAULT_USER_TIMEZONE is valid)
      return new Date().toISOString().split("T")[0]!;
    }
  }
}

/**
 * Get today's date for a specific deadline type.
 *
 * Combines the timezone rule lookup with timezone-aware date resolution.
 * This is the primary function consumers should use.
 *
 * @param deadlineType - The type of deadline
 * @param userTimezone - User's configured IANA timezone
 * @returns ISO date string (YYYY-MM-DD) representing "today" in the effective timezone
 *
 * @example
 * // User in Pacific Time, checking a DOL deadline:
 * getTodayForDeadline("rfi_due", "America/Los_Angeles")
 * // Returns today in ET (DOL timezone), not PT
 *
 * // User in Pacific Time, checking a local deadline:
 * getTodayForDeadline("pwd_expiration", "America/Los_Angeles")
 * // Returns today in PT (user's timezone)
 */
export function getTodayForDeadline(
  deadlineType: DeadlineType,
  userTimezone: string
): string {
  const rule = DEADLINE_TIMEZONE_RULES[deadlineType];
  const tz = getEffectiveTimezone(rule, userTimezone);
  return getTodayInTimezone(tz);
}

/**
 * Get the display label for a deadline's timezone context.
 *
 * Used by frontend components to show "11:59 PM ET" or "11:59 PM your time".
 *
 * @param rule - The timezone rule
 * @returns Human-readable timezone label
 *
 * @example
 * getTimezoneDisplayLabel("dol")   // "11:59 PM ET"
 * getTimezoneDisplayLabel("local") // "11:59 PM your time"
 */
export function getTimezoneDisplayLabel(rule: TimezoneRule): string {
  return rule === "dol" ? "11:59 PM ET" : "11:59 PM your time";
}
