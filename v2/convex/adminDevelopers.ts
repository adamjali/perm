import { v } from "convex/values";

import { internal } from "./_generated/api";
import { action, internalQuery } from "./_generated/server";
import { getAdminEmail } from "./lib/admin";
import { extractUserIdFromAction } from "./lib/auth";
import { keyCounts, keyWorks, type KeyCounts } from "./lib/apiKeyStats";
import { API_LIVE_DAILY_CAP, apiPlan } from "./lib/apiPlans";
import { rows as mirrorRows } from "./lib/publicMirror";
import { MS_PER_DAY } from "./lib/time";
import { webhookHealth } from "./webhookDelivery";

/**
 * The admin page's Developers tab: who has an API account, on which plan, with
 * how many keys, endpoints and watches, and the calls each made, by day; the
 * working keys by scope, webhook health, and live DOL lookups against the
 * API-wide ceiling.
 *
 * Calls are counted in the public-data database (`api_usage`) under each
 * account's random id; who an account belongs to lives only here, in Convex.
 * This joins the two for the admin alone. An action because reading the
 * public-data database is a network call; the admin check is `sendAdminEmail`'s.
 */

interface AccountRow {
  account: string;
  plan: string;
  email: string | null;
  createdAt: number;
  activeKeys: number;
  revokedKeys: number;
  sandboxKeys: number;
  endpoints: number;
  pausedEndpoints: number;
  watches: number;
}
interface DayRow { day: string; keyed: number; mcp: number; extension: number; other: number }
interface WebhookHealth {
  endpoints: number;
  paused: number;
  pending: number;
  held: number;
  deliveredSince: number;
  failedSince: number;
  watches: number;
}
interface LiveLookups { today: number; yesterday: number; ceiling: number; readable: boolean }
interface AccountsOut { accounts: AccountRow[]; keys: KeyCounts; webhooks: WebhookHealth }
interface SummaryOut extends Omit<AccountsOut, "accounts"> {
  accounts: (AccountRow & { calls30d: number; callsYesterday: number })[];
  days: DayRow[];
  usageReadable: boolean;
  live: LiveLookups;
}

const accountFields = {
  account: v.string(),
  plan: v.string(),
  email: v.union(v.string(), v.null()),
  createdAt: v.number(),
  activeKeys: v.number(),
  revokedKeys: v.number(),
  sandboxKeys: v.number(),
  endpoints: v.number(),
  pausedEndpoints: v.number(),
  watches: v.number(),
};
const keyCountsV = v.object({
  live: v.number(),
  sandbox: v.number(),
  byScope: v.object({ read: v.number(), export: v.number(), live_lookup: v.number(), webhooks: v.number(), cases_read: v.number() }),
});
const healthV = v.object({
  endpoints: v.number(),
  paused: v.number(),
  pending: v.number(),
  held: v.number(),
  deliveredSince: v.number(),
  failedSince: v.number(),
  watches: v.number(),
});

/** `now` comes from the caller, an action, so the query reads no clock. */
export const accounts = internalQuery({
  args: { now: v.number() },
  returns: v.object({ accounts: v.array(v.object(accountFields)), keys: keyCountsV, webhooks: healthV }),
  handler: async (ctx, args): Promise<AccountsOut> => {
    const out: AccountRow[] = [];
    const allKeys = [];
    for await (const a of ctx.db.query("apiAccounts")) {
      const user = await ctx.db.get(a.userId);
      const keys = await ctx.db
        .query("apiKeys")
        .withIndex("by_user", (q) => q.eq("userId", a.userId))
        .collect();
      allKeys.push(...keys);
      const endpoints = await ctx.db
        .query("webhookEndpoints")
        .withIndex("by_account", (q) => q.eq("account", a.account))
        .take(50);
      const watches = await ctx.db
        .query("webhookWatches")
        .withIndex("by_account", (q) => q.eq("account", a.account))
        .take(5000);
      const working = keys.filter((k) => keyWorks(k, args.now));
      out.push({
        account: a.account,
        plan: apiPlan(a.plan).label,
        email: user?.email ?? null,
        createdAt: a.createdAt,
        activeKeys: working.filter((k) => !k.sandbox).length,
        revokedKeys: keys.filter((k) => k.revokedAt !== undefined).length,
        sandboxKeys: working.filter((k) => k.sandbox).length,
        endpoints: endpoints.length,
        pausedEndpoints: endpoints.filter((e) => e.pausedAt !== undefined).length,
        watches: watches.length,
      });
    }
    return {
      accounts: out.sort((x, y) => y.createdAt - x.createdAt),
      keys: keyCounts(allKeys, args.now),
      webhooks: await webhookHealth(ctx, args.now - MS_PER_DAY),
    };
  },
});

