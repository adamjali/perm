/**
 * Calendar Sync Helpers
 *
 * Provides helper functions for scheduling and managing calendar sync operations.
 * These helpers are used from mutations to check eligibility and schedule sync actions.
 *
 * @module
 */

import { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import type { SyncEligibilityResult } from "../googleAuth";

/**
 * Result from scheduleCalendarSync helper
 */
export interface ScheduleCalendarSyncResult {
  /** Whether sync was scheduled */
  scheduled: boolean;
  /** Reason if sync was not scheduled */
  reason?: string;
}

/**
 * Schedule a calendar sync for a case if the user is eligible
 *
 * This helper function is designed to be called from mutations when case data
 * changes (create, update, etc.). It:
 *
 * 1. Checks if the user has Google Calendar connected and sync enabled
 * 2. If eligible, schedules the sync action to run immediately
 * 3. Returns whether sync was scheduled and why (or why not)
 *
 * **Usage from mutations:**
 * ```typescript
 * import { scheduleCalendarSync } from "./lib/calendarSyncHelpers";
 *
 * // In a mutation handler after updating case data:
 * const syncResult = await scheduleCalendarSync(ctx, userId, caseId);
 * if (syncResult.scheduled) {
 *   console.log("Calendar sync scheduled");
 * } else {
 *   console.log("Sync not scheduled:", syncResult.reason);
 * }
 * ```
 *
 * **Why check eligibility first?**
 * - Avoids scheduling unnecessary actions for users without Google connected
 * - Reduces Convex action execution costs
 * - Provides clear feedback about why sync didn't happen
 *
 * @param ctx - The mutation context (has scheduler access)
 * @param userId - The user ID who owns the case
 * @param caseId - The case ID to sync
 * @returns ScheduleCalendarSyncResult with scheduled flag and reason
 */
export async function scheduleCalendarSync(
  ctx: MutationCtx,
  userId: Id<"users">,
  caseId: Id<"cases">
): Promise<ScheduleCalendarSyncResult> {
  // First, check if user is eligible for calendar sync
  const eligibility: SyncEligibilityResult = await ctx.runQuery(
    internal.googleAuth.shouldSyncCalendar,
    { userId }
  );

  if (!eligibility.shouldSync) {
    return {
      scheduled: false,
      reason: eligibility.reason ?? "Unknown eligibility issue",
    };
  }

  // User is eligible - schedule the sync action
  // runAfter(0, ...) schedules immediately (async, non-blocking)
  await ctx.scheduler.runAfter(
    0,
    internal.googleCalendarActions.syncCaseCalendarEvents,
    { userId, caseId }
  );

  return {
    scheduled: true,
  };
}

/**
 * Schedule calendar sync for multiple cases
 *
 * Useful when bulk operations affect multiple cases (e.g., status changes).
 * Schedules sync for each case that passes eligibility check.
 *
 * **Note:** This only checks eligibility once per user (not per case).
 * If the user is not eligible, no syncs are scheduled.
 *
 * @param ctx - The mutation context
 * @param userId - The user ID who owns the cases
 * @param caseIds - Array of case IDs to sync
 * @returns Object with count of scheduled syncs and reason if none scheduled
 */
export async function scheduleCalendarSyncBulk(
  ctx: MutationCtx,
  userId: Id<"users">,
  caseIds: Id<"cases">[]
): Promise<{
  scheduledCount: number;
  reason?: string;
}> {
  if (caseIds.length === 0) {
    return { scheduledCount: 0, reason: "No cases to sync" };
  }

  // Check eligibility once for the user
  const eligibility: SyncEligibilityResult = await ctx.runQuery(
    internal.googleAuth.shouldSyncCalendar,
    { userId }
  );

  if (!eligibility.shouldSync) {
    return {
      scheduledCount: 0,
      reason: eligibility.reason ?? "Unknown eligibility issue",
    };
  }

  // Schedule sync for each case
  for (const caseId of caseIds) {
    await ctx.scheduler.runAfter(
      0,
      internal.googleCalendarActions.syncCaseCalendarEvents,
      { userId, caseId }
    );
  }

  return {
    scheduledCount: caseIds.length,
  };
}
