import { v } from "convex/values";

import { internalMutation, internalQuery } from "./_generated/server";
import { CATEGORIES, COUNTRIES } from "./bulletinAlerts";
import { parseSubscription } from "./casePushAlerts";
import { checkAndRecordRateLimit } from "./lib/rateLimit";
import { MS_PER_DAY, MS_PER_HOUR } from "./lib/time";

/**
 * A browser notification when a new visa bulletin is out, telling the reader what it did to their own line
 * (GreenCardClock offers one per bulletin; ours names the line's move). No account and no email: the
 * browser's PushSubscription is the delivery address, as for a case (casePushAlerts.ts, whose design and
 * public-endpoint checklist this follows). The sweep is bulletinPushAlertsSweep.ts.
 *
 * A browser that subscribes is seeded with the bulletin current at its first sweep, silently, so the first
 * notification is the NEXT bulletin. One browser follows at most LINES_PER_BROWSER lines.
 */

const PER_IP = { limit: 20, windowMs: MS_PER_HOUR };
export const GLOBAL_BUDGET = { limit: 1000, windowMs: MS_PER_DAY };
export const LINES_PER_BROWSER = 10;
const SWEEP_READ = 2000;
const CLOSE_AFTER_FAILURES = 5;
const ENDPOINT_READ = 2 * LINES_PER_BROWSER;

const result = v.object({ ok: v.boolean(), message: v.string(), throttled: v.optional(v.boolean()) });

const isCategory = (c: string): boolean => (CATEGORIES as readonly string[]).includes(c);
const isCountry = (c: string): boolean => (COUNTRIES as readonly string[]).includes(c);

export const subscribe = internalMutation({
  args: {
    category: v.string(),
    country: v.string(),
    subscription: v.string(),
    endpointHash: v.string(),
    ipHash: v.string(),
  },
  returns: result,
  handler: async (ctx, a) => {
    if (!isCategory(a.category) || !isCountry(a.country)) return { ok: false, message: "Pick a category and a country from the list." };
    if (!parseSubscription(a.subscription)) return { ok: false, message: "The browser did not hand back a usable subscription." };
    if (a.endpointHash.length !== 64 || a.ipHash.length !== 64) return { ok: false, message: "Malformed request." };

    const perIp = await checkAndRecordRateLimit(ctx, a.ipHash, "bulletin-push-subscribe", PER_IP);
    if (!perIp.allowed) return { ok: false, throttled: true, message: "That is enough for one hour. Try again later." };

    const existing = await ctx.db
      .query("bulletinPushAlerts")
      .withIndex("by_endpoint_line", (q) => q.eq("endpointHash", a.endpointHash).eq("category", a.category).eq("country", a.country))
      .first();
    if (existing && existing.closedAt === undefined) return { ok: true, message: "This browser already follows that line." };

    const open = (await ctx.db.query("bulletinPushAlerts").withIndex("by_endpoint", (q) => q.eq("endpointHash", a.endpointHash)).take(ENDPOINT_READ)).filter(
      (r) => r.closedAt === undefined,
    );
    if (open.length >= LINES_PER_BROWSER) return { ok: false, message: `One browser can follow ${LINES_PER_BROWSER} lines. Stop one to add another.` };

    // Charged last of the checks and before the write: a refusal leaves nothing behind.
    const budget = await checkAndRecordRateLimit(ctx, "all", "bulletin-push-subscribe-global", GLOBAL_BUDGET);
    if (!budget.allowed) return { ok: false, throttled: true, message: "New browser alerts are paused for today. Try again tomorrow." };

    const message = "This browser will be notified when the next visa bulletin is out, with what it did to this line.";
    if (existing) {
      // Back after stopping: a fresh baseline, so it's seeded again rather than told about the gap.
      await ctx.db.patch(existing._id, {
        closedAt: undefined, lastSeenBulletin: undefined, lastSeenCutoff: undefined, subscription: a.subscription, failures: 0, createdAt: Date.now(),
      });
      return { ok: true, message };
    }
    await ctx.db.insert("bulletinPushAlerts", {
      category: a.category, country: a.country, subscription: a.subscription, endpointHash: a.endpointHash, createdAt: Date.now(), failures: 0,
    });
    return { ok: true, message };
  },
});

