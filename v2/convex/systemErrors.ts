/**
 * System Errors
 *
 * Records backend errors for admin visibility and optional email alerts.
 * Frontend errors go to Sentry; this table is for Convex-side errors
 * that need admin attention (failed crons, webhook errors, etc.).
 */

import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAdmin } from "./lib/admin";

const ERROR_SOURCE = v.union(
  v.literal("mutation"),
  v.literal("action"),
  v.literal("query"),
  v.literal("cron"),
  v.literal("webhook"),
);

/**
 * Record a system error (server-side only).
 */
export const record = internalMutation({
  args: {
    source: ERROR_SOURCE,
    operation: v.string(),
    message: v.string(),
    stack: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    resourceId: v.optional(v.string()),
    extra: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const errorId = await ctx.db.insert("systemErrors", {
      ...args,
      resolved: false,
      createdAt: Date.now(),
    });

    // Send admin notification for unresolved errors
    // Rate-limit: only notify if fewer than 5 unresolved errors in last hour
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const recentErrors = await ctx.db
      .query("systemErrors")
      .withIndex("by_resolved", (q) => q.eq("resolved", false))
      .filter((q) => q.gte(q.field("createdAt"), oneHourAgo))
      .collect();

    if (recentErrors.length <= 5) {
      await ctx.scheduler.runAfter(0, internal.notificationActions.sendAdminNotificationEmail, {
        subject: `[System Error] ${args.operation}`,
        body: `Source: ${args.source}\nOperation: ${args.operation}\n\n${args.message}${args.resourceId ? `\n\nResource: ${args.resourceId}` : ""}`,
      });
    }

    return errorId;
  },
});

/**
 * List recent system errors (admin only).
 */
export const list = query({
  args: {
    resolved: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const limit = args.limit ?? 50;

    if (args.resolved !== undefined) {
      return ctx.db
        .query("systemErrors")
        .withIndex("by_resolved", (q) => q.eq("resolved", args.resolved!))
        .order("desc")
        .take(limit);
    }

    return ctx.db
      .query("systemErrors")
      .withIndex("by_created_at")
      .order("desc")
      .take(limit);
  },
});

/**
 * Mark error(s) as resolved (admin only).
 */
export const resolve = internalMutation({
  args: {
    errorIds: v.array(v.id("systemErrors")),
  },
  handler: async (ctx, args) => {
    for (const id of args.errorIds) {
      await ctx.db.patch(id, { resolved: true });
    }
  },
});
