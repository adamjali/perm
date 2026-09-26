/**
 * Follow an employer: an email when DOL moves its PERM cases as a group.
 *
 * The census page (`/perm-employers/under-review`) was quoted to about 127,000
 * people on X on Sep 25 2026, and the question every reply asked was "tell me
 * when it changes". This answers it for one employer at a time, from the list
 * of employer-wide moves the daily sweep already writes into
 * `perm_docs['employer_stages']`:
 *
 * - `holdMoves`: a day five or more of the employer's cases went on hold or
 *   came off it;
 * - `decisionMoves`: a day a batch of them was decided, big against both the
 *   employer's queue and its own usual pace.
 *
 * The rules for both live in `scripts/ingest_case_status_direct.py` beside
 * their tests; this module only remembers which moves each follower has been
 * told (`toldMoves`) and mails the rest. Every sentence names who acted: DOL
 * holds, releases, certifies and denies; the employer withdraws. No reason
 * appears, because DOL publishes none.
 *
 * ## Consent and budgets
 *
 * The same grammar as the other three alert kinds: an unauthenticated POST
 * stages a follow, a confirm click makes it live, the token is purpose-scoped
 * (`employer-confirm` / `employer-unsubscribe`), opt-outs are tombstones.
 * The employer's name in every email comes from our own records, looked up
 * by the HTTP route from the slug, never from the form, so nobody can make
 * this send words of their choosing to someone else's inbox.
 *
 * It claims no new line in the Resend arithmetic (convex/caseAlerts.ts):
 * confirmations share the case confirmations' 15 a day, alerts share the case
 * alerts' 18 (`convex/lib/alertBudgets.ts`), and every alert leaves through
 * `deliverAlert`, so a follower gets at most one alert email a day whatever
 * else they follow.
 *
 * @module convex/employerAlerts
 */

import type { ReactElement } from "react";
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
import { SITE_URL, actionUrl } from "./lib/links";
import { prefsLink } from "./lib/prefsLink";
import {
  makeUnsubscribeToken,
  verifyUnsubscribeToken,
} from "./lib/unsubscribeToken";
import { one } from "./lib/publicMirror";
import { recordError } from "./lib/errorRecording";
import {
  checkAndRecordRateLimit,
  checkRateLimit,
  recordRateLimitAttempt,
} from "./lib/rateLimit";
import { stageNewsFor, stageNewsletterFor } from "./lib/newsConsent";
import { createLogger } from "./lib/logging";
import {
  CASE_ALERT_BUDGET,
  CASE_ALERT_KEY,
  CASE_CONFIRMATION_BUDGET,
  CASE_CONFIRMATION_KEY,
  noteRefusal,
} from "./lib/alertBudgets";
import { deliverAlert, etDay } from "./lib/alertDelivery";
import { dropQueued } from "./lib/alertOutboxStore";
import {
  HOLD_STATUS,
  QUEUE_STATUS,
  employerMoves,
  longDate,
  parseEmployerStagesDoc,
  type EmployerMove,
  type EmployerStagesDoc,
} from "../src/lib/employerStages";

const log = createLogger("EmployerAlerts");

/** Follows one address may hold. A product limit and a read bound. */
export const MAX_EMPLOYERS_PER_ADDRESS = 25;
const CONFIRMATION_COOLDOWN_MS = 10 * 60 * 1000;
const SUBSCRIBE_IP_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 };
/** Rows one sweep reads, and alerts one sweep may build. */
const CHECK_BATCH_LIMIT = 300;
const ALERT_BATCH_LIMIT = 18;
/** A move older than this many days is history, not news, and is never sent. */
const FRESH_DAYS = 3;
/** Keys remembered per follow; the doc holds at most 120 days of moves. */
const TOLD_CAP = 80;
const APPEAL_STATUSES = ["RECONSIDERATION APPEALS", "BALCA APPEALS", "REQUEST FOR REVIEW"];

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,119}$/;

const THROTTLED_REPLY =
  "We can't send confirmation emails right now. Please try again in a little while.";
const NEUTRAL_REPLY = "Check your inbox to confirm.";

function isPlausibleEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function unsubscribeSecret(): string {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) throw new Error("UNSUBSCRIBE_SECRET is not configured");
  return secret;
}

