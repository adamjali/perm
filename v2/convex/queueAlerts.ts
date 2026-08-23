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
 *   again unless they subscribe for a genuinely DIFFERENT month.
 * - Resend's account cap is 100/day and has already caused one outage here, so
 *   the notify sweep is batched and reschedules its own remainder.
 *
 * ## Sending discipline
 *
 * Every send in this module goes through `sendEmailWithRetry`, never
 * `resend.emails.send()` directly. Two reasons, both learned the hard way:
 *
 * 1. The Resend SDK does NOT throw on an HTTP error. `fetchRequest` returns
 *    `{ data: null, error }` for a 429, a 422 and a network failure alike. An
 *    earlier version of this file wrapped a bare send in try/catch and marked
 *    the subscriber notified on the line after, so a rate-limited send stamped
 *    `notifiedAt`, reported success, and destroyed the one email they signed
 *    up for. The catch block was dead code for every realistic failure.
 * 2. The recipient blocklist is enforced inside `sendEmailWithRetry`. Calling
 *    the SDK directly walks around it, which would make the invariant stated
 *    in convex/lib/emailBlocklist.ts false.
 *
 * @module convex/queueAlerts
 */

import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { FROM_EMAIL, getResend, sendEmailWithRetry } from "./lib/email";
import {
  makeUnsubscribeToken,
  verifyUnsubscribeToken,
  type TokenPurpose,
} from "./lib/unsubscribeToken";
import { recordError } from "./lib/errorRecording";
import { checkAndRecordRateLimit } from "./lib/rateLimit";
import { createLogger } from "./lib/logging";

const log = createLogger("QueueAlerts");

/**
 * How many alerts one sweep may send.
 *
 * Well under Resend's 100/day account cap. When more than this are due the
 * sweep reschedules itself for the remainder rather than dropping them.
 */
const NOTIFY_BATCH_LIMIT = 40;

/**
 * Gap before a rescheduled sweep resumes.
 *
 * Long enough that a rate-limit condition has time to clear, short enough that
 * a large backlog still drains the same day.
 */
const NOTIFY_RESUME_DELAY_MS = 5 * 60 * 1000;

/**
 * Minimum gap between confirmation emails to one address.
 *
 * Note what this does and does not do. It stops one address being mailed
 * repeatedly. It does NOT stop an attacker cycling through many addresses,
 * because a first-time address has no previous send to compare against. That
 * vector is handled by the per-IP rate limit on the HTTP route, which is the
 * only layer that can see the caller. Do not treat this constant as the
 * anti-abuse control on its own.
 */
const CONFIRMATION_COOLDOWN_MS = 10 * 60 * 1000;

/**
 * Per-caller ceiling on subscribe attempts.
 *
 * Five an hour is far more than a human needs and far less than a script
 * wants. The identifier is the caller IP as reported by `x-forwarded-for`,
 * which IS spoofable — see the note on the global budget below for why that is
 * survivable rather than fatal.
 */
const SUBSCRIBE_IP_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 };

/**
 * Global ceiling on confirmation emails, across every caller.
 *
 * This is the control that actually protects the thing at risk. Resend's
 * account cap is 100/day and it is SHARED with password resets, OTP codes and
 * deadline reminders; exhausting it has already caused one outage here. A
 * per-IP limit alone cannot prevent that, because an attacker rotating
 * addresses through a proxy pool defeats both the per-address cooldown and the
 * per-IP counter. A global budget cannot be rotated around: whatever an
 * attacker does, confirmations stop at 30 in a rolling day and the remaining
 * ~70 stay available for mail people actually depend on.
 *
 * The cost is that a genuine burst of signups (a Reddit thread, a launch) gets
 * throttled. That is the correct trade: a delayed marketing confirmation is
 * recoverable, a locked-out password reset is not.
 */
const CONFIRMATION_GLOBAL_BUDGET = { limit: 30, windowMs: 24 * 60 * 60 * 1000 };

