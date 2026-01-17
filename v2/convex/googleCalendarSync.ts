/**
 * Google Calendar Sync - Internal Queries and Mutations
 *
 * This file contains internal queries and mutations for calendar sync.
 * These run in Convex's standard runtime (not Node.js).
 *
 * The actions that make external API calls are in googleCalendarActions.ts
 * which runs in Node.js runtime.
 */

import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getDefaultCalendarPreferences } from "./lib/calendarEventExtractor";
import type {
  CaseDataForCalendar,
  UserCalendarPreferences,
} from "./lib/calendarTypes";

// ============================================================================
// INTERNAL QUERIES
// ============================================================================

/**
 * Get case data for calendar sync
 *
 * Internal query to fetch case data needed for extracting calendar events.
 * Returns null if case not found or deleted.
 */
export const getCaseForCalendarSync = internalQuery({
  args: { caseId: v.id("cases") },
  handler: async (ctx, args): Promise<CaseDataForCalendar | null> => {
    const caseDoc = await ctx.db.get(args.caseId);

    if (!caseDoc || caseDoc.deletedAt) {
      return null;
    }

    // Map to CaseDataForCalendar interface
    return {
      _id: caseDoc._id,
      caseNumber: caseDoc.caseNumber,
      internalCaseNumber: caseDoc.internalCaseNumber,
      employerName: caseDoc.employerName,
      beneficiaryIdentifier: caseDoc.beneficiaryIdentifier ?? "",
      caseStatus: caseDoc.caseStatus,
      progressStatus: caseDoc.progressStatus,
      deletedAt: caseDoc.deletedAt,
      pwdExpirationDate: caseDoc.pwdExpirationDate,
      eta9089FilingDate: caseDoc.eta9089FilingDate,
      eta9089CertificationDate: caseDoc.eta9089CertificationDate,
      eta9089ExpirationDate: caseDoc.eta9089ExpirationDate,
      filingWindowOpens: caseDoc.filingWindowOpens,
      recruitmentWindowCloses: caseDoc.recruitmentWindowCloses,
      i140FilingDate: caseDoc.i140FilingDate,
      rfiEntries: caseDoc.rfiEntries?.map((entry) => ({
        id: entry.id,
        receivedDate: entry.receivedDate,
        responseDueDate: entry.responseDueDate,
        responseSubmittedDate: entry.responseSubmittedDate,
      })),
      rfeEntries: caseDoc.rfeEntries?.map((entry) => ({
        id: entry.id,
        receivedDate: entry.receivedDate,
        responseDueDate: entry.responseDueDate,
        responseSubmittedDate: entry.responseSubmittedDate,
      })),
      calendarSyncEnabled: caseDoc.calendarSyncEnabled,
    };
  },
});

/**
 * Get user calendar preferences
 *
 * Internal query to fetch user's calendar sync preferences.
 * Returns default preferences if profile not found.
 */
export const getUserCalendarPreferences = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<UserCalendarPreferences> => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .unique();

    if (!profile) {
      // Return defaults if no profile found
      return getDefaultCalendarPreferences();
    }

    return {
      calendarSyncEnabled: profile.calendarSyncEnabled,
      calendarSyncPwd: profile.calendarSyncPwd,
      calendarSyncEta9089: profile.calendarSyncEta9089,
      calendarSyncFilingWindow: profile.calendarSyncFilingWindow,
      calendarSyncRecruitment: profile.calendarSyncRecruitment,
      calendarSyncI140: profile.calendarSyncI140,
      calendarSyncRfi: profile.calendarSyncRfi,
      calendarSyncRfe: profile.calendarSyncRfe,
    };
  },
});

/**
 * Get existing calendar event IDs for a case
 *
 * Internal query to fetch current event IDs before sync (for deletion).
 */
export const getCaseCalendarEventIds = internalQuery({
  args: { caseId: v.id("cases") },
  handler: async (ctx, args) => {
    const caseDoc = await ctx.db.get(args.caseId);
    return caseDoc?.calendarEventIds ?? null;
  },
});

/**
 * Get all cases for a user that have calendar events stored.
 *
 * Used by bulkDeleteEventsByType to find cases that need event cleanup
 * when a calendar sync preference is toggled OFF.
 *
 * @param userId - The user ID to query cases for
 * @returns Array of cases with their _id and calendarEventIds
 */
export const getCasesWithCalendarEvents = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // Get all non-deleted cases for the user
    const cases = await ctx.db
      .query("cases")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    // Filter to only cases that have calendarEventIds
    const casesWithEvents = cases
      .filter((c) => c.calendarEventIds !== undefined)
      .map((c) => ({
        _id: c._id,
        calendarEventIds: c.calendarEventIds,
      }));

    return casesWithEvents;
  },
});

// ============================================================================
// INTERNAL MUTATIONS
// ============================================================================

/**
 * Update calendar event IDs on a case
 *
 * Internal mutation to store the Google Calendar event IDs on a case
 * after sync completes.
 */
export const updateCaseCalendarEventIds = internalMutation({
  args: {
    caseId: v.id("cases"),
    calendarEventIds: v.object({
      pwd_expiration: v.optional(v.string()),
      eta9089_filing_window: v.optional(v.string()),
      eta9089_expiration: v.optional(v.string()),
      i140_filing_deadline: v.optional(v.string()),
      rfi_due: v.optional(v.string()),
      rfe_due: v.optional(v.string()),
      recruitment_end: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args): Promise<void> => {
    await ctx.db.patch(args.caseId, {
      calendarEventIds: args.calendarEventIds,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Clear calendar event IDs on a case
 *
 * Internal mutation to remove all calendar event IDs from a case.
 * Called after events are deleted from Google Calendar.
 */
export const clearCaseCalendarEventIds = internalMutation({
  args: {
    caseId: v.id("cases"),
  },
  handler: async (ctx, args): Promise<void> => {
    await ctx.db.patch(args.caseId, {
      calendarEventIds: undefined,
      updatedAt: Date.now(),
    });
  },
});
