/**
 * Timeline Queries and Mutations
 *
 * Provides functions for the case timeline visualization feature:
 * 1. getPreferences - Get user's timeline preferences (or defaults)
 * 2. updatePreferences - Update selectedCaseIds and/or timeRange
 * 3. addCaseToTimeline - Add single case to selected list
 * 4. removeCaseFromTimeline - Remove single case from selected list
 * 5. getCasesForTimeline - Get cases with all timeline-relevant data
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { getCurrentUserId, getCurrentUserIdOrNull } from "./lib/auth";

/**
 * Timeline time range type
 */
type TimeRange = 3 | 6 | 12 | 24;

/**
 * Default timeline preferences
 */
const DEFAULT_TIME_RANGE: TimeRange = 12;

/**
 * Get user's timeline preferences (or defaults)
 * Returns default values if no preferences are saved
 */
export const getPreferences = query({
  args: {},
  handler: async (ctx) => {
    // Use null-safe auth check for graceful sign-out handling
    const userId = await getCurrentUserIdOrNull(ctx);
    if (userId === null) {
      return {
        selectedCaseIds: null,
        timeRange: DEFAULT_TIME_RANGE,
      };
    }

    // Query for existing preferences
    const preferences = await ctx.db
      .query("timelinePreferences")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    if (!preferences) {
      // Return defaults if no preferences saved
      return {
        selectedCaseIds: null,
        timeRange: DEFAULT_TIME_RANGE,
      };
    }

    return {
      selectedCaseIds: preferences.selectedCaseIds ?? null,
      timeRange: preferences.timeRange,
    };
  },
});

/**
 * Update user's timeline preferences
 * Creates preferences if they don't exist, otherwise updates
 */
export const updatePreferences = mutation({
  args: {
    selectedCaseIds: v.optional(v.union(v.null(), v.array(v.id("cases")))),
    timeRange: v.optional(v.union(v.literal(3), v.literal(6), v.literal(12), v.literal(24))),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const now = Date.now();

    // Query for existing preferences
    const existingPreferences = await ctx.db
      .query("timelinePreferences")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    if (existingPreferences) {
      // Update existing preferences
      const updates: Partial<{
        selectedCaseIds: Id<"cases">[] | undefined;
        timeRange: TimeRange;
        updatedAt: number;
      }> = { updatedAt: now };

      // Only update fields that are provided
      if (args.selectedCaseIds !== undefined) {
        updates.selectedCaseIds = args.selectedCaseIds === null ? undefined : args.selectedCaseIds;
      }
      if (args.timeRange !== undefined) {
        updates.timeRange = args.timeRange;
      }

      await ctx.db.patch(existingPreferences._id, updates);
      return existingPreferences._id;
    } else {
      // Create new preferences
      const preferencesId = await ctx.db.insert("timelinePreferences", {
        userId: userId,
        selectedCaseIds: args.selectedCaseIds === null ? undefined : args.selectedCaseIds,
        timeRange: args.timeRange ?? DEFAULT_TIME_RANGE,
        createdAt: now,
        updatedAt: now,
      });
      return preferencesId;
    }
  },
});

/**
 * Add a single case to the timeline selection
 * If selectedCaseIds is null (all cases), creates explicit list with all current active cases + new case
 */
export const addCaseToTimeline = mutation({
  args: {
    caseId: v.id("cases"),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const now = Date.now();

    // Verify the case exists and belongs to user
    const caseDoc = await ctx.db.get(args.caseId);
    if (!caseDoc || caseDoc.userId !== userId || caseDoc.deletedAt !== undefined) {
      throw new Error("Case not found");
    }

    // Get existing preferences
    const existingPreferences = await ctx.db
      .query("timelinePreferences")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    if (!existingPreferences) {
      // No preferences exist - create with just this case selected
      const preferencesId = await ctx.db.insert("timelinePreferences", {
        userId: userId,
        selectedCaseIds: [args.caseId],
        timeRange: DEFAULT_TIME_RANGE,
        createdAt: now,
        updatedAt: now,
      });
      return preferencesId;
    }

    // Get current selected case IDs
    let currentSelection = existingPreferences.selectedCaseIds;

    if (currentSelection === undefined) {
      // null/undefined means "all cases" - we need to get all active cases and add this one
      const allCases = await ctx.db
        .query("cases")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .take(1000);

      const activeCaseIds = allCases
        .filter((c) => c.deletedAt === undefined && c.caseStatus !== "closed")
        .map((c) => c._id);

      // Add the new case if not already included
      if (!activeCaseIds.includes(args.caseId)) {
        activeCaseIds.push(args.caseId);
      }

      currentSelection = activeCaseIds;
    } else {
      // Explicit list - add if not already included
      if (!currentSelection.includes(args.caseId)) {
        currentSelection = [...currentSelection, args.caseId];
      }
    }

    await ctx.db.patch(existingPreferences._id, {
      selectedCaseIds: currentSelection,
      updatedAt: now,
    });

    return existingPreferences._id;
  },
});

