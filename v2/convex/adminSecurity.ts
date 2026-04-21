/**
 * Admin-only queries/mutations powering /admin/security.
 *
 * All functions require admin via requireAdmin() / getAdminProfile().
 * Read-only queries for dashboard views + mutations for manual override.
 */

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAdmin } from "./lib/admin";
import { normalizeIp } from "./abuseBlocklist";

/**
 * Aggregate summary numbers for the dashboard's top-of-page KPI cards.
 * Single round-trip — computed in one query to avoid multiple waterfalls.
 */
export const getSecuritySummary = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;

    // Active blocklist entries (expiresAt > now)
    const allBlocks = await ctx.db.query("abuseBlocklist").take(500);
    const activeBlocks = allBlocks.filter((b) => b.expiresAt > now);

    // Rate-limit rejections in last 24h — we keyed strikes under
    // "ip_strike:<ip>" so filter for that action prefix.
    const recentStrikes = await ctx.db
      .query("rateLimits")
      .withIndex("by_timestamp", (q) => q.gte("timestamp", dayAgo))
      .take(4000);
    const strikeHits = recentStrikes.filter((r) => r.action === "ip_strike").length;

    // System errors that might indicate abuse cascade
    const recentErrors = await ctx.db
      .query("systemErrors")
      .withIndex("by_created_at", (q) => q.gte("createdAt", dayAgo))
      .take(500);

    // Flagged users (profile.suspendedAt is present)
    const allProfiles = await ctx.db.query("userProfiles").take(500);
    const flaggedCount = allProfiles.filter(
      (p) => "suspendedAt" in p && (p as unknown as { suspendedAt?: number }).suspendedAt,
    ).length;

    return {
      activeBlockedIps: activeBlocks.length,
      strikeHitsLast24h: strikeHits,
      systemErrorsLast24h: recentErrors.length,
      flaggedUsers: flaggedCount,
      generatedAt: now,
    };
  },
});

/**
 * Recent security events — unions strikes + systemErrors, newest first.
 * Client-side filtering by category keeps the query simple.
 */
export const listRecentEvents = query({
  args: {
    limit: v.optional(v.number()),
    sinceMs: v.optional(v.number()), // e.g., 24 * 60 * 60 * 1000 = last 24h
  },
  handler: async (ctx, { limit = 200, sinceMs = 72 * 60 * 60 * 1000 }) => {
    await requireAdmin(ctx);
    const cap = Math.min(Math.max(limit, 1), 500);
    const cutoff = Date.now() - sinceMs;

    // Rate-limit strikes
    const strikes = await ctx.db
      .query("rateLimits")
      .withIndex("by_timestamp", (q) => q.gte("timestamp", cutoff))
      .order("desc")
      .take(cap);

    // System errors
    const errors = await ctx.db
      .query("systemErrors")
      .withIndex("by_created_at", (q) => q.gte("createdAt", cutoff))
      .order("desc")
      .take(cap);

    // Normalize into a common event shape
    type Event = {
      id: string;
      at: number;
      kind: "rate_limit" | "error" | "strike";
      ip?: string;
      actor?: string;
      endpoint?: string;
      reason?: string;
      severity: "info" | "warning" | "error";
    };

    const events: Event[] = [];

    for (const s of strikes) {
      events.push({
        id: `rl_${s._id}`,
        at: s.timestamp,
        kind: s.action === "ip_strike" ? "strike" : "rate_limit",
        ip: s.action.startsWith("ip_") ? s.identifier : undefined,
        actor: s.action.startsWith("ip_") ? undefined : s.identifier,
        endpoint: s.action,
        reason: s.key,
        severity: s.action === "ip_strike" ? "warning" : "info",
      });
    }

    for (const e of errors) {
      events.push({
        id: `se_${e._id}`,
        at: e.createdAt,
        kind: "error",
        endpoint: e.operation,
        reason: e.message,
        severity: "error",
      });
    }

    events.sort((a, b) => b.at - a.at);
    return events.slice(0, cap);
  },
});

/**
 * Users flagged for unusual activity. Returns minimal profile + suspension context.
 */
export const listFlaggedUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const profiles = await ctx.db.query("userProfiles").take(500);
    type P = (typeof profiles)[number] & {
      suspendedAt?: number;
      suspendedReason?: string;
      suspendedUntil?: number;
    };
    const flagged = (profiles as P[]).filter((p) => p.suspendedAt);
    // Hydrate with user email
    const enriched = await Promise.all(
      flagged.map(async (p) => {
        const user = await ctx.db.get(p.userId);
        return {
          profileId: p._id,
          userId: p.userId,
          email: user?.email ?? null,
          suspendedAt: p.suspendedAt,
          suspendedUntil: p.suspendedUntil,
          suspendedReason: p.suspendedReason,
        };
      }),
    );
    enriched.sort((a, b) => (b.suspendedAt ?? 0) - (a.suspendedAt ?? 0));
    return enriched;
  },
});

/** Admin: clear a user suspension. */
export const adminUnsuspendUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireAdmin(ctx);
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();
    if (!profile) throw new Error("User profile not found");
    await ctx.db.patch(profile._id, {
      suspendedAt: undefined,
      suspendedReason: undefined,
      suspendedUntil: undefined,
    });
    return { ok: true };
  },
});

/** Admin: manually suspend a user. Used from the flagged-users tab's override. */
export const adminSuspendUser = mutation({
  args: {
    userId: v.id("users"),
    reason: v.string(),
    durationMs: v.optional(v.number()),
  },
  handler: async (ctx, { userId, reason, durationMs }) => {
    await requireAdmin(ctx);
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();
    if (!profile) throw new Error("User profile not found");
    const now = Date.now();
    await ctx.db.patch(profile._id, {
      suspendedAt: now,
      suspendedReason: reason,
      suspendedUntil: durationMs ? now + durationMs : undefined,
    });
    return { ok: true };
  },
});

/** Echo: normalize helper for admin UIs that want to preview an IP lookup. */
export const previewIpNormalization = query({
  args: { ip: v.string() },
  handler: async (ctx, { ip }) => {
    await requireAdmin(ctx);
    return { normalized: normalizeIp(ip) };
  },
});
