/**
 * Queue-reached alerts.
 *
 * One question dominates every PERM search term we rank for: "has DOL got to
 * my month yet?". DOL's own page cannot answer it, because it publishes only
 * today's frontier and keeps no history. We keep the history (see
 * convex/dolProcessingTimes.ts), so we can answer it exactly once, when it
 * becomes true, and then stop.
 *
 * Design constraints that shaped this:
 *
 * - Double opt-in. Nothing is ever sent to an address that has not confirmed.
 *   A typo'd or someone-else's address therefore costs one confirmation mail
 *   and nothing more.
 * - One alert per subscriber, ever. This is not a newsletter. When the queue
 *   reaches their month we send once, stamp `notifiedAt`, and never mail them
 *   again unless they subscribe for a different month.
 * - Resend's account cap is 100/day and has already caused one outage here, so
 *   the notify sweep is explicitly batched and resumable rather than a blast.
 *
 * @module convex/queueAlerts
 */

import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { FROM_EMAIL, getResend } from "./lib/email";
import { makeUnsubscribeToken, verifyUnsubscribeToken } from "./lib/unsubscribeToken";
import { recordError } from "./lib/errorRecording";
import { createLogger } from "./lib/logging";

const log = createLogger("QueueAlerts");

/**
 * How many alerts one sweep may send.
 *
 * Well under Resend's 100/day account cap, and the sweep is resumable, so a
 * larger backlog drains over consecutive runs instead of tripping the limit
 * and silently dropping mail.
 */
const NOTIFY_BATCH_LIMIT = 40;

const roleValidator = v.union(
  v.literal("attorney"),
  v.literal("applicant"),
  v.literal("employer"),
);

/** Conservative address check. Rejects the obvious, defers the rest to Resend. */
function isPlausibleEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254;
}

/** Accepts "YYYY-MM" within a sane window around the PERM programme's life. */
function isPlausibleFilingMonth(month: string): boolean {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return false;
  const year = Number(m[1]);
  const mo = Number(m[2]);
  return year >= 2020 && year <= 2035 && mo >= 1 && mo <= 12;
}

/** The public marketing site, used for human-facing links in email copy. */
function siteUrl(): string {
  return "https://permtracker.app";
}

/**
 * The Convex HTTP domain, which is where confirm and unsubscribe actually run.
 * These are different hosts and conflating them produces links that 404.
 */
function actionUrl(path: string, token: string): string {
  const base = process.env.CONVEX_SITE_URL;
  if (!base) throw new Error("CONVEX_SITE_URL is not configured");
  return `${base}${path}?token=${encodeURIComponent(token)}`;
}

function unsubscribeSecret(): string {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) throw new Error("UNSUBSCRIBE_SECRET is not configured");
  return secret;
}

// ============================================================================
// Subscribe
// ============================================================================

/**
 * Public: register interest in one filing month.
 *
 * Public because the whole point is that a visitor with no account can use it.
 * It writes one row and schedules one confirmation email; it reads nothing and
 * returns nothing that could enumerate other subscribers.
 */
export const subscribe = mutation({
  args: {
    email: v.string(),
    filingMonth: v.string(),
    role: v.optional(roleValidator),
    source: v.optional(v.string()),
  },
  returns: v.object({ ok: v.boolean(), message: v.string() }),
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();

    if (!isPlausibleEmail(email)) {
      return { ok: false, message: "That email address does not look right." };
    }
    if (!isPlausibleFilingMonth(args.filingMonth)) {
      return { ok: false, message: "Pick the month your case was filed." };
    }

    const existing = await ctx.db
      .query("dolQueueAlerts")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (existing) {
      // Re-subscribing updates the month and clears a prior opt-out, so someone
      // who filed a second case is not stuck with the first case's month.
      await ctx.db.patch(existing._id, {
        filingMonth: args.filingMonth,
        role: args.role ?? existing.role,
        unsubscribedAt: undefined,
        notifiedAt: undefined,
      });
      if (existing.confirmedAt) {
        return { ok: true, message: "Updated. We'll email you when DOL reaches that month." };
      }
    } else {
      await ctx.db.insert("dolQueueAlerts", {
        email,
        filingMonth: args.filingMonth,
        role: args.role,
        createdAt: Date.now(),
        source: args.source,
      });
    }

    await ctx.scheduler.runAfter(0, internal.queueAlerts.sendConfirmation, {
      email,
      filingMonth: args.filingMonth,
    });

    return { ok: true, message: "Check your inbox to confirm. The link expires when you use it." };
  },
});

/** Send the double opt-in confirmation. */
export const sendConfirmation = internalAction({
  args: { email: v.string(), filingMonth: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const token = await makeUnsubscribeToken(args.email, unsubscribeSecret());
      const confirmUrl = actionUrl("/queue-alert/confirm", token);

      await getResend().emails.send({
        from: FROM_EMAIL,
        to: args.email,
        subject: "Confirm your PERM queue alert",
        text: [
          "You asked to be told when the Department of Labor's PERM analyst-review queue reaches your filing month.",
          "",
          `Filing month: ${args.filingMonth}`,
          "",
          "Confirm here and we'll email you once, on the day it happens:",
          confirmUrl,
          "",
          "If you didn't ask for this, ignore this message. Nothing further will be sent.",
          "",
          "PERM Tracker",
          `${siteUrl()}/perm-processing-times`,
        ].join("\n"),
      });
    } catch (error) {
      await recordError(ctx, "action", "queueAlerts.sendConfirmation", error);
    }
    return null;
  },
});