/** Shown when either limit trips. Says nothing about the address. */
const THROTTLED_REPLY =
  "We can't send confirmation emails right now. Please try again in a little while.";

/**
 * One reply for every outcome on an existing address.
 *
 * Saying "you are already subscribed" would turn this into an oracle for
 * checking whether a given person uses the service.
 *
 * It deliberately does not claim the link expires. These tokens are stateless
 * HMACs with no expiry and no nonce, so an earlier version of this string was
 * simply false.
 */
const NEUTRAL_REPLY = "Check your inbox to confirm.";

/** The public marketing site, used for human-facing links in email copy. */
const SITE_URL = "https://permtracker.app";

/** The DOL row whose priority date IS the answer to "have they reached me yet". */
const ANALYST_REVIEW = /analyst review/i;

const roleValidator = v.union(
  v.literal("attorney"),
  v.literal("applicant"),
  v.literal("employer"),
);

/**
 * Conservative address check. Rejects the obvious, defers the rest to Resend.
 *
 * The length cap runs FIRST and that ordering is load-bearing, not style.
 * `[^\s@]` matches `.`, so `[^\s@]+\.[^\s@]{2,}$` backtracks quadratically on
 * a long failing input: measured in V8, `"a@" + ".".repeat(80000) + "@"` took
 * 8.2 seconds against this pattern. `v.string()` accepts about a megabyte, so
 * testing before the length check handed any anonymous caller seconds of
 * server compute per request. Guarded first, the same input is 0.005 ms.
 */
function isPlausibleEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/** Accepts "YYYY-MM" within a sane window around the PERM programme's life. */
function isPlausibleFilingMonth(month: string): boolean {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return false;
  const year = Number(m[1]);
  const mo = Number(m[2]);
  return year >= 2020 && year <= 2035 && mo >= 1 && mo <= 12;
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
 * Register interest in one filing month.
 *
 * Internal, not public. Its only caller is the HTTP action at
 * convex/http.ts, which is where the per-IP rate limit, the CORS allowlist and
 * the field narrowing live. As a public mutation this was a second entry point
 * that skipped all three and made the allowlist decorative.
 */
export const subscribe = internalMutation({
  args: {
    email: v.string(),
    filingMonth: v.string(),
    role: v.optional(roleValidator),
    source: v.optional(v.string()),
    /** Caller IP from the HTTP layer, or "unknown" when none is resolvable. */
    ip: v.optional(v.string()),
  },
  returns: v.object({
    ok: v.boolean(),
    message: v.string(),
    /** True only when a rate limit refused the request, so the HTTP layer can
     *  answer 429 for throttling and 400 for a malformed field. */
    throttled: v.optional(v.boolean()),
  }),
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();

    // Shape checks first: they are free, and rejecting here costs an attacker
    // a request without costing us a rate-limit row.
    if (!isPlausibleEmail(email)) {
      return { ok: false, message: "That email address does not look right." };
    }
    if (!isPlausibleFilingMonth(args.filingMonth)) {
      return { ok: false, message: "Pick the month your case was filed." };
    }

    // Per-caller limit. Skipped for "unknown" rather than bucketing every
    // unresolvable caller together, which would let one script lock out all of
    // them at once — the same reasoning as authRateLimit's fail-open.
    const ip = args.ip?.trim();
    if (ip && ip !== "unknown") {
      const perIp = await checkAndRecordRateLimit(
        ctx,
        ip,
        "queue_subscribe_ip",
        SUBSCRIBE_IP_LIMIT,
      );
      if (!perIp.allowed) {
        return { ok: false, message: THROTTLED_REPLY, throttled: true };
      }
    }

    const existing = await ctx.db
      .query("dolQueueAlerts")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    const now = Date.now();

    if (existing) {
      // This endpoint is unauthenticated, so the caller has proved nothing
      // except that they can type an address. Writing straight to
      // `filingMonth`, clearing `unsubscribedAt` or resetting `notifiedAt`
      // here would let anyone who knows an address rewrite that person's
      // subscription, resurrect an opt-out they are legally entitled to keep,
      // and trigger another send. So the request is STAGED and applied only
      // when someone with access to the inbox clicks confirm.
      const withinCooldown =
        existing.lastConfirmationSentAt !== undefined &&
        now - existing.lastConfirmationSentAt < CONFIRMATION_COOLDOWN_MS;

      if (withinCooldown) {
        // Silently skip the send. Same reply either way, so the response can
        // never be used to probe whether an address is on the list.
        return { ok: true, message: NEUTRAL_REPLY };
      }

      await ctx.db.patch(existing._id, {
        pendingFilingMonth: args.filingMonth,
        lastConfirmationSentAt: now,
      });
    } else {
      await ctx.db.insert("dolQueueAlerts", {
        email,
        filingMonth: args.filingMonth,
        role: args.role,
        createdAt: now,
        source: args.source,
        lastConfirmationSentAt: now,
      });
    }

    // Charged here, not at the top, so requests that were absorbed by the
    // per-address cooldown (which send nothing) do not consume the budget.
    const budget = await checkAndRecordRateLimit(
      ctx,
      "all",
      "queue_subscribe_global",
      CONFIRMATION_GLOBAL_BUDGET,
    );
    if (!budget.allowed) {
      log.error("confirmation budget exhausted; refusing to send", {
        windowMs: CONFIRMATION_GLOBAL_BUDGET.windowMs,
        limit: CONFIRMATION_GLOBAL_BUDGET.limit,
      });
      return { ok: false, message: THROTTLED_REPLY, throttled: true };
    }

    await ctx.scheduler.runAfter(0, internal.queueAlerts.sendConfirmation, {
      email,
      filingMonth: args.filingMonth,
    });

    return { ok: true, message: NEUTRAL_REPLY };
  },
});

