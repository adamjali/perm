/**
 * Notification Queries and Mutations
 *
 * Provides the notification system functionality:
 *
 * QUERIES:
 * - getUnreadCount: Count of unread notifications (for bell badge)
 * - getRecentNotifications: Latest N notifications (for dropdown)
 * - getNotifications: Paginated list with filters (for full page)
 * - getNotificationStats: Dashboard statistics
 *
 * MUTATIONS (public):
 * - markAsRead: Mark single notification as read
 * - markAllAsRead: Mark all user's notifications as read
 * - deleteNotification: Delete single notification
 * - deleteAllRead: Delete all read notifications
 *
 * INTERNAL MUTATIONS (server-side only):
 * - createNotification: Create notification (for deadline enforcement, status changes)
 * - cleanupCaseNotifications: Delete all notifications for a case (for case deletion)
 *
 * All queries check auth via getCurrentUserIdOrNull for graceful handling
 * when user is not authenticated (returns empty data, not errors).
 * All mutations check auth via getCurrentUserId and throw if not authenticated.
 */

import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { getCurrentUserId, getCurrentUserIdOrNull, isEmailVerified, getUserByEmail } from "./lib/auth";
import { logDelete } from "./lib/audit";
import { createLogger } from "./lib/logging";
import { rateLimiter } from "./rateLimitConfig";
import type { QueryCtx } from "./_generated/server";
import { UNREAD_COUNT_CAP } from "./lib/notificationHelpers";

const log = createLogger("Notifications");

// ============================================================================
// CONSTANTS & VALIDATORS
// ============================================================================

const notificationType = v.union(
  v.literal("deadline_reminder"),
  v.literal("status_change"),
  v.literal("rfe_alert"),
  v.literal("rfi_alert"),
  v.literal("system"),
  v.literal("auto_closure")
);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/** Case info type for notification enrichment */
interface CaseInfo {
  employerName?: string;
  beneficiaryIdentifier?: string;
  positionTitle?: string;
  caseStatus?: string;
}

/**
 * Enrich a notification with case information.
 * Returns null for caseInfo if case doesn't exist or is deleted.
 */
async function enrichNotificationWithCase<T extends Doc<"notifications">>(
  ctx: QueryCtx,
  notification: T
): Promise<T & { caseInfo: CaseInfo | null }> {
  let caseInfo: CaseInfo | null = null;

  if (notification.caseId) {
    const caseDoc = await ctx.db.get(notification.caseId);
    if (caseDoc && caseDoc.deletedAt === undefined) {
      caseInfo = {
        employerName: caseDoc.employerName,
        beneficiaryIdentifier: caseDoc.beneficiaryIdentifier,
        positionTitle: caseDoc.positionTitle,
        caseStatus: caseDoc.caseStatus,
      };
    }
  }

  return { ...notification, caseInfo };
}

/**
 * A page cursor is the `_creationTime` of the last notification a page LOOKED
 * AT (not the last one it returned), so a filtered tab resumes exactly where
 * its scan stopped. Every index ends in `_creationTime`, so the next page is a
 * range read, never a re-read of everything newer.
 *
 * A client may still hold the older `<createdAt>|<id>` form for a moment across
 * a deploy; that reads as "older than createdAt", which at worst repeats a row
 * the list already de-duplicates by id.
 */
function encodeCursor(creationTime: number): string {
  return `c:${creationTime}`;
}

