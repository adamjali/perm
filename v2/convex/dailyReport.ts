/**
 * The daily operator report: health, costs, every GitHub Actions run, the
 * ingests, failures, retries and usage.
 *
 * `scripts/daily_monitor.py` runs in GitHub Actions every morning, gathers
 * what lives outside Convex, and calls `send` with its sections. `send` adds
 * the three sections only Convex can see, stores the whole report for the
 * admin page, and emails it to the admin. One email a day, to one address,
 * claimed in the Resend ledger in convex/caseAlerts.ts.
 *
 * The workflow is public, so the report travels as the `send` argument and
 * never through the Actions log; `send` returns only the verdict.
 */
import { render } from "@react-email/render";
import { v } from "convex/values";

import { DailyReport as DailyReportEmail } from "../src/emails/DailyReport";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery, query } from "./_generated/server";
import { getSecurityAlertEmail, requireAdmin } from "./lib/admin";
import {
  type DailyReport,
  type Facts,
  type ResendDay,
  RESEND_SEND_ONLY,
  convexSections,
  readReport,
  reportSubject,
  reportText,
  worstStatus,
} from "./lib/dailyReportCompose";
import { FROM_EMAIL, getResend, sendOrQueue } from "./lib/email";
import { loggers } from "./lib/logging";
import { easternDay, MS_PER_DAY } from "./lib/time";
import { RETRY_MAX_ROWS } from "./lib/emailLimits";
import { countAudiences } from "./lib/audience";
import { ratingsSince } from "./alertRatings";
import { waitingForReview } from "./firmClaims";
import { keyCounts } from "./lib/apiKeyStats";
import { webhookHealth } from "./webhookDelivery";

const log = loggers.email;
/** Reports kept for the admin page. */
const KEEP_DAYS = 60;
/** The most rows the report reads from one table; a table past it is undercounted, never an error. */
const TABLE_READ = 2000;
/** The day's errors read for the by-operation count. */
const ERRORS_READ = 500;
/** Waiting confirmations read for the count and the oldest wait. */
const CONFIRMATIONS_READ = 200;
/** Budget refusal rows read: one per pool per day, so two days of pools fit many times over. */
const REFUSALS_READ = 200;
/** Expired reports deleted per store. */
const PRUNE_BATCH = 50;
/** Verdicts the admin page lists: two weeks. */
const HISTORY_DAYS = 14;

interface Sub {
  confirmedAt?: number;
  unsubscribedAt?: number;
}

