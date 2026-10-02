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
import { MS_PER_HOUR } from "./lib/time";

/** Admin emails about unresolved errors, at most, per rolling hour. */
const ERROR_EMAILS_PER_HOUR = 5;

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

    // Send admin notification for unresolved errors, at most
    // ERROR_EMAILS_PER_HOUR an hour. The compound-index range on
    // (resolved, createdAt) reads one past that, so the read set stays small
    // and OCC storms can't start under a high error rate.
    const oneHourAgo = Date.now() - MS_PER_HOUR;
    const recentErrors = await ctx.db
      .query("systemErrors")
      .withIndex("by_resolved", (q) =>
        q.eq("resolved", false).gte("createdAt", oneHourAgo),
      )
      .take(ERROR_EMAILS_PER_HOUR + 1);

    // ADMIN_ERROR_EMAILS=off silences the email on a deployment that is not
    // the live one: the DEVELOPMENT deployment runs the same crons against a
    // retired database, and its "[System Error]" emails look exactly like the
    // live site failing. The row is still recorded either way, and
    // every email now names the deployment it came from.
    const deployment = (process.env.CONVEX_CLOUD_URL ?? "").replace(/^https?:\/\//, "").replace(/\.convex\.cloud.*$/, "");
    if (recentErrors.length <= ERROR_EMAILS_PER_HOUR && process.env.ADMIN_ERROR_EMAILS !== "off") {
      await ctx.scheduler.runAfter(0, internal.notificationActions.sendAdminNotificationEmail, {
        subject: `[System Error] ${args.operation}`,
        body: `Source: ${args.source}\nOperation: ${args.operation}${deployment ? `\nDeployment: ${deployment}` : ""}\n\n${args.message}${args.resourceId ? `\n\nResource: ${args.resourceId}` : ""}`,
      });
    }

    return errorId;
  },
});