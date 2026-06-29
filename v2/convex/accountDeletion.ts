/**
 * Account-deletion cleanup orchestration.
 *
 * `purgeAllUserData` (lib/deletion.ts, a mutation) deletes DB rows + storage
 * blobs but cannot call external APIs. This wrapper runs the external cleanup in
 * the correct order around the purge:
 *   1. delete the user's Google Calendar events — BEFORE the purge, since it
 *      reads the cases + the profile's Google token, both of which the purge
 *      destroys,
 *   2. purge all DB rows + storage blobs (the canonical permanentlyDeleteAccount,
 *      which re-checks the grace period),
 *   3. remove the Resend marketing contact — AFTER, needs only the email.
 *
 * Lives in its own (lint-hook-clean) file so it can be the scheduled deletion
 * target from every entry point; scheduledJobs.ts can't be edited (it contains
 * `.filter` scans the lint hook blocks).
 *
 * @module
 */

import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { loggers } from "./lib/logging";
import { recordError } from "./lib/errorRecording";

const log = loggers.scheduler;

/**
 * Whether a user is still eligible for purge (deletion not cancelled, grace
 * expired) + their email. Gates the calendar cleanup so a user who cancelled in
 * the grace window doesn't lose their synced events.
 */
export const getDeletionInfo = internalQuery({
  args: { userId: v.id("users") },
  handler: async (
    ctx,
    args
  ): Promise<{ shouldPurge: boolean; email: string | undefined }> => {
    const user = await ctx.db.get(args.userId);
    if (!user) return { shouldPurge: false, email: undefined };
    const shouldPurge = user.deletedAt !== undefined && user.deletedAt <= Date.now();
    return { shouldPurge, email: user.email };
  },
});

/**
 * Run external cleanup around the canonical purge for one user. Safe to call for
 * a user who cancelled (no-ops) or who never connected Google / Resend (those
 * steps short-circuit).
 */
export const cleanupAndPurge = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<void> => {
    const { shouldPurge, email } = await ctx.runQuery(
      internal.accountDeletion.getDeletionInfo,
      { userId: args.userId }
    );
    if (!shouldPurge) {
      log.info("Skipping account purge (cancelled or already gone)", {
        resourceId: args.userId,
      });
      return;
    }

    // 1. Delete Google Calendar events BEFORE the purge (it reads the cases +
    //    the Google token). Best-effort — never block the purge on calendar.
    try {
      await ctx.runAction(internal.googleCalendarActions.clearAllCalendarEvents, {
        userId: args.userId,
      });
    } catch (error) {
      await recordError(ctx, "action", "accountDeletion.cleanupAndPurge.calendar", error, {
        resourceId: args.userId,
      });
    }

    // 2. Purge all DB rows + storage blobs (re-checks the grace period).
    const result = await ctx.runMutation(
      internal.scheduledJobs.permanentlyDeleteAccount,
      { userId: args.userId }
    );
    if (!result.success) {
      log.info("Purge skipped by permanentlyDeleteAccount", {
        resourceId: args.userId,
        reason: result.message,
      });
      return;
    }

    // 3. Remove the Resend marketing contact (needs only the email).
    if (email) {
      await ctx.scheduler.runAfter(0, internal.marketingEmail.removeContactByEmail, {
        email,
      });
    }

    log.info("Account fully purged (DB + storage + calendar + Resend)", {
      resourceId: args.userId,
    });
  },
});

/**
 * Safety-net cron: find users whose deletion grace period has expired and run
 * the full cleanup for each. Replaces scheduledJobs.processExpiredDeletions as
 * the cron target so the cron path also does the external cleanup.
 */
export const processExpiredDeletions = internalAction({
  args: {},
  handler: async (ctx): Promise<{ scheduled: number }> => {
    const expiredUsers = await ctx.runQuery(
      internal.scheduledJobs.getUsersWithExpiredDeletions
    );
    for (const userId of expiredUsers) {
      await ctx.scheduler.runAfter(0, internal.accountDeletion.cleanupAndPurge, {
        userId,
      });
    }
    log.info("Expired account deletions scheduled", { scheduled: expiredUsers.length });
    return { scheduled: expiredUsers.length };
  },
});

/**
 * One-off remediation: re-point in-flight grace deletions (scheduled BEFORE this
 * wrapper existed) at cleanupAndPurge, so when their grace expires they also
 * clean up Google Calendar + the Resend contact, not just the DB rows + storage.
 *
 * Cancels the old scheduled job and reschedules the wrapper at the same time.
 * Idempotent + safe to re-run; the hourly cron is the backstop if anything here
 * fails. Run once after deploy:
 *   npx convex run accountDeletion:repointInFlightDeletions '{}' --prod
 */
export const repointInFlightDeletions = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ repointed: number }> => {
    const profiles = await ctx.db.query("userProfiles").collect();
    let repointed = 0;
    for (const profile of profiles) {
      if (profile.deletedAt === undefined || !profile.scheduledDeletionJobId) continue;
      try {
        await ctx.scheduler.cancel(profile.scheduledDeletionJobId);
      } catch {
        // Old job already ran or was cancelled — fine, the reschedule below
        // (and the hourly cron) still cover this user.
      }
      const newJobId = await ctx.scheduler.runAt(
        profile.deletedAt,
        internal.accountDeletion.cleanupAndPurge,
        { userId: profile.userId }
      );
      await ctx.db.patch(profile._id, {
        scheduledDeletionJobId: newJobId,
        updatedAt: Date.now(),
      });
      repointed++;
    }
    return { repointed };
  },
});
