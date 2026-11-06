import { v, type Infer } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { getSecurityAlertEmail, requireAdmin } from "./lib/admin";
import {
  MIN_REPORTS,
  POST_SLUG,
  ownerDigest,
  REPORT_FIELD_KEYS,
  isoToday,
  summarizeReports,
  validateReport,
  type ReportRecord,
  type ReportView,
} from "./lib/consularReport";
import { getResend } from "./lib/email";
import { recordError } from "./lib/errorRecording";
import { SITE_URL } from "./lib/links";
import { createLogger } from "./lib/logging";
import { sendOwnerMail } from "./lib/ownerMail";
import { checkRateLimit, recordRateLimitAttempt } from "./lib/rateLimit";
import { MS_PER_DAY, MS_PER_HOUR } from "./lib/time";

/**
 * Consulate reports: what happened at a consulate's visa interview or drop box, from the people who went.
 * Rules and field lists: `convex/lib/consularReport.ts`. Modelled on the community timelines
 * (convex/communityTimelines.ts) and held to the same public-endpoint checklist (the routes are in
 * convex/http.ts):
 *
 * - every write is an internal mutation behind an HTTP action that narrows the body, caps its length and
 *   hashes the address and the edit key;
 * - cheap shape checks run before anything is read or charged;
 * - every limit is READ before any is charged, and charged only once all have passed, so a refused request
 *   leaves no trace on the address's count or the day's budget (CLAUDE.md, "A refusal must not leave the
 *   trace of a success");
 * - the per-address limit raises the cost of naive abuse, and the global daily budget bounds the table
 *   whatever addresses rotate, charged before the insert;
 * - GET never mutates, and the public queries return only what a page prints, with every figure under the
 *   three-report floor already empty.
 *
 * No field is free text, and there's no name or case number, so nothing a stranger types reaches a page
 * except a date, a month or a choice from a fixed list.
 */

/** Twenty saves an hour from one address, edits included (the timelines' figure). */
export const PER_IP = { limit: 20, windowMs: MS_PER_HOUR };
/** Five hundred new reports a day across everyone: the cap on the table's growth, well inside SCAN_CAP. */
export const GLOBAL_BUDGET = { limit: 500, windowMs: MS_PER_DAY };
/** At most three reports for one consulate from one connection while its hash is kept (a household, not a flood). */
export const PER_POST_PER_IP = 3;
/** How long a report keeps its address hash; `clearIpHashes` removes it after this. */
export const IP_HASH_KEEP_MS = MS_PER_DAY;
/** Reports read for one consulate's figures, newest first. */
const POST_READ = 2_000;
/** Reports read for every consulate's figures, newest first. */
const SCAN_CAP = 5_000;
/** Address hashes one clearing run removes; a longer backlog reschedules itself. */
const CLEAR_BATCH = 500;
/** The overview lists at most this many consulates. */
const BUSIEST = 20;
/** Reports the admin list shows, newest first. */
const ADMIN_ROWS = 100;

const HEX64 = /^[0-9a-f]{64}$/;

const optionalText = v.optional(v.union(v.string(), v.null()));
const reportInput = v.object({
  category: optionalText,
  mode: optionalText,
  nvcCompleteMonth: optionalText,
  scheduledOn: optionalText,
  interviewOn: optionalText,
  outcome: optionalText,
  refusalGround: optionalText,
  approvedOn: optionalText,
  resolvedOn: optionalText,
  slipColor: optionalText,
  askedToEmailDocs: optionalText,
  line: optionalText,
  holdReason: optionalText,
  cancelledBy: optionalText,
});

/** The wire shape of a submission, for the HTTP layer that builds one. */
export type ReportWire = Infer<typeof reportInput>;

const saveResult = v.object({
  ok: v.boolean(),
  message: v.string(),
  throttled: v.optional(v.boolean()),
});

