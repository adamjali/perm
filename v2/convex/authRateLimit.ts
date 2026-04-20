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

const ACTION_CONFIG: Record<string, RateLimitConfig> = {
  login: RATE_LIMITS.LOGIN,
  signup: RATE_LIMITS.OTP_VERIFY,
  otp_verify: RATE_LIMITS.OTP_VERIFY,
  password_reset: RATE_LIMITS.PASSWORD_RESET,
};

// Per-IP rate limits — complement (not replace) per-email limits. Per-email
// catches one attacker brute-forcing one account; per-IP catches one source
// firing at many unique emails (the signup-flood scenario).
// Conservative defaults: tuned for normal human behavior from shared NAT/VPN
// while still blocking script-flood patterns.
const IP_ACTION_CONFIG: Record<string, RateLimitConfig> = {
  ip_signup: { limit: 10, windowMs: 60 * 60 * 1000 },         // 10/hr
  ip_login: { limit: 20, windowMs: 60 * 1000 },               // 20/min
  ip_password_reset: { limit: 10, windowMs: 60 * 60 * 1000 }, // 10/hr
  ip_otp_verify: { limit: 10, windowMs: 60 * 60 * 1000 },     // 10/hr
  ip_chat: { limit: 30, windowMs: 60 * 1000 },                // 30/min
  ip_turnstile_verify: { limit: 20, windowMs: 60 * 1000 },    // 20/min
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
      v.literal("ip_signup"),
      v.literal("ip_login"),
      v.literal("ip_password_reset"),
      v.literal("ip_otp_verify"),
      v.literal("ip_chat"),
      v.literal("ip_turnstile_verify"),
    ),
  },
  handler: async (ctx, args) => {
    const config = IP_ACTION_CONFIG[args.action];
    if (!config) {
      throw new Error(`Unknown IP rate-limit action: ${args.action}`);
    }
    // Normalize the IP (trim, lowercase, take first if comma-joined list from proxy chain)
    const rawIp = args.ip.trim().toLowerCase();
    const firstIp = rawIp.split(",")[0]?.trim() ?? rawIp;
    if (!firstIp) {
      // Unknown IP — fail open with limited allowance to avoid locking out
      // users with misconfigured proxies.
      return { allowed: true, remaining: 1, retryAfterMs: 0 };
    }
    const result = await checkAndRecordRateLimit(
      ctx,
      firstIp,
      args.action,
      config,
    );
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
