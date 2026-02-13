/**
 * Sentry Error Reporter Action
 *
 * Internal action for reporting errors to Sentry from Convex.
 * Mutations/queries can schedule this action to report errors
 * since they don't have direct fetch access.
 *
 * @module
 */

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { reportError } from "./lib/sentry";

/**
 * Report an error to Sentry.
 * Called from mutations/queries via ctx.scheduler.runAfter(0, ...).
 */
export const report = internalAction({
  args: {
    errorMessage: v.string(),
    errorName: v.optional(v.string()),
    errorStack: v.optional(v.string()),
    module: v.optional(v.string()),
    operation: v.optional(v.string()),
    userId: v.optional(v.string()),
    resourceId: v.optional(v.string()),
    extra: v.optional(v.string()), // JSON-encoded extra data
  },
  handler: async (_ctx, args) => {
    const error = new Error(args.errorMessage);
    error.name = args.errorName ?? "ConvexError";
    if (args.errorStack) {
      error.stack = args.errorStack;
    }

    await reportError(error, {
      module: args.module,
      operation: args.operation,
      userId: args.userId,
      resourceId: args.resourceId,
      extra: args.extra ? JSON.parse(args.extra) : undefined,
    });
  },
});
