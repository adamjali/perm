/**
 * Auth Rate Limiting
 *
 * Pre-flight rate check mutations called by auth forms BEFORE
 * triggering signIn. Protects login, signup OTP, and password
 * reset endpoints from brute force.
 *
 * SOC 2 CC6 — Logical Access Controls
 */

import { mutation } from "./_generated/server";
import { v } from "convex/values";
import {
  checkAndRecordRateLimit,
  clearRateLimit,
  RATE_LIMITS,
  type RateLimitConfig,
} from "./lib/rateLimit";
import { getCurrentUserIdOrNull } from "./lib/auth";
import { internal } from "./_generated/api";
import { normalizeIp } from "./abuseBlocklist";

const ACTION_CONFIG: Record<string, RateLimitConfig> = {
  login: RATE_LIMITS.LOGIN,
  signup: RATE_LIMITS.OTP_VERIFY,
  otp_verify: RATE_LIMITS.OTP_VERIFY,
  password_reset: RATE_LIMITS.PASSWORD_RESET,
};

// Per-IP rate limits — complement (not replace) per-email limits. Per-email
// catches one attacker brute-forcing one account; per-IP catches one source
// firing at many unique emails (the signup-flood scenario).
//
// Caps sized for corporate NAT (50–100 seat offices sharing one public IP)
// while still stopping script floods. Windows are rolling, not calendar-aligned:
//   ip_auth  = 500 req / rolling 60 min / IP — sized for a 100-seat NAT's
//              login burst (~5 req/user incl. retries + password resets);
//              caps automated bots at 12k/day sustained
//   ip_chat  = 120 req / rolling 60 sec / IP = 2 msg/sec, already hyperactive
const IP_ACTION_CONFIG: Record<string, RateLimitConfig> = {
  ip_auth: { limit: 500, windowMs: 60 * 60 * 1000 }, // all /api/auth POSTs (signup/login/reset/otp)
  ip_chat: { limit: 120, windowMs: 60 * 1000 },       // /api/chat POSTs
};

/**
 * Check rate limit before auth action.
 * Call this BEFORE signIn() to enforce rate limiting.
 */
export const checkAuthRateLimit = mutation({
  args: {
    email: v.string(),
    action: v.union(
      v.literal("login"),
      v.literal("signup"),
      v.literal("otp_verify"),
      v.literal("password_reset")
    ),
  },
  handler: async (ctx, args) => {
    const config = ACTION_CONFIG[args.action];
    if (!config) {
      throw new Error(`Unknown auth action: ${args.action}`);
    }
    const result = await checkAndRecordRateLimit(
      ctx,
      args.email.toLowerCase(),
      args.action,
      config
    );

    // On rate-limit rejection for login/password_reset/otp_verify, record
    // the failure and potentially auto-suspend the target account.
    if (!result.allowed && args.action !== "signup") {
      await ctx.runMutation(internal.abuseDetection.recordAuthFailure, {
        email: args.email,
        action: args.action,
      });
    }

    return {
      allowed: result.allowed,
      remaining: result.remaining,
      retryAfterMs: result.resetInMs,
      message: result.message,
    };
  },
});

/**
 * Check rate limit for an action, keyed by client IP address.
 *
 * Complements `checkAuthRateLimit` (per-email): per-IP catches one source
 * hitting many unique emails, per-email catches repeat attempts on one
 * account. Both run in belt-and-suspenders fashion.
 *
 * Caller passes the IP explicitly — the mutation context doesn't see headers.
 * Callers should extract it from `x-forwarded-for` on the request side.
 */
export const checkIpRateLimit = mutation({
  args: {
    ip: v.string(),
    action: v.union(
      v.literal("ip_auth"),
      v.literal("ip_chat"),
    ),
  },
  handler: async (ctx, args) => {
    const config = IP_ACTION_CONFIG[args.action];
    if (!config) {
      throw new Error(`Unknown IP rate-limit action: ${args.action}`);
    }
    const firstIp = normalizeIp(args.ip);
    if (!firstIp) {
      // Unknown IP — fail open with limited allowance to avoid locking out
      // users with misconfigured proxies.
      return { allowed: true, remaining: 1, retryAfterMs: 0 };
    }

    // First, short-circuit if this IP is already in the abuse blocklist.
    // Reject early with a long retryAfter so the caller backs off.
    const blockRow = await ctx.db
      .query("abuseBlocklist")
      .withIndex("by_ip", (q) => q.eq("ip", firstIp))
      .unique();
    if (blockRow && blockRow.expiresAt > Date.now()) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: blockRow.expiresAt - Date.now(),
        message: "This IP is temporarily blocked due to repeated abuse.",
      };
    }

    const result = await checkAndRecordRateLimit(
      ctx,
      firstIp,
      args.action,
      config,
    );

    // If the rate limit just rejected this request, record a strike. After
    // N strikes in a short window, the IP moves to the blocklist automatically.
    if (!result.allowed) {
      await ctx.runMutation(internal.abuseBlocklist.recordStrike, {
        ip: firstIp,
        reason: `${args.action}_limit_tripped`,
      });
    }

    return {
      allowed: result.allowed,
      remaining: result.remaining,
      retryAfterMs: result.resetInMs,
      message: result.message,
    };
  },
});

/**
 * Clear rate limit after successful auth.
 * Call this after successful signIn to reset the counter.
 */
export const clearAuthRateLimit = mutation({
  args: {
    email: v.string(),
    action: v.union(
      v.literal("login"),
      v.literal("signup"),
      v.literal("otp_verify"),
      v.literal("password_reset")
    ),
  },
  handler: async (ctx, args) => {
    // Only allow clearing for authenticated users
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) return;
    await clearRateLimit(ctx, args.email.toLowerCase(), args.action);
  },
});
