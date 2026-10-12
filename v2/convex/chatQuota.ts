/**
 * One account's chat turns, asked by the chat route before it calls the AI.
 *
 * The AI providers' free quotas are shared by every account, so a per-account
 * limit is what keeps one person's runaway script from spending everyone's
 * (the route also has a per-address limit). Both buckets live in
 * rateLimitConfig: `chatTurn` per hour, `chatTurnDaily` per day. The daily
 * window is checked before either is charged, so a refused turn spends nothing.
 *
 * @module convex/chatQuota
 */
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUserId } from "./lib/auth";
import { rateLimiter } from "./rateLimitConfig";

export const takeTurn = mutation({
  args: {},
  returns: v.union(
    v.object({ ok: v.literal(true) }),
    v.object({
      ok: v.literal(false),
      window: v.union(v.literal("hour"), v.literal("day")),
      retryAfterMs: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getCurrentUserId(ctx);
    const daily = await rateLimiter.check(ctx, "chatTurnDaily", { key: userId });
    if (!daily.ok) return { ok: false as const, window: "day" as const, retryAfterMs: daily.retryAfter ?? 0 };
    const hourly = await rateLimiter.limit(ctx, "chatTurn", { key: userId });
    if (!hourly.ok) return { ok: false as const, window: "hour" as const, retryAfterMs: hourly.retryAfter ?? 0 };
    await rateLimiter.limit(ctx, "chatTurnDaily", { key: userId });
    return { ok: true as const };
  },
});
