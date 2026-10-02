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
import { getCurrentUserId, getCurrentUserIdOrNull } from "./lib/auth";
import { readUserCases } from "./lib/userCases";
import { caseDeadlineDates, type CaseDeadlineDates } from "./lib/caseDates";
import { buildDefaultProfile } from "./lib/userDefaults";


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
interface CalendarEventData extends CaseDeadlineDates {
  id: Id<"cases">;
  employerName: string;
  beneficiaryIdentifier: string;
  positionTitle: string;
  caseStatus: "pwd" | "recruitment" | "eta9089" | "i140" | "closed";
  progressStatus: "working" | "waiting_intake" | "filed" | "approved" | "under_review" | "rfi_rfe";
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

    // Live cases, newest first (convex/lib/userCases.ts)
    let filteredCases = (await readUserCases(ctx, userId)).cases;

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
      beneficiaryIdentifier: caseDoc.beneficiaryIdentifier ?? "",
      positionTitle: caseDoc.positionTitle,
      caseStatus: caseDoc.caseStatus,
      progressStatus: caseDoc.progressStatus,
      ...caseDeadlineDates(caseDoc),
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
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
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
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .first();

    // Create profile if it doesn't exist
    if (!profile) {
      const profileId = await ctx.db.insert("userProfiles", {
        ...buildDefaultProfile(userId),
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
