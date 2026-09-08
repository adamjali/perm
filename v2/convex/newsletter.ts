/**
 * The weekly bulletin digest.
 *
 * Built OFF. `buildIssue` runs every Tuesday from the cron table and composes
 * an issue from what the ingests already hold, then stores it as a preview
 * the admin panel shows. Nothing is sent unless the deployment carries
 * `NEWSLETTER_ENABLED=1`; with it set, `sendBatch` mails confirmed
 * subscribers under a global daily cap and reschedules itself for the rest.
 *
 * Every figure comes from Turso through the public mirror: DOL's processing
 * times, the live remainder's pending count, the two newest bulletins, and
 * the Federal Register documents of the last seven days. The composition is
 * pure (`lib/newsletterCompose.ts`) and the HTML is rendered from the same
 * object, so the two parts cannot disagree.
 *
 * Consent is the alert forms' second checkbox, confirmed by the SAME click as
 * the alert (`lib/newsConsent.ts`, `emailPrefs.confirmNewsletterForEmail`).
 * The preference center turns it off; nothing here can turn it on.
 *
 * Budget: NEWSLETTER_DAILY_CAP sends a day (default 30), charged BEFORE each
 * send through the shared rate-limit table. The line is claimed in
 * convex/caseAlerts.ts's ledger; with the flag on, the worst day reaches
 * Resend's 100 exactly, so flipping it on means moving Resend off the free
 * tier or lowering the cap.
 *
 * @module convex/newsletter
 */
import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { FROM_EMAIL, getResend, sendEmailWithRetry } from "./lib/email";
import { recordError } from "./lib/errorRecording";
import { createLogger } from "./lib/logging";
import {
  composeSubject,
  composeText,
  type DigestData,
  type DigestNotice,
} from "./lib/newsletterCompose";
import { parseCutoff } from "./lib/perm/calculators/priorityDate";
import { one, rows } from "./lib/publicMirror";
import { checkAndRecordRateLimit } from "./lib/rateLimit";
import { newsletterDailyCap as dailyCap, newsletterSendingEnabled as sendingEnabled, summarizeNewsletter } from "./lib/newsletterSummary";
import { adminSummaryValidator, issueStatusValidator } from "./lib/newsletterValidators";
import { makeUnsubscribeToken } from "./lib/unsubscribeToken";

const log = createLogger("newsletter");
const DAY_MS = 24 * 60 * 60 * 1000;
const BATCH = 25;

function unsubscribeSecret(): string {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) throw new Error("UNSUBSCRIBE_SECRET is not configured");
  return secret;
}

function prefsBase(): string {
  const base = process.env.CONVEX_SITE_URL;
  if (!base) throw new Error("CONVEX_SITE_URL is not configured");
  return base;
}

// ---------------------------------------------------------------------------
// Reading the record
// ---------------------------------------------------------------------------

const MONTH_NAMES = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** "2025-11", "2025-11-01" or "November 2025" -> "2025-11"; anything else -> null. */
function monthKey(raw: string): string | null {
  const t = raw.trim();
  if (/^\d{4}-\d{2}/.test(t)) return t.slice(0, 7);
  const m = /^([A-Za-z]+)\.?,?\s+(\d{4})$/.exec(t);
  if (!m) return null;
  const idx = MONTH_NAMES.indexOf(m[1]!.toLowerCase());
  return idx < 0 ? null : `${m[2]}-${String(idx + 1).padStart(2, "0")}`;
}

interface QueueFacts {
  dolAsOf: string | null;
  frontierMonth: string | null;
  averageDays: number | null;
}

