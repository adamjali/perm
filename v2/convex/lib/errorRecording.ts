/**
 * Error Recording Helper
 *
 * Thin wrapper around systemErrors.record for use in catch blocks.
 * Works in both mutation and action handlers (anything with ctx.scheduler).
 *
 * Usage:
 *   } catch (error) {
 *     console.error("Failed to do X", error);
 *     await recordError(ctx, "mutation", "cases.create.audit", error);
 *   }
 */

import { internal } from "../_generated/api";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CtxWithScheduler = {
  scheduler: {
    runAfter: (...args: any[]) => any;
  };
};

type ErrorSource = "mutation" | "action" | "query" | "cron" | "webhook";

interface RecordErrorOpts {
  userId?: string;
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
    await ctx.scheduler.runAfter(
      0,
      internal.systemErrors.record as unknown as never,
      {
        source,
        operation,
        message,
        stack,
        ...(opts?.userId ? { userId: opts.userId } : {}),
        ...(opts?.resourceId ? { resourceId: opts.resourceId } : {}),
        ...(opts?.extra ? { extra: opts.extra } : {}),
      },
    );
  } catch {
    // Never let error recording itself cause failures
    console.error(`[errorRecording] Failed to record: ${operation}`, message);
  }
}
