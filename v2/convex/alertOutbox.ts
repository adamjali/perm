/**
 * The alert outbox: one email per address per Eastern day, however many
 * things it follows. The policy and its reasons are in
 * `convex/lib/alertDelivery.ts`; this module holds the state and the sender.
 *
 * @module convex/alertOutbox
 */

import type { ReactElement } from "react";
import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { FROM_EMAIL, getResend, sendEmailWithRetry } from "./lib/email";
import { SITE_URL } from "./lib/links";
import { oneClickUnsubscribeUrl, prefsLink } from "./lib/prefsLink";
import { makeUnsubscribeToken } from "./lib/unsubscribeToken";
import { etDay, oneClickHeaders } from "./lib/alertDelivery";
import { recordError } from "./lib/errorRecording";
import { createLogger } from "./lib/logging";

const log = createLogger("AlertOutbox");

/** Addresses one run serves. The rest wait for the reschedule. */
const ADDRESSES_PER_RUN = 40;
/** Items one bundle carries; anything past this goes out tomorrow. */
const ITEMS_PER_BUNDLE = 12;
/** Failed sends before an item is given up and recorded as an error. */
const MAX_ATTEMPTS = 6;
/** Sent, dropped and failed rows are kept this long for the admin panel. */
const KEEP_MS = 30 * 86_400_000;

const kindValidator = v.union(
  v.literal("case"),
  v.literal("queue"),
  v.literal("bulletin"),
  v.literal("employer"),
);
const summaryValidator = v.object({
  title: v.string(),
  line: v.string(),
  url: v.string(),
  tone: v.optional(v.union(v.literal("good"), v.literal("bad"), v.literal("neutral"))),
});

function unsubscribeSecret(): string {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) throw new Error("UNSUBSCRIBE_SECRET is not configured");
  return secret;
}

/**
 * How many live things an address follows, counted to two.
 *
 * Two is all the policy needs ("one thing, or more than one"), so each read
 * stops as soon as the answer is settled. A queue alert is live until it has
 * fired, because it fires once; the others until the person opts out or the
 * case is decided.
 */
async function liveAtMostTwo(ctx: QueryCtx, email: string): Promise<number> {
  let n = 0;
  for await (const r of ctx.db.query("caseStatusAlerts").withIndex("by_email", (q) => q.eq("email", email))) {
    if (r.confirmedAt !== undefined && r.unsubscribedAt === undefined && r.caseClosedAt === undefined) {
      if (++n >= 2) return n;
    }
  }
  for await (const r of ctx.db.query("employerAlerts").withIndex("by_email", (q) => q.eq("email", email))) {
    if (r.confirmedAt !== undefined && r.unsubscribedAt === undefined) {
      if (++n >= 2) return n;
    }
  }
  for await (const r of ctx.db.query("bulletinAlerts").withIndex("by_email", (q) => q.eq("email", email))) {
    if (r.confirmedAt !== undefined && r.unsubscribedAt === undefined) {
      if (++n >= 2) return n;
    }
  }
  for await (const r of ctx.db.query("dolQueueAlerts").withIndex("by_email", (q) => q.eq("email", email))) {
    if (r.confirmedAt !== undefined && r.unsubscribedAt === undefined && r.notifiedAt === undefined) {
      if (++n >= 2) return n;
    }
  }
  return n;
}

export const deliveryState = internalQuery({
  args: { email: v.string(), day: v.string() },
  returns: v.object({
    sendNow: v.boolean(),
    mailedToday: v.boolean(),
    queued: v.boolean(),
    live: v.number(),
  }),
  handler: async (ctx, args) => {
    const recipient = await ctx.db
      .query("alertRecipients")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
    const mailedToday = recipient?.lastSentDay === args.day;
    const queued =
      (await ctx.db
        .query("alertOutbox")
        .withIndex("by_email_status", (q) => q.eq("email", args.email).eq("status", "queued"))
        .first()) !== null;
    const live = await liveAtMostTwo(ctx, args.email);
    return { sendNow: !mailedToday && !queued && live <= 1, mailedToday, queued, live };
  },
});

export const enqueue = internalMutation({
  args: {
    email: v.string(),
    kind: kindValidator,
    ref: v.string(),
    subject: v.string(),
    html: v.optional(v.string()),
    text: v.string(),
    listUnsubscribe: v.string(),
    summary: summaryValidator,
  },
  returns: v.id("alertOutbox"),
  handler: async (ctx, args) => {
    // One waiting item per row: a newer one for the same case or employer
    // replaces the older, so a bundle never says two things about one case.
    for await (const old of ctx.db
      .query("alertOutbox")
      .withIndex("by_ref_status", (q) => q.eq("ref", args.ref).eq("status", "queued"))) {
      if (old.email === args.email && args.kind !== "employer") {
        await ctx.db.patch(old._id, { status: "dropped", html: undefined, text: undefined, lastError: "superseded" });
      }
    }
    return await ctx.db.insert("alertOutbox", {
      ...args,
      status: "queued",
      createdAt: Date.now(),
      attempts: 0,
    });
  },
});