/**
 * Remove a single case from the timeline selection
 */
export const removeCaseFromTimeline = mutation({
  args: {
    caseId: v.id("cases"),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    const now = Date.now();

    // Get existing preferences
    const existingPreferences = await ctx.db
      .query("timelinePreferences")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    if (!existingPreferences) {
      // No preferences - nothing to remove from
      // Create preferences with all active cases except this one
      const allCases = await ctx.db
        .query("cases")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .take(1000);

      const activeCaseIds = allCases
        .filter(
          (c) =>
            c.deletedAt === undefined &&
            c.caseStatus !== "closed" &&
            c._id !== args.caseId
        )
        .map((c) => c._id);

      const preferencesId = await ctx.db.insert("timelinePreferences", {
        userId: userId,
        selectedCaseIds: activeCaseIds,
        timeRange: DEFAULT_TIME_RANGE,
        createdAt: now,
        updatedAt: now,
      });
      return preferencesId;
    }

    let currentSelection = existingPreferences.selectedCaseIds;

    if (currentSelection === undefined) {
      // null/undefined means "all cases" - get all active cases except this one
      const allCases = await ctx.db
        .query("cases")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .take(1000);

      currentSelection = allCases
        .filter(
          (c) =>
            c.deletedAt === undefined &&
            c.caseStatus !== "closed" &&
            c._id !== args.caseId
        )
        .map((c) => c._id);
    } else {
      // Explicit list - remove the case
      currentSelection = currentSelection.filter((id) => id !== args.caseId);
    }

    await ctx.db.patch(existingPreferences._id, {
      selectedCaseIds: currentSelection,
      updatedAt: now,
    });

    return existingPreferences._id;
  },
});

/**
 * RFI/RFE entry type for timeline data
 */
interface TimelineRfiRfeEntry {
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
 * Timeline case data type
 */
interface TimelineCaseData {
  id: Id<"cases">;
  employerName: string;
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
  rfiEntries: TimelineRfiRfeEntry[];
  rfeEntries: TimelineRfiRfeEntry[];
}

/**
 * Get cases with all timeline-relevant data
 * Filters based on user preferences (selectedCaseIds, timeRange)
 */
export const getCasesForTimeline = query({
  args: {
    timeRange: v.optional(v.union(v.literal(3), v.literal(6), v.literal(12), v.literal(24))),
  },
  handler: async (ctx, args): Promise<TimelineCaseData[]> => {
    // Use null-safe auth check for graceful sign-out handling
    const userId = await getCurrentUserIdOrNull(ctx);
    if (userId === null) {
      return [];
    }

    // Get user's preferences
    const preferences = await ctx.db
      .query("timelinePreferences")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    // Use provided timeRange or preference or default
    // NOTE: _timeRange calculated but not currently used (reserved for future time filtering)
    void (args.timeRange ?? preferences?.timeRange ?? DEFAULT_TIME_RANGE);

    // Fetch non-deleted cases for user with reasonable limit
    const allCases = await ctx.db
      .query("cases")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .take(1000);

    // Filter out deleted cases and cases hidden from timeline
    let filteredCases = allCases.filter((c) =>
      c.deletedAt === undefined && c.showOnTimeline !== false
    );

    // Apply selection filter
    const selectedCaseIds = preferences?.selectedCaseIds;
    if (selectedCaseIds !== undefined && selectedCaseIds.length > 0) {
      // Explicit list of selected cases
      const selectedSet = new Set(selectedCaseIds);
      filteredCases = filteredCases.filter((c) => selectedSet.has(c._id));
    } else if (selectedCaseIds === undefined) {
      // null/undefined means all active (non-closed) cases
      filteredCases = filteredCases.filter((c) => c.caseStatus !== "closed");
    }
    // Note: empty array means no cases selected

    // Map to timeline data format
    return filteredCases.map((caseDoc) => ({
      id: caseDoc._id,
      employerName: caseDoc.employerName,
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
      rfiEntries: (caseDoc.rfiEntries ?? []) as TimelineRfiRfeEntry[],
      rfeEntries: (caseDoc.rfeEntries ?? []) as TimelineRfiRfeEntry[],
    }));
  },
});