/** Stop every bulletin line this browser follows. */
export const stop = internalMutation({
  args: { endpointHash: v.string() },
  returns: v.object({ ok: v.boolean(), message: v.string(), closed: v.number() }),
  handler: async (ctx, a) => {
    if (a.endpointHash.length !== 64) return { ok: false, message: "Malformed request.", closed: 0 };
    const rows = await ctx.db.query("bulletinPushAlerts").withIndex("by_endpoint", (q) => q.eq("endpointHash", a.endpointHash)).take(ENDPOINT_READ);
    let closed = 0;
    for (const r of rows) {
      if (r.closedAt === undefined) {
        await ctx.db.patch(r._id, { closedAt: Date.now() });
        closed++;
      }
    }
    return { ok: true, message: closed > 0 ? "This browser will not be notified of bulletins any more." : "This browser wasn't following a line.", closed };
  },
});

const activeRow = v.object({
  _id: v.id("bulletinPushAlerts"),
  category: v.string(),
  country: v.string(),
  subscription: v.string(),
  lastSeenBulletin: v.optional(v.string()),
  lastSeenCutoff: v.optional(v.string()),
});

/** One page of the open rows; the sweep walks every page. */
export const activeRows = internalQuery({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.object({ rows: v.array(activeRow), cursor: v.string(), isDone: v.boolean() }),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("bulletinPushAlerts")
      .withIndex("by_closed", (q) => q.eq("closedAt", undefined))
      .paginate({ numItems: SWEEP_READ, cursor: args.cursor });
    return {
      rows: page.page.map((r) => ({
        _id: r._id, category: r.category, country: r.country, subscription: r.subscription,
        lastSeenBulletin: r.lastSeenBulletin, lastSeenCutoff: r.lastSeenCutoff,
      })),
      cursor: page.continueCursor,
      isDone: page.isDone,
    };
  },
});

/** The bulletin current at a row's first sweep, recorded silently. */
export const seed = internalMutation({
  args: { id: v.id("bulletinPushAlerts"), month: v.string(), cutoff: v.string() },
  returns: v.null(),
  handler: async (ctx, a) => {
    await ctx.db.patch(a.id, { lastSeenBulletin: a.month, lastSeenCutoff: a.cutoff, lastCheckedAt: Date.now() });
    return null;
  },
});

/**
 * Claim a bulletin before telling a row about it: the row takes the new month now, so a second sweep at the
 * same moment finds nothing new. False when the row already holds this month or newer, or was closed.
 */
export const claim = internalMutation({
  args: { id: v.id("bulletinPushAlerts"), month: v.string(), cutoff: v.string() },
  returns: v.boolean(),
  handler: async (ctx, a) => {
    const row = await ctx.db.get(a.id);
    if (!row || row.closedAt !== undefined || (row.lastSeenBulletin !== undefined && row.lastSeenBulletin >= a.month)) return false;
    await ctx.db.patch(a.id, { lastSeenBulletin: a.month, lastSeenCutoff: a.cutoff, lastCheckedAt: Date.now() });
    return true;
  },
});

/** A claimed notification that couldn't go: put the old bulletin back so the next sweep tries again. */
export const unclaim = internalMutation({
  args: { id: v.id("bulletinPushAlerts"), claimed: v.string(), month: v.string(), cutoff: v.string() },
  returns: v.null(),
  handler: async (ctx, a) => {
    const row = await ctx.db.get(a.id);
    if (!row || row.lastSeenBulletin !== a.claimed) return null;
    await ctx.db.patch(a.id, { lastSeenBulletin: a.month, lastSeenCutoff: a.cutoff });
    return null;
  },
});

export const delivered = internalMutation({
  args: { id: v.id("bulletinPushAlerts") },
  returns: v.null(),
  handler: async (ctx, a) => {
    await ctx.db.patch(a.id, { failures: 0, lastCheckedAt: Date.now() });
    return null;
  },
});

export const close = internalMutation({
  args: { id: v.id("bulletinPushAlerts") },
  returns: v.null(),
  handler: async (ctx, a) => {
    await ctx.db.patch(a.id, { closedAt: Date.now() });
    return null;
  },
});

export const bumpFailure = internalMutation({
  args: { id: v.id("bulletinPushAlerts") },
  returns: v.null(),
  handler: async (ctx, a) => {
    const row = await ctx.db.get(a.id);
    if (!row) return null;
    const failures = row.failures + 1;
    await ctx.db.patch(a.id, { failures, ...(failures >= CLOSE_AFTER_FAILURES ? { closedAt: Date.now() } : {}) });
    return null;
  },
});
