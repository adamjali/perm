/**
 * The admin panel's view of alert email: how much of each daily budget is
 * spent, who each one turned away this week, what is waiting in the outbox
 * and what went out, and which employers people follow.
 *
 * Every figure answers a question Adam asked on Sep 25 2026: are the alerts
 * working, and is it time to move off Resend's free plan. A pool that refused
 * anyone is the second answer.
 *
 * SECURITY: requireAdmin(); the rows carry subscriber addresses.
 *
 * @module convex/adminDelivery
 */

import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireAdmin } from "./lib/admin";
import { BUDGETS, type BudgetName } from "./lib/alertBudgets";
import { etDay } from "./lib/alertDelivery";

const DAY_MS = 86_400_000;

const kindValidator = v.union(v.literal("case"), v.literal("queue"), v.literal("bulletin"), v.literal("employer"));

export const getDelivery = query({
  args: {},
  returns: v.object({
    pools: v.array(
      v.object({
        name: v.string(),
        label: v.string(),
        limit: v.number(),
        usedLast24h: v.number(),
        refusedLast7d: v.number(),
      }),
    ),
    refusalDays: v.array(v.object({ day: v.string(), pool: v.string(), count: v.number() })),
    outbox: v.object({
      queued: v.number(),
      oldestQueuedAt: v.union(v.number(), v.null()),
      last7d: v.object({
        emails: v.number(),
        items: v.number(),
        bundles: v.number(),
        direct: v.number(),
        failed: v.number(),
        dropped: v.number(),
        byKind: v.object({ case: v.number(), queue: v.number(), bulletin: v.number(), employer: v.number() }),
      }),
    }),
    recent: v.array(
      v.object({
        email: v.string(),
        kind: kindValidator,
        status: v.string(),
        title: v.string(),
        line: v.string(),
        createdAt: v.number(),
        sentAt: v.union(v.number(), v.null()),
        bundleSize: v.union(v.number(), v.null()),
        direct: v.boolean(),
        lastError: v.union(v.string(), v.null()),
      }),
    ),
    follows: v.object({
      confirmed: v.number(),
      pending: v.number(),
      unsubscribed: v.number(),
      top: v.array(v.object({ slug: v.string(), name: v.string(), followers: v.number() })),
    }),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const now = Date.now();

    const d7day = etDay(now - 6 * DAY_MS);
    const refusalRows = await ctx.db
      .query("budgetRefusals")
      .withIndex("by_day_pool", (q) => q.gte("day", d7day))
      .take(200);
    const refusedBy = new Map<string, number>();
    for (const r of refusalRows) refusedBy.set(r.pool, (refusedBy.get(r.pool) ?? 0) + r.count);

    const pools = [];
    for (const [name, b] of Object.entries(BUDGETS) as [BudgetName, (typeof BUDGETS)[BudgetName]][]) {
      const used = await ctx.db
        .query("rateLimits")
        .withIndex("by_key_and_timestamp", (q) => q.eq("key", `${b.key}:all`).gte("timestamp", now - DAY_MS))
        .take(b.limit + 50);
      pools.push({ name, label: b.label, limit: b.limit, usedLast24h: used.length, refusedLast7d: refusedBy.get(name) ?? 0 });
    }

    const queuedRows = await ctx.db
      .query("alertOutbox")
      .withIndex("by_status_created", (q) => q.eq("status", "queued"))
      .take(1000);

    const week = await ctx.db
      .query("alertOutbox")
      .withIndex("by_created", (q) => q.gte("createdAt", now - 7 * DAY_MS))
      .order("desc")
      .take(3000);
    const byKind = { case: 0, queue: 0, bulletin: 0, employer: 0 };
    let items = 0;
    let direct = 0;
    let failed = 0;
    let dropped = 0;
    // One email is one (address, send time): every item of a bundle is
    // stamped with the same `sentAt`, a direct send is its own.
    const sentEmails = new Set<string>();
    const bundleEmails = new Set<string>();
    for (const r of week) {
      if (r.status === "sent") {
        items += 1;
        byKind[r.kind] += 1;
        const key = `${r.email}|${r.sentAt ?? r.createdAt}`;
        sentEmails.add(key);
        if (r.direct) direct += 1;
        else if ((r.bundleSize ?? 1) > 1) bundleEmails.add(key);
      } else if (r.status === "failed") failed += 1;
      else if (r.status === "dropped") dropped += 1;
    }

    const followRows = await ctx.db.query("employerAlerts").order("desc").take(2000);
    const counts = new Map<string, { name: string; followers: number }>();
    let confirmed = 0;
    let pending = 0;
    let unsubscribed = 0;
    for (const r of followRows) {
      if (r.unsubscribedAt !== undefined) unsubscribed += 1;
      else if (r.confirmedAt !== undefined) {
        confirmed += 1;
        const c = counts.get(r.slug) ?? { name: r.employerName, followers: 0 };
        c.followers += 1;
        counts.set(r.slug, c);
      } else pending += 1;
    }

    return {
      pools,
      refusalDays: refusalRows.map((r) => ({ day: r.day, pool: r.pool, count: r.count })),
      outbox: {
        queued: queuedRows.length,
        oldestQueuedAt: queuedRows[0]?.createdAt ?? null,
        last7d: {
          emails: sentEmails.size,
          items,
          bundles: bundleEmails.size,
          direct,
          failed,
          dropped,
          byKind,
        },
      },
      recent: week.slice(0, 30).map((r) => ({
        email: r.email,
        kind: r.kind,
        status: r.status,
        title: r.summary.title,
        line: r.summary.line,
        createdAt: r.createdAt,
        sentAt: r.sentAt ?? null,
        bundleSize: r.bundleSize ?? null,
        direct: r.direct === true,
        lastError: r.lastError ?? null,
      })),
      follows: {
        confirmed,
        pending,
        unsubscribed,
        top: [...counts.entries()]
          .map(([slug, c]) => ({ slug, name: c.name, followers: c.followers }))
          .sort((a, b) => b.followers - a.followers || a.name.localeCompare(b.name))
          .slice(0, 10),
      },
    };
  },
});
