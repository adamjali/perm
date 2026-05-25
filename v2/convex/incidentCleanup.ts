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
import { purgeAllUserData } from "./lib/deletion";
// Attacker-signature matcher is single-sourced in lib/nameValidation (alongside
// the prevention validator) so incident tooling never re-derives the signature.
import { isAttackerName } from "./lib/nameValidation";

// Attack-window bounds (UTC). Used for time-windowed cleanup of tables
// without userId linkage (systemErrors).
// END extended to 06:00 UTC to cover the post-01:13 cascade tail: the
// welcomeEmail queue kept firing 429-failures until systemErrors.record fix
// landed at 04:48 UTC and we cancelled the storm at 05:00 UTC. Any errors
// after 06:00 UTC are post-response and represent legit operational state.
const ATTACK_START_MS = Date.parse("2026-04-19T22:38:00Z");
const ATTACK_END_MS   = Date.parse("2026-04-20T06:00:00Z");

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

// ============================================================================
// ATTACKER USER PURGE — cascade-deletes via purgeAllUserData
// ============================================================================

/**
 * Paginate through users table and return ONLY those whose name matches the
 * attacker signature. Cursor-based so the calling action can resume safely.
 */
export const listAttackerUserIds = internalQuery({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    limit: v.number(),
  },
  handler: async (ctx, { cursor, limit }) => {
    const cap = Math.min(Math.max(limit, 1), 500);
    const page = await ctx.db
      .query("users")
      .paginate({ cursor: cursor ?? null, numItems: cap });

    const attackerIds: string[] = [];
    let legitScanned = 0;
    for (const u of page.page) {
      if (isAttackerName(u.name)) {
        attackerIds.push(u._id);
      } else {
        legitScanned++;
      }
    }
    return {
      attackerIds,
      scanned: page.page.length,
      legitSkipped: legitScanned,
      continueCursor: page.continueCursor,
      isDone: page.isDone,
    };
  },
});

/**
 * Re-validate + purge a batch of user IDs. Re-checks isAttackerName on each
 * fetched user so a bad caller cannot delete a legitimate account by ID.
 */
export const purgeAttackerUsersBatch = internalMutation({
  args: { userIds: v.array(v.id("users")) },
  handler: async (ctx, { userIds }) => {
    let deleted = 0;
    let skipped = 0;
    const skippedReasons: string[] = [];
    const agg = {
      cases: 0,
      notifications: 0,
      conversations: 0,
      auditLogs: 0,
      userProfiles: 0,
      authAccounts: 0,
      authSessions: 0,
      authRefreshTokens: 0,
      authVerificationCodes: 0,
    };

    for (const userId of userIds) {
      const user = await ctx.db.get(userId);
      if (!user) {
        skipped++;
        if (skippedReasons.length < 10) skippedReasons.push(`${userId}: missing`);
        continue;
      }
      if (!isAttackerName(user.name)) {
        skipped++;
        if (skippedReasons.length < 10) {
          skippedReasons.push(`${userId}: name-clean (${JSON.stringify(user.name)})`);
        }
        continue;
      }

      const r = await purgeAllUserData(ctx, userId);
      deleted++;
      agg.cases += r.cases;
      agg.notifications += r.notifications;
      agg.conversations += r.conversations;
      agg.auditLogs += r.auditLogs;
      if (r.profileDeleted) agg.userProfiles++;
      agg.authAccounts += r.authAccounts;
      agg.authSessions += r.authSessions;
      agg.authRefreshTokens += r.authRefreshTokens;
      agg.authVerificationCodes += r.authVerificationCodes;
    }

    return { deleted, skipped, skippedReasons, aggregate: agg };
  },
});

/**
 * Delete systemErrors rows whose createdAt falls in the attack window.
 * Uses the by_created_at index to stay under the 4096 read limit.
 */
export const purgeAttackWindowSystemErrorsBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("systemErrors")
      .withIndex("by_created_at", (q) =>
        q.gte("createdAt", ATTACK_START_MS).lte("createdAt", ATTACK_END_MS),
      )
      .take(1000);

    let deleted = 0;
    for (const r of rows) {
      await ctx.db.delete(r._id);
      deleted++;
    }
    return { deleted, hadMore: rows.length === 1000 };
  },
});

/**
 * Drive the full incident cleanup:
 *   1. Purge attacker users (cascade delete via purgeAllUserData)
 *   2. Purge attack-window systemErrors
 * Returns aggregate counts.
 */
export const runFullCleanup = internalAction({
  args: {
    userBatchSize: v.optional(v.number()),
    maxUserBatches: v.optional(v.number()),
    maxSystemErrorBatches: v.optional(v.number()),
  },
  handler: async (
    ctx,
    {
      userBatchSize = 150,
      maxUserBatches = 300,
      maxSystemErrorBatches = 50,
    },
  ): Promise<{
    userPhase: {
      batches: number;
      totalDeleted: number;
      totalSkipped: number;
      aggregate: Record<string, number>;
      stoppedReason: string;
      lastSkippedReasons: string[];
    };
    systemErrorsPhase: {
      batches: number;
      totalDeleted: number;
      stoppedReason: string;
    };
  }> => {
    // Phase 1: attacker users + cascade
    let cursor: string | null = null;
    let batches = 0;
    let totalDeleted = 0;
    let totalSkipped = 0;
    const aggregate: Record<string, number> = {};
    let lastSkippedReasons: string[] = [];
    let stoppedReasonUsers = "done";

    while (batches < maxUserBatches) {
      batches++;
      const listResult: {
        attackerIds: string[];
        continueCursor: string;
        isDone: boolean;
      } = await ctx.runQuery(internal.incidentCleanup.listAttackerUserIds, {
        cursor,
        limit: userBatchSize,
      });

      if (listResult.attackerIds.length > 0) {
        const purgeResult: {
          deleted: number;
          skipped: number;
          skippedReasons: string[];
          aggregate: Record<string, number>;
        } = await ctx.runMutation(
          internal.incidentCleanup.purgeAttackerUsersBatch,
          { userIds: listResult.attackerIds as Array<never> },
        );
        totalDeleted += purgeResult.deleted;
        totalSkipped += purgeResult.skipped;
        if (purgeResult.skippedReasons.length > 0) {
          lastSkippedReasons = purgeResult.skippedReasons;
        }
        // Aggregating server-returned counts — keys are a known closed set,
        // not user input, so bracket access is safe.
        for (const [k, v] of Object.entries(purgeResult.aggregate)) {
          aggregate[k] = (aggregate[k] ?? 0) + (v as number);
        }
      }

      if (listResult.isDone) {
        stoppedReasonUsers = "end of users table";
        break;
      }
      cursor = listResult.continueCursor;
    }
    if (batches >= maxUserBatches) {
      stoppedReasonUsers = `hit maxUserBatches=${maxUserBatches}`;
    }

    // Phase 2: attack-window systemErrors (no userId linkage)
    let seBatches = 0;
    let seTotalDeleted = 0;
    let stoppedReasonSe = "done";
    while (seBatches < maxSystemErrorBatches) {
      seBatches++;
      const r: { deleted: number; hadMore: boolean } = await ctx.runMutation(
        internal.incidentCleanup.purgeAttackWindowSystemErrorsBatch,
        {},
      );
      seTotalDeleted += r.deleted;
      if (!r.hadMore) {
        stoppedReasonSe = "window drained";
        break;
      }
    }
    if (seBatches >= maxSystemErrorBatches) {
      stoppedReasonSe = `hit maxSystemErrorBatches=${maxSystemErrorBatches}`;
    }

    return {
      userPhase: {
        batches,
        totalDeleted,
        totalSkipped,
        aggregate,
        stoppedReason: stoppedReasonUsers,
        lastSkippedReasons,
      },
      systemErrorsPhase: {
        batches: seBatches,
        totalDeleted: seTotalDeleted,
        stoppedReason: stoppedReasonSe,
      },
    };
  },
});