/** DOL's processing-times snapshot, the same row the site's pages read. */
async function readQueue(): Promise<QueueFacts> {
  const row = await one(
    "SELECT perm_as_of, json FROM processing_times ORDER BY perm_as_of DESC LIMIT 1",
  );
  if (!row || typeof row.json !== "string") return { dolAsOf: null, frontierMonth: null, averageDays: null };
  let doc: Record<string, unknown> = {};
  try {
    doc = JSON.parse(row.json) as Record<string, unknown>;
  } catch {
    return { dolAsOf: typeof row.perm_as_of === "string" ? row.perm_as_of : null, frontierMonth: null, averageDays: null };
  }
  const queues = Array.isArray(doc.permQueues) ? (doc.permQueues as Record<string, unknown>[]) : [];
  const analyst = queues.find((q) => typeof q.queue === "string" && /analyst review/i.test(q.queue));
  const pd = analyst && typeof analyst.priorityDate === "string" ? analyst.priorityDate : null;
  const frontierMonth = pd ? monthKey(pd) : null;
  const avg = Array.isArray(doc.permAverageDays) ? (doc.permAverageDays as Record<string, unknown>[])[0] : undefined;
  const averageDays = avg && typeof avg.calendarDays === "number" ? avg.calendarDays : null;
  return {
    dolAsOf: typeof row.perm_as_of === "string" ? row.perm_as_of.slice(0, 10) : null,
    frontierMonth,
    averageDays,
  };
}

/** Pending PERM cases in the live remainder, from the doc the sweep writes. */
async function readPending(): Promise<number | null> {
  const row = await one("SELECT json FROM perm_docs WHERE key = 'live_remainder'");
  if (!row || typeof row.json !== "string") return null;
  try {
    // The doc spreads its counts at the top level: { total, pending, decided, ... }.
    const doc = JSON.parse(row.json) as { pending?: unknown };
    const n = doc.pending;
    return typeof n === "number" ? n : null;
  } catch {
    return null;
  }
}

/** Newest bulletin held and how its final-action cells moved against the one before. */
async function readBulletin(): Promise<Pick<DigestData, "bulletinMonth" | "bulletinMoves">> {
  // One row per month; final_action is JSON of category -> country -> cell.
  const months = await rows(
    "SELECT bulletin_month, final_action FROM visa_bulletins ORDER BY bulletin_month DESC LIMIT 2",
  );
  const parse = (raw: unknown): Record<string, Record<string, string>> => {
    if (typeof raw !== "string") return {};
    try {
      const doc = JSON.parse(raw) as unknown;
      return doc && typeof doc === "object" ? (doc as Record<string, Record<string, string>>) : {};
    } catch {
      return {};
    }
  };
  const latest = months[0];
  const prior = months[1];
  if (!latest || typeof latest.bulletin_month !== "string") return { bulletinMonth: null, bulletinMoves: null };
  const bulletinMonth = latest.bulletin_month.slice(0, 7);
  if (!prior) return { bulletinMonth, bulletinMoves: null };
  const now = parse(latest.final_action);
  const before = parse(prior.final_action);
  // A non-date cell: C is open to every date, U is shut to all of them.
  const rank = (cell: unknown): number => {
    const c = parseCutoff(typeof cell === "string" ? cell : undefined);
    if (!c) return Number.NaN;
    if (c.kind === "current") return Number.POSITIVE_INFINITY;
    if (c.kind === "unavailable") return Number.NEGATIVE_INFINITY;
    return Date.parse(c.iso);
  };
  let advanced = 0;
  let held = 0;
  let retrogressed = 0;
  let total = 0;
  for (const [category, countries] of Object.entries(now)) {
    if (!countries || typeof countries !== "object") continue;
    for (const [country, cell] of Object.entries(countries)) {
      const previous = before[category]?.[country];
      if (previous === undefined) continue;
      const ra = rank(previous);
      const rb = rank(cell);
      if (Number.isNaN(ra) || Number.isNaN(rb)) continue;
      total += 1;
      if (ra === rb) held += 1;
      else if (rb > ra) advanced += 1;
      else retrogressed += 1;
    }
  }
  return { bulletinMonth, bulletinMoves: total > 0 ? { advanced, held, retrogressed, total } : null };
}