/** Everything Convex knows about the last 24 hours, as counts only. */
export const facts = internalQuery({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const now = Date.now();
    const since = now - MS_PER_DAY;

    const users = (await ctx.db.query("users").order("desc").take(TABLE_READ)).filter((u) => !u.deletedAt);
    const profiles = await ctx.db.query("userProfiles").take(TABLE_READ);

    const kinds = [
      ["case", await ctx.db.query("caseStatusAlerts").take(TABLE_READ)],
      ["queue", await ctx.db.query("dolQueueAlerts").take(TABLE_READ)],
      ["bulletin", await ctx.db.query("bulletinAlerts").take(TABLE_READ)],
      ["employer", await ctx.db.query("employerAlerts").take(TABLE_READ)],
      ["news", await ctx.db.query("newsSubscribers").take(TABLE_READ)],
    ] as const;
    const subs = kinds.map(([kind, rows]) => {
      const list = rows as Sub[];
      return {
        kind,
        live: list.filter((r) => r.confirmedAt && !r.unsubscribedAt).length,
        confirmed24h: list.filter((r) => (r.confirmedAt ?? 0) > since).length,
        left24h: list.filter((r) => (r.unsubscribedAt ?? 0) > since).length,
      };
    });

    const errors = await ctx.db
      .query("systemErrors")
      .withIndex("by_created_at", (q) => q.gt("createdAt", since))
      .take(ERRORS_READ);
    const byOp = new Map<string, number>();
    for (const e of errors) byOp.set(e.operation, (byOp.get(e.operation) ?? 0) + 1);

    const outbox = await ctx.db.query("alertOutbox").order("desc").take(TABLE_READ);
    const queued = outbox.filter((r) => r.status === "queued");

    const confirmationWaiting = await ctx.db.query("confirmationQueue").withIndex("by_queuedAt").take(CONFIRMATIONS_READ);
    const retryWaiting = await ctx.db.query("emailRetries").withIndex("by_queuedAt").take(RETRY_MAX_ROWS);
    const yesterdayUtc = await ctx.db
      .query("emailDays")
      .withIndex("by_day", (q) => q.eq("day", new Date(now - MS_PER_DAY).toISOString().slice(0, 10)))
      .unique();

    const today = easternDay(now);
    const yesterday = easternDay(now - MS_PER_DAY);
    const refusals = (await ctx.db.query("budgetRefusals").order("desc").take(REFUSALS_READ)).filter(
      (r) => r.day === today || r.day === yesterday,
    );

    const firmWaiting = await waitingForReview(ctx, 50);

    // Who each account is for, from its onboarding role, so the report's
    // attorney figure leaves out people tracking their own case.
    const roleByUser = new Map(profiles.map((p) => [p.userId, p.jobTitle]));
    const fresh = users.filter((u) => u._creationTime > since);

    return {
      users: users.length,
      signups24h: fresh.length,
      audiences: countAudiences(users.map((u) => roleByUser.get(u._id))),
      signupsByAudience: countAudiences(fresh.map((u) => roleByUser.get(u._id))),
      logins24h: profiles.filter((p) => (p.lastLoginAt ?? 0) > since).length,
      subs,
      errors: {
        count: errors.length,
        top: [...byOp.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
      },
      outbox: {
        sent24h: outbox.filter((r) => r.status === "sent" && (r.sentAt ?? 0) > since).length,
        failed24h: outbox.filter((r) => r.status === "failed" && r._creationTime > since).length,
        queued: queued.length,
        oldestQueuedAt: queued.length ? Math.min(...queued.map((r) => r._creationTime)) : null,
      },
      refusals: refusals.map((r) => ({ day: r.day, pool: r.pool, count: r.count, queued: r.queued ?? 0 })),
      confirmationQueue: {
        waiting: confirmationWaiting.length,
        oldestQueuedAt: confirmationWaiting[0]?.queuedAt ?? null,
      },
      retries: {
        waiting: retryWaiting.length,
        oldestQueuedAt: retryWaiting[0]?.queuedAt ?? null,
        // The report runs at 7:30 AM Eastern, so "yesterday" in UTC is the day that just ended.
        retriedYesterday: yesterdayUtc?.retried ?? 0,
        lostYesterday: yesterdayUtc?.lost ?? 0,
      },
      // Firm names are public; no address or role reaches the report.
      firmReview: { waiting: firmWaiting.map((w) => ({ firmName: w.firmName, kind: w.kind, since: w.since })) },
      // What people said about their alerts, the last week: scores and notes only.
      ratings: await ratingsSince(ctx, now - 7 * MS_PER_DAY),
      // API keys by scope and webhook health: counts only, no account or address.
      developers: {
        keys: keyCounts(await ctx.db.query("apiKeys").take(TABLE_READ), now),
        webhooks: await webhookHealth(ctx, since),
      },
    };
  },
});

/**
 * Resend's own log for the last 24 hours: every send, auth mail included.
 * On failure, the reason as a short phrase for the report line.
 */
