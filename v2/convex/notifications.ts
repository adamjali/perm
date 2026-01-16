/**
 * Notification Queries and Mutations
 *
 * Provides the notification system functionality:
 *
 * QUERIES:
 * - getUnreadCount: Count of unread notifications (for bell badge)
 * - getRecentNotifications: Latest N notifications (for dropdown)
 * - getNotifications: Paginated list with filters (for full page)
 * - getNotificationsByCase: All notifications for a specific case
 * - getNotificationStats: Dashboard statistics
 *
 * MUTATIONS (public):
 * - markAsRead: Mark single notification as read
 * - markAllAsRead: Mark all user's notifications as read
 * - markMultipleAsRead: Mark specific notifications as read
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

import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id, Doc } from "./_generated/dataModel";
import { getCurrentUserId, getCurrentUserIdOrNull } from "./lib/auth";
import type { QueryCtx } from "./_generated/server";

// ============================================================================
// CONSTANTS & VALIDATORS
// ============================================================================

const _BATCH_SIZE = 100;

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
 * Encode cursor for pagination (compound format: timestamp|_id).
 * Ensures unique cursors even when notifications have identical timestamps.
 */
function encodeCursor(createdAt: number, id: string): string {
  return `${createdAt}|${id}`;
}

/**
 * Decode cursor from pagination string.
 * Returns null if cursor is invalid.
 */
function decodeCursor(cursor: string): { time: number; id: string | null } | null {
  const [timeStr, cursorId] = cursor.split("|");
  const cursorTime = parseInt(timeStr!, 10);
  if (isNaN(cursorTime)) return null;
  return { time: cursorTime, id: cursorId ?? null };
}

/**
 * Filter notifications that come before the cursor (for descending pagination).
 */
function filterByCursor<T extends { createdAt: number; _id: string }>(
  items: T[],
  cursor: string | undefined
): T[] {
  if (!cursor) return items;

  const decoded = decodeCursor(cursor);
  if (!decoded) return items;

  if (decoded.id) {
    return items.filter(
      (n) => n.createdAt < decoded.time || (n.createdAt === decoded.time && n._id < decoded.id!)
    );
  }
  return items.filter((n) => n.createdAt < decoded.time);
}

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
        q.eq("userId", userId as Id<"users">).eq("isRead", false)
      )
      .take(1000); // Limit to prevent runaway queries

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
      .withIndex("by_user_id", (q) => q.eq("userId", userId as Id<"users">))
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

    // Start building query
    let notificationsQuery;

    // Use specific index based on filters for efficiency
    if (filters?.isRead !== undefined) {
      // Use by_user_and_unread index when filtering by read status
      notificationsQuery = ctx.db
        .query("notifications")
        .withIndex("by_user_and_unread", (q) =>
          q.eq("userId", userId as Id<"users">).eq("isRead", filters.isRead!)
        );
    } else if (filters?.caseId !== undefined) {
      // Use by_case_id index when filtering by case
      notificationsQuery = ctx.db
        .query("notifications")
        .withIndex("by_case_id", (q) => q.eq("caseId", filters.caseId!));
    } else {
      // Default: use by_user_id index
      notificationsQuery = ctx.db
        .query("notifications")
        .withIndex("by_user_id", (q) => q.eq("userId", userId as Id<"users">));
    }

    // Fetch notifications with limit + 1 to detect if there are more
    const fetchLimit = limit + 1;
    let notifications = await notificationsQuery.order("desc").take(fetchLimit);

    // Apply additional filters that couldn't be done via index
    // Filter by case ownership if using by_case_id index (security check)
    if (filters?.caseId !== undefined) {
      notifications = notifications.filter((n) => n.userId === userId);
    }

    // Filter by type if specified
    if (filters?.type !== undefined && filters.type.length > 0) {
      const typeSet = new Set(filters.type);
      notifications = notifications.filter((n) => typeSet.has(n.type));
    }

    // Handle cursor-based pagination
    notifications = filterByCursor(notifications, cursor);

    // Check if there are more results
    const hasMore = notifications.length > limit;
    const paginatedNotifications = notifications.slice(0, limit);

    // Get the next cursor
    const lastNotification = paginatedNotifications[paginatedNotifications.length - 1];
    const nextCursor =
      hasMore && lastNotification
        ? encodeCursor(lastNotification.createdAt, lastNotification._id)
        : null;

    // Enrich with case info
    const enrichedNotifications = await Promise.all(
      paginatedNotifications.map((n) => enrichNotificationWithCase(ctx, n))
    );

    return { notifications: enrichedNotifications, nextCursor, hasMore };
  },
});