/**
 * Clear the cooldown stamp after a send that did not actually go out.
 *
 * `lastConfirmationSentAt` is written before the send, because it has to be:
 * it is the thing that stops a repeat request mailing the same address again.
 * But that means it records INTENT, not delivery. Without this, a Resend
 * outage leaves a real person looking at "check your inbox", holding no email,
 * and silently no-op'd for ten minutes if they try again.
 */
export const clearConfirmationCooldown = internalMutation({
  args: { email: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("dolQueueAlerts")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (row) await ctx.db.patch(row._id, { lastConfirmationSentAt: undefined });
    return null;
  },
});

/** Send the double opt-in confirmation. */
export const sendConfirmation = internalAction({
  args: { email: v.string(), filingMonth: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const token = await makeUnsubscribeToken(
        args.email,
        unsubscribeSecret(),
        "queue-confirm",
      );
      const confirmUrl = actionUrl("/queue-alert/confirm", token);

      const result = await sendEmailWithRetry(getResend(), {
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
          `${SITE_URL}/perm-processing-times`,
        ].join("\n"),
      });

      // The SDK reports failure by RETURNING an error, not by throwing, so
      // this check is the only thing standing between a failed send and a
      // silent one. See the module docstring.
      if (result.error) {
        log.error("confirmation send failed", {
          email: args.email,
          error: result.error.message,
        });
        await recordError(
          ctx,
          "action",
          "queueAlerts.sendConfirmation",
          new Error(`Resend: ${result.error.name}: ${result.error.message}`),
        );
        await ctx.runMutation(internal.queueAlerts.clearConfirmationCooldown, {
          email: args.email,
        });
      }
    } catch (error) {
      await recordError(ctx, "action", "queueAlerts.sendConfirmation", error);
      await ctx.runMutation(internal.queueAlerts.clearConfirmationCooldown, {
        email: args.email,
      });
    }
    return null;
  },
});

// ============================================================================
// Confirm / unsubscribe (driven by the HTTP routes)
// ============================================================================

/**
 * The one place a subscriber row is looked up from a token.
 *
 * Scoped by purpose: a token minted for unsubscribing does not verify here and
 * vice versa. Before that scoping existed both routes accepted the same string,
 * so replaying an unsubscribe link against the confirm route undid the opt-out.
 */