async function stampRecipient(
  ctx: { db: import("./_generated/server").MutationCtx["db"] },
  email: string,
  day: string,
  now: number,
) {
  const row = await ctx.db
    .query("alertRecipients")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();
  if (row) {
    await ctx.db.patch(row._id, { lastSentDay: day, lastSentAt: now, emailsSent: row.emailsSent + 1 });
  } else {
    await ctx.db.insert("alertRecipients", { email, lastSentDay: day, lastSentAt: now, emailsSent: 1 });
  }
}

/** A direct send: kept as a summary-only row so the admin panel sees every alert. */
export const recordDirect = internalMutation({
  args: {
    email: v.string(),
    kind: kindValidator,
    ref: v.string(),
    subject: v.string(),
    summary: summaryValidator,
    day: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert("alertOutbox", {
      email: args.email,
      kind: args.kind,
      ref: args.ref,
      status: "sent",
      subject: args.subject,
      summary: args.summary,
      createdAt: now,
      sentAt: now,
      bundleSize: 1,
      direct: true,
    });
    await stampRecipient(ctx, args.email, args.day, now);
    return null;
  },
});

/** Distinct addresses with something waiting, oldest item first. */
export const waitingAddresses = internalQuery({
  args: { limit: v.number() },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    const seen = new Set<string>();
    for await (const row of ctx.db
      .query("alertOutbox")
      .withIndex("by_status_created", (q) => q.eq("status", "queued"))) {
      seen.add(row.email);
      if (seen.size >= args.limit) break;
    }
    return [...seen];
  },
});

const itemValidator = v.object({
  _id: v.id("alertOutbox"),
  kind: kindValidator,
  subject: v.string(),
  html: v.optional(v.string()),
  text: v.optional(v.string()),
  listUnsubscribe: v.optional(v.string()),
  summary: summaryValidator,
  createdAt: v.number(),
});

/** What waits for one address, or nothing if it was already mailed today. */
export const waitingFor = internalQuery({
  args: { email: v.string(), day: v.string() },
  returns: v.array(itemValidator),
  handler: async (ctx, args) => {
    const recipient = await ctx.db
      .query("alertRecipients")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
    if (recipient?.lastSentDay === args.day) return [];
    const rows = await ctx.db
      .query("alertOutbox")
      .withIndex("by_email_status", (q) => q.eq("email", args.email).eq("status", "queued"))
      .take(ITEMS_PER_BUNDLE);
    return rows
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((r) => ({
        _id: r._id,
        kind: r.kind,
        subject: r.subject,
        html: r.html,
        text: r.text,
        listUnsubscribe: r.listUnsubscribe,
        summary: r.summary,
        createdAt: r.createdAt,
      }));
  },
});

export const markSent = internalMutation({
  args: { email: v.string(), ids: v.array(v.id("alertOutbox")), day: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const id of args.ids) {
      await ctx.db.patch(id, {
        status: "sent",
        sentAt: now,
        bundleSize: args.ids.length,
        html: undefined,
        text: undefined,
      });
    }
    await stampRecipient(ctx, args.email, args.day, now);
    return null;
  },
});

export const markAttempt = internalMutation({
  args: { ids: v.array(v.id("alertOutbox")), error: v.string() },
  returns: v.number(),
  handler: async (ctx, args) => {
    let gaveUp = 0;
    for (const id of args.ids) {
      const row = await ctx.db.get(id);
      if (!row || row.status !== "queued") continue;
      const attempts = (row.attempts ?? 0) + 1;
      const done = attempts >= MAX_ATTEMPTS;
      if (done) gaveUp += 1;
      await ctx.db.patch(id, {
        attempts,
        lastError: args.error.slice(0, 300),
        ...(done ? { status: "failed" as const, html: undefined, text: undefined } : {}),
      });
    }
    return gaveUp;
  },
});

type Waiting = {
  _id: Id<"alertOutbox">;
  kind: Doc<"alertOutbox">["kind"];
  subject: string;
  html?: string;
  text?: string;
  listUnsubscribe?: string;
  summary: Doc<"alertOutbox">["summary"];
};

/** "G-100-... is now CERTIFIED, and 2 more updates", kept inside an inbox line. */
export function bundleSubject(items: { summary: { title: string; line: string } }[]): string {
  const [first] = items;
  if (!first) return "Your PERM Tracker updates";
  const more = items.length - 1;
  const lead = `${first.summary.title}: ${first.summary.line}`;
  const tail = more === 1 ? ", and 1 more update" : `, and ${more} more updates`;
  const full = `${lead}${tail}`;
  return full.length <= 78 ? full : `${items.length} updates from PERM Tracker`;
}

/** The plain-text bundle. It must say everything the HTML does. */
export function bundleText(items: Waiting[], prefsUrl: string, stopUrl: string): string {
  return [
    `${items.length} things you follow moved since we last wrote.`,
    "",
    ...items.flatMap((i) => [`${i.summary.title}`, `  ${i.summary.line}`, `  ${i.summary.url}`, ""]),
    "Each figure is DOL's or the State Department's own published record. None of it is a prediction of your case.",
    "",
    `Everything this address follows, and turning any of it off: ${prefsUrl}`,
    `Stop all of these alerts: ${stopUrl}`,
    "",
    "PERM Tracker",
    SITE_URL,
  ].join("\n");
}