/** Federal Register documents from the last seven days, newest first. */
async function readNotices(sinceIso: string): Promise<DigestNotice[]> {
  const list = await rows(
    "SELECT title, html_url AS url, publication_date, type FROM policy_notices WHERE publication_date >= ? ORDER BY publication_date DESC, document_number DESC LIMIT 8",
    [sinceIso],
  );
  return list
    .filter((n) => typeof n.title === "string" && typeof n.url === "string" && typeof n.publication_date === "string")
    .map((n) => ({
      title: String(n.title),
      url: String(n.url),
      publicationDate: String(n.publication_date).slice(0, 10),
      type: typeof n.type === "string" ? n.type : "Notice",
    }));
}

async function renderHtml(data: DigestData): Promise<string> {
  const { render } = await import("@react-email/render");
  const { BulletinWeekly } = await import("../src/emails/BulletinWeekly");
  return await render(BulletinWeekly(data));
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

export const storeIssue = internalMutation({
  args: {
    weekOf: v.string(),
    data: v.string(),
    subject: v.string(),
    text: v.string(),
    html: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("newsletterIssues")
      .withIndex("by_weekOf", (q) => q.eq("weekOf", args.weekOf))
      .first();
    // A rebuild of a week that already went out must not reset its send state.
    if (existing && existing.status !== "preview") return null;
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, builtAt: Date.now() });
      return null;
    }
    await ctx.db.insert("newsletterIssues", {
      ...args,
      builtAt: Date.now(),
      status: "preview",
      sentCount: 0,
    });
    return null;
  },
});

const issueSlice = v.object({
  subject: v.string(),
  data: v.string(),
  status: issueStatusValidator,
  cursor: v.optional(v.string()),
});

export const issueForWeek = internalQuery({
  args: { weekOf: v.string() },
  returns: v.union(v.null(), issueSlice),
  handler: async (ctx, { weekOf }) => {
    const issue: Doc<"newsletterIssues"> | null = await ctx.db
      .query("newsletterIssues")
      .withIndex("by_weekOf", (q) => q.eq("weekOf", weekOf))
      .first();
    if (!issue) return null;
    return { subject: issue.subject, data: issue.data, status: issue.status, cursor: issue.cursor };
  },
});

export const markProgress = internalMutation({
  args: {
    weekOf: v.string(),
    sent: v.number(),
    cursor: v.optional(v.string()),
    status: v.union(v.literal("sending"), v.literal("sent")),
  },
  returns: v.null(),
  handler: async (ctx, { weekOf, sent, cursor, status }) => {
    const issue = await ctx.db
      .query("newsletterIssues")
      .withIndex("by_weekOf", (q) => q.eq("weekOf", weekOf))
      .first();
    if (!issue) return null;
    await ctx.db.patch(issue._id, {
      sentCount: issue.sentCount + sent,
      status,
      ...(cursor === undefined ? {} : { cursor }),
    });
    return null;
  },
});

/** Confirmed, not unsubscribed, in email order, after the cursor. */
export const confirmedAfter = internalQuery({
  args: { after: v.optional(v.string()), limit: v.number() },
  returns: v.array(v.string()),
  handler: async (ctx, { after, limit }) => {
    const out: string[] = [];
    const q = ctx.db
      .query("newsletterSubscribers")
      .withIndex("by_email", (x) => (after === undefined ? x : x.gt("email", after)))
      .order("asc");
    for await (const row of q) {
      if (row.confirmedAt !== undefined && row.unsubscribedAt === undefined) {
        out.push(row.email);
        if (out.length >= limit) break;
      }
    }
    return out;
  },
});

/** Charge one send against the global daily cap, BEFORE the send. */
export const chargeSend = internalMutation({
  args: {},
  returns: v.object({ allowed: v.boolean(), remaining: v.number() }),
  handler: async (ctx) => {
    const r = await checkAndRecordRateLimit(ctx, "all", "newsletter_send", {
      limit: dailyCap(),
      windowMs: DAY_MS,
    });
    return { allowed: r.allowed, remaining: r.remaining };
  },
});

// ---------------------------------------------------------------------------
// Building and sending
// ---------------------------------------------------------------------------

