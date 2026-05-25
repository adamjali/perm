/**
 * Abuse blocklist — IPs that have been auto-banned (or manually banned by an
 * admin) from hitting our public HTTP endpoints.
 *
 * - Single `abuseBlocklist` table, keyed by normalized IP.
 * - `isIpBlocked()` returns { blocked, expiresAt, reason } for middleware.
 * - `recordStrike()` runs every time `checkIpRateLimit` REJECTS. After
 *   N strikes in a short window, the IP is auto-blocked for 24h.
 * - Admin mutations let you manually block, unblock, extend, or list entries.
 * - The `cleanupExpiredBlocks` cron scrubs stale rows so the table stays bounded.
 */

import { v } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
  internalQuery,
  type QueryCtx,
  type MutationCtx,
} from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requireAdmin } from "./lib/admin";

const AUTO_BLOCK_STRIKES = 3;              // # rate-limit rejections within window
const AUTO_BLOCK_WINDOW_MS = 15 * 60_000;  // 15-minute rolling window for strikes
const AUTO_BLOCK_DURATION_MS = 24 * 60 * 60_000; // 24h auto-ban

/**
 * Shared result shape for the block-mutating operations (recordStrike,
 * adminBlockIp, adminUnblockIp) so callers reason over one type instead of
 * three ad-hoc inline objects.
 *
 * - `blocked` — true iff the IP is now blocked (set by recordStrike/adminBlockIp).
 * - `unblocked` — true iff a block was removed (set by adminUnblockIp).
 * - `ip` — the normalized IP the operation acted on (admin ops echo it back).
 * - `strikes` — current strike count in the window (recordStrike only).
 * - `expiresAt` — when the active block lifts, epoch ms (present only when blocked).
 */
export interface BlockOutcome {
  blocked: boolean;
  unblocked?: boolean;
  ip?: string;
  strikes?: number;
  expiresAt?: number;
}

/** Normalize an IP so lookups are consistent across middleware/mutation paths. */
export function normalizeIp(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  return trimmed.split(",")[0]?.trim() ?? trimmed;
}

/**
 * Look up the blocklist row for a normalized IP — only returns it if the block
 * is currently active (expiresAt > now). Returns null on no row, expired row,
 * or unparseable IP. Use anywhere you need a "is this IP blocked right now"
 * gate; for raw access (admin tooling, debugging), use `getBlockInternal`.
 */
export async function findActiveBlock(
  ctx: QueryCtx | MutationCtx,
  ip: string,
): Promise<Doc<"abuseBlocklist"> | null> {
  const normalized = normalizeIp(ip);
  if (!normalized) return null;
  const row = await ctx.db
    .query("abuseBlocklist")
    .withIndex("by_ip", (q) => q.eq("ip", normalized))
    .unique();
  if (!row || row.expiresAt <= Date.now()) return null;
  return row;
}

/**
 * Check if an IP is currently blocked. Exposed as a public query so that
 * any path (middleware, admin UI, debugging) can read without mutating state.
 */
export const isIpBlocked = query({
  args: { ip: v.string() },
  handler: async (ctx, { ip }) => {
    const row = await findActiveBlock(ctx, ip);
    if (!row) return { blocked: false as const };
    return {
      blocked: true as const,
      expiresAt: row.expiresAt,
      reason: row.reason,
      manualOverride: row.manualOverride,
    };
  },
});

/**
 * Internal helper — record a rate-limit strike for this IP, and if we've
 * hit the auto-block threshold, add the IP to the blocklist. Safe to call
 * from the same mutation that's enforcing a rate limit.
 */
