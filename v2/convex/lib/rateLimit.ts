/**
 * Rate Limiting Library
 *
 * Provides sliding window rate limiting for sensitive operations.
 * Uses Convex internal tables to track request counts.
 *
 * Common limits:
 * - OTP verification: 5 attempts per 15 minutes
 * - Password reset: 3 requests per hour
 * - Login attempts: 10 per 15 minutes
 */

import { MutationCtx, QueryCtx } from "../_generated/server";

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  limit: number;
  /** Time window in milliseconds */
  windowMs: number;
}

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Number of remaining attempts */
  remaining: number;
  /** Time in ms until the limit resets */
  resetInMs: number;
  /** Error message if rate limited */
  message?: string;
}

/**
 * Predefined rate limit configurations
 */
export const RATE_LIMITS = {
  /** OTP verification: 5 attempts per 15 minutes */
  OTP_VERIFY: { limit: 5, windowMs: 15 * 60 * 1000 },
  /** Password reset request: 3 per hour */
  PASSWORD_RESET: { limit: 3, windowMs: 60 * 60 * 1000 },
  /** Login attempts: 10 per 15 minutes */
  LOGIN: { limit: 10, windowMs: 15 * 60 * 1000 },
  /** Email send: 5 per 10 minutes (prevent spam) */
  EMAIL_SEND: { limit: 5, windowMs: 10 * 60 * 1000 },
} as const;

/**
 * Generate a rate limit key for an identifier and action
 */
function getRateLimitKey(identifier: string, action: string): string {
  return `${action}:${identifier}`;
}

/**
 * Check rate limit for an action
 *
 * This is a lightweight in-memory check using Convex's system tables.
 * For production, consider using a dedicated rate limiting table.
 *
 * @param ctx - Query or mutation context
 * @param identifier - Unique identifier (email, IP, user ID)
 * @param action - Action being rate limited
 * @param config - Rate limit configuration
 * @returns Rate limit check result
 */
export async function checkRateLimit(
  ctx: QueryCtx | MutationCtx,
  identifier: string,
  action: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const key = getRateLimitKey(identifier, action);
  const now = Date.now();
  const windowStart = now - config.windowMs;

  // Query recent attempts from rate limit table
  const attempts = await ctx.db
    .query("rateLimits")
    .withIndex("by_key_and_timestamp", (q) =>
      q.eq("key", key).gte("timestamp", windowStart)
    )
    .collect();

  const attemptCount = attempts.length;
  const remaining = Math.max(0, config.limit - attemptCount);
  const oldestAttempt = attempts[0]?.timestamp ?? now;
  const resetInMs = Math.max(0, oldestAttempt + config.windowMs - now);

  if (attemptCount >= config.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetInMs,
      message: `Too many requests. Please try again in ${Math.ceil(resetInMs / 1000 / 60)} minutes.`,
    };
  }

  return {
    allowed: true,
    remaining: remaining - 1, // Account for this attempt
    resetInMs,
  };
}

/**
 * Record a rate limit attempt
 * Call this AFTER checking rate limit to record the attempt
 *
 * @param ctx - Mutation context
 * @param identifier - Unique identifier (email, IP, user ID)
 * @param action - Action being rate limited
 */
export async function recordRateLimitAttempt(
  ctx: MutationCtx,
  identifier: string,
  action: string
): Promise<void> {
  const key = getRateLimitKey(identifier, action);

  await ctx.db.insert("rateLimits", {
    key,
    timestamp: Date.now(),
    identifier,
    action,
  });
}

/**
 * Check and record rate limit in one operation
 * Use this for convenience when you want to check and record atomically
 *
 * @param ctx - Mutation context
 * @param identifier - Unique identifier (email, IP, user ID)
 * @param action - Action being rate limited
 * @param config - Rate limit configuration
 * @returns Rate limit check result
 */
export async function checkAndRecordRateLimit(
  ctx: MutationCtx,
  identifier: string,
  action: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const result = await checkRateLimit(ctx, identifier, action, config);

  if (result.allowed) {
    await recordRateLimitAttempt(ctx, identifier, action);
  }

  return result;
}

/**
 * Clear rate limit records for an identifier and action
 * Use after successful authentication to reset failed attempt counters
 *
 * @param ctx - Mutation context
 * @param identifier - Unique identifier (email, IP, user ID)
 * @param action - Action to clear
 */
export async function clearRateLimit(
  ctx: MutationCtx,
  identifier: string,
  action: string
): Promise<void> {
  const key = getRateLimitKey(identifier, action);

  const records = await ctx.db
    .query("rateLimits")
    .withIndex("by_key_and_timestamp", (q) => q.eq("key", key))
    .collect();

  // Delete all records for this key
  for (const record of records) {
    await ctx.db.delete(record._id);
  }
}

/**
 * Cleanup old rate limit records
 * Should be run periodically to prevent table bloat
 *
 * @param ctx - Mutation context
 * @param maxAgeMs - Maximum age of records to keep (default: 24 hours)
 */
export async function cleanupRateLimits(
  ctx: MutationCtx,
  maxAgeMs: number = 24 * 60 * 60 * 1000
): Promise<number> {
  const cutoff = Date.now() - maxAgeMs;

  const oldRecords = await ctx.db
    .query("rateLimits")
    .filter((q) => q.lt(q.field("timestamp"), cutoff))
    .take(100); // Process in batches

  for (const record of oldRecords) {
    await ctx.db.delete(record._id);
  }

  return oldRecords.length;
}