/** Compose this week's issue from the record and store it as a preview. */
export const buildIssue = internalAction({
  args: { weekOf: v.optional(v.string()) },
  returns: v.object({ weekOf: v.string(), subject: v.string(), scheduledSend: v.boolean() }),
  handler: async (ctx, args) => {
    const weekOf = args.weekOf ?? new Date().toISOString().slice(0, 10);
    const since = new Date(Date.now() - 7 * DAY_MS).toISOString().slice(0, 10);
    try {
      const [queue, pending, bulletin, notices] = await Promise.all([
        readQueue(),
        readPending(),
        readBulletin(),
        readNotices(since),
      ]);
      const data: DigestData = {
        weekOf,
        ...queue,
        pendingCases: pending,
        ...bulletin,
        notices,
      };
      const subject = composeSubject(data);
      const text = composeText(data);
      const html = await renderHtml(data);
      await ctx.runMutation(internal.newsletter.storeIssue, {
        weekOf,
        data: JSON.stringify(data),
        subject,
        text,
        html,
      });
      const enabled = sendingEnabled();
      log.info("issue built", { weekOf, subject, enabled });
      if (enabled) {
        await ctx.scheduler.runAfter(0, internal.newsletter.sendBatch, { weekOf });
      }
      return { weekOf, subject, scheduledSend: enabled };
    } catch (error) {
      await recordError(ctx, "action", `newsletter.buildIssue ${weekOf}`, error);
      throw error;
    }
  },
});

/**
 * Send up to the daily cap, then reschedule for the rest tomorrow. Charges
 * the budget before each send; a refusal leaves no trace of a success.
 */
export const sendBatch = internalAction({
  args: { weekOf: v.string() },
  returns: v.object({ sent: v.number(), done: v.boolean() }),
  handler: async (ctx, { weekOf }) => {
    if (!sendingEnabled()) {
      log.info("sending disabled; nothing sent", { weekOf });
      return { sent: 0, done: true };
    }
    const issue = await ctx.runQuery(internal.newsletter.issueForWeek, { weekOf });
    if (!issue || issue.status === "sent") return { sent: 0, done: true };
    const data = JSON.parse(issue.data) as DigestData;
    const resend = getResend();
    let cursor = issue.cursor;
    let sent = 0;
    let budgetHit = false;

    while (!budgetHit) {
      const batch = await ctx.runQuery(internal.newsletter.confirmedAfter, { after: cursor, limit: BATCH });
      if (batch.length === 0) break;
      for (const email of batch) {
        const charge = await ctx.runMutation(internal.newsletter.chargeSend, {});
        if (!charge.allowed) {
          budgetHit = true;
          break;
        }
        const token = await makeUnsubscribeToken(email, unsubscribeSecret(), "prefs");
        const prefsUrl = `${prefsBase()}/prefs?token=${encodeURIComponent(token)}`;
        const personal: DigestData = { ...data, prefsUrl };
        const result = await sendEmailWithRetry(resend, {
          from: FROM_EMAIL,
          to: email,
          subject: issue.subject,
          text: composeText(personal),
          html: await renderHtml(personal),
        });
        if (result.error) {
          log.warn("send failed", { weekOf, error: String(result.error) });
          await recordError(
            ctx,
            "action",
            `newsletter.sendBatch ${weekOf}`,
            new Error(`newsletter send failed: ${String(result.error)}`),
          );
        } else {
          sent += 1;
        }
        cursor = email;
      }
      if (batch.length < BATCH) break;
    }

    const done = !budgetHit;
    await ctx.runMutation(internal.newsletter.markProgress, {
      weekOf,
      sent,
      cursor,
      status: done ? "sent" : "sending",
    });
    log.info("batch finished", { weekOf, sent, done });
    // Progress-guarded: a day that sent nothing does not spin a timer.
    if (!done && sent > 0) {
      await ctx.scheduler.runAfter(DAY_MS, internal.newsletter.sendBatch, { weekOf });
    }
    return { sent, done };
  },
});

/** Everything the admin panel shows: list size and the latest issue. */
export const adminSummary = internalQuery({
  args: {},
  returns: adminSummaryValidator,
  handler: async (ctx) => await summarizeNewsletter(ctx),
});
