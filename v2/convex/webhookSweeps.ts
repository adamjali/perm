/**
 * Where webhook events come from: the same checks that already run for the
 * email alerts, read the same way, each queuing events in its own
 * transaction (convex/lib/webhookQueue.ts) and never waiting on delivery.
 *
 * - case.status_changed: a watched case's status in the public-data
 *   database, compared with what the watch last saw, exactly as
 *   caseAlerts.sweepCaseChanges does for email. It runs when the server's
 *   5-minute check reports a watched case moved (POST /watched-cases/sweep,
 *   which also runs the email sweep) and twice a day as a floor. Webhook
 *   watches are on the server's list (convex/watchedCases.ts).
 * - employer.moved: the employer-wide moves the daily sweep writes into
 *   perm_docs['employer_stages'], the list the employer follows read, each
 *   move told to a watch once.
 * - processing_times.updated and queue.moved: the moment Convex stores a new
 *   DOL processing-times snapshot (dolProcessingTimes.refresh, hourly on
 *   weekdays), the event that also starts the queue-month alerts.
 * - bulletin.published: the hourly bulletin-alert sweep's read of the newest
 *   bulletin; a month newer than the last one seen.
 *
 * The site's own revalidation routes fire on the same publications, but they
 * live on the web server, which holds no endpoints or secrets; these hooks
 * are Convex's own reads of the same moments, within the same hour.
 */
import { v } from "convex/values";

import { internalAction, internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { SITE_URL } from "./lib/links";
import { createLogger } from "./lib/logging";
import { one, placeholders, query, type Statement } from "./lib/publicMirror";
import { easternDay } from "./lib/time";
import { enqueueEvent } from "./lib/webhookQueue";
import { recordError } from "./lib/errorRecording";
import { freshMoves, unheard } from "./employerAlerts";
import { canonicalStatus } from "../src/lib/caseStatusVocabulary";
import { programOf, statusTableFor, type FlagProgram } from "../src/lib/flagCaseNumber";
import { parseEmployerStagesDoc } from "../src/lib/employerStages";

const log = createLogger("WebhookSweeps");

/** Watches one sweep reads: the email sweep's batch. */
const BATCH = 300;
/** Moves a watch remembers having told, newest last. */
const TOLD_CAP = 200;

/* ------------------------------------------------------------------ */
/* case.status_changed                                                 */
/* ------------------------------------------------------------------ */

/**
 * The watches a sweep that began at `before` still has to check: least
 * recently checked first (never-checked rows sort first), and only those
 * checked before the sweep began. A batch stamps what it checked with a later
 * time, so the next batch moves on, and once every watch is stamped the list
 * is empty and the sweep stops. Without the bound the oldest batch is always
 * full once there are more watches than a batch, and the chain never ends.
 */
export const dueCaseWatches = internalQuery({
  args: { limit: v.number(), before: v.number() },
  returns: v.array(
    v.object({ _id: v.id("webhookWatches"), target: v.string(), lastSeenStatus: v.union(v.string(), v.null()) }),
  ),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("webhookWatches")
      .withIndex("by_kind_and_checked", (q) => q.eq("kind", "case").lt("lastCheckedAt", args.before))
      .take(args.limit);
    return rows.map((w) => ({ _id: w._id, target: w.target, lastSeenStatus: w.lastSeenStatus ?? null }));
  },
});

const caseChange = v.object({
  id: v.id("webhookWatches"),
  from: v.string(),
  to: v.string(),
  isFinal: v.boolean(),
  program: v.string(),
});

