/**
 * System Errors
 *
 * Records backend errors for admin visibility and optional email alerts.
 * Frontend errors go to Sentry; this table is for Convex-side errors
 * that need admin attention (failed crons, webhook errors, etc.).
 */

import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
// Single-sourced from lib/errorRecording (a dependency-light helper) so schema +
// mutation + the ErrorSource TS type all share one closed-set definition without
// importing a Convex function module into broad consumers.
import { errorSourceValidator } from "./lib/errorRecording";

/**
 * Record a system error (server-side only).
 */
export const record = internalMutation({
  args: {
    source: errorSourceValidator,
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
    // Rate-limit: only notify if fewer than 5 unresolved errors in last hour.
    // Uses compound-index range on (resolved, createdAt) and .take(6) so the
    // read set is at most 6 docs — prevents OCC storms under high error rates.
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const recentErrors = await ctx.db
      .query("systemErrors")
      .withIndex("by_resolved", (q) =>
        q.eq("resolved", false).gte("createdAt", oneHourAgo),
      )
      .take(6);

    if (recentErrors.length <= 5) {
      await ctx.scheduler.runAfter(0, internal.notificationActions.sendAdminNotificationEmail, {
        subject: `[System Error] ${args.operation}`,
        body: `Source: ${args.source}\nOperation: ${args.operation}\n\n${args.message}${args.resourceId ? `\n\nResource: ${args.resourceId}` : ""}`,
      });
    }

    return errorId;
  },
});