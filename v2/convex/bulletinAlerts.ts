/**
 * Visa-bulletin movement alerts.
 *
 * The question after "has DOL reached my month" is "has my priority date
 * moved". The State Department publishes a new bulletin roughly monthly and
 * keeps no notification channel; we hold the 84-month archive (Turso
 * `visa_bulletins`, written by scripts/ingest_visa_bulletin.py), so we can
 * answer it the day a new bulletin lands in the archive.
 *
 * Third sibling of queueAlerts / caseAlerts, and it inherits their whole
 * consent grammar deliberately: double opt-in, staged changes, tombstoned
 * opt-outs, purpose-scoped tokens, per-IP limits in the HTTP layer, and a
 * global daily budget on the shared Resend cap (the full arithmetic lives in
 * convex/caseAlerts.ts).
 *
 * RECURRING, like case alerts: a cutoff can move every month, so the change
 * detector is `lastSeenCutoff` per subscription, baselined silently on the
 * first sweep after confirmation so the first email is a real movement and
 * not a restatement of what the subscriber could already see.
 *
 * Every send goes through `sendEmailWithRetry` (blocklist + returned-error
 * handling; the Resend SDK does not throw) and a failed send does NOT
 * advance `lastSeenCutoff` - stamping on failure would eat the movement.
 *
 * @module convex/bulletinAlerts
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
import type { ReactElement } from "react";
import { FROM_EMAIL, getResend, sendEmailWithRetry } from "./lib/email";
import { one as mirrorOne } from "./lib/publicMirror";
import {
  makeUnsubscribeToken,
  verifyUnsubscribeToken,
  type TokenPurpose,
} from "./lib/unsubscribeToken";
import { recordError } from "./lib/errorRecording";
import { checkAndRecordRateLimit } from "./lib/rateLimit";
import { stageNewsFor } from "./lib/newsConsent";
import { createLogger } from "./lib/logging";

const log = createLogger("BulletinAlerts");

const SITE_URL = "https://permtracker.app";

/** Categories as the archive prints them. Country keys as the JSON stores them. */
export const CATEGORIES = ["EB1", "EB2", "EB3", "EW3", "EB4", "EB5"] as const;
export const COUNTRIES = [
  "worldwide",
  "china",
  "india",
  "mexico",
  "philippines",
] as const;

const categoryValidator = v.union(...CATEGORIES.map((c) => v.literal(c)));
const countryValidator = v.union(...COUNTRIES.map((c) => v.literal(c)));

/** Alerts one sweep may send; the remainder reschedules. Budget arithmetic in caseAlerts.ts. */
const ALERT_BATCH_LIMIT = 12;
const ALERT_GLOBAL_BUDGET = { limit: 12, windowMs: 24 * 60 * 60 * 1000 };
const CONFIRMATION_GLOBAL_BUDGET = { limit: 6, windowMs: 24 * 60 * 60 * 1000 };
const CONFIRMATION_COOLDOWN_MS = 10 * 60 * 1000;
const SUBSCRIBE_IP_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 };
const RESUME_DELAY_MS = 5 * 60 * 1000;

const NEUTRAL_REPLY = "Check your inbox to confirm.";
const THROTTLED_REPLY = "Too many requests. Try again in a little while.";

function isPlausibleEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

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

/** "EB2 India", "EB3 all countries" - one label used by subjects and bodies alike. */
export function seriesLabel(category: string, country: string): string {
  const countryLabel =
    country === "worldwide"
      ? "all countries"
      : country.charAt(0).toUpperCase() + country.slice(1);
  return `${category} ${countryLabel}`;
}

/** A cutoff cell in plain words. "C" and "U" are opposites, never dates. */
export function cutoffInWords(cutoff: string): string {
  if (cutoff === "C") return "Current (open to every priority date)";
  if (cutoff === "U") return "Unavailable (no visa numbers)";
  return cutoff;
}

// ============================================================================
// Subscribe
// ============================================================================

