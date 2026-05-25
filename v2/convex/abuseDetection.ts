/**
 * Abuse detection — watches for auth-failure patterns and auto-suspends users
 * when the pattern looks like account-takeover or automated credential stuffing.
 *
 * Pattern watched:
 *   10 failed auth attempts (login / password_reset / otp_verify) on the SAME
 *   email within a rolling 30-minute window, CORROBORATED by recent per-IP
 *   strikes in the same window.
 *
 * Targeted-lockout DoS mitigation: per-email failures alone are cheap to forge
 * once an attacker knows a victim's email (deliberately fail logins to trip the
 * lock). To avoid weaponizing the suspension, we require a corroborating signal
 * that this is broader automated abuse — at least one `ip_strike` row (recorded
 * by the per-IP rate limiter when a source floods auth endpoints) within the
 * window. A low-and-slow single-email lockout attempt that never floods an IP
 * therefore no longer forces a 24h hard lock. This uses only data already
 * tracked in `rateLimits` — no schema change.
 *
 * When detected:
 *   - Sets userProfiles.suspendedAt / suspendedReason / suspendedUntil
 *   - Admin gets an email via sendAdminNotificationEmail
 *   - Event recorded in rateLimits table for audit
 *
 * Called from `checkAuthRateLimit` whenever a per-email check REJECTS.
 * Lightweight: two reads + one optional write + scheduled email.
 */

import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { getUserByEmail } from "./lib/auth";
import { getUserSuspension, setSuspension } from "./lib/suspension";

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

    // Corroboration gate (targeted-lockout DoS mitigation): require at least one
    // recent per-IP strike. ip_strike rows are written by the per-IP rate limiter
    // when a source floods auth endpoints — their presence indicates automated/
    // distributed abuse rather than a cheap single-email lockout attempt. Without
    // this, an attacker who knows a victim's email could deliberately fail logins
    // to hard-lock the account for 24h.
    const recentIpStrikes = await ctx.db
      .query("rateLimits")
      .withIndex("by_timestamp", (q) => q.gte("timestamp", windowStart))
      .filter((q) => q.eq(q.field("action"), "ip_strike"))
      .first();
    if (!recentIpStrikes) {
      return { suspended: false, uncorroborated: true };
    }

    // Pattern matched. Find the user profile by email and auto-suspend.
    const user = await getUserByEmail(ctx, normalizedEmail);
    if (!user) return { suspended: false };

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .unique();
    if (!profile) return { suspended: false };

    // Skip if already suspended
    if (profile.suspendedAt) return { suspended: false, alreadySuspended: true };

    await ctx.db.patch(
      profile._id,
      setSuspension({
        atMs: now,
        reason: `auto: ${recent.length} auth failures in 30min`,
        untilMs: now + AUTO_SUSPEND_DURATION_MS,
      }),
    );

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

// Neutral, non-revealing reason returned to UNAUTHENTICATED callers. The real
// internal reason (e.g. "auto: N auth failures in 30min") leaks the lockout
// mechanics and is only ever exposed to admins via /admin/security.
const NEUTRAL_SUSPENSION_REASON = "locked";

/**
 * Public query for the client to check whether an email is currently
 * suspended. Called from the login form BEFORE signIn so we can show a
 * friendly "account temporarily locked" message instead of just 429-ing.
 *
 * Returns a MINIMAL, neutral shape — just `{ suspended }` plus a constant
 * `reason` code for telemetry. It intentionally does NOT return the internal
 * auto-generated reason or the suspend/until timestamps, both because those
 * leak the detection mechanics to anyone (this query is unauthenticated) and
 * because they sharpen the account-existence oracle.
 *
 * Account-existence trade-off: a `suspended: true` response still implies the
 * email has a profile. The leak is bounded: signup already returns "email
 * already in use", and Convex applies its own per-deployment query rate limit.
 * If oracle abuse is later observed, convert to a per-email rate-limited
 * mutation that returns a neutral response after N probes per window.
 */
export const checkEmailSuspension = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalizedEmail = email.toLowerCase().trim();
    if (!normalizedEmail) return { suspended: false as const, reason: null };
    const user = await getUserByEmail(ctx, normalizedEmail);
    if (!user) return { suspended: false as const, reason: null };
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .unique();
    const suspension = getUserSuspension(profile);
    if (!suspension) return { suspended: false as const, reason: null };
    return {
      suspended: true as const,
      reason: NEUTRAL_SUSPENSION_REASON,
    };
  },
});
