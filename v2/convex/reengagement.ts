/**
 * Re-engagement nudge + weekly-digest auto-pause.
 *
 * Flow for a verified user who has the weekly digest ON but has gone quiet:
 *   1. After INACTIVE_DAYS with no activity, send ONE "we've missed you" email
 *      and stamp reengagementNudgeSentAt.
 *   2. If still no activity SUPPRESS_GRACE_DAYS after that nudge, pause the weekly
 *      digest (emailWeeklyDigest=false) and stamp weeklyDigestSuppressedAt.
 *
 * Logging back in clears reengagementNudgeSentAt (recordMyLogin) so the cycle can
 * restart later. The auto-pause is NOT auto-undone on login — instead the in-app
 * banner (getReengagementBannerState) lets the user turn the digest back on, so
 * the choice stays explicit. Deadline reminders are never affected.
 *
 * @module
 */

import {
  query,
  mutation,
  internalQuery,
  internalMutation,
  internalAction,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { getCurrentUserId, getCurrentUserIdOrNull } from "./lib/auth";
import { loggers } from "./lib/logging";

const log = loggers.scheduler;

const DAY_MS = 24 * 60 * 60 * 1000;
/** Days of no activity before the first nudge. */
const INACTIVE_DAYS = 60;
/** Days after the nudge, still inactive, before the weekly digest is paused. */
const SUPPRESS_GRACE_DAYS = 14;

/**
 * Verified users who have the weekly digest ON but have been inactive past the
 * nudge threshold. Returns the state the cron needs to decide nudge vs suppress.
 */
export const getReengagementCandidates = internalQuery({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - INACTIVE_DAYS * DAY_MS;
    const profiles = await ctx.db.query("userProfiles").collect();

    const candidates: Array<{
      profileId: typeof profiles[number]["_id"];
      email: string;
      userName: string;
      lastSeen: number;
      reengagementNudgeSentAt: number | undefined;
      weeklyDigestSuppressedAt: number | undefined;
    }> = [];

    for (const profile of profiles) {
      if (profile.emailWeeklyDigest !== true) continue; // nothing to pause
      if (profile.deletedAt !== undefined) continue;
      const lastSeen =
        profile.lastActiveAt ?? profile.lastLoginAt ?? profile._creationTime;
      if (lastSeen >= cutoff) continue; // still active

      const user = await ctx.db.get(profile.userId);
      if (!user || user.deletedAt || !user.email) continue;

      candidates.push({
        profileId: profile._id,
        email: user.email,
        userName:
          profile.fullName || user.name || user.email.split("@")[0] || "there",
        lastSeen,
        reengagementNudgeSentAt: profile.reengagementNudgeSentAt,
        weeklyDigestSuppressedAt: profile.weeklyDigestSuppressedAt,
      });
    }

    return candidates;
  },
});

/** Stamp that the nudge email was sent. */
export const markNudged = internalMutation({
  args: { profileId: v.id("userProfiles"), at: v.number() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.profileId, {
      reengagementNudgeSentAt: args.at,
      updatedAt: Date.now(),
    });
  },
});

/** Pause the weekly digest after an unanswered nudge. */
export const suppressWeeklyDigest = internalMutation({
  args: { profileId: v.id("userProfiles"), at: v.number() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.profileId, {
      emailWeeklyDigest: false,
      weeklyDigestSuppressedAt: args.at,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Daily: nudge newly-inactive users, and pause the weekly digest for those whose
 * nudge went unanswered through the grace period.
 */
export const runReengagementCheck = internalAction({
  args: {},
  handler: async (ctx): Promise<{ nudged: number; suppressed: number }> => {
    const candidates = await ctx.runQuery(
      internal.reengagement.getReengagementCandidates
    );
    const now = Date.now();
    let nudged = 0;
    let suppressed = 0;
    let emailIndex = 0;

    for (const c of candidates) {
      if (c.reengagementNudgeSentAt === undefined) {
        // First nudge for this inactivity spell.
        await ctx.scheduler.runAfter(
          emailIndex * 1000,
          internal.notificationActions.sendReengagementNudge,
          { to: c.email, userName: c.userName }
        );
        await ctx.runMutation(internal.reengagement.markNudged, {
          profileId: c.profileId,
          at: now,
        });
        nudged++;
        emailIndex++;
      } else if (
        now - c.reengagementNudgeSentAt > SUPPRESS_GRACE_DAYS * DAY_MS &&
        c.lastSeen < c.reengagementNudgeSentAt && // no activity since the nudge
        c.weeklyDigestSuppressedAt === undefined
      ) {
        await ctx.runMutation(internal.reengagement.suppressWeeklyDigest, {
          profileId: c.profileId,
          at: now,
        });
        suppressed++;
      }
    }

    log.info("Reengagement check complete", { nudged, suppressed });
    return { nudged, suppressed };
  },
});

// ============================================================================
// IN-APP BANNER (client-facing)
// ============================================================================

/** True if the current user's weekly digest was auto-paused (drives the banner). */
export const getReengagementBannerState = query({
  args: {},
  handler: async (ctx): Promise<{ weeklyDigestPaused: boolean }> => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) return { weeklyDigestPaused: false };
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();
    return { weeklyDigestPaused: profile?.weeklyDigestSuppressedAt !== undefined };
  },
});

/** Turn the weekly digest back on (from the banner) and clear the paused state. */
export const reactivateWeeklyDigest = mutation({
  args: {},
  handler: async (ctx): Promise<void> => {
    const userId = await getCurrentUserId(ctx);
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();
    if (!profile) throw new Error("Profile not found");
    await ctx.db.patch(profile._id, {
      emailWeeklyDigest: true,
      weeklyDigestSuppressedAt: undefined,
      reengagementNudgeSentAt: undefined,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Acknowledge the pause without re-enabling: clears the paused marker so the
 * banner stops showing, but leaves the weekly digest OFF.
 */
export const dismissReengagementBanner = mutation({
  args: {},
  handler: async (ctx): Promise<void> => {
    const userId = await getCurrentUserId(ctx);
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();
    if (!profile) return;
    await ctx.db.patch(profile._id, {
      weeklyDigestSuppressedAt: undefined,
      updatedAt: Date.now(),
    });
  },
});