export const subscribe = internalMutation({
  args: {
    email: v.string(),
    category: categoryValidator,
    country: countryValidator,
    source: v.optional(v.string()),
    /**
     * The product-news checkbox on the form. Staged here rather than by a
     * follow-up mutation from the HTTP layer, and passed on to the
     * confirmation so the email can say so. See convex/emailPrefs.ts.
     */
    news: v.optional(v.boolean()),
    ip: v.optional(v.string()),
  },
  returns: v.object({
    ok: v.boolean(),
    message: v.string(),
    throttled: v.optional(v.boolean()),
  }),
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    if (!isPlausibleEmail(email)) {
      return { ok: false, message: "That email address does not look right." };
    }

    const ip = args.ip?.trim();
    if (ip && ip !== "unknown") {
      const perIp = await checkAndRecordRateLimit(
        ctx,
        ip,
        "bulletin_subscribe_ip",
        SUBSCRIBE_IP_LIMIT,
      );
      if (!perIp.allowed) {
        return { ok: false, message: THROTTLED_REPLY, throttled: true };
      }
    }

    const existing = await ctx.db
      .query("bulletinAlerts")
      .withIndex("by_email_series", (q) =>
        q.eq("email", email).eq("category", args.category).eq("country", args.country),
      )
      .first();

    const now = Date.now();
    const series = `${args.category}|${args.country}`;

    if (existing) {
      const withinCooldown =
        existing.lastConfirmationSentAt !== undefined &&
        now - existing.lastConfirmationSentAt < CONFIRMATION_COOLDOWN_MS;
      if (withinCooldown) {
        return { ok: true, message: NEUTRAL_REPLY };
      }
      // Staged, never applied live: an unauthenticated POST proves nothing.
      // For an existing (email, series) row the "change" is a re-request of
      // the same series, which is what lets a fresh confirm click resurrect
      // a tombstoned row - and nothing else can.
      await ctx.db.patch(existing._id, {
        pendingSeries: series,
        lastConfirmationSentAt: now,
      });
    } else {
      await ctx.db.insert("bulletinAlerts", {
        email,
        category: args.category,
        country: args.country,
        pendingSeries: series,
        createdAt: now,
        source: args.source,
        lastConfirmationSentAt: now,
      });
    }

    const budget = await checkAndRecordRateLimit(
      ctx,
      "all",
      "bulletin_subscribe_global",
      CONFIRMATION_GLOBAL_BUDGET,
    );
    if (!budget.allowed) {
      log.error("bulletin confirmation budget exhausted; refusing to send");
      return { ok: false, message: THROTTLED_REPLY, throttled: true };
    }

    // Stage the product-news opt-in in THIS transaction, next to the schedule
    // call, so the row and the email that names it are one write. Doing it
    // from the HTTP layer after this mutation returned raced the send action,
    // which is why the flag is threaded rather than looked up. Reached only on
    // the accepted path, so a request the cooldown absorbed (which sends no
    // email) can no longer stage news nobody was told about.
    const includesNews = args.news === true;
    if (includesNews) {
      await stageNewsFor(ctx, email, args.source);
    }

    await ctx.scheduler.runAfter(0, internal.bulletinAlerts.sendConfirmation, {
      email,
      category: args.category,
      country: args.country,
      includesNews,
    });

    return { ok: true, message: NEUTRAL_REPLY };
  },
});

export const clearConfirmationCooldown = internalMutation({
  args: { email: v.string(), category: v.string(), country: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("bulletinAlerts")
      .withIndex("by_email_series", (q) =>
        q.eq("email", args.email).eq("category", args.category).eq("country", args.country),
      )
      .first();
    if (row) {
      await ctx.db.patch(row._id, { lastConfirmationSentAt: undefined });
    }
    return null;
  },
});

async function renderOrTextOnly(
  ctx: Parameters<typeof recordError>[0],
  where: string,
  build: () => Promise<ReactElement>,
): Promise<string | undefined> {
  try {
    const { render } = await import("@react-email/render");
    return await render(await build());
  } catch (error) {
    log.error("email render failed, sending text only", { where });
    await recordError(ctx, "action", where, error);
    return undefined;
  }
}

