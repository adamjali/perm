/**
 * Calendar Queries and Mutations
 *
 * Provides functions for the calendar UI feature:
 * 1. getCalendarEvents - Get cases with deadline fields for calendar display
 * 2. getCalendarPreferences - Get user's calendar visibility preferences
 * 3. updateCalendarPreferences - Update hidden cases and deadline types
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { getCurrentUserId, getCurrentUserIdOrNull } from "./lib/auth";

/**
 * Maps calendar sync preference names to the schema field names for calendarEventIds.
 *
 * When a preference is toggled OFF, we need to delete the corresponding calendar events.
 * This maps the preference field name to the schema fields that store event IDs.
 */
const PREF_TO_SCHEMA_FIELDS: Record<string, string[]> = {
  calendarSyncPwd: ["pwd_expiration"],
  calendarSyncEta9089: ["eta9089_filing_window", "eta9089_expiration"],
  calendarSyncI140: ["i140_filing_deadline"],
  calendarSyncRfe: ["rfe_due"],
  calendarSyncRfi: ["rfi_due"],
  calendarSyncRecruitment: ["recruitment_end"],
  calendarSyncFilingWindow: ["eta9089_filing_window"],
};

/**
 * RFI/RFE entry type for calendar data
 */
interface CalendarRfiRfeEntry {
  id: string;
  title?: string;
  description?: string;
  notes?: string;
  receivedDate: string;
  responseDueDate: string;
  responseSubmittedDate?: string;
  createdAt: number;
}

/**
 * Calendar event data type - case with all deadline-relevant fields
 */
interface CalendarEventData {
  id: Id<"cases">;
  employerName: string;
  beneficiaryIdentifier: string;
  positionTitle: string;
  caseStatus: "pwd" | "recruitment" | "eta9089" | "i140" | "closed";
  progressStatus: "working" | "waiting_intake" | "filed" | "approved" | "under_review" | "rfi_rfe";
  // PWD dates
  pwdFilingDate?: string;
  pwdDeterminationDate?: string;
  pwdExpirationDate?: string;
  // Recruitment dates
  jobOrderStartDate?: string;
  jobOrderEndDate?: string;
  sundayAdFirstDate?: string;
  sundayAdSecondDate?: string;
  additionalRecruitmentStartDate?: string;
  additionalRecruitmentEndDate?: string;
  noticeOfFilingStartDate?: string;
  noticeOfFilingEndDate?: string;
  // ETA 9089 dates
  eta9089FilingDate?: string;
  eta9089AuditDate?: string;
  eta9089CertificationDate?: string;
  eta9089ExpirationDate?: string;
  // I-140 dates
  i140FilingDate?: string;
  i140ReceiptDate?: string;
  i140ApprovalDate?: string;
  i140DenialDate?: string;
  // RFI/RFE entries
  rfiEntries: CalendarRfiRfeEntry[];
  rfeEntries: CalendarRfiRfeEntry[];
}

/**
 * Calendar preferences type
 */
interface CalendarPreferences {
  hiddenCases: Id<"cases">[];
  hiddenDeadlineTypes: string[];
  showCompleted: boolean; // Show I-140 approved cases
  showClosed: boolean; // Show closed/archived cases
}

/**
 * Get calendar events (cases with deadline fields) for the current user
 * @param showCompleted - If true, includes I-140 approved cases (default: false)
 * @param showClosed - If true, includes closed/archived cases (default: false)
 */
