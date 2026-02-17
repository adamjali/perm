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

const ACTION_CONFIG: Record<string, RateLimitConfig> = {
  login: RATE_LIMITS.LOGIN,
  signup: RATE_LIMITS.OTP_VERIFY,
  otp_verify: RATE_LIMITS.OTP_VERIFY,
  password_reset: RATE_LIMITS.PASSWORD_RESET,
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
    await clearRateLimit(ctx, args.email.toLowerCase(), args.action);
  },
});