export const sendConfirmation = internalAction({
  args: {
    email: v.string(),
    category: categoryValidator,
    country: countryValidator,
    /**
     * Whether `subscribe` also staged a product-news opt-in for this address.
     *
     * Passed in rather than queried: `subscribe` schedules this action from
     * inside its own transaction, so a lookup here could run before the
     * staging commits and send an email that names nothing while the row
     * exists. Optional so anything already in flight when this shipped still
     * renders, and absent means "say nothing", which is the safe direction.
     */
    includesNews: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const includesNews = args.includesNews === true;
      const token = await makeUnsubscribeToken(
        args.email,
        unsubscribeSecret(),
        "bulletin-confirm",
      );
      const confirmUrl = actionUrl("/bulletin-alert/confirm", token);
      const label = seriesLabel(args.category, args.country);

      const html = await renderOrTextOnly(
        ctx,
        "bulletinAlerts.sendConfirmation.render",
        async () => {
          const { BulletinAlertConfirm } = await import(
            "../src/emails/BulletinAlertConfirm"
          );
          return BulletinAlertConfirm({
            seriesLabel: label,
            confirmUrl,
            includesNews,
          });
        },
      );

      const result = await sendEmailWithRetry(getResend(), {
        from: FROM_EMAIL,
        to: args.email,
        subject: `Confirm your visa bulletin alert for ${label}`,
        html,
        text: [
          `You asked to be told when the State Department's final-action cutoff for ${label} moves.`,
          "",
          "Confirm here and we'll email you when a new bulletin changes it:",
          confirmUrl,
          "",
          // The text part must not disagree with the HTML: both name the news
          // opt-in or neither does. One click confirming two things is only
          // consent for the second if the email said so.
          ...(includesNews
            ? [
                "You also asked for occasional product news. The same click confirms that.",
                "",
              ]
            : []),
          "If you didn't ask for this, ignore this message. Nothing further will be sent.",
          "",
          "PERM Tracker",
          `${SITE_URL}/tools/priority-date-calculator`,
        ].join("\n"),
      });

      if (result.error) {
        log.error("bulletin confirmation send failed", {
          error: result.error.message,
        });
        await recordError(
          ctx,
          "action",
          "bulletinAlerts.sendConfirmation",
          new Error(`Resend: ${result.error.name}: ${result.error.message}`),
        );
        await ctx.runMutation(internal.bulletinAlerts.clearConfirmationCooldown, {
          email: args.email,
          category: args.category,
          country: args.country,
        });
      }
    } catch (error) {
      await recordError(ctx, "action", "bulletinAlerts.sendConfirmation", error);
      await ctx.runMutation(internal.bulletinAlerts.clearConfirmationCooldown, {
        email: args.email,
        category: args.category,
        country: args.country,
      });
    }
    return null;
  },
});

// ============================================================================
// Confirm / unsubscribe
// ============================================================================

async function rowsForToken(
  ctx: MutationCtx,
  token: string,
  purpose: TokenPurpose,
): Promise<Doc<"bulletinAlerts">[]> {
  const email = await verifyUnsubscribeToken(token, unsubscribeSecret(), purpose);
  if (!email) return [];
  return await ctx.db
    .query("bulletinAlerts")
    .withIndex("by_email", (q) => q.eq("email", email))
    .collect();
}

