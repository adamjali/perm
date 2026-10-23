/**
 * Reviews of PERM Tracker, collected on the site's own form since Oct 23 2026 (owner's call: Senja's free plan
 * hides every review past its 15th, deleted ones counted, so the reviews come to us instead).
 *
 * - A review waits for the owner (Admin > Reviews). Approval is never by stars (16 CFR 465.7(b)): the owner
 *   declines spam, abuse and reviews of something else. Approving or declining refreshes /reviews and the
 *   homepage at once (`/api/revalidate-reviews`).
 * - The public read (`listPublished`) carries approved reviews only, never an address, and never a review by
 *   someone who runs the site (`insider`, 16 CFR 465.5); those are kept, never shown or counted.
 * - Senja's form stays up for links already sent; `importFromSenja` copies anything new there into the same
 *   queue once a day, by Senja's id, so nothing is copied twice.
 *
 * Public-endpoint checklist: the write is an internal mutation behind the HTTP route (`/review/submit`), which
 * owns the shape and the honeypot; the global daily budget is checked before anything is written, and the per-
 * address limit after it, before the insert. The owner hears of waiting reviews at most once a day.
 */

import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { getSecurityAlertEmail, requireAdmin } from "./lib/admin";
import { getResend } from "./lib/email";
import { recordError } from "./lib/errorRecording";
import { SITE_URL } from "./lib/links";
import { createLogger } from "./lib/logging";
import { sendOwnerMail } from "./lib/ownerMail";
import { checkAndRecordRateLimit } from "./lib/rateLimit";
import { MS_PER_DAY, MS_PER_HOUR, MS_PER_MINUTE } from "./lib/time";
import { INSIDER_REVIEW_IDS, parseSenjaWidget, senjaTime } from "../src/lib/reviews/senjaParse";

const log = createLogger("SiteReviews");

/** Reviews the form takes from everyone together in a day; past it the form says so. */
export const GLOBAL_PER_DAY = 30;
/** Reviews one address may send in an hour. */
export const IP_LIMIT = { limit: 5, windowMs: MS_PER_HOUR };
/** The owner's "reviews are waiting" email: at most one a day. */
const NOTICE_LIMIT = { limit: 1, windowMs: MS_PER_DAY };
/** The most reviews the public read hands back; the page shows them twelve at a time. */
const PUBLIC_READ = 500;
const ADMIN_READ = 100;

/** The Senja widget whose script carries the reviews left there (its id is in the widget's own public URL). */
export const SENJA_WIDGET_URL = "https://widget.senja.io/widget/3563db96-3a71-4d2a-b7e8-70550d4dd814/platform.js";

export const THANKS =
  "Thanks. Your review will show here once we've checked it isn't spam, usually within a day.";

const status = v.union(v.literal("pending"), v.literal("approved"), v.literal("declined"));

// ============================================================================
// The form
// ============================================================================

export const submit = internalMutation({
  args: {
    rating: v.number(),
    text: v.string(),
    name: v.string(),
    email: v.optional(v.string()),
    ip: v.string(),
  },
  returns: v.object({ ok: v.boolean(), throttled: v.optional(v.boolean()), message: v.string() }),
  handler: async (ctx, args) => {
    const now = Date.now();
    let today = 0;
    for await (const row of ctx.db.query("siteReviews").withIndex("by_created", (q) => q.gte("createdAt", now - MS_PER_DAY))) {
      void row;
      today += 1;
      if (today >= GLOBAL_PER_DAY) {
        return { ok: false, throttled: true, message: "The review form has taken all it can for today. Please try again tomorrow." };
      }
    }
    const perIp = await checkAndRecordRateLimit(ctx, args.ip, "site_review_ip", IP_LIMIT);
    if (!perIp.allowed) {
      return { ok: false, throttled: true, message: "That's a few reviews in a row. Please try again in an hour." };
    }
    await ctx.db.insert("siteReviews", {
      rating: args.rating,
      text: args.text,
      name: args.name,
      ...(args.email ? { email: args.email } : {}),
      status: "pending",
      source: "site",
      createdAt: now,
    });
    await noteWaiting(ctx);
    return { ok: true, message: THANKS };
  },
});

/** Tell the owner reviews wait: one email a day at most, charged before it's scheduled. */
async function noteWaiting(ctx: Parameters<typeof checkAndRecordRateLimit>[0]): Promise<void> {
  const notice = await checkAndRecordRateLimit(ctx, "admin", "site_review_notice", NOTICE_LIMIT);
  if (notice.allowed) await ctx.scheduler.runAfter(0, internal.siteReviews.notifyOwner, {});
}

// ============================================================================
// The public read
// ============================================================================

const publicReview = v.object({
  id: v.string(),
  rating: v.number(),
  text: v.string(),
  name: v.string(),
  createdAt: v.number(),
});

