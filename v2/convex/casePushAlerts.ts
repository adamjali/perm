import { v } from "convex/values";

import { internalMutation, internalQuery } from "./_generated/server";
import { checkAndRecordRateLimit } from "./lib/rateLimit";
import { normaliseFlagCaseNumber } from "../src/lib/flagCaseNumber";

/**
 * Browser push alerts for a case, for people with no account and no wish to
 * hand over an email address.
 *
 * The browser's PushSubscription is the delivery address: it names a browser,
 * carries no identity, and the person can revoke it in the browser or here.
 * The sweep runs twice a day beside the email sweep, reads the same status
 * tables, and sends one notification per change. A subscription taken out
 * the day after a change is seeded silently, exactly as the email alerts are,
 * so nobody is told about a transition that happened before they asked.
 *
 * Public endpoint checklist: the mutations are internal; the HTTP layer caps
 * lengths and hashes the address and the endpoint; shape checks run before
 * any limit is charged; a per-address limit raises the cost of abuse and the
 * global daily budget bounds the table however many addresses rotate; one
 * browser watches at most ten cases; GET is never a mutation.
 */

const PER_IP = { limit: 5, windowMs: 60 * 60 * 1000 };
const GLOBAL_BUDGET = { limit: 200, windowMs: 24 * 60 * 60 * 1000 };
const CASES_PER_BROWSER = 10;
/** Rows the sweep reads per run; more than this is a scale the sweep should be re-designed for, not a loop. */
const SWEEP_READ = 2000;
const CLOSE_AFTER_FAILURES = 5;

const result = v.object({ ok: v.boolean(), message: v.string(), throttled: v.optional(v.boolean()) });