export const save = internalMutation({
  args: {
    post: v.string(),
    editKeyHash: v.string(),
    ipHash: v.string(),
    input: reportInput,
  },
  returns: saveResult,
  handler: async (ctx, a) => {
    // Cheap shape checks first, before anything is read, charged or written.
    if (!HEX64.test(a.editKeyHash) || !HEX64.test(a.ipHash)) return { ok: false, message: "Malformed request." };
    const checked = validateReport({ ...a.input, post: a.post });
    if (!checked.ok) return { ok: false, message: checked.message };
    const fields = checked.value;

    const now = Date.now();
    const existing = await ctx.db
      .query("consularReports")
      .withIndex("by_post_key", (q) => q.eq("post", fields.post).eq("editKeyHash", a.editKeyHash))
      .first();

    // Every limit is read before any is charged.
    if (!existing) {
      const mine = await ctx.db
        .query("consularReports")
        .withIndex("by_post_ip", (q) => q.eq("post", fields.post).eq("ipHash", a.ipHash))
        .take(PER_POST_PER_IP);
      if (mine.length >= PER_POST_PER_IP) {
        return {
          ok: false,
          throttled: true,
          message: `This connection has added ${PER_POST_PER_IP} reports for this consulate today, which is the most it can add. Try again tomorrow.`,
        };
      }
    }
    const perIp = await checkRateLimit(ctx, a.ipHash, "consular-report-save", PER_IP);
    if (!perIp.allowed) {
      return { ok: false, throttled: true, message: "That's enough saves for one hour. Try again later." };
    }
    if (!existing) {
      const budget = await checkRateLimit(ctx, "all", "consular-report-global", GLOBAL_BUDGET);
      if (!budget.allowed) {
        return { ok: false, throttled: true, message: "New reports are paused for today. Try again tomorrow." };
      }
    }

    // Every check passed: charge, then write.
    await recordRateLimitAttempt(ctx, a.ipHash, "consular-report-save");

    // Every field is written, the cleared ones too, so an edit that removes a date really removes it.
    // Patching a field to undefined deletes it, which is exactly what a cleared field means.
    const patch: Record<string, unknown> = { updatedAt: now };
    for (const k of REPORT_FIELD_KEYS) patch[k] = fields[k];

    if (existing) {
      await ctx.db.patch(existing._id, patch as Partial<Doc<"consularReports">>);
      return { ok: true, message: "Your report was updated." };
    }

    await recordRateLimitAttempt(ctx, "all", "consular-report-global");
    const present = Object.fromEntries(Object.entries(patch).filter(([, x]) => x !== undefined));
    await ctx.db.insert("consularReports", {
      ...(present as Partial<Doc<"consularReports">>),
      post: fields.post,
      category: fields.category,
      outcome: fields.outcome,
      editKeyHash: a.editKeyHash,
      ipHash: a.ipHash,
      ipHashUntil: now + IP_HASH_KEEP_MS,
      createdAt: now,
      updatedAt: now,
    });
    return { ok: true, message: "Your report is saved. Thanks for adding it." };
  },
});

export const remove = internalMutation({
  args: { post: v.string(), editKeyHash: v.string() },
  returns: saveResult,
  handler: async (ctx, a) => {
    if (!POST_SLUG.test(a.post) || !HEX64.test(a.editKeyHash)) return { ok: false, message: "Malformed request." };
    const row = await ctx.db
      .query("consularReports")
      .withIndex("by_post_key", (q) => q.eq("post", a.post).eq("editKeyHash", a.editKeyHash))
      .first();
    if (!row) return { ok: false, message: "There's no report from this browser for this consulate." };
    await ctx.db.delete(row._id);
    return { ok: true, message: "Your report was removed." };
  },
});

