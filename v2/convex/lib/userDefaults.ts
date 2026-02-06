/**
 * Default User Profile Factory
 *
 * Centralizes the default profile values used when creating new user profiles.
 * Previously duplicated across 5 locations with inconsistencies.
 */

import type { Id } from "../_generated/dataModel";

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
    emailNotificationsEnabled: true,
    smsNotificationsEnabled: false,
    pushNotificationsEnabled: false,
    urgentDeadlineDays: 7,
    reminderDaysBefore: [1, 3, 7, 14, 30],
    emailDeadlineReminders: true,
    emailStatusUpdates: true,
    emailRfeAlerts: true,
    emailWeeklyDigest: true,
    preferredNotificationEmail: "signup" as const,
    quietHoursEnabled: false,
    timezone: "America/New_York",
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
    ...(overrides?.termsAcceptedAt !== undefined
      ? { termsAcceptedAt: overrides.termsAcceptedAt, termsVersion: overrides.termsVersion }
      : {}),
    createdAt: now,
    updatedAt: now,
  };
}