function employerUrl(slug: string): string {
  return `${SITE_URL}/perm-employers/${slug}`;
}

/** Shift an ISO date by whole days, no time zone involved. */
function isoMinusDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** "Sep 24" for the move rows; the census date takes the long form. */
function shortDate(iso: string): string {
  return longDate(iso).replace(/^(\w{3})\w*/, "$1").replace(/, \d{4}$/, "");
}

// ============================================================================
// Who an employer is, from our own records
// ============================================================================

/**
 * The employer's name for a slug, or null when we hold no such employer.
 *
 * Published employers are in `perm_entities`; ones DOL has not published yet
 * are in `perm_live_only_index`. Both are primary-key reads. Used by the HTTP
 * route BEFORE `subscribe`, so the name in the confirmation email is ours.
 */
export async function employerNameFor(slug: string): Promise<string | null> {
  if (!SLUG_RE.test(slug)) return null;
  const published = await one(
    "SELECT name FROM perm_entities WHERE kind = 'employer' AND slug = ?",
    [slug],
  );
  if (typeof published?.name === "string" && published.name) return published.name;
  const live = await one("SELECT name FROM perm_live_only_index WHERE slug = ?", [slug]);
  return typeof live?.name === "string" && live.name ? live.name : null;
}

// ============================================================================
// Subscribe
// ============================================================================

/** Internal: the only caller is the HTTP route, which verified the name. */
export const subscribe = internalMutation({
  args: {
    email: v.string(),
    slug: v.string(),
    employerName: v.string(),
    source: v.optional(v.string()),
    news: v.optional(v.boolean()),
    newsletter: v.optional(v.boolean()),
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
    if (!SLUG_RE.test(args.slug)) {
      return { ok: false, message: "We don't know that employer." };
    }

    const ip = args.ip?.trim();
    if (ip && ip !== "unknown") {
      const perIp = await checkAndRecordRateLimit(ctx, ip, "employer_subscribe_ip", SUBSCRIBE_IP_LIMIT);
      if (!perIp.allowed) return { ok: false, message: THROTTLED_REPLY, throttled: true };
    }

    const existing = await ctx.db
      .query("employerAlerts")
      .withIndex("by_email_slug", (q) => q.eq("email", email).eq("slug", args.slug))
      .first();
    const forThisAddress = await ctx.db
      .query("employerAlerts")
      .withIndex("by_email", (q) => q.eq("email", email))
      .take(MAX_EMPLOYERS_PER_ADDRESS + 1);
    const now = Date.now();
    const lastSent = forThisAddress.reduce((a, r) => Math.max(a, r.lastConfirmationSentAt ?? 0), 0);
    if (lastSent > 0 && now - lastSent < CONFIRMATION_COOLDOWN_MS) {
      return { ok: true, message: NEUTRAL_REPLY };
    }
    if (!existing && forThisAddress.length >= MAX_EMPLOYERS_PER_ADDRESS) {
      return { ok: true, message: NEUTRAL_REPLY };
    }

    // Charged BEFORE the write, so a refusal leaves no stamp for a retry to
    // trip over (the Sep 4 2026 lesson in convex/caseAlerts.ts).
    const budget = await checkAndRecordRateLimit(ctx, "all", CASE_CONFIRMATION_KEY, CASE_CONFIRMATION_BUDGET);
    if (!budget.allowed) {
      await noteRefusal(ctx, "caseConfirm");
      log.error("confirmation budget exhausted; refusing to send", { limit: CASE_CONFIRMATION_BUDGET.limit });
      return { ok: false, message: THROTTLED_REPLY, throttled: true };
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        pendingSlug: args.slug,
        pendingName: args.employerName,
        lastConfirmationSentAt: now,
      });
    } else {
      await ctx.db.insert("employerAlerts", {
        email,
        slug: args.slug,
        employerName: args.employerName,
        pendingSlug: args.slug,
        pendingName: args.employerName,
        createdAt: now,
        source: args.source,
        lastConfirmationSentAt: now,
      });
    }

    const includesNews = args.news === true;
    if (includesNews) await stageNewsFor(ctx, email, args.source);
    const includesNewsletter = args.newsletter === true;
    if (includesNewsletter) await stageNewsletterFor(ctx, email, args.source);

    await ctx.scheduler.runAfter(0, internal.employerAlerts.sendConfirmation, {
      email,
      slug: args.slug,
      employerName: args.employerName,
      includesNews,
      includesNewsletter,
    });
    return { ok: true, message: NEUTRAL_REPLY };
  },
});