/** The caller's own report, found by the edit key its browser holds: the fields only, never a hash. */
export const mine = internalQuery({
  args: { post: v.string(), editKeyHash: v.string() },
  returns: v.union(v.null(), reportInput),
  handler: async (ctx, a) => {
    if (!POST_SLUG.test(a.post) || !HEX64.test(a.editKeyHash)) return null;
    const row = await ctx.db
      .query("consularReports")
      .withIndex("by_post_key", (q) => q.eq("post", a.post).eq("editKeyHash", a.editKeyHash))
      .first();
    if (!row) return null;
    const out: Record<string, string> = {};
    for (const k of REPORT_FIELD_KEYS) if (row[k] !== undefined) out[k] = row[k] as string;
    return out as Infer<typeof reportInput>;
  },
});

const countV = v.object({ id: v.string(), label: v.string(), count: v.number() });
const nullableNumber = v.union(v.number(), v.null());
const viewV = v.object({
  total: v.number(),
  windows: v.array(v.object({ days: v.number(), total: v.number(), open: v.boolean(), byOutcome: v.array(countV) })),
  categories: v.array(
    v.object({
      id: v.union(
        v.literal("employment"),
        v.literal("h1b"),
        v.literal("h4"),
        v.literal("l1"),
        v.literal("l2"),
        v.literal("family"),
        v.literal("immediate"),
        v.literal("k1"),
        v.literal("f1"),
        v.literal("b1b2"),
        v.literal("other"),
      ),
      label: v.string(),
      count: nullableNumber,
      open: v.boolean(),
      byOutcome: v.array(countV),
      byLine: v.array(countV),
      waitMedian: nullableNumber,
      after: v.object({ finished: nullableNumber, waiting: nullableNumber, median: nullableNumber }),
    }),
  ),
  weeks: v.array(v.object({ start: v.string(), count: nullableNumber, partial: v.boolean() })),
  results: v.object({
    days: v.number(),
    n: nullableNumber,
    g221: nullableNumber,
    share: nullableNumber,
    holdReasons: v.array(countV),
  }),
  moved: v.object({ days: v.number(), n: nullableNumber, byWho: v.array(countV) }),
  wait: v.object({ days: v.number(), n: nullableNumber, median: nullableNumber }),
});

/** A stored row as the pure helpers read it. */
function asRecord(r: Doc<"consularReports">): ReportRecord {
  return r as unknown as ReportRecord;
}

/**
 * One consulate's figures. PUBLIC on purpose: it returns only what the page prints, every figure under the
 * three-report floor already empty, and never a key, a hash or a row.
 */
export const forPost = query({
  args: { post: v.string() },
  returns: viewV,
  handler: async (ctx, a): Promise<ReportView> => {
    const today = isoToday();
    if (!POST_SLUG.test(a.post)) return summarizeReports([], today);
    const got = await ctx.db
      .query("consularReports")
      .withIndex("by_post", (q) => q.eq("post", a.post))
      .order("desc")
      .take(POST_READ);
    return summarizeReports(got.map(asRecord), today);
  },
});

/**
 * Every consulate's figures together, and the consulates with the most reports in the last 30 days with the
 * share of their interview results that were a 221(g). A consulate is listed only from three reports, and its
 * share only from three results. PUBLIC on purpose, and like `forPost` returns only what a page prints.
 */
export const overview = query({
  args: {},
  returns: v.object({
    all: viewV,
    busiest: v.array(
      v.object({ post: v.string(), reports30: v.number(), results: nullableNumber, g221: nullableNumber, share: nullableNumber }),
    ),
    scanCapped: v.boolean(),
    scanCap: v.number(),
  }),
  handler: async (ctx) => {
    const today = isoToday();
    // NEWEST first, so past the cap the figures cover the newest SCAN_CAP reports, never the oldest.
    const scanned = await ctx.db.query("consularReports").order("desc").take(SCAN_CAP);
    const records = scanned.map(asRecord);
    const byPost = new Map<string, ReportRecord[]>();
    for (const r of records) {
      if (r.hidden === true) continue;
      const list = byPost.get(r.post);
      if (list) list.push(r);
      else byPost.set(r.post, [r]);
    }
    const busiest = [...byPost.entries()]
      .map(([post, list]) => {
        const view = summarizeReports(list, today);
        const w30 = view.windows.find((w) => w.days === 30);
        return { post, reports30: w30?.total ?? 0, results: view.results.n, g221: view.results.g221, share: view.results.share };
      })
      .filter((p) => p.reports30 >= MIN_REPORTS)
      .sort((x, y) => y.reports30 - x.reports30 || x.post.localeCompare(y.post))
      .slice(0, BUSIEST);
    return { all: summarizeReports(records, today), busiest, scanCapped: scanned.length >= SCAN_CAP, scanCap: SCAN_CAP };
  },
});