/** Approved reviews by people outside the team, newest first. No address ever leaves here. */
export const listPublished = query({
  args: {},
  returns: v.array(publicReview),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("siteReviews")
      .withIndex("by_status_created", (q) => q.eq("status", "approved"))
      .order("desc")
      .take(PUBLIC_READ);
    return rows
      .filter((r) => r.insider !== true)
      .map((r) => ({ id: r._id as string, rating: r.rating, text: r.text, name: r.name, createdAt: r.createdAt }));
  },
});

// ============================================================================
// The owner
// ============================================================================

const adminReview = v.object({
  _id: v.id("siteReviews"),
  rating: v.number(),
  text: v.string(),
  name: v.string(),
  email: v.optional(v.string()),
  status,
  source: v.union(v.literal("site"), v.literal("senja")),
  insider: v.boolean(),
  /** The address watches a case on the site: a sign the reviewer is a real user, never shown publicly. */
  watchesCase: v.boolean(),
  createdAt: v.number(),
  reviewedAt: v.optional(v.number()),
});

/** Waiting reviews (oldest first) and the newest decided ones. SECURITY: requireAdmin; rows carry addresses. */
export const listForAdmin = query({
  args: {},
  returns: v.object({ waiting: v.array(adminReview), decided: v.array(adminReview) }),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const shape = async (r: Doc<"siteReviews">) => {
      const watcher = r.email
        ? await ctx.db
            .query("caseStatusAlerts")
            .withIndex("by_email", (q) => q.eq("email", r.email!))
            .first()
        : null;
      return {
        _id: r._id,
        rating: r.rating,
        text: r.text,
        name: r.name,
        ...(r.email ? { email: r.email } : {}),
        status: r.status,
        source: r.source,
        insider: r.insider === true,
        watchesCase: watcher !== null && watcher.confirmedAt !== undefined,
        createdAt: r.createdAt,
        ...(r.reviewedAt !== undefined ? { reviewedAt: r.reviewedAt } : {}),
      };
    };
    const waiting = await ctx.db
      .query("siteReviews")
      .withIndex("by_status_created", (q) => q.eq("status", "pending"))
      .take(ADMIN_READ);
    const decided = [
      ...(await ctx.db.query("siteReviews").withIndex("by_status_created", (q) => q.eq("status", "approved")).order("desc").take(ADMIN_READ)),
      ...(await ctx.db.query("siteReviews").withIndex("by_status_created", (q) => q.eq("status", "declined")).order("desc").take(ADMIN_READ)),
    ].sort((a, b) => b.createdAt - a.createdAt);
    return {
      waiting: await Promise.all(waiting.map(shape)),
      decided: await Promise.all(decided.slice(0, ADMIN_READ).map(shape)),
    };
  },
});

/** Show a review on /reviews and the homepage. SECURITY: requireAdmin. */
export const approve = mutation({
  args: { id: v.id("siteReviews") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const row = await ctx.db.get(id);
    if (!row) throw new Error("That review no longer exists.");
    await ctx.db.patch(id, { status: "approved", reviewedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.siteReviews.refreshPages, {});
    return null;
  },
});

/** Keep a review off the site (spam, abuse, a review of something else; never its stars). SECURITY: requireAdmin. */
export const decline = mutation({
  args: { id: v.id("siteReviews") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    const row = await ctx.db.get(id);
    if (!row) throw new Error("That review no longer exists.");
    await ctx.db.patch(id, { status: "declined", reviewedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.siteReviews.refreshPages, {});
    return null;
  },
});

export const waitingCount = internalQuery({
  args: {},
  returns: v.array(v.object({ name: v.string(), rating: v.number(), text: v.string() })),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("siteReviews")
      .withIndex("by_status_created", (q) => q.eq("status", "pending"))
      .take(ADMIN_READ);
    return rows.map((r) => ({ name: r.name, rating: r.rating, text: r.text }));
  },
});

/** One email to the owner: the reviews waiting right now. The caller charged the once-a-day limit. */
export const notifyOwner = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const to = getSecurityAlertEmail();
    if (!to) return null;
    try {
      const waiting = await ctx.runQuery(internal.siteReviews.waitingCount, {});
      if (waiting.length === 0) return null;
      const lines = waiting
        .slice(0, 20)
        .map((w) => `- ${w.name}, ${w.rating} of 5: ${w.text.length > 160 ? `${w.text.slice(0, 157)}...` : w.text}`);
      const text = [
        "These reviews wait for you before they show on the site:",
        "",
        ...lines,
        "",
        `Approve or decline on the admin page: ${SITE_URL}/admin#reviews`,
        "",
        "Decline only spam, abuse or a review of something else, never a review for its stars.",
        "You get this at most once a day.",
      ].join("\n");
      const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const html = text
        .split("\n")
        .map((l) => (l ? `<p>${esc(l)}</p>` : ""))
        .join("");
      await sendOwnerMail(ctx, "site-review", getResend(), {
        to,
        subject: `Reviews waiting for you: ${waiting.length}`,
        html,
        text,
      });
    } catch (error) {
      await recordError(ctx, "action", "siteReviews.notifyOwner", error);
    }
    return null;
  },
});

