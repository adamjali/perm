import { query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { getCurrentUserIdOrNull } from "./lib/auth";

/**
 * List audit logs for the current user
 * Only shows logs created by the authenticated user
 * Returns empty array if not authenticated (graceful sign-out handling)
 */
export const listMine = query({
  args: {
    tableName: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Use null-safe auth check for graceful sign-out/timeout handling
    const userId = await getCurrentUserIdOrNull(ctx);
    if (userId === null) {
      return [];
    }

    const limit = args.limit ?? 50;

    // Query by user ID index
    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_user_id", (q) => q.eq("userId", userId as Id<"users">))
      .order("desc")
      .take(limit);

    // Filter by table name if specified
    if (args.tableName) {
      return logs.filter((log) => log.tableName === args.tableName);
    }

    return logs;
  },
});

/**
 * Get audit logs for a specific document
 * Security: Only returns logs for documents owned by current user
 * Returns empty array if not authenticated (graceful sign-out handling)
 */
export const forDocument = query({
  args: {
    documentId: v.string(),
    tableName: v.string(),
  },
  handler: async (ctx, args) => {
    // Use null-safe auth check for graceful sign-out/timeout handling
    const userId = await getCurrentUserIdOrNull(ctx);
    if (userId === null) {
      return [];
    }

    // Get all logs for this document
    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_document_id", (q) => q.eq("documentId", args.documentId))
      .order("desc")
      .collect();

    // Security: Only return logs for documents the user owns
    return logs.filter((log) => log.userId === userId);
  },
});

/**
 * Get audit logs within a date range
 * Only for current user's logs
 * Returns empty array if not authenticated (graceful sign-out handling)
 */
export const byDateRange = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
    tableName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Use null-safe auth check for graceful sign-out/timeout handling
    const userId = await getCurrentUserIdOrNull(ctx);
    if (userId === null) {
      return [];
    }

    // Query using compound index for efficient user+timestamp filtering
    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_user_and_timestamp", (q) =>
        q
          .eq("userId", userId as Id<"users">)
          .gte("timestamp", args.startDate)
          .lte("timestamp", args.endDate)
      )
      .order("desc")
      .collect();

    // Filter by table name if specified
    if (args.tableName) {
      return logs.filter((log) => log.tableName === args.tableName);
    }

    return logs;
  },
});
