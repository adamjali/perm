/**
 * The admin "signals" panel: who signed up, who subscribed to what, who
 * added which case, and whether anyone is actually using the thing.
 *
 * Growth signal belongs on the admin page, not in a database query.
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
import { summarizeNewsletter } from "./lib/newsletterSummary";
import { adminSummaryValidator } from "./lib/newsletterValidators";


import { query } from "./_generated/server";
import { requireAdmin } from "./lib/admin";
import { MS_PER_DAY } from "./lib/time";

/** Newest rows of each subscription list the panel shows. */
const SUBSCRIPTIONS_SHOWN = 500;
/** Newest accounts the panel shows. */
const USERS_SHOWN = 200;
/** Profiles read to join onto those accounts. */
const PROFILES_READ = 1000;
/** Newest in-app case additions the panel shows. */
const CASES_SHOWN = 40;

/** One subscription row, shaped for a table the admin can scan. */
interface SignalSub {
  email: string;
  /** What they subscribed to, in words ("G-100-...", "PWD OEWS · 2025-11"). */
  subject: string;
  status: "pending" | "confirmed" | "unsubscribed";
  createdAt: number;
  /** Last time a real alert was sent, when the table records one. */
  lastNotifiedAt: number | null;
  /** When the address confirmed, and when it stopped: the subscription's own clock. */
  confirmedAt: number | null;
  unsubscribedAt: number | null;
  /** Alerts sent on this subscription, where the table counts them. */
  alertCount: number | null;
  /** What the alert last reported (a case's status, a bulletin cutoff). */
  lastSeen: string | null;
  /** Where the person signed up, as the form recorded it. */
  source: string | null;
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
    confirmedAt: v.union(v.number(), v.null()),
    unsubscribedAt: v.union(v.number(), v.null()),
    alertCount: v.union(v.number(), v.null()),
    lastSeen: v.union(v.string(), v.null()),
    source: v.union(v.string(), v.null()),
  }),
);

/** The clock fields every subscription table shares. */
const clock = (r: { confirmedAt?: number; unsubscribedAt?: number; source?: string }) => ({
  confirmedAt: r.confirmedAt ?? null,
  unsubscribedAt: r.unsubscribedAt ?? null,
  source: r.source ?? null,
});

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
      employerAlerts: subValidator,
      news: subValidator,
    }),
    newsletter: adminSummaryValidator,
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
    const d7 = now - 7 * MS_PER_DAY;
    const d14 = now - 14 * MS_PER_DAY;

    // Users: newest first. The tables here are small (hundreds of rows);
    // every collect() below is bounded by the size of the product itself.
    const users = await ctx.db.query("users").order("desc").take(USERS_SHOWN);
    const living = users.filter((u) => !u.deletedAt);
    const recentUsers = living.slice(0, 20).map((u) => ({
      email: u.email ?? "(no email)",
      createdAt: u._creationTime,
    }));

    // Bounded, not collect(): the panel is a scan surface, not an export.
    const profiles = await ctx.db.query("userProfiles").take(PROFILES_READ);
    const activeLast7d = profiles.filter(
      (p) => (p.lastLoginAt ?? 0) > d7,
    ).length;

    const caseAlerts = (await ctx.db.query("caseStatusAlerts").order("desc").take(SUBSCRIPTIONS_SHOWN)).map(
      (r): SignalSub => ({
        email: r.email,
        subject: r.caseNumber,
        status: status(r),
        createdAt: r._creationTime,
        lastNotifiedAt: r.lastAlertSentAt ?? null,
        ...clock(r),
        alertCount: r.alertCount ?? null,
        lastSeen: r.lastSeenStatus ?? null,
      }),
    );
    const queueAlerts = (await ctx.db.query("dolQueueAlerts").order("desc").take(SUBSCRIPTIONS_SHOWN)).map(
      (r): SignalSub => ({
        email: r.email,
        subject: `${r.queue === "pwd-oews" ? "PWD OEWS" : r.queue === "pwd-nonoews" ? "PWD non-OEWS" : "PERM queue"} · ${r.filingMonth}`,
        status: status(r),
        createdAt: r._creationTime,
        lastNotifiedAt: r.notifiedAt ?? null,
        ...clock(r),
        alertCount: r.notifiedAt ? 1 : 0,
        lastSeen: null,
      }),
    );
    const bulletinAlerts = (await ctx.db.query("bulletinAlerts").order("desc").take(SUBSCRIPTIONS_SHOWN)).map(
      (r): SignalSub => ({
        email: r.email,
        subject: `Bulletin ${r.category} · ${r.country}`,
        status: status(r),
        createdAt: r._creationTime,
        lastNotifiedAt: r.lastAlertSentAt ?? null,
        ...clock(r),
        alertCount: r.alertCount ?? null,
        lastSeen: r.lastSeenCutoff ?? null,
      }),
    );
    const employerAlerts = (await ctx.db.query("employerAlerts").order("desc").take(SUBSCRIPTIONS_SHOWN)).map(
      (r): SignalSub => ({
        email: r.email,
        subject: r.employerName,
        status: status(r),
        createdAt: r._creationTime,
        lastNotifiedAt: r.lastAlertSentAt ?? null,
        ...clock(r),
        alertCount: r.alertCount ?? null,
        lastSeen: null,
      }),
    );
    const news = (await ctx.db.query("newsSubscribers").order("desc").take(SUBSCRIPTIONS_SHOWN)).map(
      (r): SignalSub => ({
        email: r.email,
        subject: "Product news",
        status: status(r),
        createdAt: r.createdAt,
        lastNotifiedAt: null,
        ...clock(r),
        alertCount: null,
        lastSeen: null,
      }),
    );

    // In-app case additions, newest first, with the owner's email joined.
    const cases = await ctx.db.query("cases").order("desc").take(CASES_SHOWN);
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
        employerAlerts,
        news,
      },
      recentCases,
      newsletter: await summarizeNewsletter(ctx),
    };
  },
});
