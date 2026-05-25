/**
 * Error Recording Helper
 *
 * Unified error reporting: one call → DB + admin email + Sentry.
 * Works in mutation and action handlers (anything with ctx.scheduler).
 *
 * - Schedules systemErrors.record → DB insert + rate-limited admin email
 * - Schedules sentryReportAction.report → Sentry HTTP API
 *
 * Usage:
 *   } catch (error) {
 *     console.error("Failed to do X", error);
 *     await recordError(ctx, "mutation", "cases.create.audit", error);
 *   }
 */

import { v } from "convex/values";
import type { Infer } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";

/**
 * Single source of truth for the `systemErrors.source` closed set.
 *
 * Defined here (a dependency-light helper) rather than in the `systemErrors.ts`
 * function module so that consumers — including `convex/schema.ts` and the
 * `systemErrors.record` mutation — can import the validator without dragging the
 * Convex function-registration / generated-API type graph through every caller
 * of `recordError` (which broke @convex-dev/auth provider inference).
 *
 * `sentryReportAction.report` accepts the same four literals and `recordError`
 * forwards `source` to both — keep this set in sync with it. `"query"` is
 * intentionally absent: no code path records query-sourced errors (queries
 * can't schedule, so they can't reach `recordError`).
 */
export const errorSourceValidator = v.union(
  v.literal("mutation"),
  v.literal("action"),
  v.literal("cron"),
  v.literal("webhook"),
);

// FilterApi generic can't fully resolve internal.systemErrors at the type level.
// The reference is verified correct — see convex/systemErrors.ts (internalMutation).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const internalApi = internal as any;

/** Accepts both mutation and action contexts (both have scheduler.runAfter). */
type CtxWithScheduler = {
  scheduler: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    runAfter: (delay: number, fn: any, args: any) => Promise<any>;
  };
};

// Derived from the single-source validator so this type can never drift from
// the `systemErrors` table / `record` mutation accepted set.
type ErrorSource = Infer<typeof errorSourceValidator>;

interface RecordErrorOpts {
  userId?: Id<"users">;
  resourceId?: string;
  extra?: string;
}

export async function recordError(
  ctx: CtxWithScheduler,
  source: ErrorSource,
  operation: string,
  error: unknown,
  opts?: RecordErrorOpts,
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  const optionalFields = {
    ...(opts?.userId && { userId: opts.userId }),
    ...(opts?.resourceId && { resourceId: opts.resourceId }),
    ...(opts?.extra && { extra: opts.extra }),
  };

  // 1. Record to DB + admin email
  try {
    await ctx.scheduler.runAfter(0, internalApi.systemErrors.record, {
      source,
      operation,
      message,
      stack,
      ...optionalFields,
    });
  } catch (recordingError) {
    // Never let error recording itself cause failures
    console.error(`[errorRecording] Failed to record: ${operation}`, message, recordingError);
  }

  // 2. Schedule Sentry report (runs asynchronously after scheduling)
  try {
    await ctx.scheduler.runAfter(0, internalApi.sentryReportAction.report, {
      source,
      operation,
      message,
      ...(stack && { stack }),
      ...optionalFields,
      // Sentry expects userId as string, not branded Id
      ...(opts?.userId && { userId: opts.userId.toString() }),
    });
  } catch (sentryError) {
    console.error(`[errorRecording] Failed to schedule Sentry report: ${operation}`, sentryError);
  }
}