export const confirmByToken = internalMutation({
  args: { token: v.string() },
  returns: v.union(
    v.object({ email: v.string(), series: v.array(v.string()) }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const rows = await rowsForToken(ctx, args.token, "bulletin-confirm");
    if (rows.length === 0) return null;

    const confirmed: string[] = [];
    let email: string | null = null;

    for (const row of rows) {
      // Replayed confirm links must not resurrect an opt-out; only a fresh
      // subscribe (which stages pendingSeries) re-arms the row.
      if (row.unsubscribedAt !== undefined && row.pendingSeries === undefined) {
        continue;
      }
      await ctx.db.patch(row._id, {
        confirmedAt: row.confirmedAt ?? Date.now(),
        pendingSeries: undefined,
        unsubscribedAt: undefined,
      });
      confirmed.push(seriesLabel(row.category, row.country));
      email = row.email;
    }

    if (email === null) return null;
    await ctx.runMutation(internal.emailPrefs.confirmNewsForEmail, { email });
    return { email, series: confirmed };
  },
});

export const unsubscribeByToken = internalMutation({
  args: { token: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const rows = await rowsForToken(ctx, args.token, "bulletin-unsubscribe");
    if (rows.length === 0) return false;
    const now = Date.now();
    for (const row of rows) {
      if (row.unsubscribedAt !== undefined && row.pendingSeries === undefined) continue;
      await ctx.db.patch(row._id, {
        unsubscribedAt: now,
        pendingSeries: undefined,
      });
    }
    return true;
  },
});

// ============================================================================
// The sweep
// ============================================================================

/** Live, confirmed subscriptions, oldest first. The table is small. */
export const liveSubscriptions = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("bulletinAlerts"),
      email: v.string(),
      category: v.string(),
      country: v.string(),
      lastSeenCutoff: v.optional(v.string()),
      lastSeenBulletin: v.optional(v.string()),
    }),
  ),
  handler: async (ctx) => {
    const out: {
      _id: Id<"bulletinAlerts">;
      email: string;
      category: string;
      country: string;
      lastSeenCutoff?: string;
      lastSeenBulletin?: string;
    }[] = [];
    for await (const row of ctx.db
      .query("bulletinAlerts")
      .withIndex("by_alert_sweep", (q) => q.eq("unsubscribedAt", undefined))) {
      if (!row.confirmedAt) continue;
      out.push({
        _id: row._id,
        email: row.email,
        category: row.category,
        country: row.country,
        lastSeenCutoff: row.lastSeenCutoff,
        lastSeenBulletin: row.lastSeenBulletin,
      });
    }
    return out;
  },
});

export const recordSeen = internalMutation({
  args: {
    id: v.id("bulletinAlerts"),
    cutoff: v.string(),
    bulletinMonth: v.string(),
    sent: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const patch: Partial<Doc<"bulletinAlerts">> = {
      lastSeenCutoff: args.cutoff,
      lastSeenBulletin: args.bulletinMonth,
    };
    if (args.sent) {
      const row = await ctx.db.get(args.id);
      patch.lastAlertSentAt = Date.now();
      patch.alertCount = (row?.alertCount ?? 0) + 1;
    }
    await ctx.db.patch(args.id, patch);
    return null;
  },
});

/**
 * Compare every live subscription against the newest bulletin in the archive
 * and mail the ones whose cutoff moved. Runs daily off a cron; cheap when
 * nothing changed (one Turso row read, zero sends).
 */
