/**
 * Sentry Report Action
 *
 * Internal action that bridges recordError → Sentry.
 * Mutations can't use fetch directly, so they schedule this action
 * which calls the reportError HTTP utility.
 *
 * Used exclusively by recordError() in convex/lib/errorRecording.ts.
 */

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { reportError } from "./lib/sentry";

export const report = internalAction({
  args: {
    source: v.union(
      v.literal("mutation"),
      v.literal("action"),
      v.literal("cron"),
      v.literal("webhook"),
    ),
    operation: v.string(),
    message: v.string(),
    stack: v.optional(v.string()),
    userId: v.optional(v.string()),
    resourceId: v.optional(v.string()),
    extra: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    try {
      const error = new Error(args.message);
      if (args.stack) {
        error.stack = args.stack;
      }

      await reportError(error, {
        module: args.source,
        operation: args.operation,
        userId: args.userId,
        resourceId: args.resourceId,
        extra: args.extra ? { detail: args.extra } : undefined,
      });
    } catch (e) {
      // Log but don't throw — Convex retries failed actions, and Sentry reporting
      // should never cause cascading retries
      console.error("[sentryReportAction] Failed to report to Sentry:", e);
    }
  },
});
