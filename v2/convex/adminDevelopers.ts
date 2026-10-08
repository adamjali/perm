import { v } from "convex/values";

import { internal } from "./_generated/api";
import { action, internalQuery } from "./_generated/server";
import { getAdminEmail } from "./lib/admin";
import { extractUserIdFromAction } from "./lib/auth";
import { apiPlan } from "./lib/apiPlans";
import { rows as mirrorRows } from "./lib/publicMirror";

/**
 * The admin page's Developers tab: who has an API account, on which plan, with
 * how many keys, and the calls each made, by day.
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
}
interface DayRow { day: string; keyed: number; mcp: number; extension: number; other: number }
interface SummaryOut {
  accounts: (AccountRow & { calls30d: number; callsYesterday: number })[];
  days: DayRow[];
  usageReadable: boolean;
}

export const accounts = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      account: v.string(),
      plan: v.string(),
      email: v.union(v.string(), v.null()),
      createdAt: v.number(),
      activeKeys: v.number(),
      revokedKeys: v.number(),
    }),
  ),
  handler: async (ctx): Promise<AccountRow[]> => {
    const out: AccountRow[] = [];
    for await (const a of ctx.db.query("apiAccounts")) {
      const user = await ctx.db.get(a.userId);
      const keys = await ctx.db
        .query("apiKeys")
        .withIndex("by_user", (q) => q.eq("userId", a.userId))
        .collect();
      out.push({
        account: a.account,
        plan: apiPlan(a.plan).label,
        email: user?.email ?? null,
        createdAt: a.createdAt,
        activeKeys: keys.filter((k) => k.revokedAt === undefined).length,
        revokedKeys: keys.filter((k) => k.revokedAt !== undefined).length,
      });
    }
    return out.sort((x, y) => y.createdAt - x.createdAt);
  },
});

export const summary = action({
  args: {},
  returns: v.object({
    accounts: v.array(
      v.object({
        account: v.string(),
        plan: v.string(),
        email: v.union(v.string(), v.null()),
        createdAt: v.number(),
        activeKeys: v.number(),
        revokedKeys: v.number(),
        calls30d: v.number(),
        callsYesterday: v.number(),
      }),
    ),
    /** Calls a day for the last 30 UTC days: keyed, and without a key by bucket. */
    days: v.array(v.object({ day: v.string(), keyed: v.number(), mcp: v.number(), extension: v.number(), other: v.number() })),
    usageReadable: v.boolean(),
  }),
  handler: async (ctx): Promise<SummaryOut> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized: Not authenticated");
    const userId = extractUserIdFromAction(identity.subject);
    const me = await ctx.runQuery(internal.admin.getUserEmail, { userId });
    if (!me || me.email !== getAdminEmail()) throw new Error("Unauthorized: Admin access required");

    const accts: AccountRow[] = await ctx.runQuery(internal.adminDevelopers.accounts, {});
    let usage: { day: string; account: string; key_id: string; calls: number }[] = [];
    let usageReadable = true;
    try {
      usage = (await mirrorRows(
        "SELECT day, account, key_id, calls FROM api_usage WHERE day >= date('now', '-30 day')",
      )).map((r) => ({ day: String(r.day), account: String(r.account), key_id: String(r.key_id), calls: Number(r.calls) || 0 }));
    } catch {
      usageReadable = false;
    }
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
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
    };
  },
});