export const recordCaseWatches = internalMutation({
  args: {
    checked: v.array(v.id("webhookWatches")),
    seeds: v.array(v.object({ id: v.id("webhookWatches"), status: v.string() })),
    changes: v.array(caseChange),
  },
  returns: v.object({ events: v.number() }),
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const id of args.checked) {
      if (await ctx.db.get(id)) await ctx.db.patch(id, { lastCheckedAt: now });
    }
    for (const s of args.seeds) {
      const w = await ctx.db.get(s.id);
      if (w && w.lastSeenStatus === undefined) await ctx.db.patch(w._id, { lastSeenStatus: s.status });
    }
    let events = 0;
    for (const c of args.changes) {
      const w = await ctx.db.get(c.id);
      // Removed since the read, or another sweep already moved it on.
      if (!w || w.lastSeenStatus !== c.from) continue;
      await ctx.db.patch(w._id, { lastSeenStatus: c.to });
      const r = await enqueueEvent(ctx, {
        type: "case.status_changed",
        key: `case:${w._id}:${now}:${c.to}`,
        account: w.account,
        data: {
          caseNumber: w.target,
          program: c.program,
          from: c.from,
          to: c.to,
          isFinal: c.isFinal,
          observedOn: easternDay(now),
          url: `${SITE_URL}/perm-case-status?case=${encodeURIComponent(w.target)}`,
        },
      });
      if (r.deliveries > 0) events++;
    }
    return { events };
  },
});

/** Compare every watched case with our record and queue an event for each change. */
export const sweepCaseWatches = internalAction({
  args: { startedAt: v.optional(v.number()) },
  returns: v.object({ checked: v.number(), seeded: v.number(), changed: v.number() }),
  handler: async (ctx, args): Promise<{ checked: number; seeded: number; changed: number }> => {
    const startedAt = args.startedAt ?? Date.now();
    const batch: { _id: Id<"webhookWatches">; target: string; lastSeenStatus: string | null }[] = await ctx.runQuery(
      internal.webhookSweeps.dueCaseWatches,
      { limit: BATCH, before: startedAt },
    );
    if (batch.length === 0) return { checked: 0, seeded: 0, changed: 0 };

    const byProgram = new Map<FlagProgram, string[]>();
    for (const n of new Set(batch.map((w) => w.target))) {
      const p = programOf(n);
      const list = byProgram.get(p);
      if (list) list.push(n);
      else byProgram.set(p, [n]);
    }
    const statements: Statement[] = [];
    for (const [program, numbers] of byProgram) {
      const marks = placeholders(numbers.length);
      if (!marks) continue;
      statements.push({
        sql: `SELECT case_number, current_status, is_final FROM ${statusTableFor(program)} WHERE case_number IN (${marks})`,
        args: numbers,
      });
    }
    let rows: Record<string, string | number | null>[] = [];
    try {
      rows = (await query(statements)).flat();
    } catch (error) {
      await recordError(ctx, "action", "webhookSweeps.sweepCaseWatches.read", error);
      return { checked: 0, seeded: 0, changed: 0 };
    }
    const now = new Map<string, { status: string; isFinal: boolean }>();
    for (const r of rows) {
      if (typeof r.case_number !== "string" || typeof r.current_status !== "string") continue;
      now.set(r.case_number, { status: canonicalStatus(r.current_status), isFinal: Number(r.is_final) === 1 });
    }

    const seeds: { id: Id<"webhookWatches">; status: string }[] = [];
    const changes: { id: Id<"webhookWatches">; from: string; to: string; isFinal: boolean; program: string }[] = [];
    for (const w of batch) {
      const cur = now.get(w.target);
      // A number our records don't hold yet: no change and no error.
      if (!cur) continue;
      if (w.lastSeenStatus === null) seeds.push({ id: w._id, status: cur.status });
      else if (w.lastSeenStatus !== cur.status) {
        changes.push({ id: w._id, from: w.lastSeenStatus, to: cur.status, isFinal: cur.isFinal, program: programOf(w.target) });
      }
    }
    await ctx.runMutation(internal.webhookSweeps.recordCaseWatches, { checked: batch.map((w) => w._id), seeds, changes });
    // A full batch: more of this pass is waiting. The same start time carries
    // on, so the pass ends once every watch has been checked since it began.
    if (batch.length === BATCH) await ctx.scheduler.runAfter(1_000, internal.webhookSweeps.sweepCaseWatches, { startedAt });
    return { checked: batch.length, seeded: seeds.length, changed: changes.length };
  },
});