/** The subscription JSON the browser hands back, narrowed to what web-push needs. */
export function parseSubscription(json: string): { endpoint: string; keys: { p256dh: string; auth: string } } | null {
  if (json.length > 2000) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const o = parsed as Record<string, unknown>;
  const keys = o.keys as Record<string, unknown> | undefined;
  if (typeof o.endpoint !== "string" || !o.endpoint.startsWith("https://") || o.endpoint.length > 1000) return null;
  if (!keys || typeof keys.p256dh !== "string" || typeof keys.auth !== "string" || keys.p256dh.length > 200 || keys.auth.length > 200) return null;
  return { endpoint: o.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

export const subscribe = internalMutation({
  args: {
    caseNumber: v.string(),
    subscription: v.string(),
    /** SHA-256 of the subscription endpoint, computed by the HTTP layer. */
    endpointHash: v.string(),
    /** SHA-256 of the forwarded address, computed by the HTTP layer. */
    ipHash: v.string(),
  },
  returns: result,
  handler: async (ctx, a) => {
    const ref = normaliseFlagCaseNumber(a.caseNumber);
    if (!ref) return { ok: false, message: "That does not look like a DOL case number." };
    const sub = parseSubscription(a.subscription);
    if (!sub) return { ok: false, message: "The browser did not hand back a usable subscription." };
    if (a.endpointHash.length !== 64 || a.ipHash.length !== 64) return { ok: false, message: "Malformed request." };

    const perIp = await checkAndRecordRateLimit(ctx, a.ipHash, "push-subscribe", PER_IP);
    if (!perIp.allowed) return { ok: false, throttled: true, message: "That is enough for one hour. Try again later." };

    const existing = await ctx.db
      .query("caseStatusPushAlerts")
      .withIndex("by_endpoint_case", (q) => q.eq("endpointHash", a.endpointHash).eq("caseNumber", ref.caseNumber))
      .first();
    if (existing && existing.closedAt === undefined) {
      return { ok: true, message: "This browser is already watching that case." };
    }

    const open = (await ctx.db.query("caseStatusPushAlerts").withIndex("by_endpoint", (q) => q.eq("endpointHash", a.endpointHash)).take(CASES_PER_BROWSER + 5)).filter(
      (r) => r.closedAt === undefined,
    );
    if (open.length >= CASES_PER_BROWSER) {
      return { ok: false, message: `One browser can watch ${CASES_PER_BROWSER} cases. Stop one to add another.` };
    }

    // The global budget is charged last of the checks and before the write:
    // a refusal here leaves nothing behind.
    const budget = await checkAndRecordRateLimit(ctx, "all", "push-subscribe-global", GLOBAL_BUDGET);
    if (!budget.allowed) return { ok: false, throttled: true, message: "New browser alerts are paused for today. Try again tomorrow." };

    if (existing) {
      // A browser that stopped and came back: reopen its own row with a fresh
      // baseline, so it is seeded again rather than told about the interval.
      await ctx.db.patch(existing._id, { closedAt: undefined, lastSeenStatus: undefined, subscription: a.subscription, failures: 0, createdAt: Date.now() });
      return { ok: true, message: "This browser will be notified when DOL's status for that case changes." };
    }
    await ctx.db.insert("caseStatusPushAlerts", {
      caseNumber: ref.caseNumber,
      subscription: a.subscription,
      endpointHash: a.endpointHash,
      createdAt: Date.now(),
      failures: 0,
    });
    return { ok: true, message: "This browser will be notified when DOL's status for that case changes." };
  },
});

export const stop = internalMutation({
  args: { endpointHash: v.string() },
  returns: v.object({ ok: v.boolean(), message: v.string(), closed: v.number() }),
  handler: async (ctx, a) => {
    if (a.endpointHash.length !== 64) return { ok: false, message: "Malformed request.", closed: 0 };
    const rows = await ctx.db.query("caseStatusPushAlerts").withIndex("by_endpoint", (q) => q.eq("endpointHash", a.endpointHash)).take(50);
    let closed = 0;
    const now = Date.now();
    for (const r of rows) {
      if (r.closedAt === undefined) {
        await ctx.db.patch(r._id, { closedAt: now });
        closed++;
      }
    }
    return { ok: true, message: closed > 0 ? "This browser will not be notified any more." : "This browser was not watching anything.", closed };
  },
});

const activeRow = v.object({
  _id: v.id("caseStatusPushAlerts"),
  caseNumber: v.string(),
  subscription: v.string(),
  lastSeenStatus: v.optional(v.string()),
  failures: v.number(),
});

export const activeRows = internalQuery({
  args: {},
  returns: v.array(activeRow),
  handler: async (ctx) => {
    const rows = await ctx.db.query("caseStatusPushAlerts").withIndex("by_closed", (q) => q.eq("closedAt", undefined)).take(SWEEP_READ);
    return rows.map((r) => ({ _id: r._id, caseNumber: r.caseNumber, subscription: r.subscription, lastSeenStatus: r.lastSeenStatus, failures: r.failures }));
  },
});

export const seed = internalMutation({
  args: { id: v.id("caseStatusPushAlerts"), status: v.string() },
  returns: v.null(),
  handler: async (ctx, a) => {
    await ctx.db.patch(a.id, { lastSeenStatus: a.status, lastCheckedAt: Date.now() });
    return null;
  },
});

export const markSeen = internalMutation({
  args: { id: v.id("caseStatusPushAlerts"), status: v.string(), close: v.boolean() },
  returns: v.null(),
  handler: async (ctx, a) => {
    await ctx.db.patch(a.id, { lastSeenStatus: a.status, lastCheckedAt: Date.now(), failures: 0, ...(a.close ? { closedAt: Date.now() } : {}) });
    return null;
  },
});

export const close = internalMutation({
  args: { id: v.id("caseStatusPushAlerts") },
  returns: v.null(),
  handler: async (ctx, a) => {
    await ctx.db.patch(a.id, { closedAt: Date.now() });
    return null;
  },
});

export const bumpFailure = internalMutation({
  args: { id: v.id("caseStatusPushAlerts") },
  returns: v.null(),
  handler: async (ctx, a) => {
    const row = await ctx.db.get(a.id);
    if (!row) return null;
    const failures = row.failures + 1;
    await ctx.db.patch(a.id, { failures, ...(failures >= CLOSE_AFTER_FAILURES ? { closedAt: Date.now() } : {}) });
    return null;
  },
});