async function rowForToken(
  ctx: MutationCtx,
  token: string,
  purpose: TokenPurpose,
): Promise<Doc<"dolQueueAlerts"> | null> {
  const email = await verifyUnsubscribeToken(token, unsubscribeSecret(), purpose);
  if (!email) return null;
  return await ctx.db
    .query("dolQueueAlerts")
    .withIndex("by_email", (q) => q.eq("email", email))
    .first();
}

export const confirmByToken = internalMutation({
  args: { token: v.string() },
  returns: v.union(
    v.object({
      email: v.string(),
      filingMonth: v.string(),
      alreadyReached: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const row = await rowForToken(ctx, args.token, "queue-confirm");
    if (!row) return null;

    // A confirm token never expires and is replayable by anyone who can read
    // the original email, including a corporate link scanner. So it cannot be
    // treated as a fresh act of consent: once someone has opted out, replaying
    // an older confirm link must NOT put them back on the list. Only a new
    // subscribe request (which stages a pending month) can do that.
    if (row.unsubscribedAt !== undefined && row.pendingFilingMonth === undefined) {
      return null;
    }

    // Reset the send ONLY when the month genuinely moved. `subscribe` stages
    // `pendingFilingMonth` on every request including a re-submit of the month
    // already on file, so a truthiness check here cleared `notifiedAt` for an
    // unchanged month, put the row back in the sweep, and mailed a second
    // "one alert per subscriber, ever".
    const monthChanged =
      row.pendingFilingMonth !== undefined && row.pendingFilingMonth !== row.filingMonth;
    const filingMonth = row.pendingFilingMonth ?? row.filingMonth;

    await ctx.db.patch(row._id, {
      confirmedAt: row.confirmedAt ?? Date.now(),
      filingMonth,
      pendingFilingMonth: undefined,
      unsubscribedAt: undefined,
      ...(monthChanged ? { notifiedAt: undefined } : {}),
    });

    // Most signups name a month the queue has ALREADY passed: the form offers
    // every month back to 2020 and the frontier sits inside that range. Without
    // this they would wait for the next DOL publication (realistically a month)
    // to be told about something that was already true when they signed up.
    const latest = await ctx.db
      .query("dolProcessingTimes")
      .withIndex("by_fetched")
      .order("desc")
      .first();
    const frontier =
      latest?.permQueues.find((q) => ANALYST_REVIEW.test(q.queue))?.priorityDate ?? null;
    const alreadyReached =
      frontier !== null && filingMonth <= frontier && (monthChanged || !row.notifiedAt);

    if (alreadyReached && latest) {
      await ctx.scheduler.runAfter(0, internal.queueAlerts.notifyQueueReached, {
        frontier,
        asOf: latest.permAsOf,
      });
    }

    return { email: row.email, filingMonth, alreadyReached };
  },
});

export const unsubscribeByToken = internalMutation({
  args: { token: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const row = await rowForToken(ctx, args.token, "queue-unsubscribe");
    if (!row) return false;

    // Also drop any staged month change. Leaving it would mean a replayed
    // confirm link could still resurrect them via the pending-month path.
    await ctx.db.patch(row._id, {
      unsubscribedAt: Date.now(),
      pendingFilingMonth: undefined,
    });
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
 *
 * Reads through `by_alert_sweep`, which leads with `notifiedAt` and
 * `unsubscribedAt`, and stops as soon as `limit` rows are collected. The
 * earlier version ran `.collect()` over every row with `filingMonth <=
 * frontier` and then filtered in JS, so as the frontier advanced it re-read
 * essentially the whole table on every sweep, including every row it had
 * already notified, and the `limit` argument bounded nothing. That is the
 * unbounded-`.collect()` pattern the Convex guidelines call out, and it fails
 * hard at the read limit rather than degrading.
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
    const out: {
      _id: Id<"dolQueueAlerts">;
      email: string;
      filingMonth: string;
    }[] = [];

    for await (const row of ctx.db
      .query("dolQueueAlerts")
      .withIndex("by_alert_sweep", (q) =>
        q
          .eq("notifiedAt", undefined)
          .eq("unsubscribedAt", undefined)
          .lte("filingMonth", args.frontier),
      )) {
      // Double opt-in: an unconfirmed row is inert. Filtered here rather than
      // indexed because it is the only remaining predicate and the index has
      // already cut the read down to un-notified, un-unsubscribed rows.
      if (!row.confirmedAt) continue;
      out.push({ _id: row._id, email: row.email, filingMonth: row.filingMonth });
      if (out.length >= args.limit) break;
    }

    return out;
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
 * Called after a new DOL snapshot lands, and again on confirm when the
 * subscriber's month was already passed. Sends at most NOTIFY_BATCH_LIMIT per
 * run and RESCHEDULES ITSELF for the remainder, because blowing the Resend cap
 * does not just delay these emails, it takes down password resets and deadline
 * reminders with them.
 *
 * The self-reschedule is the whole mechanism. An earlier version returned
 * `{ sent, remaining }` to `ctx.scheduler.runAfter`, which discards return
 * values, so nothing ever resumed: with 100 due, 40 were told and 60 waited for
 * the next DOL publication, roughly a month later.
 */
export const notifyQueueReached = internalAction({
  args: { frontier: v.string(), asOf: v.string() },
  returns: v.object({ sent: v.number(), failed: v.number(), remaining: v.boolean() }),
  handler: async (
    ctx,
    args,
  ): Promise<{ sent: number; failed: number; remaining: boolean }> => {
    const due = await ctx.runQuery(internal.queueAlerts.dueForAlert, {
      frontier: args.frontier,
      limit: NOTIFY_BATCH_LIMIT + 1,
    });

    const batch = due.slice(0, NOTIFY_BATCH_LIMIT);
    let remaining = due.length > NOTIFY_BATCH_LIMIT;
    let sent = 0;
    let failed = 0;

    for (const row of batch) {
      try {
        const token = await makeUnsubscribeToken(
          row.email,
          unsubscribeSecret(),
          "queue-unsubscribe",
        );
        const unsubUrl = actionUrl("/queue-alert/unsubscribe", token);

        const result = await sendEmailWithRetry(getResend(), {
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
            `Current figures: ${SITE_URL}/perm-processing-times`,
            "",
            "This was the only email you signed up for, and it will not repeat.",
            `Opt out entirely: ${unsubUrl}`,
            "",
            "PERM Tracker",
          ].join("\n"),
        });

        if (result.error) {
          // Do NOT mark notified. This subscriber stays due so a later sweep
          // retries them; stamping here would consume their one alert on a
          // send that never left the building.
          failed += 1;
          log.error("alert send failed", {
            email: row.email,
            error: result.error.message,
          });
          await recordError(
            ctx,
            "action",
            "queueAlerts.notifyQueueReached",
            new Error(`Resend: ${result.error.name}: ${result.error.message}`),
          );
          continue;
        }

        await ctx.runMutation(internal.queueAlerts.markNotified, { id: row._id });
        sent += 1;
      } catch (error) {
        // One bad address must not stop the sweep for everyone behind it.
        failed += 1;
        log.error("alert send threw", { email: row.email, error });
        await recordError(ctx, "action", "queueAlerts.notifyQueueReached", error);
      }
    }

    // A failure leaves that row due, so it would be picked up again next run.
    // Resume when there is more to do, but only when this run actually made
    // progress: rescheduling after a run where every send failed would spin a
    // timer against a service that is already down.
    if (failed > 0 && sent > 0) remaining = true;

    if (remaining && sent > 0) {
      await ctx.scheduler.runAfter(
        NOTIFY_RESUME_DELAY_MS,
        internal.queueAlerts.notifyQueueReached,
        args,
      );
    } else if (remaining) {
      log.error("notify sweep stalled: work remains but nothing sent this run", {
        frontier: args.frontier,
        failed,
      });
    }

    return { sent, failed, remaining };
  },
});