export const sweep = internalAction({
  args: {},
  returns: v.object({ sent: v.number(), failed: v.number(), baselined: v.number() }),
  handler: async (ctx): Promise<{ sent: number; failed: number; baselined: number }> => {
    let latest: { month: string; finalAction: Record<string, Record<string, string>> };
    try {
      const row = await mirrorOne(
        "SELECT bulletin_month, final_action FROM visa_bulletins " +
          "ORDER BY bulletin_month DESC LIMIT 1",
      );
      if (!row) return { sent: 0, failed: 0, baselined: 0 };
      latest = {
        month: String(row.bulletin_month),
        finalAction: JSON.parse(String(row.final_action)) as Record<
          string,
          Record<string, string>
        >,
      };
    } catch (error) {
      await recordError(ctx, "action", "bulletinAlerts.sweep.read", error);
      throw error;
    }

    const subs = await ctx.runQuery(internal.bulletinAlerts.liveSubscriptions, {});
    let sent = 0;
    let failed = 0;
    let baselined = 0;

    for (const sub of subs) {
      const cutoff = latest.finalAction[sub.category]?.[sub.country];
      if (cutoff === undefined) continue; // series absent from this bulletin

      // First sighting after confirmation: baseline silently. The subscriber
      // saw the current value on the page they subscribed from; the alert
      // they asked for is the NEXT movement.
      if (sub.lastSeenCutoff === undefined || sub.lastSeenBulletin === undefined) {
        await ctx.runMutation(internal.bulletinAlerts.recordSeen, {
          id: sub._id,
          cutoff,
          bulletinMonth: latest.month,
          sent: false,
        });
        baselined += 1;
        continue;
      }

      if (latest.month <= sub.lastSeenBulletin || cutoff === sub.lastSeenCutoff) {
        // Same bulletin, or a new bulletin that left this series where it
        // was. Advance the month stamp so the next comparison is against the
        // newest bulletin, without burning a send.
        if (latest.month > sub.lastSeenBulletin) {
          await ctx.runMutation(internal.bulletinAlerts.recordSeen, {
            id: sub._id,
            cutoff,
            bulletinMonth: latest.month,
            sent: false,
          });
        }
        continue;
      }

      if (sent >= ALERT_BATCH_LIMIT) {
        // Remainder picked up by the rescheduled run below.
        continue;
      }
      const budget = await ctx.runMutation(internal.bulletinAlerts.claimAlertBudget, {});
      if (!budget) {
        log.error("bulletin alert budget exhausted mid-sweep; remainder waits");
        break;
      }

      try {
        const token = await makeUnsubscribeToken(
          sub.email,
          unsubscribeSecret(),
          "bulletin-unsubscribe",
        );
        const unsubUrl = actionUrl("/bulletin-alert/unsubscribe", token);
        const label = seriesLabel(sub.category, sub.country);
        const fromWords = cutoffInWords(sub.lastSeenCutoff);
        const toWords = cutoffInWords(cutoff);

        const html = await renderOrTextOnly(
          ctx,
          "bulletinAlerts.sweep.render",
          async () => {
            const { BulletinMoved } = await import("../src/emails/BulletinMoved");
            return BulletinMoved({
              seriesLabel: label,
              bulletinMonth: latest.month,
              fromCutoff: fromWords,
              toCutoff: toWords,
              unsubscribeUrl: unsubUrl,
            });
          },
        );

        const result = await sendEmailWithRetry(getResend(), {
          from: FROM_EMAIL,
          to: sub.email,
          subject: `${label} moved in the ${latest.month} visa bulletin`,
          html,
          headers: {
            "List-Unsubscribe": `<${unsubUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
          text: [
            `The State Department's ${latest.month} visa bulletin changed the final-action cutoff for ${label}.`,
            "",
            `Before: ${fromWords}`,
            `Now: ${toWords}`,
            "",
            "This is the State Department's own published figure. It isn't advice",
            "and it isn't a prediction of your case.",
            "",
            `History and the full board: ${SITE_URL}/tools/priority-date-calculator`,
            "",
            `Stop these alerts: ${unsubUrl}`,
            "",
            "PERM Tracker",
          ].join("\n"),
        });

        if (result.error) {
          failed += 1;
          log.error("bulletin alert send failed", { error: result.error.message });
          await recordError(
            ctx,
            "action",
            "bulletinAlerts.sweep",
            new Error(`Resend: ${result.error.name}: ${result.error.message}`),
          );
          continue; // lastSeen NOT advanced; retried next run
        }

        await ctx.runMutation(internal.bulletinAlerts.recordSeen, {
          id: sub._id,
          cutoff,
          bulletinMonth: latest.month,
          sent: true,
        });
        sent += 1;
      } catch (error) {
        failed += 1;
        await recordError(ctx, "action", "bulletinAlerts.sweep", error);
      }
    }

    // More movements than one batch could send: resume shortly, but only if
    // this run made progress (same stall logic as the queue sweep).
    const moved = subs.length - baselined;
    if (sent === ALERT_BATCH_LIMIT && moved > sent && sent > 0) {
      await ctx.scheduler.runAfter(RESUME_DELAY_MS, internal.bulletinAlerts.sweep, {});
    }

    return { sent, failed, baselined };
  },
});

/** Claim one send from the daily bulletin-alert budget. */
export const claimAlertBudget = internalMutation({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const r = await checkAndRecordRateLimit(
      ctx,
      "all",
      "bulletin_alert_global",
      ALERT_GLOBAL_BUDGET,
    );
    return r.allowed;
  },
});