/* ------------------------------------------------------------------ */
/* employer.moved                                                      */
/* ------------------------------------------------------------------ */

/** Employer watches a pass begun at `before` hasn't checked yet; see dueCaseWatches. */
export const dueEmployerWatches = internalQuery({
  args: { limit: v.number(), before: v.number() },
  returns: v.array(
    v.object({
      _id: v.id("webhookWatches"),
      target: v.string(),
      toldMoves: v.array(v.string()),
      followingFrom: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("webhookWatches")
      .withIndex("by_kind_and_checked", (q) => q.eq("kind", "employer").lt("lastCheckedAt", args.before))
      .take(args.limit);
    return rows.map((w) => ({ _id: w._id, target: w.target, toldMoves: w.toldMoves ?? [], followingFrom: w.followingFrom ?? null }));
  },
});

const moveArg = v.object({ key: v.string(), date: v.string(), name: v.string(), sentence: v.string(), n: v.number() });

export const recordEmployerWatches = internalMutation({
  args: {
    checked: v.array(v.id("webhookWatches")),
    news: v.array(v.object({ id: v.id("webhookWatches"), moves: v.array(moveArg) })),
  },
  returns: v.object({ events: v.number() }),
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const id of args.checked) {
      if (await ctx.db.get(id)) await ctx.db.patch(id, { lastCheckedAt: now });
    }
    let events = 0;
    for (const item of args.news) {
      const w = await ctx.db.get(item.id);
      if (!w) continue;
      const told = new Set(w.toldMoves ?? []);
      const fresh = item.moves.filter((m) => !told.has(m.key));
      if (fresh.length === 0) continue;
      await ctx.db.patch(w._id, { toldMoves: [...told, ...fresh.map((m) => m.key)].slice(-TOLD_CAP) });
      for (const m of fresh) {
        const [, kind, to] = m.key.split("|");
        const r = await enqueueEvent(ctx, {
          type: "employer.moved",
          key: `employer:${w._id}:${m.key}`,
          account: w.account,
          data: {
            employer: { slug: w.target, name: m.name, url: `${SITE_URL}/perm-employers/${w.target}` },
            date: m.date,
            kind: kind ?? null,
            to: to ?? null,
            cases: m.n,
            sentence: m.sentence,
          },
        });
        if (r.deliveries > 0) events++;
      }
    }
    return { events };
  },
});

export const sweepEmployerWatches = internalAction({
  args: { startedAt: v.optional(v.number()) },
  returns: v.object({ checked: v.number(), told: v.number() }),
  handler: async (ctx, args): Promise<{ checked: number; told: number }> => {
    const startedAt = args.startedAt ?? Date.now();
    const batch: { _id: Id<"webhookWatches">; target: string; toldMoves: string[]; followingFrom: string | null }[] =
      await ctx.runQuery(internal.webhookSweeps.dueEmployerWatches, { limit: BATCH, before: startedAt });
    if (batch.length === 0) return { checked: 0, told: 0 };
    let doc;
    try {
      const row = await one("SELECT json, computed_at FROM perm_docs WHERE key = ?", ["employer_stages"]);
      doc = row && typeof row.json === "string" ? parseEmployerStagesDoc(row.json, Number(row.computed_at), Date.now()) : null;
    } catch (error) {
      await recordError(ctx, "action", "webhookSweeps.sweepEmployerWatches.read", error);
      return { checked: 0, told: 0 };
    }
    if (!doc) return { checked: 0, told: 0 };
    const moves = freshMoves(doc, easternDay(Date.now()));
    const news = batch
      .map((w) => ({
        id: w._id,
        moves: unheard(moves.get(w.target), w.toldMoves, w.followingFrom ?? undefined).map((m) => ({
          key: m.key,
          date: m.date,
          name: m.name,
          sentence: m.sentence,
          n: m.n,
        })),
      }))
      .filter((x) => x.moves.length > 0);
    await ctx.runMutation(internal.webhookSweeps.recordEmployerWatches, { checked: batch.map((w) => w._id), news });
    if (batch.length === BATCH) await ctx.scheduler.runAfter(1_000, internal.webhookSweeps.sweepEmployerWatches, { startedAt });
    return { checked: batch.length, told: news.reduce((n, x) => n + x.moves.length, 0) };
  },
});