/** Live DOL lookups asked through the API on a UTC day, every account together (src/lib/api/live.ts). */
async function liveAsked(day: string): Promise<number> {
  const r = await mirrorRows(`SELECT json_extract(json, '$."all"') AS n FROM perm_docs WHERE key = ?`, [`api_live_${day}`]);
  return Number(r[0]?.n) || 0;
}

export const summary = action({
  args: {},
  returns: v.object({
    accounts: v.array(v.object({ ...accountFields, calls30d: v.number(), callsYesterday: v.number() })),
    /** Calls a day for the last 30 UTC days: keyed, and without a key by bucket. */
    days: v.array(v.object({ day: v.string(), keyed: v.number(), mcp: v.number(), extension: v.number(), other: v.number() })),
    usageReadable: v.boolean(),
    /** Working keys, live and sandbox, by scope. */
    keys: keyCountsV,
    /** Endpoints, paused ones, deliveries waiting or held, and the last 24 hours. */
    webhooks: healthV,
    /** Live DOL lookups asked through the API today and yesterday (UTC), against the ceiling. */
    live: v.object({ today: v.number(), yesterday: v.number(), ceiling: v.number(), readable: v.boolean() }),
  }),
  handler: async (ctx): Promise<SummaryOut> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized: Not authenticated");
    const userId = extractUserIdFromAction(identity.subject);
    const me = await ctx.runQuery(internal.admin.getUserEmail, { userId });
    if (!me || me.email !== getAdminEmail()) throw new Error("Unauthorized: Admin access required");

    const now = Date.now();
    const { accounts: accts, keys, webhooks }: AccountsOut = await ctx.runQuery(internal.adminDevelopers.accounts, { now });
    const live: LiveLookups = { today: 0, yesterday: 0, ceiling: API_LIVE_DAILY_CAP, readable: true };
    try {
      live.today = await liveAsked(new Date(now).toISOString().slice(0, 10));
      live.yesterday = await liveAsked(new Date(now - MS_PER_DAY).toISOString().slice(0, 10));
    } catch {
      live.readable = false;
    }
    let usage: { day: string; account: string; key_id: string; calls: number }[] = [];
    let usageReadable = true;
    try {
      usage = (await mirrorRows(
        "SELECT day, account, key_id, calls FROM api_usage WHERE day >= date('now', '-30 day')",
      )).map((r) => ({ day: String(r.day), account: String(r.account), key_id: String(r.key_id), calls: Number(r.calls) || 0 }));
    } catch {
      usageReadable = false;
    }
    const yesterday = new Date(now - MS_PER_DAY).toISOString().slice(0, 10);
    const byDay = new Map<string, DayRow>();
    for (const r of usage) {
      const d = byDay.get(r.day) ?? { day: r.day, keyed: 0, mcp: 0, extension: 0, other: 0 };
      if (r.account !== "anonymous") d.keyed += r.calls;
      else if (r.key_id === "mcp") d.mcp += r.calls;
      // The browser extension's keyless employer lookup (src/app/v1/lookup/employer).
      else if (r.key_id === "extension") d.extension += r.calls;
      else d.other += r.calls;
      byDay.set(r.day, d);
    }
    return {
      accounts: accts.map((a) => ({
        ...a,
        calls30d: usage.filter((r) => r.account === a.account).reduce((n, r) => n + r.calls, 0),
        callsYesterday: usage.filter((r) => r.account === a.account && r.day === yesterday).reduce((n, r) => n + r.calls, 0),
      })),
      days: [...byDay.values()].sort((a, b) => (a.day < b.day ? 1 : -1)),
      usageReadable,
      keys,
      webhooks,
      live,
    };
  },
});