/**
 * Get all notifications for a specific case.
 * Used for case detail view to show notification history.
 *
 * @param caseId - The case to get notifications for
 * @returns Array of notifications for the case, ordered by createdAt desc
 */
export const getNotificationsByCase = query({
  args: {
    caseId: v.id("cases"),
  },
  handler: async (ctx, { caseId }) => {
    const userId = await getCurrentUserIdOrNull(ctx);

    // Return empty array if not authenticated
    if (userId === null) {
      return [];
    }

    // First verify the user owns this case
    const caseDoc = await ctx.db.get(caseId);
    if (!caseDoc || caseDoc.deletedAt !== undefined || caseDoc.userId !== userId) {
      return [];
    }

    // Use by_case_id index for efficient query
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_case_id", (q) => q.eq("caseId", caseId))
      .order("desc")
      .take(1000); // Limit to prevent runaway queries

    // Filter to only notifications belonging to this user (security)
    return notifications.filter((n) => n.userId === userId);
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
  }> => {
    const userId = await getCurrentUserIdOrNull(ctx);

    // Return empty stats if not authenticated
    if (userId === null) {
      return {
        total: 0,
        unread: 0,
        byType: {},
      };
    }

    // Fetch all notifications for user (limited)
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user_id", (q) => q.eq("userId", userId as Id<"users">))
      .take(1000);

    // Calculate stats
    const total = notifications.length;
    const unread = notifications.filter((n) => !n.isRead).length;

    // Group by type
    const byType: Record<string, number> = {};
    for (const notification of notifications) {
      byType[notification.type] = (byType[notification.type] ?? 0) + 1;
    }

    return {
      total,
      unread,
      byType,
    };
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
    const now = Date.now();
    const BATCH_SIZE = 100;

    // Fetch limited batch of unread notifications
    const unreadNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_user_and_unread", (q) =>
        q.eq("userId", userId as Id<"users">).eq("isRead", false)
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
 * Mark multiple specific notifications as read.
 *
 * @param notificationIds - Array of notification IDs to mark as read
 * @returns Count of notifications successfully marked as read
 */
export const markMultipleAsRead = mutation({
  args: {
    notificationIds: v.array(v.id("notifications")),
  },
  handler: async (ctx, { notificationIds }): Promise<{ count: number }> => {
    const userId = await getCurrentUserId(ctx);
    const now = Date.now();

    // Verify all notifications belong to user before updating any
    const notifications = await Promise.all(
      notificationIds.map((id) => ctx.db.get(id))
    );

    // Check ownership for all notifications
    for (let i = 0; i < notifications.length; i++) {
      const notification = notifications[i];
      if (!notification) {
        throw new Error(`Notification ${notificationIds[i]} not found`);
      }
      if (notification.userId !== userId) {
        throw new Error(`Access denied: you do not own notification ${notificationIds[i]}`);
      }
    }

    // Update all notifications
    let count = 0;
    for (const notification of notifications) {
      if (notification && !notification.isRead) {
        await ctx.db.patch(notification._id, {
          isRead: true,
          readAt: now,
          updatedAt: now,
        });
        count++;
      }
    }

    return { count };
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
        q.eq("userId", userId as Id<"users">).eq("isRead", true)
      )
      .take(BATCH_SIZE + 1); // Take one extra to check if there are more

    const hasMore = readNotifications.length > BATCH_SIZE;
    const toProcess = readNotifications.slice(0, BATCH_SIZE);

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
 * Mark a notification as having been sent via email (internal use only).
 *
 * Called from notification email actions after successful email delivery.
 * Not exposed to the client API.
 */
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