function decodeCursor(cursor: string | undefined): number | null {
  if (!cursor) return null;
  const raw = cursor.startsWith("c:") ? cursor.slice(2) : cursor.split("|")[0];
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * How many notifications one page may look through to fill itself. A filtered
 * tab (one type, say) can sit behind thousands of newer rows of other types;
 * past this the page returns what it found with `hasMore` and a cursor, and the
 * next page carries on from there. A notification is well under 1 KB, so this
 * stays far inside Convex's 32,000-document and 16 MiB read limits.
 */
export const NOTIFICATION_PAGE_SCAN_MAX = 4_000;

/**
 * The most notifications the stats query counts. Past it the result says so
 * (`capped`) instead of stopping at a round number without a word.
 */
export const NOTIFICATION_STATS_MAX = 20_000;

/**
 * Get count of unread notifications for the current user.
 * Used for the notification bell badge.
 *
 * @returns Number of unread notifications, or 0 if not authenticated
 */
export const getUnreadCount = query({
  args: {},
  handler: async (ctx): Promise<number> => {
    const userId = await getCurrentUserIdOrNull(ctx);

    // Return 0 if not authenticated (graceful handling for sign-out)
    if (userId === null) {
      return 0;
    }

    // Use the by_user_and_unread index for efficient counting
    const unreadNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_user_and_unread", (q) =>
        q.eq("userId", userId).eq("isRead", false)
      )
      .take(UNREAD_COUNT_CAP);

    return unreadNotifications.length;
  },
});

/**
 * Get the most recent N notifications for the current user.
 * Used for the notification dropdown in the header.
 *
 * Includes case information when caseId exists (simple join).
 *
 * @param limit - Maximum number of notifications to return (default: 5)
 * @returns Array of notifications with optional case info
 */
export const getRecentNotifications = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { limit = 5 }) => {
    const userId = await getCurrentUserIdOrNull(ctx);

    // Return empty array if not authenticated
    if (userId === null) {
      return [];
    }

    // Query notifications ordered by creation time (descending)
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);

    // Enrich with case info where applicable
    return Promise.all(notifications.map((n) => enrichNotificationWithCase(ctx, n)));
  },
});

/**
 * Get paginated notifications with optional filters.
 * Used for the full notifications page.
 *
 * Supports filtering by:
 * - type: Array of notification types
 * - isRead: Read/unread status
 * - caseId: Specific case
 *
 * @returns Paginated notifications with continuation cursor
 */
export const getNotifications = query({
  args: {
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
    filters: v.optional(
      v.object({
        type: v.optional(v.array(notificationType)),
        isRead: v.optional(v.boolean()),
        caseId: v.optional(v.id("cases")),
      })
    ),
  },
  handler: async (ctx, { cursor, limit = 20, filters }) => {
    const userId = await getCurrentUserIdOrNull(ctx);

    // Return empty result if not authenticated
    if (userId === null) {
      return {
        notifications: [],
        nextCursor: null,
        hasMore: false,
      };
    }

    const pageSize = Math.max(1, Math.min(Math.floor(limit), 100));
    const after = decodeCursor(cursor);
    const typeSet =
      filters?.type !== undefined && filters.type.length > 0 ? new Set(filters.type) : null;

    // Every read is scoped to this user by the index itself; the case and type
    // filters are checked row by row below, so a filtered tab keeps reading
    // older rows until it has a full page or reaches the scan budget.
    const isRead = filters?.isRead;
    const rows =
      isRead !== undefined
        ? ctx.db
            .query("notifications")
            .withIndex("by_user_and_unread", (q) =>
              after === null
                ? q.eq("userId", userId).eq("isRead", isRead)
                : q.eq("userId", userId).eq("isRead", isRead).lt("_creationTime", after)
            )
        : ctx.db
            .query("notifications")
            .withIndex("by_user_id", (q) =>
              after === null
                ? q.eq("userId", userId)
                : q.eq("userId", userId).lt("_creationTime", after)
            );

    const page: Doc<"notifications">[] = [];
    let scanned = 0;
    let lastSeen: number | null = null;
    let hasMore = false;
    for await (const n of rows.order("desc")) {
      if (page.length === pageSize || scanned === NOTIFICATION_PAGE_SCAN_MAX) {
        hasMore = true;
        break;
      }
      scanned++;
      lastSeen = n._creationTime;
      if (filters?.caseId !== undefined && n.caseId !== filters.caseId) continue;
      if (typeSet !== null && !typeSet.has(n.type)) continue;
      page.push(n);
    }

    const nextCursor = hasMore && lastSeen !== null ? encodeCursor(lastSeen) : null;

    const enrichedNotifications = await Promise.all(
      page.map((n) => enrichNotificationWithCase(ctx, n))
    );

    return { notifications: enrichedNotifications, nextCursor, hasMore };
  },
});

