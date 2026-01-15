/**
 * Deadline Type Mapping
 *
 * Provides bidirectional mapping between dashboard DeadlineType (snake_case)
 * and calendar DeadlineType (camelCase) naming conventions.
 *
 * ## Why Two Naming Conventions?
 *
 * - **Dashboard (snake_case)**: Used in backend/Convex context for database queries,
 *   API responses, and calendar event ID storage. Matches typical database conventions.
 *
 * - **Calendar (camelCase)**: Used in frontend/React context for timeline visualization,
 *   component props, and TypeScript interfaces. Matches TypeScript/React conventions.
 *
 * ## Usage
 *
 * ```typescript
 * import { dashboardToCalendar, calendarToDashboard } from './deadlineTypeMapping';
 *
 * // Convert dashboard type to calendar type
 * const calendarType = dashboardToCalendar('pwd_expiration'); // 'pwdExpires'
 *
 * // Convert calendar type to dashboard type
 * const dashboardType = calendarToDashboard('pwdExpires'); // 'pwd_expiration'
 * ```
 *
 * @see ./dashboardTypes.ts for DashboardDeadlineType
 * @see ../../src/lib/calendar/types.ts for CalendarDeadlineType
 */

import type { DeadlineType as DashboardDeadlineType } from "./dashboardTypes";

/**
 * Calendar deadline types (camelCase, frontend convention).
 * Subset of types that have dashboard equivalents.
 */
export type MappableCalendarDeadlineType =
  | "pwdExpires"
  | "rfiDue"
  | "rfeDue"
  | "filingWindowOpens"
  | "filingWindowCloses"
  | "eta9089Expires"
  | "i140Filed";

/**
 * Mapping from dashboard (snake_case) to calendar (camelCase) deadline types.
 * Not all dashboard types have calendar equivalents - only actionable deadlines.
 */
export const DASHBOARD_TO_CALENDAR_MAP: Partial<
  Record<DashboardDeadlineType, MappableCalendarDeadlineType>
> = {
  pwd_expiration: "pwdExpires",
  rfi_due: "rfiDue",
  rfe_due: "rfeDue",
  filing_window_opens: "filingWindowOpens",
  recruitment_window: "filingWindowCloses",
  eta9089_expiration: "eta9089Expires",
  i140_filing_deadline: "i140Filed",
} as const;

/**
 * Mapping from calendar (camelCase) to dashboard (snake_case) deadline types.
 */
export const CALENDAR_TO_DASHBOARD_MAP: Record<
  MappableCalendarDeadlineType,
  DashboardDeadlineType
> = {
  pwdExpires: "pwd_expiration",
  rfiDue: "rfi_due",
  rfeDue: "rfe_due",
  filingWindowOpens: "filing_window_opens",
  filingWindowCloses: "recruitment_window",
  eta9089Expires: "eta9089_expiration",
  i140Filed: "i140_filing_deadline",
} as const;

/**
 * Convert a dashboard deadline type to its calendar equivalent.
 *
 * @param dashboardType - Dashboard deadline type (snake_case)
 * @returns Calendar deadline type (camelCase) or undefined if no mapping exists
 *
 * @example
 * dashboardToCalendar('pwd_expiration') // 'pwdExpires'
 * dashboardToCalendar('rfi_response')   // undefined (no calendar equivalent)
 */
export function dashboardToCalendar(
  dashboardType: DashboardDeadlineType
): MappableCalendarDeadlineType | undefined {
  return DASHBOARD_TO_CALENDAR_MAP[dashboardType];
}

/**
 * Convert a calendar deadline type to its dashboard equivalent.
 *
 * @param calendarType - Calendar deadline type (camelCase)
 * @returns Dashboard deadline type (snake_case)
 *
 * @example
 * calendarToDashboard('pwdExpires')         // 'pwd_expiration'
 * calendarToDashboard('filingWindowCloses') // 'recruitment_window'
 */
export function calendarToDashboard(
  calendarType: MappableCalendarDeadlineType
): DashboardDeadlineType {
  return CALENDAR_TO_DASHBOARD_MAP[calendarType];
}

/**
 * Check if a dashboard deadline type has a calendar equivalent.
 *
 * @param dashboardType - Dashboard deadline type to check
 * @returns True if the type can be mapped to a calendar type
 */
export function hasDashboardToCalendarMapping(
  dashboardType: DashboardDeadlineType
): boolean {
  return dashboardType in DASHBOARD_TO_CALENDAR_MAP;
}

/**
 * Type guard to check if a string is a valid mappable calendar deadline type.
 */
export function isMappableCalendarDeadlineType(
  value: string
): value is MappableCalendarDeadlineType {
  return value in CALENDAR_TO_DASHBOARD_MAP;
}
