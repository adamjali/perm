/**
 * The admin "signals" panel: who signed up, who subscribed to what, who
 * added which case, and whether anyone is actually using the thing.
 *
 * Built the day the first real alert subscriber appeared (2026-08-28: one
 * person confirmed a queue alert, then a case alert on their own case the
 * same night) and Adam had to ask a database to find out. Growth signal
 * belongs on the admin page, not in a REPL.
 *
 * WHAT IS DELIBERATELY NOT HERE: public case SEARCHES. The lookup page
 * redacts case numbers from analytics on purpose (a case number is a
 * person's immigration record; the legal pages promise we do not build
 * profiles of visitors), so there is no per-visitor search log to show.
 * The closest honest proxy - cases the public lookup DISCOVERED and
 * recorded - lives in Turso and can join this panel later via a server
 * route if wanted.
 *
 * SECURITY: requireAdmin() on the query; every row here contains user
 * email addresses and belongs behind it.
 */

import { v } from "convex/values";

import { query } from "./_generated/server";
import { requireAdmin } from "./lib/admin";

/** One subscription row, shaped for a table the admin can scan. */
interface SignalSub {
  email: string;
  /** What they subscribed to, in words ("G-100-...", "PWD OEWS · 2025-11"). */
  subject: string;
  status: "pending" | "confirmed" | "unsubscribed";
  createdAt: number;
  /** Last time a real alert was sent, when the table records one. */
  lastNotifiedAt: number | null;
}

const status = (r: {
  confirmedAt?: number;
  unsubscribedAt?: number;
}): SignalSub["status"] =>
  r.unsubscribedAt ? "unsubscribed" : r.confirmedAt ? "confirmed" : "pending";

const subValidator = v.array(
  v.object({
    email: v.string(),
    subject: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("unsubscribed"),
    ),
    createdAt: v.number(),
    lastNotifiedAt: v.union(v.number(), v.null()),
  }),
);

export const getSignals = query({
  args: {},
  returns: v.object({
    totals: v.object({
      users: v.union(v.number(), v.null()),
      activeLast7d: v.number(),
      signupsLast14d: v.number(),
    }),
    recentUsers: v.array(
      v.object({ email: v.string(), createdAt: v.number() }),
    ),
    subscriptions: v.object({
      caseAlerts: subValidator,
      queueAlerts: subValidator,
      bulletinAlerts: subValidator,
      news: subValidator,
    }),
    recentCases: v.array(
      v.object({
        email: v.string(),
        employerName: v.string(),
        caseNumber: v.union(v.string(), v.null()),
        createdAt: v.number(),
      }),
    ),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const now = Date.now();
    const d7 = now - 7 * 86_400_000;
    const d14 = now - 14 * 86_400_000;

    // Users: newest first. The tables here are small (hundreds of rows);
    // every collect() below is bounded by the size of the product itself.
    const users = await ctx.db.query("users").order("desc").take(200);
    const living = users.filter((u) => !u.deletedAt);
    const recentUsers = living.slice(0, 20).map((u) => ({
      email: u.email ?? "(no email)",
      createdAt: u._creationTime,
    }));

    // Bounded, not collect(): the panel is a scan surface, not an export.
    const profiles = await ctx.db.query("userProfiles").take(1000);
    const activeLast7d = profiles.filter(
      (p) => (p.lastLoginAt ?? 0) > d7,
    ).length;

    const caseAlerts = (await ctx.db.query("caseStatusAlerts").order("desc").take(500)).map(
      (r): SignalSub => ({
        email: r.email,
        subject: r.caseNumber,
        status: status(r),
        createdAt: r._creationTime,
        lastNotifiedAt: r.lastAlertSentAt ?? null,
      }),
    );
    const queueAlerts = (await ctx.db.query("dolQueueAlerts").order("desc").take(500)).map(
      (r): SignalSub => ({
        email: r.email,
        subject: `${r.queue === "pwd-oews" ? "PWD OEWS" : r.queue === "pwd-nonoews" ? "PWD non-OEWS" : "PERM queue"} · ${r.filingMonth}`,
        status: status(r),
        createdAt: r._creationTime,
        lastNotifiedAt: r.notifiedAt ?? null,
      }),
    );
    const bulletinAlerts = (await ctx.db.query("bulletinAlerts").order("desc").take(500)).map(
      (r): SignalSub => ({
        email: r.email,
        subject: `Bulletin ${r.category} · ${r.country}`,
        status: status(r),
        createdAt: r._creationTime,
        lastNotifiedAt: r.lastAlertSentAt ?? null,
      }),
    );
    const news = (await ctx.db.query("newsSubscribers").order("desc").take(500)).map(
      (r): SignalSub => ({
        email: r.email,
        subject: "Product news",
        status: status(r),
        createdAt: r.createdAt,
        lastNotifiedAt: null,
      }),
    );

    // In-app case additions, newest first, with the owner's email joined.
    const cases = await ctx.db.query("cases").order("desc").take(40);
    const recentCases = [];
    for (const c of cases) {
      if (c.deletedAt) continue;
      if (recentCases.length >= 20) break;
      const owner = await ctx.db.get(c.userId);
      recentCases.push({
        email: owner?.email ?? "(deleted user)",
        employerName: c.employerName,
        caseNumber: c.caseNumber ?? null,
        createdAt: c._creationTime,
      });
    }

    return {
      totals: {
        users: living.length >= 200 ? null : living.length,
        activeLast7d,
        signupsLast14d: living.filter((u) => u._creationTime > d14).length,
      },
      recentUsers,
      subscriptions: {
        caseAlerts,
        queueAlerts,
        bulletinAlerts,
        news,
      },
      recentCases,
    };
  },
});