async function resendDay(now: number): Promise<ResendDay | string> {
  // The deployment sends with AUTH_RESEND_KEY and has no RESEND_API_KEY, so
  // use the sending key when no separate reading key exists; a send-only key
  // answers 401 and
  // the line below says so instead.
  const key = process.env.RESEND_API_KEY || process.env.AUTH_RESEND_KEY;
  if (!key) return "no Resend key is set (RESEND_API_KEY or AUTH_RESEND_KEY)";
  const since = now - MS_PER_DAY;
  const out: ResendDay = { sent: 0, bounced: 0, complained: 0 };
  let after: string | null = null;
  for (let page = 0; page < 3; page++) {
    const url = `https://api.resend.com/emails?limit=100${after ? `&after=${after}` : ""}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    if (res.status === 401 || res.status === 403) return RESEND_SEND_ONLY;
    if (!res.ok) return `HTTP ${res.status}`;
    const body = (await res.json()) as {
      has_more?: boolean;
      data?: Array<{ id: string; created_at: string; last_event?: string }>;
    };
    const rows = body.data ?? [];
    let older = false;
    for (const r of rows) {
      if (Date.parse(r.created_at) < since) {
        older = true;
        continue;
      }
      out.sent++;
      if (r.last_event === "bounced") out.bounced++;
      if (r.last_event === "complained") out.complained++;
    }
    if (older || !body.has_more || rows.length === 0) break;
    after = rows[rows.length - 1]!.id;
  }
  return out;
}

export const store = internalMutation({
  args: { day: v.string(), overall: v.string(), report: v.any() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("dailyReports")
      .withIndex("by_day", (q) => q.eq("day", args.day))
      .unique();
    if (existing) await ctx.db.replace(existing._id, { ...args, createdAt: Date.now() });
    else await ctx.db.insert("dailyReports", { ...args, createdAt: Date.now() });
    const cutoff = easternDay(Date.now() - KEEP_DAYS * MS_PER_DAY);
    for (const old of await ctx.db
      .query("dailyReports")
      .withIndex("by_day", (q) => q.lt("day", cutoff))
      .take(PRUNE_BATCH)) {
      await ctx.db.delete(old._id);
    }
    return null;
  },
});

/**
 * Called once each morning by the daily-monitor workflow. The argument is
 * `v.any()` on purpose: a validation error would echo the whole report into
 * the public Actions log, so the report is read defensively instead.
 */
export const send = internalAction({
  args: { report: v.any() },
  returns: v.object({ overall: v.string(), emailed: v.boolean() }),
  handler: async (ctx, args) => {
    const outside = readReport(args.report);
    if (!outside) throw new Error("daily report: unreadable input");
    const now = Date.now();
    const f = (await ctx.runQuery(internal.dailyReport.facts, {})) as Facts;
    let resend: ResendDay | string;
    try {
      resend = await resendDay(now);
    } catch (e) {
      resend = e instanceof Error ? e.name : "error";
    }
    const report: DailyReport = {
      ...outside,
      sections: [...outside.sections, ...convexSections(f, resend, now)],
    };
    const overall = worstStatus(report.sections.map((s) => s.status));
    await ctx.runMutation(internal.dailyReport.store, { day: report.day, overall, report });

    const to = getSecurityAlertEmail();
    if (!to) {
      log.error("daily report: no admin address configured");
      return { overall, emailed: false };
    }
    const html = await render(DailyReportEmail({ report }));
    const { error } = await sendOrQueue(ctx, "daily-report", getResend(), {
      from: FROM_EMAIL,
      to: [to],
      subject: reportSubject(report),
      html,
      text: reportText(report),
    }, { priority: "high" });
    if (error) {
      log.error("daily report: send failed", { error: error.message });
      return { overall, emailed: false };
    }
    return { overall, emailed: true };
  },
});

/** The admin page's Monitor tab: the newest report and two weeks of verdicts. */
export const latest = query({
  args: {},
  returns: v.object({
    report: v.union(v.any(), v.null()),
    history: v.array(v.object({ day: v.string(), overall: v.string() })),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("dailyReports").withIndex("by_day").order("desc").take(HISTORY_DAYS);
    return {
      report: rows[0]?.report ?? null,
      history: rows.map((r) => ({ day: r.day, overall: r.overall })),
    };
  },
});