export const getCalendarEvents = query({
  args: {
    showCompleted: v.optional(v.boolean()), // Show I-140 approved cases
    showClosed: v.optional(v.boolean()), // Show closed/archived cases
  },
  handler: async (ctx, args): Promise<CalendarEventData[]> => {
    // Use null-safe auth check for graceful sign-out handling
    const userId = await getCurrentUserIdOrNull(ctx);
    if (userId === null) {
      return [];
    }

    // Query cases for user with reasonable limit
    const cases = await ctx.db
      .query("cases")
      .withIndex("by_user_id", (q) => q.eq("userId", userId as Id<"users">))
      .take(1000);

    // Filter out deleted cases
    let filteredCases = cases.filter((c) => c.deletedAt === undefined);

    // Filter out completed cases (I-140 + approved) unless showCompleted is true
    if (args.showCompleted !== true) {
      filteredCases = filteredCases.filter(
        (c) => !(c.caseStatus === "i140" && c.progressStatus === "approved")
      );
    }

    // Filter out closed cases unless showClosed is true
    if (args.showClosed !== true) {
      filteredCases = filteredCases.filter((c) => c.caseStatus !== "closed");
    }

    // Map to calendar event data format
    return filteredCases.map((caseDoc) => ({
      id: caseDoc._id,
      employerName: caseDoc.employerName,
      beneficiaryIdentifier: caseDoc.beneficiaryIdentifier,
      positionTitle: caseDoc.positionTitle,
      caseStatus: caseDoc.caseStatus,
      progressStatus: caseDoc.progressStatus,
      // PWD dates
      pwdFilingDate: caseDoc.pwdFilingDate,
      pwdDeterminationDate: caseDoc.pwdDeterminationDate,
      pwdExpirationDate: caseDoc.pwdExpirationDate,
      // Recruitment dates
      jobOrderStartDate: caseDoc.jobOrderStartDate,
      jobOrderEndDate: caseDoc.jobOrderEndDate,
      sundayAdFirstDate: caseDoc.sundayAdFirstDate,
      sundayAdSecondDate: caseDoc.sundayAdSecondDate,
      additionalRecruitmentStartDate: caseDoc.additionalRecruitmentStartDate,
      additionalRecruitmentEndDate: caseDoc.additionalRecruitmentEndDate,
      noticeOfFilingStartDate: caseDoc.noticeOfFilingStartDate,
      noticeOfFilingEndDate: caseDoc.noticeOfFilingEndDate,
      // ETA 9089 dates
      eta9089FilingDate: caseDoc.eta9089FilingDate,
      eta9089AuditDate: caseDoc.eta9089AuditDate,
      eta9089CertificationDate: caseDoc.eta9089CertificationDate,
      eta9089ExpirationDate: caseDoc.eta9089ExpirationDate,
      // I-140 dates
      i140FilingDate: caseDoc.i140FilingDate,
      i140ReceiptDate: caseDoc.i140ReceiptDate,
      i140ApprovalDate: caseDoc.i140ApprovalDate,
      i140DenialDate: caseDoc.i140DenialDate,
      // RFI/RFE entries - default to empty arrays
      rfiEntries: (caseDoc.rfiEntries ?? []) as CalendarRfiRfeEntry[],
      rfeEntries: (caseDoc.rfeEntries ?? []) as CalendarRfiRfeEntry[],
    }));
  },
});

/**
 * Get user's calendar preferences (hidden cases and deadline types)
 * Returns empty arrays if not set
 */
export const getCalendarPreferences = query({
  args: {},
  handler: async (ctx): Promise<CalendarPreferences> => {
    // Use null-safe auth check for graceful sign-out handling
    const userId = await getCurrentUserIdOrNull(ctx);
    if (userId === null) {
      return {
        hiddenCases: [],
        hiddenDeadlineTypes: [],
        showCompleted: false,
        showClosed: false,
      };
    }

    // Query user profile for calendar preferences
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId as Id<"users">))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .first();

    if (!profile) {
      return {
        hiddenCases: [],
        hiddenDeadlineTypes: [],
        showCompleted: false,
        showClosed: false,
      };
    }

    return {
      hiddenCases: profile.calendarHiddenCases ?? [],
      hiddenDeadlineTypes: profile.calendarHiddenDeadlineTypes ?? [],
      showCompleted: profile.calendarShowCompleted ?? false,
      showClosed: profile.calendarShowClosed ?? false,
    };
  },
});

/**
 * Update user's calendar preferences (hidden cases, deadline types, and visibility toggles)
 * Only updates fields that are provided
 * Creates user profile if it doesn't exist
 */
export const updateCalendarPreferences = mutation({
  args: {
    hiddenCases: v.optional(v.array(v.id("cases"))),
    hiddenDeadlineTypes: v.optional(v.array(v.string())),
    showCompleted: v.optional(v.boolean()), // Show I-140 approved cases
    showClosed: v.optional(v.boolean()), // Show closed/archived cases
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const now = Date.now();

    // Query user profile
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId as Id<"users">))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .first();

    // Create profile if it doesn't exist
    if (!profile) {
      const profileId = await ctx.db.insert("userProfiles", {
        userId: userId as Id<"users">,
        userType: "individual",
        emailNotificationsEnabled: true,
        smsNotificationsEnabled: false,
        pushNotificationsEnabled: false,
        urgentDeadlineDays: 7,
        reminderDaysBefore: [1, 3, 7, 14, 30],
        emailDeadlineReminders: true,
        emailStatusUpdates: true,
        emailRfeAlerts: true,
        emailWeeklyDigest: false,
        preferredNotificationEmail: "signup",
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
        casesSortOrder: "desc",
        casesPerPage: 20,
        dismissedDeadlines: [],
        darkModeEnabled: false,
        autoDeadlineEnforcementEnabled: false,
        createdAt: now,
        updatedAt: now,
        // Initialize calendar preferences with provided values or defaults
        calendarHiddenCases: args.hiddenCases ?? [],
        calendarHiddenDeadlineTypes: args.hiddenDeadlineTypes ?? [],
        calendarShowCompleted: args.showCompleted ?? false,
        calendarShowClosed: args.showClosed ?? false,
      });
      return profileId;
    }

    // Build update object with only provided fields
    const updates: {
      calendarHiddenCases?: Id<"cases">[];
      calendarHiddenDeadlineTypes?: string[];
      calendarShowCompleted?: boolean;
      calendarShowClosed?: boolean;
      updatedAt: number;
    } = { updatedAt: now };

    if (args.hiddenCases !== undefined) {
      updates.calendarHiddenCases = args.hiddenCases;
    }

    if (args.hiddenDeadlineTypes !== undefined) {
      updates.calendarHiddenDeadlineTypes = args.hiddenDeadlineTypes;
    }

    if (args.showCompleted !== undefined) {
      updates.calendarShowCompleted = args.showCompleted;
    }

    if (args.showClosed !== undefined) {
      updates.calendarShowClosed = args.showClosed;
    }

    await ctx.db.patch(profile._id, updates);

    return profile._id;
  },
});