/** Clear the address hash from reports saved more than a day ago. Hourly (convex/crons.ts). */
export const clearIpHashes = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();
    // gt(0) leaves out rows with no ipHashUntil, which sort first in the index.
    const due = await ctx.db
      .query("consularReports")
      .withIndex("by_ip_until", (q) => q.gt("ipHashUntil", 0).lt("ipHashUntil", now))
      .take(CLEAR_BATCH);
    for (const r of due) await ctx.db.patch(r._id, { ipHash: undefined, ipHashUntil: undefined });
    if (due.length === CLEAR_BATCH) await ctx.scheduler.runAfter(0, internal.consularReports.clearIpHashes, {});
    return due.length;
  },
});

/** Admin: take a report off every figure, from the CLI (`npx convex run`), as the timelines' hide does. */
export const hide = internalMutation({
  args: { id: v.id("consularReports"), hidden: v.boolean() },
  returns: v.null(),
  handler: async (ctx, a) => {
    await ctx.db.patch(a.id, { hidden: a.hidden ? true : undefined });
    return null;
  },
});

/** Admin: delete a report outright, for a removal asked for by email (support@permtracker.app). */
export const deleteById = internalMutation({
  args: { id: v.id("consularReports") },
  returns: v.boolean(),
  handler: async (ctx, a) => {
    const row = await ctx.db.get(a.id);
    if (!row) return false;
    await ctx.db.delete(a.id);
    return true;
  },
});

/** The admin page's list: the newest reports with what they say, never a hash. */
export const listForAdmin = query({
  args: {},
  returns: v.array(
    v.object({
      id: v.id("consularReports"),
      post: v.string(),
      category: v.string(),
      outcome: v.string(),
      mode: v.union(v.string(), v.null()),
      nvcCompleteMonth: v.union(v.string(), v.null()),
      scheduledOn: v.union(v.string(), v.null()),
      interviewOn: v.union(v.string(), v.null()),
      refusalGround: v.union(v.string(), v.null()),
      approvedOn: v.union(v.string(), v.null()),
      resolvedOn: v.union(v.string(), v.null()),
      slipColor: v.union(v.string(), v.null()),
      askedToEmailDocs: v.union(v.string(), v.null()),
      line: v.union(v.string(), v.null()),
      holdReason: v.union(v.string(), v.null()),
      cancelledBy: v.union(v.string(), v.null()),
      createdAt: v.number(),
      updatedAt: v.number(),
      hidden: v.boolean(),
    }),
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const got = await ctx.db.query("consularReports").order("desc").take(ADMIN_ROWS);
    return got.map((r) => ({
      id: r._id,
      post: r.post,
      category: r.category,
      outcome: r.outcome,
      mode: r.mode ?? null,
      nvcCompleteMonth: r.nvcCompleteMonth ?? null,
      scheduledOn: r.scheduledOn ?? null,
      interviewOn: r.interviewOn ?? null,
      refusalGround: r.refusalGround ?? null,
      approvedOn: r.approvedOn ?? null,
      resolvedOn: r.resolvedOn ?? null,
      slipColor: r.slipColor ?? null,
      askedToEmailDocs: r.askedToEmailDocs ?? null,
      line: r.line ?? null,
      holdReason: r.holdReason ?? null,
      cancelledBy: r.cancelledBy ?? null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      hidden: r.hidden === true,
    }));
  },
});