export const clearConfirmationCooldown = internalMutation({
  args: { email: v.string(), slug: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("employerAlerts")
      .withIndex("by_email_slug", (q) => q.eq("email", args.email).eq("slug", args.slug))
      .first();
    if (row) await ctx.db.patch(row._id, { lastConfirmationSentAt: undefined });
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
    slug: v.string(),
    employerName: v.string(),
    includesNews: v.optional(v.boolean()),
    includesNewsletter: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const token = await makeUnsubscribeToken(args.email, unsubscribeSecret(), "employer-confirm");
      const confirmUrl = actionUrl("/employer-alert/confirm", token);
      const html = await renderOrTextOnly(ctx, "employerAlerts.sendConfirmation.render", async () => {
        const { EmployerAlertConfirm } = await import("../src/emails/EmployerAlertConfirm");
        return EmployerAlertConfirm({
          employerName: args.employerName,
          confirmUrl,
          includesNews: args.includesNews === true,
          includesNewsletter: args.includesNewsletter === true,
        });
      });
      const result = await sendEmailWithRetry(getResend(), {
        from: FROM_EMAIL,
        to: args.email,
        subject: `Confirm: follow ${args.employerName} on PERM Tracker`,
        html,
        text: [
          `You asked to follow ${args.employerName}'s PERM cases.`,
          "",
          "We'll email you when DOL puts five or more of them on hold or takes them off it in a day,",
          "or decides a batch of them well above its usual pace. Never more than one email a day.",
          "",
          "Confirm here:",
          confirmUrl,
          "",
          ...(args.includesNews
            ? ["You also asked for occasional product news. The same click confirms that.", ""]
            : []),
          ...(args.includesNewsletter
            ? ["You also asked for the weekly bulletin digest, once it launches. The same click confirms that.", ""]
            : []),
          "If you didn't ask for this, ignore this message. Nothing further will be sent.",
          "",
          "PERM Tracker",
          employerUrl(args.slug),
        ].join("\n"),
      });
      if (result.error) {
        await recordError(
          ctx,
          "action",
          "employerAlerts.sendConfirmation",
          new Error(`Resend: ${result.error.name}: ${result.error.message}`),
        );
        await ctx.runMutation(internal.employerAlerts.clearConfirmationCooldown, {
          email: args.email,
          slug: args.slug,
        });
      }
    } catch (error) {
      await recordError(ctx, "action", "employerAlerts.sendConfirmation", error);
      await ctx.runMutation(internal.employerAlerts.clearConfirmationCooldown, {
        email: args.email,
        slug: args.slug,
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
  purpose: "employer-confirm" | "employer-unsubscribe",
): Promise<Doc<"employerAlerts">[]> {
  const email = await verifyUnsubscribeToken(token, unsubscribeSecret(), purpose);
  if (!email) return [];
  return await ctx.db
    .query("employerAlerts")
    .withIndex("by_email", (q) => q.eq("email", email))
    .take(MAX_EMPLOYERS_PER_ADDRESS);
}

export const confirmByToken = internalMutation({
  args: { token: v.string() },
  returns: v.union(v.object({ email: v.string(), employers: v.array(v.string()) }), v.null()),
  handler: async (ctx, args) => {
    const all = await rowsForToken(ctx, args.token, "employer-confirm");
    const confirmed: string[] = [];
    const now = Date.now();
    for (const row of all) {
      // Only a fresh request stages a slug; a replayed link finds nothing to do.
      if (row.pendingSlug === undefined) continue;
      const moved = row.slug !== row.pendingSlug;
      await ctx.db.patch(row._id, {
        confirmedAt: row.confirmedAt ?? now,
        slug: row.pendingSlug,
        employerName: row.pendingName ?? row.employerName,
        pendingSlug: undefined,
        pendingName: undefined,
        unsubscribedAt: undefined,
        followingFrom: etDay(now),
        ...(moved || row.unsubscribedAt !== undefined ? { toldMoves: [] } : {}),
      });
      confirmed.push(row.pendingName ?? row.employerName);
    }
    if (confirmed.length === 0) return null;
    const email = all[0]!.email;
    // What the page already showed them is not news: mark today's moves told.
    await ctx.scheduler.runAfter(0, internal.employerAlerts.seedTold, { email });
    await ctx.runMutation(internal.emailPrefs.confirmNewsForEmail, { email });
    await ctx.runMutation(internal.emailPrefs.confirmNewsletterForEmail, { email });
    return { email, employers: confirmed };
  },
});

export const unsubscribeByToken = internalMutation({
  args: { token: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const all = await rowsForToken(ctx, args.token, "employer-unsubscribe");
    if (all.length === 0) return false;
    const now = Date.now();
    for (const row of all) {
      if (row.unsubscribedAt !== undefined && row.pendingSlug === undefined) continue;
      await ctx.db.patch(row._id, { unsubscribedAt: now, pendingSlug: undefined, pendingName: undefined });
    }
    await dropQueued(ctx, all[0]!.email, "employer");
    return true;
  },
});

// ============================================================================
// The census doc
// ============================================================================

async function readDoc(): Promise<EmployerStagesDoc | null> {
  const row = await one("SELECT json, computed_at FROM perm_docs WHERE key = ?", ["employer_stages"]);
  if (!row || typeof row.json !== "string") return null;
  return parseEmployerStagesDoc(row.json, Number(row.computed_at), Date.now());
}

/** The moves still news on `today`: dated inside the freshness window. */
export function freshMoves(doc: EmployerStagesDoc, today: string): Map<string, EmployerMove[]> {
  const floor = isoMinusDays(today, FRESH_DAYS);
  const bySlug = new Map<string, EmployerMove[]>();
  for (const m of employerMoves(doc)) {
    if (!m.slug || m.date < floor) continue;
    const list = bySlug.get(m.slug);
    if (list) list.push(m);
    else bySlug.set(m.slug, [m]);
  }
  return bySlug;
}

/** Which of an employer's fresh moves this follower has not heard. */
export function unheard(
  moves: EmployerMove[] | undefined,
  told: readonly string[] | undefined,
  followingFrom: string | undefined,
): EmployerMove[] {
  const heard = new Set(told ?? []);
  return (moves ?? []).filter((m) => !heard.has(m.key) && (!followingFrom || m.date >= followingFrom));
}

export const forSeeding = internalQuery({
  args: { email: v.string() },
  returns: v.array(v.object({ _id: v.id("employerAlerts"), slug: v.string(), toldMoves: v.optional(v.array(v.string())) })),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("employerAlerts")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .take(MAX_EMPLOYERS_PER_ADDRESS);
    return rows
      .filter((r) => r.confirmedAt !== undefined && r.unsubscribedAt === undefined)
      .map((r) => ({ _id: r._id, slug: r.slug, toldMoves: r.toldMoves }));
  },
});

export const recordTold = internalMutation({
  args: { id: v.id("employerAlerts"), keys: v.array(v.string()), sent: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row) return null;
    const merged = [...new Set([...(row.toldMoves ?? []), ...args.keys])].slice(-TOLD_CAP);
    const now = Date.now();
    await ctx.db.patch(args.id, {
      toldMoves: merged,
      lastCheckedAt: now,
      ...(args.sent ? { lastAlertSentAt: now, alertCount: (row.alertCount ?? 0) + 1 } : {}),
    });
    return null;
  },
});

/** Mark every current move told for a newly confirmed follow. */
export const seedTold = internalAction({
  args: { email: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const doc = await readDoc();
      if (!doc) return null;
      const all = employerMoves(doc);
      for (const row of await ctx.runQuery(internal.employerAlerts.forSeeding, { email: args.email })) {
        const keys = all.filter((m) => m.slug === row.slug).map((m) => m.key);
        if (keys.length > 0) {
          await ctx.runMutation(internal.employerAlerts.recordTold, { id: row._id, keys, sent: false });
        }
      }
    } catch (error) {
      // `followingFrom` still keeps older moves out, so this degrades safely.
      await recordError(ctx, "action", "employerAlerts.seedTold", error);
    }
    return null;
  },
});

// ============================================================================
// The sweep
// ============================================================================

export const dueForCheck = internalQuery({
  args: { limit: v.number() },
  returns: v.array(
    v.object({
      _id: v.id("employerAlerts"),
      email: v.string(),
      slug: v.string(),
      employerName: v.string(),
      toldMoves: v.optional(v.array(v.string())),
      followingFrom: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const out: {
      _id: Id<"employerAlerts">;
      email: string;
      slug: string;
      employerName: string;
      toldMoves?: string[];
      followingFrom?: string;
    }[] = [];
    for await (const row of ctx.db
      .query("employerAlerts")
      .withIndex("by_alert_sweep", (q) => q.eq("unsubscribedAt", undefined))) {
      if (!row.confirmedAt) continue;
      out.push({
        _id: row._id,
        email: row.email,
        slug: row.slug,
        employerName: row.employerName,
        toldMoves: row.toldMoves,
        followingFrom: row.followingFrom,
      });
      if (out.length >= args.limit) break;
    }
    return out;
  },
});

export const markChecked = internalMutation({
  args: { ids: v.array(v.id("employerAlerts")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const id of args.ids) await ctx.db.patch(id, { lastCheckedAt: now });
    return null;
  },
});

export const claimAlertBudget = internalMutation({
  args: { want: v.number() },
  returns: v.number(),
  handler: async (ctx, args) => {
    if (args.want <= 0) return 0;
    const state = await checkRateLimit(ctx, "all", CASE_ALERT_KEY, CASE_ALERT_BUDGET);
    if (!state.allowed) {
      await noteRefusal(ctx, "caseAlert", args.want);
      return 0;
    }
    const granted = Math.min(args.want, state.remaining + 1);
    await noteRefusal(ctx, "caseAlert", args.want - granted);
    for (let i = 0; i < granted; i++) await recordRateLimitAttempt(ctx, "all", CASE_ALERT_KEY);
    return granted;
  },
});

/** "Adobe Inc.: DOL put 215 of its cases on hold", inside an inbox line. */
export function employerSubject(name: string, moves: EmployerMove[]): string {
  const first = moves[0];
  if (!first) return `${name}: its PERM cases moved`;
  const lead = `${name}: ${first.sentence}`;
  if (moves.length === 1 && lead.length <= 78) return lead;
  const more = `${lead}, and ${moves.length - 1} more`;
  if (moves.length > 1 && more.length <= 78) return more;
  return `${name}: ${moves.length === 1 ? "a change" : `${moves.length} changes`} to its PERM cases`.slice(0, 78);
}

/** Today's pending mix for one employer, from the census row, or null. */
function mixFor(doc: EmployerStagesDoc, slug: string) {
  const row = doc.employers.find((e) => e.slug === slug);
  if (!row) return null;
  const queue = row.byStatus[QUEUE_STATUS] ?? 0;
  const appeal = APPEAL_STATUSES.reduce((a, s) => a + (row.byStatus[s] ?? 0), 0);
  return {
    pending: row.pending,
    queue,
    appeal,
    review: row.pending - queue - appeal,
    held: row.byStatus[HOLD_STATUS] ?? 0,
  };
}

/**
 * Tell each follower about the employer-wide moves they have not heard.
 *
 * Runs after the daily sweeps have written the census (see crons.ts). Reads
 * up to CHECK_BATCH_LIMIT follows least-recently-checked first, bumps every
 * one it looked at, builds at most ALERT_BATCH_LIMIT alerts under the shared
 * daily budget, and hands each to `deliverAlert`. A failed send leaves the
 * moves unheard so the next run tries again; a queued or sent one is told.
 */
export const sweep = internalAction({
  args: {},
  returns: v.object({ checked: v.number(), sent: v.number(), queued: v.number(), failed: v.number() }),
  handler: async (ctx): Promise<{ checked: number; sent: number; queued: number; failed: number }> => {
    const doc = await readDoc().catch(async (error: unknown) => {
      await recordError(ctx, "action", "employerAlerts.sweep.read", error);
      return null;
    });
    if (!doc) return { checked: 0, sent: 0, queued: 0, failed: 0 };

    const due = await ctx.runQuery(internal.employerAlerts.dueForCheck, { limit: CHECK_BATCH_LIMIT + 1 });
    const batch = due.slice(0, CHECK_BATCH_LIMIT);
    let remaining = due.length > CHECK_BATCH_LIMIT;
    if (batch.length === 0) return { checked: 0, sent: 0, queued: 0, failed: 0 };

    const today = etDay(Date.now());
    const moves = freshMoves(doc, today);
    const withNews = batch
      .map((sub) => ({ sub, news: unheard(moves.get(sub.slug), sub.toldMoves, sub.followingFrom) }))
      .filter((x) => x.news.length > 0);

    await ctx.runMutation(internal.employerAlerts.markChecked, { ids: batch.map((b) => b._id) });
    if (withNews.length === 0) return { checked: batch.length, sent: 0, queued: 0, failed: 0 };

    const granted = await ctx.runMutation(internal.employerAlerts.claimAlertBudget, {
      want: Math.min(withNews.length, ALERT_BATCH_LIMIT),
    });
    if (granted < withNews.length) remaining = true;
    if (granted === 0) {
      log.error("alert budget exhausted; employer alerts wait", { due: withNews.length });
      return { checked: batch.length, sent: 0, queued: 0, failed: 0 };
    }

    let sent = 0;
    let queued = 0;
    let failed = 0;
    const asOf = longDate(doc.asOf);
    for (const { sub, news } of withNews.slice(0, granted)) {
      try {
        const token = await makeUnsubscribeToken(sub.email, unsubscribeSecret(), "employer-unsubscribe");
        const unsubUrl = actionUrl("/employer-alert/unsubscribe", token);
        const prefsUrl = await prefsLink(sub.email, unsubscribeSecret(), `employer:${sub._id}`);
        const url = employerUrl(sub.slug);
        const mix = mixFor(doc, sub.slug);
        const rows = news.map((m) => ({ dateLabel: shortDate(m.date), sentence: m.sentence, tone: m.tone }));
        const html = await renderOrTextOnly(ctx, "employerAlerts.sweep.render", async () => {
          const { EmployerMoved } = await import("../src/emails/EmployerMoved");
          return EmployerMoved({
            employerName: sub.employerName,
            employerUrl: url,
            moves: rows,
            mix,
            asOf,
            unsubscribeUrl: unsubUrl,
            prefsUrl,
          });
        });
        const result = await deliverAlert(ctx, {
          email: sub.email,
          kind: "employer",
          ref: `employer:${sub._id}`,
          subject: employerSubject(sub.employerName, news),
          html,
          text: [
            `${sub.employerName}, an employer you follow on PERM Tracker:`,
            "",
            ...rows.map((r) => `  Recorded ${r.dateLabel}: ${r.sentence}.`),
            "",
            ...(mix
              ? [
                  `Its ${mix.pending.toLocaleString("en-US")} pending cases today: ${mix.held.toLocaleString("en-US")} on hold, ${mix.appeal.toLocaleString("en-US")} under appeal, ${mix.queue.toLocaleString("en-US")} waiting for an analyst.`,
                  "",
                ]
              : []),
            `These are DOL's own case statuses, read from its case system and counted on ${asOf}.`,
            "DOL gives no reason for a hold or a batch, and neither do we. None of it is a prediction of any one case.",
            "",
            `Every figure for ${sub.employerName}: ${url}`,
            "",
            `Stop employer alerts: ${unsubUrl}`,
            "",
            "PERM Tracker",
          ].join("\n"),
          listUnsubscribe: unsubUrl,
          summary: {
            title: sub.employerName,
            line: news.length === 1 ? news[0]!.sentence : `${news[0]!.sentence}, and ${news.length - 1} more`,
            url,
            tone: news[0]!.tone,
          },
        });
        if (result.status === "failed") {
          failed += 1;
          await recordError(ctx, "action", "employerAlerts.sweep", new Error(`Resend: ${result.error}`));
          continue;
        }
        await ctx.runMutation(internal.employerAlerts.recordTold, {
          id: sub._id,
          keys: news.map((m) => m.key),
          sent: true,
        });
        if (result.status === "sent") sent += 1;
        else queued += 1;
      } catch (error) {
        failed += 1;
        await recordError(ctx, "action", "employerAlerts.sweep", error);
      }
    }

    if (remaining && sent + queued > 0) {
      await ctx.scheduler.runAfter(5 * 60 * 1000, internal.employerAlerts.sweep, {});
    }
    return { checked: batch.length, sent, queued, failed };
  },
});