/**
 * Disconnect Google Calendar with cleanup of all calendar events
 *
 * This mutation:
 * 1. Schedules deletion of ALL calendar events from Google Calendar
 * 2. Clears OAuth tokens from userProfiles
 * 3. Sets googleCalendarConnected to false
 *
 * The event cleanup runs asynchronously via scheduler.runAfter to avoid
 * timeout issues with potentially many events to delete.
 *
 * @returns Object with cleanup scheduled status
 */
export const disconnectGoogleCalendarWithCleanup = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserId(ctx);
    const now = Date.now();

    // Get the user profile
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId as Id<"users">))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .first();

    if (!profile) {
      throw new Error("User profile not found");
    }

    // Check if calendar is connected
    if (!profile.googleCalendarConnected) {
      return {
        success: true,
        cleanupScheduled: false,
        message: "Google Calendar was not connected",
      };
    }

    // Schedule the cleanup action to run immediately
    // This deletes all calendar events from Google Calendar
    // and clears calendarEventIds from all cases
    await ctx.scheduler.runAfter(
      0,
      internal.googleCalendarActions.clearAllCalendarEvents,
      { userId: userId as Id<"users"> }
    );

    // Clear all Google OAuth fields immediately
    // The cleanup action handles event deletion asynchronously
    await ctx.db.patch(profile._id, {
      googleAccessToken: undefined,
      googleRefreshToken: undefined,
      googleTokenExpiry: undefined,
      googleEmail: undefined,
      googleScopes: undefined,
      googleCalendarConnected: false,
      updatedAt: now,
    });

    return {
      success: true,
      cleanupScheduled: true,
      message: "Google Calendar disconnected. Calendar events are being removed.",
    };
  },
});

/**
 * Valid calendar sync preference names that can be toggled.
 * These map to userProfile fields.
 */
const VALID_CALENDAR_PREFS = [
  "calendarSyncPwd",
  "calendarSyncEta9089",
  "calendarSyncI140",
  "calendarSyncRfe",
  "calendarSyncRfi",
  "calendarSyncRecruitment",
  "calendarSyncFilingWindow",
] as const;

type CalendarSyncPrefName = (typeof VALID_CALENDAR_PREFS)[number];

/**
 * Update a calendar sync preference with auto-cleanup when toggled OFF.
 *
 * When a calendar sync preference is toggled OFF, this mutation:
 * 1. Updates the preference in userProfiles
 * 2. Schedules deletion of all calendar events of that type from Google Calendar
 * 3. Clears the event IDs from all user's cases
 *
 * When toggled ON, only the preference is updated (events are created on next case update).
 *
 * @param preferenceName - The preference field name (e.g., "calendarSyncPwd")
 * @param newValue - The new boolean value for the preference
 */
export const updateCalendarSyncPreference = mutation({
  args: {
    preferenceName: v.string(),
    newValue: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { preferenceName, newValue } = args;
    const userId = await getCurrentUserId(ctx);
    const now = Date.now();

    // Validate preference name
    if (!VALID_CALENDAR_PREFS.includes(preferenceName as CalendarSyncPrefName)) {
      throw new Error(`Invalid preference name: ${preferenceName}`);
    }

    // Get user profile
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId as Id<"users">))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .first();

    if (!profile) {
      throw new Error("User profile not found");
    }

    // Update the preference
    const updates: Record<string, unknown> = {
      [preferenceName]: newValue,
      updatedAt: now,
    };
    await ctx.db.patch(profile._id, updates);

    // If toggled OFF, schedule deletion of calendar events for this type
    if (newValue === false) {
      const schemaFields = PREF_TO_SCHEMA_FIELDS[preferenceName];
      if (schemaFields && schemaFields.length > 0) {
        // Schedule the bulk delete action to run immediately
        await ctx.scheduler.runAfter(
          0,
          internal.googleCalendarActions.bulkDeleteEventsByType,
          {
            userId: userId as Id<"users">,
            eventSchemaFields: schemaFields,
          }
        );
      }
    }

    return { success: true, preferenceName, newValue };
  },
});
