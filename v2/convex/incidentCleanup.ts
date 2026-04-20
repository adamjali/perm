/**
 * Incident Cleanup Utilities — 2026-04-19 signup-abuse response.
 *
 * Cancels scheduled storm jobs (systemErrors.record / sentryReportAction.report /
 * sendAdminNotificationEmail) that piled up during the attack cascade.
 *
 * Safety: function-name allow-list is hard-coded. The legitimate cron job
 * scheduledJobs.permanentlyDeleteAccount is NOT in the list and cannot be
 * cancelled through this utility.
 */

import { v } from "convex/values";
import {
  internalQuery,
  internalMutation,
  internalAction,
} from "./_generated/server";
import { internal } from "./_generated/api";

// Hard-coded allow-list: only these function names can be cancelled.
// welcomeEmail is included because failing welcomeEmail retries (from attack-
// scheduled jobs) are the SOURCE of new systemErrors.record + sentryReport
// storm jobs via recordError() wrapper. Cancelling them breaks the faucet.
const CANCELLABLE_STORM_JOBS = [
  "systemErrors.js:record",
  "sentryReportAction.js:report",
  "notificationActions.js:sendAdminNotificationEmail",
  "welcomeEmail.js:sendWelcomeEmail",
] as const;

/**
 * List pending scheduled jobs matching the storm allow-list.
 * Paginates through scheduled_functions newest-first so the action can walk
 * the entire table in chunks, not just the top scan window.
 */
export const listPendingStormJobs = internalQuery({
  args: {
    limit: v.number(),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, { limit, cursor }) => {
    const cap = Math.min(Math.max(limit, 1), 500);
    const allowed = new Set<string>(CANCELLABLE_STORM_JOBS);

    const page = await ctx.db.system
      .query("_scheduled_functions")
      .order("desc")
      .paginate({ cursor: cursor ?? null, numItems: cap });

    const candidates: Array<{ id: string; name: string }> = [];
    for (const j of page.page) {
      if (j.state?.kind === "pending" && allowed.has(j.name)) {
        candidates.push({ id: j._id, name: j.name });
      }
    }
    return {
      scanned: page.page.length,
      candidateCount: candidates.length,
      candidates,
      continueCursor: page.continueCursor,
      isDone: page.isDone,
    };
  },
});

/**
 * Cancel an explicit list of scheduled-function IDs.
 * Re-validates each against the allow-list before cancelling —
 * caller cannot smuggle in a non-allowed function name.
 */
export const cancelJobsByIds = internalMutation({
  args: { ids: v.array(v.string()) },
  handler: async (ctx, { ids }) => {
    const allowed = new Set<string>(CANCELLABLE_STORM_JOBS);
    let cancelled = 0;
    const skipped: Array<{ id: string; reason: string }> = [];
    const cancelledIds: string[] = [];

    for (const idStr of ids) {
      const id = idStr as unknown as never; // system Ids are opaque strings
      // ctx.db.system.get works on _scheduled_functions
      const job = (await (ctx.db.system as unknown as {
        get: (id: unknown) => Promise<null | { _id: string; name: string; state?: { kind: string } }>;
      }).get(id)) ?? null;

      if (!job) {
        skipped.push({ id: idStr, reason: "missing" });
        continue;
      }
      if (job.state?.kind !== "pending") {
        skipped.push({ id: idStr, reason: `state=${job.state?.kind ?? "?"}` });
        continue;
      }
      if (!allowed.has(job.name)) {
        skipped.push({ id: idStr, reason: `name=${job.name}` });
        continue;
      }
      await ctx.scheduler.cancel(id);
      cancelledIds.push(idStr);
      cancelled++;
    }

    return { cancelled, skippedCount: skipped.length, skipped, cancelledIds };
  },
});

/**
 * Drain all storm jobs by looping list → cancel.
 * Bounded by maxIterations and maxTotal to prevent runaway.
 * Returns aggregate stats + full list of cancelled IDs (for audit trail).
 */
export const drainStormJobs = internalAction({
  args: {
    maxIterations: v.optional(v.number()),
    batchSize: v.optional(v.number()),
    maxTotal: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { maxIterations = 50, batchSize = 500, maxTotal = 20000 },
  ): Promise<{
    iterations: number;
    totalCancelled: number;
    totalSkipped: number;
    sampleCancelledIds: string[];
    countByFunction: Record<string, number>;
    stoppedReason: string;
  }> => {
    let totalCancelled = 0;
    let totalSkipped = 0;
    let iteration = 0;
    let stoppedReason = "done";
    let cursor: string | null = null;
    const countByFunction: Record<string, number> = {};
    const sampleCancelledIds: string[] = [];
    const SAMPLE_CAP = 500;

    while (iteration < maxIterations) {
      iteration++;
      const listResult: {
        scanned: number;
        candidateCount: number;
        candidates: Array<{ id: string; name: string }>;
        continueCursor: string;
        isDone: boolean;
      } = await ctx.runQuery(internal.incidentCleanup.listPendingStormJobs, {
        limit: batchSize,
        cursor,
      });

      if (listResult.candidateCount > 0) {
        const ids = listResult.candidates.map((c) => c.id);
        const cancelResult: {
          cancelled: number;
          skippedCount: number;
          cancelledIds: string[];
        } = await ctx.runMutation(internal.incidentCleanup.cancelJobsByIds, {
          ids,
        });
        totalCancelled += cancelResult.cancelled;
        totalSkipped += cancelResult.skippedCount;

        // Count by function name (cancelled IDs correspond positionally to the
        // candidates that were still pending + allowed when mutation ran).
        for (const cand of listResult.candidates) {
          if (cancelResult.cancelledIds.includes(cand.id)) {
            countByFunction[cand.name] = (countByFunction[cand.name] ?? 0) + 1;
          }
        }
        // Keep a bounded sample for audit
        for (const id of cancelResult.cancelledIds) {
          if (sampleCancelledIds.length >= SAMPLE_CAP) break;
          sampleCancelledIds.push(id);
        }
      }

      if (totalCancelled >= maxTotal) {
        stoppedReason = `hit maxTotal=${maxTotal}`;
        break;
      }

      if (listResult.isDone) {
        stoppedReason = "end of table";
        break;
      }

      cursor = listResult.continueCursor;
    }

    if (iteration >= maxIterations) {
      stoppedReason = `hit maxIterations=${maxIterations}`;
    }

    return {
      iterations: iteration,
      totalCancelled,
      totalSkipped,
      sampleCancelledIds,
      countByFunction,
      stoppedReason,
    };
  },
});