// ============================================================================
// Confirm / unsubscribe (driven by the HTTP routes)
// ============================================================================

export const confirmByToken = internalMutation({
  args: { token: v.string() },
  returns: v.union(v.object({ email: v.string(), filingMonth: v.string() }), v.null()),
  handler: async (ctx, args) => {
    const email = await verifyUnsubscribeToken(args.token, unsubscribeSecret());
    if (!email) return null;

    const row = await ctx.db
      .query("dolQueueAlerts")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (!row) return null;

    if (!row.confirmedAt) {
      await ctx.db.patch(row._id, { confirmedAt: Date.now(), unsubscribedAt: undefined });
    }
    return { email: row.email, filingMonth: row.filingMonth };
  },
});

export const unsubscribeByToken = internalMutation({
  args: { token: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const email = await verifyUnsubscribeToken(args.token, unsubscribeSecret());
    if (!email) return false;

    const row = await ctx.db
      .query("dolQueueAlerts")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (!row) return false;

    await ctx.db.patch(row._id, { unsubscribedAt: Date.now() });
    return true;
  },
});

// ============================================================================
// Notify sweep
// ============================================================================

/**
 * Everyone whose month the queue has now reached and who has not been told.
 *
 * `frontier` is DOL's published analyst-review month. A subscriber qualifies
 * when their filing month is at or before it, which is exactly the moment the
 * answer to their question changed from "no" to "yes".
 */
export const dueForAlert = internalQuery({
  args: { frontier: v.string(), limit: v.number() },
  returns: v.array(
    v.object({
      _id: v.id("dolQueueAlerts"),
      email: v.string(),
      filingMonth: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("dolQueueAlerts")
      .withIndex("by_filing_month", (q) => q.lte("filingMonth", args.frontier))
      .collect();

    return rows
      .filter((r) => r.confirmedAt && !r.notifiedAt && !r.unsubscribedAt)
      .slice(0, args.limit)
      .map((r) => ({ _id: r._id, email: r.email, filingMonth: r.filingMonth }));
  },
});

export const markNotified = internalMutation({
  args: { id: v.id("dolQueueAlerts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { notifiedAt: Date.now() });
    return null;
  },
});

/**
 * Send the one alert to everyone the queue has reached.
 *
 * Called after a new DOL snapshot lands. Batched and resumable: it sends at
 * most NOTIFY_BATCH_LIMIT per run, and the next run picks up the remainder,
 * because blowing the Resend cap does not just delay these emails, it takes
 * down password resets and deadline reminders with them.
 */
export const notifyQueueReached = internalAction({
  args: { frontier: v.string(), asOf: v.string() },
  returns: v.object({ sent: v.number(), remaining: v.boolean() }),
  handler: async (ctx, args): Promise<{ sent: number; remaining: boolean }> => {
    const due = await ctx.runQuery(internal.queueAlerts.dueForAlert, {
      frontier: args.frontier,
      limit: NOTIFY_BATCH_LIMIT + 1,
    });

    const batch = due.slice(0, NOTIFY_BATCH_LIMIT);
    const remaining = due.length > NOTIFY_BATCH_LIMIT;
    let sent = 0;

    for (const row of batch) {
      try {
        const token = await makeUnsubscribeToken(row.email, unsubscribeSecret());
        const unsubUrl = actionUrl("/queue-alert/unsubscribe", token);

        await getResend().emails.send({
          from: FROM_EMAIL,
          to: row.email,
          subject: `DOL has reached ${row.filingMonth} in the PERM queue`,
          headers: {
            "List-Unsubscribe": `<${unsubUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
          text: [
            `The Department of Labor's PERM analyst-review queue has reached ${args.frontier}.`,
            `You asked to be told when it reached ${row.filingMonth}.`,
            "",
            `This is DOL's own published figure, as of ${args.asOf}, from`,
            "https://flag.dol.gov/processingtimes",
            "",
            "Reaching your month means DOL is now adjudicating cases filed then. It",
            "is not a decision on your case and it is not a prediction of one.",
            "",
            `Current figures: ${siteUrl()}/perm-processing-times`,
            "",
            "This was the only email you signed up for, and it will not repeat.",
            `Opt out entirely: ${unsubUrl}`,
            "",
            "PERM Tracker",
          ].join("\n"),
        });

        await ctx.runMutation(internal.queueAlerts.markNotified, { id: row._id });
        sent += 1;
      } catch (error) {
        // One bad address must not stop the sweep for everyone behind it.
        log.error("alert send failed", { email: row.email, error });
        await recordError(ctx, "action", "queueAlerts.notifyQueueReached", error);
      }
    }

    return { sent, remaining };
  },
});
