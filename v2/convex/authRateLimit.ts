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
import { normalizeIp, findActiveBlock } from "./abuseBlocklist";
import { recordError } from "./lib/errorRecording";

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
 * Pre-flight rate limit. Call BEFORE signIn() so the counter increments on
 * the attempt itself, not on the response.
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
    // the failure and potentially auto-suspend the target account. Try-wrapped:
    // the rate-limit VERDICT (result.allowed) is the security-load-bearing value
    // and must be returned even if this audit/suspend bookkeeping throws. Without
    // the wrap, a throw here rolls back the whole mutation → caller's catch fails
    // open → a bookkeeping bug silently inverts a REJECT into an ALLOW.
    if (!result.allowed && args.action !== "signup") {
      try {
        await ctx.runMutation(internal.abuseDetection.recordAuthFailure, {
          email: args.email,
          action: args.action,
        });
      } catch (error) {
        await recordError(ctx, "mutation", "authRateLimit.recordAuthFailure", error);
      }
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
    // Per-request fail-open when no trustworthy IP is present. Callers pass the
    // literal "unknown" when getClientIp() can't resolve an IP (local dev /
    // missing headers); normalizeIp("unknown") is truthy, so without this guard
    // all such traffic would share ONE real `ip_auth:unknown` / `ip_chat:unknown`
    // bucket — collectively lockable, and an attacker could dodge per-IP limits
    // by forcing an empty header. Treat both the empty case and the "unknown"
    // sentinel as a non-enforced pass-through. Returns remaining: 0 so callers
    // don't cache a bogus headroom signal — this is "we can't enforce", not a
    // real allowance.
    if (!firstIp || firstIp === "unknown") {
      return { allowed: true, remaining: 0, retryAfterMs: 0 };
    }

    // First, short-circuit if this IP is already in the abuse blocklist.
    // Reject early with a long retryAfter so the caller backs off.
    const blockRow = await findActiveBlock(ctx, firstIp);
    if (blockRow) {
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
    // Try-wrapped for the same reason as recordAuthFailure above: a throw in the
    // strike recorder must not roll back the rate-limit verdict (which would make
    // the caller fail open and turn a REJECT into an ALLOW).
    if (!result.allowed) {
      try {
        await ctx.runMutation(internal.abuseBlocklist.recordStrike, {
          ip: firstIp,
          reason: `${args.action}_limit_tripped`,
        });
      } catch (error) {
        await recordError(ctx, "mutation", "authRateLimit.recordStrike", error);
      }
    }

    return {
      allowed: result.allowed,
      remaining: result.remaining,
      retryAfterMs: result.resetInMs,
      message: result.message,
    };
  },
});

/** Reset the per-email counter after a successful signIn. */
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
    // Ownership check: an authenticated user may only clear THEIR OWN email's
    // counter. Without this, any logged-in user could wipe a victim's per-email
    // brute-force counter and defeat the login rate limit. Resolve the email
    // from the users table (identity.email is empty for password-auth users).
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) return;
    const user = await ctx.db.get(userId);
    const ownEmail = user?.email?.toLowerCase().trim();
    const requested = args.email.toLowerCase().trim();
    if (!ownEmail || ownEmail !== requested) return;
    await clearRateLimit(ctx, requested, args.action);
  },
});