export const recordStrike = internalMutation({
  args: { ip: v.string(), reason: v.string() },
  handler: async (ctx, { ip, reason }): Promise<BlockOutcome> => {
    const normalized = normalizeIp(ip);
    if (!normalized) return { blocked: false };

    // Count how many recent strikes we already have for this IP. We reuse
    // the rateLimits table as a strike log so we don't need another table
    // just for counting.
    const now = Date.now();
    const windowStart = now - AUTO_BLOCK_WINDOW_MS;
    const key = `ip_strike:${normalized}`;
    const recent = await ctx.db
      .query("rateLimits")
      .withIndex("by_key_and_timestamp", (q) =>
        q.eq("key", key).gte("timestamp", windowStart),
      )
      .collect();
    const strikes = recent.length + 1;

    await ctx.db.insert("rateLimits", {
      key,
      timestamp: now,
      identifier: normalized,
      action: "ip_strike",
    });

    if (strikes < AUTO_BLOCK_STRIKES) {
      return { blocked: false, strikes };
    }

    // Upsert blocklist row
    const existing = await ctx.db
      .query("abuseBlocklist")
      .withIndex("by_ip", (q) => q.eq("ip", normalized))
      .unique();

    const expiresAt = now + AUTO_BLOCK_DURATION_MS;
    if (existing) {
      await ctx.db.patch(existing._id, {
        expiresAt: Math.max(existing.expiresAt, expiresAt),
        reason,
        strikes,
      });
    } else {
      await ctx.db.insert("abuseBlocklist", {
        ip: normalized,
        addedAt: now,
        expiresAt,
        reason,
        strikes,
        manualOverride: false,
      });
    }
    return { blocked: true, strikes, expiresAt };
  },
});

/** Admin: manually block an IP. */
export const adminBlockIp = mutation({
  args: {
    ip: v.string(),
    reason: v.string(),
    durationMs: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<BlockOutcome> => {
    await requireAdmin(ctx);
    const normalized = normalizeIp(args.ip);
    if (!normalized) throw new Error("Invalid IP");
    const now = Date.now();
    const expiresAt = now + (args.durationMs ?? AUTO_BLOCK_DURATION_MS);
    const existing = await ctx.db
      .query("abuseBlocklist")
      .withIndex("by_ip", (q) => q.eq("ip", normalized))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        expiresAt,
        reason: args.reason,
        manualOverride: true,
      });
      return { blocked: true, ip: normalized, expiresAt };
    }
    await ctx.db.insert("abuseBlocklist", {
      ip: normalized,
      addedAt: now,
      expiresAt,
      reason: args.reason,
      strikes: 0,
      manualOverride: true,
    });
    return { blocked: true, ip: normalized, expiresAt };
  },
});

/** Admin: remove an IP from the blocklist. */
export const adminUnblockIp = mutation({
  args: { ip: v.string() },
  handler: async (ctx, args): Promise<BlockOutcome> => {
    await requireAdmin(ctx);
    const normalized = normalizeIp(args.ip);
    const row = await ctx.db
      .query("abuseBlocklist")
      .withIndex("by_ip", (q) => q.eq("ip", normalized))
      .unique();
    if (row) {
      await ctx.db.delete(row._id);
      return { blocked: false, unblocked: true, ip: normalized };
    }
    return { blocked: false, unblocked: false, ip: normalized };
  },
});

/** Admin: list all currently-active blocklist entries, newest first. */
export const listActiveBlocks = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const now = Date.now();
    const rows = await ctx.db.query("abuseBlocklist").order("desc").take(500);
    return rows.filter((r) => r.expiresAt > now);
  },
});

/** Cron — scrub expired rows so the table stays bounded. */
export const cleanupExpiredBlocks = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    // Use <= to match findActiveBlock's expiry boundary (a row is "active" iff
    // expiresAt > now, so expiresAt <= now is expired and safe to delete). This
    // keeps the "expired" definition identical across the read gate and cleanup.
    const expired = await ctx.db
      .query("abuseBlocklist")
      .withIndex("by_expiresAt", (q) => q.lte("expiresAt", now))
      .take(500);
    let deleted = 0;
    for (const row of expired) {
      await ctx.db.delete(row._id);
      deleted++;
    }
    return { deleted };
  },
});

/** Internal: raw lookup for use inside other Convex functions. */
export const getBlockInternal = internalQuery({
  args: { ip: v.string() },
  handler: async (ctx, { ip }) => {
    const normalized = normalizeIp(ip);
    return await ctx.db
      .query("abuseBlocklist")
      .withIndex("by_ip", (q) => q.eq("ip", normalized))
      .unique();
  },
});