/**
 * Get notification statistics for the dashboard.
 * Returns total count, unread count, and breakdown by type.
 *
 * @returns Notification stats object
 */
export const getNotificationStats = query({
  args: {},
  handler: async (ctx): Promise<{
    total: number;
    unread: number;
    byType: Record<string, number>;
    capped: boolean;
  }> => {
    const userId = await getCurrentUserIdOrNull(ctx);

    // Return empty stats if not authenticated
    if (userId === null) {
      return {
        total: 0,
        unread: 0,
        byType: {},
        capped: false,
      };
    }

    // Count every notification up to NOTIFICATION_STATS_MAX, newest first,
    // and say when the count stopped there.
    let total = 0;
    let unread = 0;
    let capped = false;
    const byType: Record<string, number> = {};
    for await (const n of ctx.db
      .query("notifications")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .order("desc")) {
      if (total === NOTIFICATION_STATS_MAX) {
        capped = true;
        break;
      }
      total++;
      if (!n.isRead) unread++;
      byType[n.type] = (byType[n.type] ?? 0) + 1;
    }

    return { total, unread, byType, capped };
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Mark a single notification as read.
 *
 * @param notificationId - The ID of the notification to mark as read
 * @throws Error if not authenticated or notification not owned by user
 */
export const markAsRead = mutation({
  args: {
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, { notificationId }) => {
    const userId = await getCurrentUserId(ctx);

    // Fetch and verify ownership
    const notification = await ctx.db.get(notificationId);

    if (!notification) {
      throw new Error("Notification not found");
    }

    if (notification.userId !== userId) {
      throw new Error("Access denied: you do not own this notification");
    }

    // Update to mark as read
    const now = Date.now();
    await ctx.db.patch(notificationId, {
      isRead: true,
      readAt: now,
      updatedAt: now,
    });

    return { success: true };
  },
});

/**
 * Mark all notifications as read for the current user.
 * Uses batching to prevent timeouts with large notification counts.
 *
 * @returns Count of notifications marked as read and whether more remain
 */
export const markAllAsRead = mutation({
  args: {},
  handler: async (ctx): Promise<{ count: number; hasMore: boolean }> => {
    const userId = await getCurrentUserId(ctx);
    await rateLimiter.limit(ctx, "notificationsMarkAllRead", { key: userId, throws: true });
    const now = Date.now();
    const BATCH_SIZE = 100;

    // Fetch limited batch of unread notifications
    const unreadNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_user_and_unread", (q) =>
        q.eq("userId", userId).eq("isRead", false)
      )
      .take(BATCH_SIZE + 1); // Take one extra to check if there are more

    const hasMore = unreadNotifications.length > BATCH_SIZE;
    const toProcess = unreadNotifications.slice(0, BATCH_SIZE);

    // Update batch
    for (const notification of toProcess) {
      await ctx.db.patch(notification._id, {
        isRead: true,
        readAt: now,
        updatedAt: now,
      });
    }

    return { count: toProcess.length, hasMore };
  },
});

/**
 * Delete a single notification.
 *
 * @param notificationId - The ID of the notification to delete
 * @throws Error if not authenticated or notification not owned by user
 */
export const deleteNotification = mutation({
  args: {
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, { notificationId }) => {
    const userId = await getCurrentUserId(ctx);

    // Fetch and verify ownership
    const notification = await ctx.db.get(notificationId);

    if (!notification) {
      throw new Error("Notification not found");
    }

    if (notification.userId !== userId) {
      throw new Error("Access denied: you do not own this notification");
    }

    // Audit: notification deletion
    await logDelete(ctx, "notifications", notificationId, notification as Record<string, unknown>);

    // Actually delete from database (no soft delete for notifications)
    await ctx.db.delete(notificationId);

    return { success: true };
  },
});

/**
 * Delete all read notifications for the current user.
 * Uses batching to prevent timeouts with large notification counts.
 *
 * @returns Count of notifications deleted and whether more remain
 */
export const deleteAllRead = mutation({
  args: {},
  handler: async (ctx): Promise<{ count: number; hasMore: boolean }> => {
    const userId = await getCurrentUserId(ctx);
    const BATCH_SIZE = 100;

    // Fetch limited batch of read notifications
    const readNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_user_and_unread", (q) =>
        q.eq("userId", userId).eq("isRead", true)
      )
      .take(BATCH_SIZE + 1); // Take one extra to check if there are more

    const hasMore = readNotifications.length > BATCH_SIZE;
    const toProcess = readNotifications.slice(0, BATCH_SIZE);

    // Audit: batch deletion (single summarized entry)
    if (toProcess.length > 0) {
      await logDelete(ctx, "notifications", toProcess[0]!._id, {
        batchDelete: true,
        count: toProcess.length,
        notificationIds: toProcess.map((n) => n._id.toString()),
      });
    }

    // Delete batch
    for (const notification of toProcess) {
      await ctx.db.delete(notification._id);
    }

    return { count: toProcess.length, hasMore };
  },
});

// ============================================================================
// INTERNAL MUTATIONS (called from other server code, not exposed to client)
// ============================================================================

/**
 * Create a notification (internal use only).
 *
 * Called from other server code (e.g., deadline enforcement, case status changes).
 * Not exposed to the client API.
 */
export const createNotification = internalMutation({
  args: {
    userId: v.id("users"),
    caseId: v.optional(v.id("cases")),
    type: notificationType,
    title: v.string(),
    message: v.string(),
    priority: v.union(
      v.literal("low"),
      v.literal("normal"),
      v.literal("high"),
      v.literal("urgent")
    ),
    deadlineDate: v.optional(v.string()),
    deadlineType: v.optional(v.string()),
    daysUntilDeadline: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const notificationId = await ctx.db.insert("notifications", {
      userId: args.userId,
      caseId: args.caseId,
      type: args.type,
      title: args.title,
      message: args.message,
      priority: args.priority,
      deadlineDate: args.deadlineDate,
      deadlineType: args.deadlineType,
      daysUntilDeadline: args.daysUntilDeadline,
      isRead: false,
      emailSent: false,
      createdAt: now,
      updatedAt: now,
    });

    return notificationId;
  },
});

/**
 * Delete all notifications for a specific case (internal use only).
 * Uses batching to prevent timeouts with large notification counts.
 *
 * Called when a case is deleted to clean up associated notifications.
 * Not exposed to the client API.
 */
export const cleanupCaseNotifications = internalMutation({
  args: {
    caseId: v.id("cases"),
  },
  handler: async (ctx, { caseId }): Promise<{ count: number; hasMore: boolean }> => {
    const BATCH_SIZE = 100;

    // Fetch limited batch of notifications for this case
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_case_id", (q) => q.eq("caseId", caseId))
      .take(BATCH_SIZE + 1); // Take one extra to check if there are more

    const hasMore = notifications.length > BATCH_SIZE;
    const toProcess = notifications.slice(0, BATCH_SIZE);

    // Delete batch
    for (const notification of toProcess) {
      await ctx.db.delete(notification._id);
    }

    return { count: toProcess.length, hasMore };
  },
});

/**
 * Shared guard: check that a user exists, is not soft-deleted, and has a
 * verified email (via authAccounts). Returns false and logs the reason on
 * any failure. Used by both isNotificationValid and isUserActiveByEmail.
 */
async function isUserActiveAndVerified(
  ctx: QueryCtx,
  user: Doc<"users"> | null,
  caller: string,
  logExtra?: Record<string, string>
): Promise<boolean> {
  if (!user) {
    log.warn(`${caller}: user not found`, logExtra ?? {});
    return false;
  }
  if (user.deletedAt) {
    log.warn(`${caller}: user soft-deleted`, { resourceId: String(user._id) });
    return false;
  }
  if (!(await isEmailVerified(ctx, user._id))) {
    log.warn(`${caller}: email not verified`, { resourceId: String(user._id) });
    return false;
  }
  return true;
}

/**
 * Check if a notification's user is active with a verified email.
 * Used by email actions to guard against sending to deleted/unverified users.
 *
 * Checks: notification exists -> user exists -> user not deleted -> email verified.
 */
export const isNotificationValid = internalQuery({
  args: {
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, { notificationId }): Promise<boolean> => {
    const notification = await ctx.db.get(notificationId);
    if (!notification) {
      log.warn("isNotificationValid: notification not found", { resourceId: notificationId });
      return false;
    }
    const user = await ctx.db.get(notification.userId);
    return isUserActiveAndVerified(ctx, user, "isNotificationValid", {
      resourceId: String(notification.userId),
    });
  },
});

/**
 * Check if a user (looked up by email) is active with a verified email.
 * Used by email actions (e.g., weekly digest) to guard against sending
 * to deleted or unverified users.
 *
 * Checks: user exists by email -> user not deleted -> email verified.
 */
export const isUserActiveByEmail = internalQuery({
  args: {
    email: v.string(),
  },
  handler: async (ctx, { email }): Promise<boolean> => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();
    return isUserActiveAndVerified(ctx, user, "isUserActiveByEmail", { email });
  },
});

