/**
 * Error Recording Helper
 *
 * Thin wrapper around systemErrors.record for use in catch blocks.
 * Works in mutation and action handlers (anything with ctx.scheduler).
 *
 * Usage:
 *   } catch (error) {
 *     console.error("Failed to do X", error);
 *     await recordError(ctx, "mutation", "cases.create.audit", error);
 *   }
 */

import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";

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

type ErrorSource = "mutation" | "action" | "cron" | "webhook";

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
  const message =
    error instanceof Error ? error.message : String(error);
  const stack =
    error instanceof Error ? error.stack : undefined;

  try {
    await ctx.scheduler.runAfter(0, internalApi.systemErrors.record, {
      source,
      operation,
      message,
      stack,
      ...(opts?.userId && { userId: opts.userId }),
      ...(opts?.resourceId && { resourceId: opts.resourceId }),
      ...(opts?.extra && { extra: opts.extra }),
    });
  } catch (recordingError) {
    // Never let error recording itself cause failures
    console.error(`[errorRecording] Failed to record: ${operation}`, message, recordingError);
  }
}