/* ------------------------------------------------------------------ */
/* The feeds                                                            */
/* ------------------------------------------------------------------ */

async function feedState(ctx: MutationCtx, key: string): Promise<{ id: Id<"webhookFeedState"> | null; value: string | null }> {
  const row = await ctx.db
    .query("webhookFeedState")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  return { id: row?._id ?? null, value: row?.value ?? null };
}

async function setFeedState(ctx: MutationCtx, key: string, id: Id<"webhookFeedState"> | null, value: string): Promise<void> {
  if (id) await ctx.db.patch(id, { value, updatedAt: Date.now() });
  else await ctx.db.insert("webhookFeedState", { key, value, updatedAt: Date.now() });
}

/**
 * DOL published new processing times: processing_times.updated, and
 * queue.moved when the PERM analyst-review month differs from the last one
 * seen. The first snapshot after this ships sets the baseline quietly.
 */
export const processingTimesPublished = internalMutation({
  args: { permAsOf: v.string(), pwdAsOf: v.optional(v.string()), analystMonth: v.optional(v.string()) },
  returns: v.object({ updated: v.boolean(), moved: v.boolean() }),
  handler: async (ctx, args) => {
    const updated = await enqueueEvent(ctx, {
      type: "processing_times.updated",
      key: `processing_times:${args.permAsOf}:${args.pwdAsOf ?? ""}:${args.analystMonth ?? ""}`,
      data: {
        permAsOf: args.permAsOf,
        pwdAsOf: args.pwdAsOf ?? null,
        analystReviewMonth: args.analystMonth ?? null,
        url: `${SITE_URL}/perm-processing-times`,
      },
    });
    let moved = false;
    if (args.analystMonth) {
      const state = await feedState(ctx, "queue_month");
      if (state.value !== null && state.value !== args.analystMonth) {
        const r = await enqueueEvent(ctx, {
          type: "queue.moved",
          key: `queue:${state.value}>${args.analystMonth}:${args.permAsOf}`,
          data: { queue: "PERM analyst review", from: state.value, to: args.analystMonth, asOf: args.permAsOf, url: `${SITE_URL}/perm-queue` },
        });
        moved = r.deliveries > 0;
      }
      if (state.value !== args.analystMonth) await setFeedState(ctx, "queue_month", state.id, args.analystMonth);
    }
    return { updated: updated.deliveries > 0, moved };
  },
});

/** The bulletin sweep read the newest bulletin: an event for a month newer than the last one seen. */
export const bulletinSeen = internalMutation({
  args: { month: v.string() },
  returns: v.object({ published: v.boolean() }),
  handler: async (ctx, args) => {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(args.month)) return { published: false };
    const state = await feedState(ctx, "bulletin_month");
    if (state.value !== null && args.month <= state.value) return { published: false };
    // The first read after this ships sets the baseline quietly: the month
    // it finds was published before anyone could subscribe.
    if (state.value === null) {
      await setFeedState(ctx, "bulletin_month", null, args.month);
      return { published: false };
    }
    const r = await enqueueEvent(ctx, {
      type: "bulletin.published",
      key: `bulletin:${args.month}`,
      data: { month: args.month, url: `${SITE_URL}/visa-bulletin/${args.month}` },
    });
    await setFeedState(ctx, "bulletin_month", state.id, args.month);
    log.info("bulletin.published", { month: args.month, deliveries: r.deliveries });
    return { published: r.deliveries > 0 };
  },
});