export const markEmailSent = internalMutation({
  args: {
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, { notificationId }) => {
    const now = Date.now();
    await ctx.db.patch(notificationId, {
      emailSent: true,
      emailSentAt: now,
      updatedAt: now,
    });
  },
});

/**
 * One-click unsubscribe from the WEEKLY digest only (deadline reminders stay on).
 * Called by the /unsubscribe HTTP route after token verification.
 *
 * Independent of marketing/Broadcast unsubscribe — this only touches the weekly
 * transactional digest. `emailWeeklyDigest` is the single source of truth, so the
 * in-app settings toggle reflects this immediately. Idempotent.
 */
export const unsubscribeWeeklyByEmail = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args): Promise<{ ok: boolean }> => {
    const user = await getUserByEmail(ctx, args.email);
    if (!user || user.deletedAt) return { ok: false };
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .unique();
    if (!profile) return { ok: false };
    // Also clear the inactivity auto-pause marker: a deliberate one-click
    // unsubscribe means the digest is OFF by the user's choice, not an auto-pause,
    // so the "we paused it — turn it back on" banner must not re-prompt (and
    // possibly re-subscribe) them.
    const needsPatch =
      profile.emailWeeklyDigest !== false ||
      profile.weeklyDigestSuppressedAt !== undefined;
    if (needsPatch) {
      await ctx.db.patch(profile._id, {
        emailWeeklyDigest: false,
        weeklyDigestSuppressedAt: undefined,
        updatedAt: Date.now(),
      });
      log.info("Weekly digest unsubscribed via email link", { resourceId: profile._id });
    }
    return { ok: true };
  },
});

/**
 * True only if `email` is the caller's OWN verified email address. Used to gate
 * the "send test email" action so an authed user can't send branded mail to
 * arbitrary addresses.
 */
export const isOwnVerifiedEmail = internalQuery({
  args: { userId: v.id("users"), email: v.string() },
  handler: async (ctx, args): Promise<boolean> => {
    const user = await getUserByEmail(ctx, args.email);
    if (!user || user._id !== args.userId || user.deletedAt) return false;
    return await isEmailVerified(ctx, args.userId);
  },
});