// ============================================================================
// Refreshing the pages
// ============================================================================

/** Waits before each retry of a refused refresh; after the last, the failure is recorded. */
const REFRESH_RETRY_MS = [MS_PER_MINUTE, 5 * MS_PER_MINUTE, 30 * MS_PER_MINUTE] as const;

/**
 * Refresh /reviews and the homepage now rather than at the end of their daily window. Needs REVALIDATE_SECRET on
 * the deployment; without it the change shows within a day, and a warning says so. A refused call is retried,
 * then recorded with `recordError`, which emails the owner.
 */
export const refreshPages = internalAction({
  args: { attempt: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const key = process.env.REVALIDATE_SECRET;
    if (!key) {
      log.warn("REVALIDATE_SECRET isn't set; the reviews show the change when the pages next regenerate", {});
      return null;
    }
    let failure: string | null = null;
    try {
      const res = await fetch(`${SITE_URL}/api/revalidate-reviews`, {
        method: "POST",
        headers: { "x-revalidate-secret": key },
      });
      if (!res.ok) failure = `HTTP ${res.status}`;
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
    }
    if (failure === null) return null;
    const attempt = args.attempt ?? 0;
    const wait = REFRESH_RETRY_MS[attempt];
    if (wait !== undefined) {
      log.warn("reviews refresh failed; trying again", { attempt, failure });
      await ctx.scheduler.runAfter(wait, internal.siteReviews.refreshPages, { attempt: attempt + 1 });
      return null;
    }
    await recordError(
      ctx,
      "action",
      "siteReviews.refreshPages",
      new Error(`/reviews and the homepage weren't refreshed after ${attempt + 1} tries (${failure}); they show the change within a day.`),
    );
    return null;
  },
});

// ============================================================================
// Senja, for links already sent
// ============================================================================

const senjaReview = v.object({
  senjaId: v.string(),
  rating: v.number(),
  text: v.string(),
  name: v.string(),
  createdAt: v.number(),
});

/** Store the Senja reviews not copied before. `approve` is for the one-time first copy of reviews already shown. */
export const storeFromSenja = internalMutation({
  args: { reviews: v.array(senjaReview), approve: v.optional(v.boolean()) },
  returns: v.object({ added: v.number(), waiting: v.number() }),
  handler: async (ctx, args) => {
    const now = Date.now();
    let added = 0;
    let waiting = 0;
    for (const r of args.reviews) {
      const held = await ctx.db
        .query("siteReviews")
        .withIndex("by_senja_id", (q) => q.eq("senjaId", r.senjaId))
        .first();
      if (held) continue;
      const insider = INSIDER_REVIEW_IDS.has(r.senjaId);
      const shown = args.approve === true || insider;
      await ctx.db.insert("siteReviews", {
        rating: r.rating,
        text: r.text,
        name: r.name,
        status: shown ? "approved" : "pending",
        source: "senja",
        senjaId: r.senjaId,
        ...(insider ? { insider: true } : {}),
        createdAt: r.createdAt,
        ...(shown ? { reviewedAt: now } : {}),
      });
      added += 1;
      if (!shown) waiting += 1;
    }
    if (waiting > 0) await noteWaiting(ctx);
    if (args.approve === true && added > 0) await ctx.scheduler.runAfter(0, internal.siteReviews.refreshPages, {});
    return { added, waiting };
  },
});

/**
 * Copy what Senja's form has collected (daily, crons.ts). A script Senja can't serve or can't be read is recorded
 * and retried tomorrow; it never reads as "no reviews".
 */
export const importFromSenja = internalAction({
  args: { approve: v.optional(v.boolean()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const res = await fetch(SENJA_WIDGET_URL);
      if (!res.ok) throw new Error(`Senja answered ${res.status}`);
      const all = parseSenjaWidget(await res.text());
      if (!all) throw new Error("no review array in the Senja widget script");
      const reviews = all.map((r) => ({
        senjaId: r.id,
        rating: r.rating,
        text: r.text,
        name: r.name,
        createdAt: senjaTime(r.date),
      }));
      const { added, waiting } = await ctx.runMutation(internal.siteReviews.storeFromSenja, {
        reviews,
        ...(args.approve ? { approve: true } : {}),
      });
      log.info("Senja reviews copied", { read: reviews.length, added, waiting });
    } catch (error) {
      await recordError(ctx, "action", "siteReviews.importFromSenja", error);
    }
    return null;
  },
});