/** The admin page's Delete button: the report is gone for good, from every figure and from this list. */
export const deleteForAdmin = mutation({
  args: { id: v.id("consularReports") },
  returns: v.boolean(),
  handler: async (ctx, a) => {
    await requireAdmin(ctx);
    const row = await ctx.db.get(a.id);
    if (!row) return false;
    await ctx.db.delete(a.id);
    return true;
  },
});

/** The admin page's Hide and Show buttons. */
export const setHiddenForAdmin = mutation({
  args: { id: v.id("consularReports"), hidden: v.boolean() },
  returns: v.null(),
  handler: async (ctx, a) => {
    await requireAdmin(ctx);
    await ctx.db.patch(a.id, { hidden: a.hidden ? true : undefined });
    return null;
  },
});

// ============================================================================
// The owner's daily email
// ============================================================================

const log = createLogger("consularReports");

/** Read past the day's new-report budget and the edits on top, so the email's count is right. */
const CHANGED_READ = 1_000;

/** Every report saved or edited after `since`, newest change first. */
export const changedSince = internalQuery({
  args: { since: v.number() },
  returns: v.object({
    rows: v.array(
      v.object({
        post: v.string(),
        category: v.string(),
        outcome: v.string(),
        refusalGround: v.union(v.string(), v.null()),
        interviewOn: v.union(v.string(), v.null()),
        line: v.union(v.string(), v.null()),
        holdReason: v.union(v.string(), v.null()),
        cancelledBy: v.union(v.string(), v.null()),
        createdAt: v.number(),
        updatedAt: v.number(),
        hidden: v.boolean(),
      }),
    ),
    more: v.boolean(),
  }),
  handler: async (ctx, a) => {
    const got = await ctx.db
      .query("consularReports")
      .withIndex("by_updated", (q) => q.gt("updatedAt", a.since))
      .order("desc")
      .take(CHANGED_READ + 1);
    return {
      rows: got.slice(0, CHANGED_READ).map((r) => ({
        post: r.post,
        category: r.category,
        outcome: r.outcome,
        refusalGround: r.refusalGround ?? null,
        interviewOn: r.interviewOn ?? null,
        line: r.line ?? null,
        holdReason: r.holdReason ?? null,
        cancelledBy: r.cancelledBy ?? null,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        hidden: r.hidden === true,
      })),
      more: got.length > CHANGED_READ,
    };
  },
});

/**
 * Once a day (crons.ts), the owner hears about the reports saved or edited in the last 24 hours, with a
 * link to hide or delete each one; nothing is sent on a day with none. Reports post at once and are
 * taken down after, never held for approval (owner, Nov 5 2026). `sendOwnerMail` carries it through the
 * Cloudflare mail Worker, so it spends none of Resend's 100 a day unless the Worker fails.
 */
export const emailOwnerDaily = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const to = getSecurityAlertEmail();
    if (!to) {
      log.warn("no owner address configured; the consulate reports email wasn't sent", {});
      return null;
    }
    try {
      const since = Date.now() - MS_PER_DAY;
      const changed = await ctx.runQuery(internal.consularReports.changedSince, { since });
      const digest = ownerDigest(changed.rows, since, SITE_URL, changed.more);
      if (!digest) return null;
      const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const html = digest.text
        .split("\n")
        .map((l) => (l ? `<p>${esc(l)}</p>` : ""))
        .join("");
      const result = await sendOwnerMail(ctx, "consular-reports", getResend(), { to, subject: digest.subject, html, text: digest.text });
      if (result.error) {
        await recordError(ctx, "action", "consularReports.emailOwnerDaily", new Error(`owner email failed: ${JSON.stringify(result.error)}`));
      }
    } catch (error) {
      await recordError(ctx, "action", "consularReports.emailOwnerDaily", error);
    }
    return null;
  },
});