async function renderOrUndefined(
  ctx: Parameters<typeof recordError>[0],
  build: () => Promise<ReactElement>,
): Promise<string | undefined> {
  try {
    const { render } = await import("@react-email/render");
    return await render(await build());
  } catch (error) {
    await recordError(ctx, "action", "alertOutbox.sendBundles.render", error);
    return undefined;
  }
}

/**
 * Send what waits: one email per address, at most one per Eastern day.
 *
 * Runs half an hour after each alert sweep (see crons.ts). Reschedules itself
 * when more addresses wait than one run serves, guarded on having sent
 * something, so a Resend outage cannot spin a timer.
 */
export const sendBundles = internalAction({
  args: {},
  returns: v.object({ emails: v.number(), items: v.number(), failed: v.number(), held: v.number() }),
  handler: async (ctx): Promise<{ emails: number; items: number; failed: number; held: number }> => {
    const day = etDay(Date.now());
    const addresses = await ctx.runQuery(internal.alertOutbox.waitingAddresses, {
      limit: ADDRESSES_PER_RUN + 1,
    });
    let emails = 0;
    let itemsSent = 0;
    let failed = 0;
    let held = 0;

    for (const email of addresses.slice(0, ADDRESSES_PER_RUN)) {
      const items = (await ctx.runQuery(internal.alertOutbox.waitingFor, { email, day })) as Waiting[];
      if (items.length === 0) {
        held += 1; // already mailed today; tomorrow's first run takes it
        continue;
      }
      const ids = items.map((i) => i._id);
      try {
        let subject: string;
        let html: string | undefined;
        let text: string;
        let stopUrl: string;
        if (items.length === 1) {
          const only = items[0]!;
          subject = only.subject;
          html = only.html;
          text = only.text ?? only.summary.line;
          stopUrl = only.listUnsubscribe ?? "";
        } else {
          const token = await makeUnsubscribeToken(email, unsubscribeSecret(), "prefs");
          stopUrl = oneClickUnsubscribeUrl(token, "alerts");
          const prefsUrl = await prefsLink(email, unsubscribeSecret());
          subject = bundleSubject(items);
          text = bundleText(items, prefsUrl, stopUrl);
          html = await renderOrUndefined(ctx, async () => {
            const { DailyUpdate } = await import("../src/emails/DailyUpdate");
            return DailyUpdate({
              items: items.map((i) => ({ ...i.summary, kind: i.kind })),
              prefsUrl,
              stopUrl,
            });
          });
        }
        const result = await sendEmailWithRetry(getResend(), {
          from: FROM_EMAIL,
          to: email,
          subject,
          html,
          text,
          ...(stopUrl ? { headers: oneClickHeaders(stopUrl) } : {}),
        });
        if (result.error) {
          failed += 1;
          const gaveUp = await ctx.runMutation(internal.alertOutbox.markAttempt, {
            ids,
            error: `${result.error.name}: ${result.error.message}`,
          });
          log.error("bundle send failed", { items: ids.length, gaveUp, error: result.error.message });
          await recordError(
            ctx,
            "action",
            "alertOutbox.sendBundles",
            new Error(`Resend: ${result.error.name}: ${result.error.message}`),
          );
          continue;
        }
        await ctx.runMutation(internal.alertOutbox.markSent, { email, ids, day });
        emails += 1;
        itemsSent += ids.length;
      } catch (error) {
        failed += 1;
        await ctx.runMutation(internal.alertOutbox.markAttempt, {
          ids,
          error: error instanceof Error ? error.message : String(error),
        });
        await recordError(ctx, "action", "alertOutbox.sendBundles", error);
      }
    }

    if (addresses.length > ADDRESSES_PER_RUN && emails > 0) {
      await ctx.scheduler.runAfter(5 * 60 * 1000, internal.alertOutbox.sendBundles, {});
    }
    return { emails, items: itemsSent, failed, held };
  },
});

/** Daily: forget sent, dropped and failed rows past their month, and idle recipients. */
export const prune = internalMutation({
  args: {},
  returns: v.object({ rows: v.number(), recipients: v.number() }),
  handler: async (ctx) => {
    const cutoff = Date.now() - KEEP_MS;
    let rows = 0;
    for await (const row of ctx.db
      .query("alertOutbox")
      .withIndex("by_created", (q) => q.lt("createdAt", cutoff))) {
      if (row.status === "queued") continue;
      await ctx.db.delete(row._id);
      if (++rows >= 2000) break;
    }
    let recipients = 0;
    for await (const r of ctx.db
      .query("alertRecipients")
      .withIndex("by_last_sent", (q) => q.lt("lastSentAt", cutoff))) {
      await ctx.db.delete(r._id);
      if (++recipients >= 2000) break;
    }
    const oldDay = etDay(cutoff);
    for await (const r of ctx.db
      .query("budgetRefusals")
      .withIndex("by_day_pool", (q) => q.lt("day", oldDay))) {
      await ctx.db.delete(r._id);
    }
    return { rows, recipients };
  },
});
