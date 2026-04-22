/**
 * Abuse detection — watches for auth-failure patterns and auto-suspends users
 * when the pattern looks like account-takeover or automated credential stuffing.
 *
 * Pattern watched:
 *   10 failed auth attempts (login / password_reset / otp_verify) on the SAME
 *   email within a rolling 30-minute window. No per-IP distinctness check —
 *   a single attacker behind one IP still trips this.
 *
 * When detected:
 *   - Sets userProfiles.suspendedAt / suspendedReason / suspendedUntil
 *   - Admin gets an email via sendAdminNotificationEmail
 *   - Event recorded in rateLimits table for audit
 *
 * Called from `checkAuthRateLimit` whenever a per-email check REJECTS.
 * Lightweight: one read + one optional write + scheduled email.
 */

import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

const FAIL_WINDOW_MS = 30 * 60 * 1000;   // 30-minute rolling window
const FAIL_THRESHOLD = 10;                // failures in window before auto-suspend
const AUTO_SUSPEND_DURATION_MS = 24 * 60 * 60 * 1000; // 24h auto-suspension

/**
 * Record an auth failure (by email) and evaluate whether to auto-suspend.
 * Called internally by `checkAuthRateLimit` whenever a per-email rate check
 * rejects on login/password_reset/otp_verify — the cumulative rejection rate
 * is the primary signal of abuse.
 *
 * Returns `{ suspended }` so the caller can branch on the outcome.
 */
export const recordAuthFailure = internalMutation({
  args: {
    email: v.string(),
    action: v.string(), // e.g. "login", "password_reset"
  },
  handler: async (ctx, { email, action }) => {
    const normalizedEmail = email.toLowerCase().trim();
    if (!normalizedEmail) return { suspended: false };

    const now = Date.now();
    const windowStart = now - FAIL_WINDOW_MS;

    // Log this failure against a stable per-email key.
    const key = `auth_fail:${normalizedEmail}`;
    await ctx.db.insert("rateLimits", {
      key,
      timestamp: now,
      identifier: normalizedEmail,
      action: `auth_fail:${action}`,
    });

    // Count failures in the rolling window.
    const recent = await ctx.db
      .query("rateLimits")
      .withIndex("by_key_and_timestamp", (q) =>
        q.eq("key", key).gte("timestamp", windowStart),
      )
      .collect();

    if (recent.length < FAIL_THRESHOLD) return { suspended: false };

    // Pattern matched. Find the user profile by email and auto-suspend.
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const user = await (ctx.db.query("users") as any)
      .withIndex("email", (q: { eq: (field: string, value: string) => unknown }) =>
        q.eq("email", normalizedEmail),
      )
      .first();
    if (!user) return { suspended: false };

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .unique();
    if (!profile) return { suspended: false };

    // Skip if already suspended
    if (profile.suspendedAt) return { suspended: false, alreadySuspended: true };

    await ctx.db.patch(profile._id, {
      suspendedAt: now,
      suspendedReason: `auto: ${recent.length} auth failures in 30min`,
      suspendedUntil: now + AUTO_SUSPEND_DURATION_MS,
    });

    // Notify admin
    await ctx.scheduler.runAfter(
      0,
      internal.notificationActions.sendAdminNotificationEmail,
      {
        subject: `[Security] User auto-suspended: ${normalizedEmail}`,
        body:
          `Auto-suspension triggered by abuse detection.\n\n` +
          `Email: ${normalizedEmail}\n` +
          `Failures in last 30 min: ${recent.length}\n\n` +
          `Auto-lifts in 24h. Manual override at /admin/security.`,
      },
    );

    return {
      suspended: true,
      failures: recent.length,
      suspendedUntil: now + AUTO_SUSPEND_DURATION_MS,
    };
  },
});

/**
 * Public query for the client to check whether an email is currently
 * suspended. Called from the login form BEFORE signIn so we can show a
 * friendly "account temporarily locked" message instead of just 429-ing.
 */
export const checkEmailSuspension = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalizedEmail = email.toLowerCase().trim();
    if (!normalizedEmail) return { suspended: false as const };
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const user = await (ctx.db.query("users") as any)
      .withIndex("email", (q: { eq: (field: string, value: string) => unknown }) =>
        q.eq("email", normalizedEmail),
      )
      .first();
    if (!user) return { suspended: false as const };
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .unique();
    if (!profile || !profile.suspendedAt) return { suspended: false as const };
    // Auto-lift if past suspendedUntil (cron will tidy, but check live)
    if (profile.suspendedUntil && profile.suspendedUntil < Date.now()) {
      return { suspended: false as const };
    }
    return {
      suspended: true as const,
      suspendedAt: profile.suspendedAt,
      suspendedUntil: profile.suspendedUntil ?? null,
      reason: profile.suspendedReason ?? null,
    };
  },
});
