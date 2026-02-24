/**
 * Default User Profile Factory
 *
 * Centralizes the default profile values used when creating new user profiles.
 * ALL default values live here — other files must import, never hardcode.
 */

import type { Id } from "../_generated/dataModel";
import type { UserNotificationPrefs } from "./notificationHelpers";

/**
 * Current Terms of Service version — single source of truth.
 * Matches the effective date on the /terms page (YYYY-MM-DD).
 * Update this when terms change.
 */
export const TERMS_VERSION = "2026-02-17";

/**
 * Default notification preferences — single source of truth.
 * Used by scheduledJobs, notificationHelpers, and cases fallback logic.
 */
export const DEFAULT_NOTIFICATION_PREFS: UserNotificationPrefs = {
  emailNotificationsEnabled: true,
  emailDeadlineReminders: true,
  emailStatusUpdates: false,
  emailRfeAlerts: true,
  pushNotificationsEnabled: false,
  quietHoursEnabled: false,
  timezone: "America/New_York",
};

/**
 * Build a default user profile for a new user.
 *
 * @param userId - The user's ID
 * @param overrides - Optional field overrides (e.g., fullName, profilePhotoUrl)
 */
export function buildDefaultProfile(
  userId: Id<"users">,
  overrides?: {
    fullName?: string;
    profilePhotoUrl?: string;
    termsAcceptedAt?: number;
    termsVersion?: string;
  }
) {
  const now = Date.now();
  return {
    userId,
    fullName: overrides?.fullName,
    profilePhotoUrl: overrides?.profilePhotoUrl,
    userType: "individual" as const,
    emailNotificationsEnabled: DEFAULT_NOTIFICATION_PREFS.emailNotificationsEnabled,
    smsNotificationsEnabled: false,
    pushNotificationsEnabled: DEFAULT_NOTIFICATION_PREFS.pushNotificationsEnabled,
    urgentDeadlineDays: 7,
    reminderDaysBefore: [1, 3, 7, 14, 30],
    emailDeadlineReminders: DEFAULT_NOTIFICATION_PREFS.emailDeadlineReminders,
    emailStatusUpdates: DEFAULT_NOTIFICATION_PREFS.emailStatusUpdates,
    emailRfeAlerts: DEFAULT_NOTIFICATION_PREFS.emailRfeAlerts,
    emailWeeklyDigest: true,
    quietHoursEnabled: DEFAULT_NOTIFICATION_PREFS.quietHoursEnabled,
    timezone: DEFAULT_NOTIFICATION_PREFS.timezone,
    calendarSyncEnabled: true,
    calendarSyncPwd: true,
    calendarSyncEta9089: true,
    calendarSyncI140: true,
    calendarSyncRfe: true,
    calendarSyncRfi: true,
    calendarSyncRecruitment: true,
    calendarSyncFilingWindow: true,
    googleCalendarConnected: false,
    gmailConnected: false,
    casesSortBy: "updatedAt",
    casesSortOrder: "desc" as const,
    casesPerPage: 20,
    dismissedDeadlines: [],
    darkModeEnabled: false,
    autoDeadlineEnforcementEnabled: false,
    loginCount: 0,
    lastLoginAt: now,
    termsAcceptedAt: overrides?.termsAcceptedAt ?? now,
    termsVersion: overrides?.termsVersion ?? TERMS_VERSION,
    createdAt: now,
    updatedAt: now,
  };
}
