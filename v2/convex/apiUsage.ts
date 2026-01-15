/**
 * API Usage Tracking Functions
 *
 * Tracks and enforces daily rate limits for external search API providers.
 * This module prevents exceeding API quotas by tracking usage per provider per day.
 *
 * INTERNAL MUTATIONS (server-side only):
 * - trackUsage: Increment usage counter for provider+date (upsert)
 * - getUsageInternal: Get today's count for internal rate limit checks
 *
 * PUBLIC QUERIES (for UI display):
 * - getUsage: Get today's count for a provider
 * - getDailyLimits: Get configured limits for all providers
 *
 * @module apiUsage
 */

import { query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

/**
 * Configured daily limits for each provider.
 * These are set conservatively below actual API limits to provide a safety margin.
 *
 * Actual limits:
 * - Tavily: ~33/day (1000/month free tier)
 * - Brave: ~66/day (2000/month free tier)
 *
 * Safe margins applied:
 * - Tavily: 30/day (90% of limit)
 * - Brave: 60/day (90% of limit)
 */
export const DAILY_LIMITS = {
  tavily: 30,
  brave: 60,
} as const;

/**
 * Get today's date in UTC as YYYY-MM-DD string.
 * Uses UTC to avoid timezone issues across server instances.
 */
function getTodayUTC(): string {
  const now = new Date();
  return now.toISOString().split("T")[0]!;
}

// ============================================================================
// INTERNAL FUNCTIONS (called from other server code, not exposed to client)
// ============================================================================

/**
 * Track API usage for a provider (internal use only).
 *
 * Upserts the usage record: creates if not exists, increments if exists.
 * Called from search actions after each API call.
 *
 * @param provider - The API provider name ("tavily" | "brave")
 * @returns The updated usage count for today
 */
export const trackUsage = internalMutation({
  args: {
    provider: v.string(),
  },
  handler: async (ctx, { provider }): Promise<number> => {
    const date = getTodayUTC();

    // Try to find existing record for this provider+date
    const existing = await ctx.db
      .query("apiUsage")
      .withIndex("by_provider_date", (q) =>
        q.eq("provider", provider).eq("date", date)
      )
      .unique();

    if (existing) {
      // Increment existing counter
      const newCount = existing.count + 1;
      await ctx.db.patch(existing._id, { count: newCount });
      return newCount;
    } else {
      // Create new record with count of 1
      await ctx.db.insert("apiUsage", {
        provider,
        date,
        count: 1,
      });
      return 1;
    }
  },
});

/**
 * Get today's usage count for a provider (internal use only).
 *
 * Used by search actions to check rate limits before making API calls.
 * Returns 0 if no usage record exists for today.
 *
 * @param provider - The API provider name ("tavily" | "brave")
 * @returns Today's usage count for the provider
 */
export const getUsageInternal = internalQuery({
  args: {
    provider: v.string(),
  },
  handler: async (ctx, { provider }): Promise<number> => {
    const date = getTodayUTC();

    const record = await ctx.db
      .query("apiUsage")
      .withIndex("by_provider_date", (q) =>
        q.eq("provider", provider).eq("date", date)
      )
      .unique();

    return record?.count ?? 0;
  },
});

// ============================================================================
// PUBLIC QUERIES (exposed to client for UI display)
// ============================================================================

/**
 * Get today's usage count for a provider.
 *
 * Used by the UI to display current usage levels.
 * No authentication required as this is aggregate data.
 *
 * @param provider - The API provider name ("tavily" | "brave")
 * @returns Today's usage count for the provider
 */
export const getUsage = query({
  args: {
    provider: v.string(),
  },
  handler: async (ctx, { provider }): Promise<number> => {
    const date = getTodayUTC();

    const record = await ctx.db
      .query("apiUsage")
      .withIndex("by_provider_date", (q) =>
        q.eq("provider", provider).eq("date", date)
      )
      .unique();

    return record?.count ?? 0;
  },
});

/**
 * Get configured daily limits for all providers.
 *
 * Returns the safe limits configured for each provider.
 * Used by the UI to display usage vs limits.
 *
 * @returns Object mapping provider names to their daily limits
 */
export const getDailyLimits = query({
  args: {},
  handler: async (): Promise<Record<string, number>> => {
    return { ...DAILY_LIMITS };
  },
});
