/**
 * Reviews of PERM Tracker, collected on the site's own form since Oct 23 2026 (owner's call: Senja's free plan
 * hides every review past its 15th, deleted ones counted, so the reviews come to us instead).
 *
 * - A review waits for the owner (Admin > Reviews). Approval is never by stars (16 CFR 465.7(b)): the owner
 *   declines only with one of the reasons that rule allows, and the reason is kept. Approving or declining
 *   refreshes /reviews and the homepage (`/api/revalidate-reviews`).
 * - The public read (`listPublished`) carries approved reviews only, never an address, and never a review by
 *   someone who runs the site (`insider`, 16 CFR 465.5); those are kept, never shown or counted.
 * - Senja's form stays up for links already sent; `importFromSenja` copies anything new there into the same
 *   queue once a day, by Senja's id, so nothing is copied twice.
 * - Prefill: a signed-in reader's name and address (`prefillForMe`), or the address sealed into a link we sent
 *   (`reviewLinkFor`, opened by the `/review/prefill` route). A review sent with a valid link is marked `viaLink`.
 * - Nothing grows forever: the form takes at most GLOBAL_PER_DAY a day, and a declined review's words, name and
 *   address are deleted 90 days after the decision (`scrubDeclined`, daily); its rating and reason stay.
 *
 * Public-endpoint checklist: the write is an internal mutation behind the HTTP route (`/review/submit`), which
 * owns the shape, the size cap and the honeypot; the global daily budget is checked before anything is written,
 * and the per-address limit after it, before the insert. Every refusal and failure is logged with its reason and
 * no personal data; the owner hears of waiting reviews at most once a day.
 */

import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { getSecurityAlertEmail, requireAdmin } from "./lib/admin";
import { getCurrentUserIdOrNull } from "./lib/auth";
import { getResend } from "./lib/email";
import { recordError } from "./lib/errorRecording";
import { SITE_URL } from "./lib/links";
import { createLogger } from "./lib/logging";
import { sendOwnerMail } from "./lib/ownerMail";
import { checkAndRecordRateLimit } from "./lib/rateLimit";
import { REVIEW_LINK_TTL_MS, sealEmail } from "./lib/sealedEmail";
import { MS_PER_DAY, MS_PER_HOUR, MS_PER_MINUTE } from "./lib/time";
import { INSIDER_REVIEW_IDS, parseSenjaWidget, senjaTime } from "../src/lib/reviews/senjaParse";

const log = createLogger("SiteReviews");

/** Reviews the form takes from everyone together in a day; past it the form says so. */
export const GLOBAL_PER_DAY = 30;
/** Reviews one address may send in an hour. Convex sets the caller's address itself; a header can't fake it. */
export const IP_LIMIT = { limit: 5, windowMs: MS_PER_HOUR };
/** The same rating, name and words again within this is a double send, stored once. */
export const DUPLICATE_WINDOW_MS = 10 * MS_PER_MINUTE;
/** A declined review's words, name and address are deleted this long after the decision. */
export const DECLINED_KEEP_MS = 90 * MS_PER_DAY;
/** A private note can follow a rating of this many stars or fewer (the thanks screen asks what could be better). */
export const NOTE_UP_TO = 3;
/** How long after posting the reviewer can add that note; one note per review. */
export const NOTE_WINDOW_MS = 2 * MS_PER_HOUR;
/** A private note is deleted this long after it was written, whatever became of the review. */
export const NOTE_KEEP_MS = 90 * MS_PER_DAY;
/** The owner's "reviews are waiting" email: at most one a day. */
const NOTICE_LIMIT = { limit: 1, windowMs: MS_PER_DAY };
/** The most reviews the public read hands back; the page shows them twelve at a time. */
const PUBLIC_READ = 500;
const ADMIN_READ = 100;
/** Declined reviews scrubbed per run; the daily run reschedules itself while a full batch remains. */
const SCRUB_BATCH = 200;

/** The Senja widget whose script carries the reviews left there (its id is in the widget's own public URL). */
export const SENJA_WIDGET_URL = "https://widget.senja.io/widget/3563db96-3a71-4d2a-b7e8-70550d4dd814/platform.js";

export const THANKS = "Thanks. Your review will show here once we've read it, usually within a day.";

const status = v.union(v.literal("pending"), v.literal("approved"), v.literal("declined"));
const declineReason = v.union(
  v.literal("spam"),
  v.literal("abusive"),
  v.literal("personal"),
  v.literal("unrelated"),
  v.literal("other"),
);

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
    quick: v.boolean(),
    /** The address a valid sealed link opened to; the HTTP route checked it. */
    linkEmail: v.optional(v.string()),
  },
  returns: v.object({
    ok: v.boolean(),
    throttled: v.optional(v.boolean()),
    message: v.string(),
    /** The stored review, for the thanks screen's private note; only the browser that sent it is told. */
    reviewId: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    let today = 0;
    for await (const row of ctx.db.query("siteReviews").withIndex("by_created", (q) => q.gte("createdAt", now - MS_PER_DAY))) {
      // A double send (a second tap, a retry after a dropped reply) is one review.
      if (
        row.createdAt >= now - DUPLICATE_WINDOW_MS &&
        row.source === "site" &&
        row.rating === args.rating &&
        row.name === args.name &&
        row.text === args.text
      ) {
        log.info("duplicate review ignored", { rating: args.rating });
        return { ok: true, message: THANKS, reviewId: row._id };
      }
      today += 1;
      if (today >= GLOBAL_PER_DAY) {
        log.warn("review refused: the day's budget is spent", { budget: GLOBAL_PER_DAY });
        return { ok: false, throttled: true, message: "The review form has taken all it can for today. Please try again tomorrow." };
      }
    }
    const perIp = await checkAndRecordRateLimit(ctx, args.ip, "site_review_ip", IP_LIMIT);
    if (!perIp.allowed) {
      log.warn("review refused: one address sent too many", { limit: IP_LIMIT.limit });
      return { ok: false, throttled: true, message: "That's a few reviews in a row. Please try again in an hour." };
    }
    const email = args.email ?? args.linkEmail;
    const viaLink = args.linkEmail !== undefined && email === args.linkEmail;
    const reviewId = await ctx.db.insert("siteReviews", {
      rating: args.rating,
      text: args.text,
      name: args.name,
      ...(email ? { email } : {}),
      status: "pending",
      source: "site",
      createdAt: now,
      ...(args.quick ? { quick: true } : {}),
      ...(viaLink ? { viaLink: true } : {}),
    });
    log.info("review stored, waiting for the owner", { rating: args.rating, hasText: args.text.length > 0, quick: args.quick, viaLink });
    await noteWaiting(ctx);
    return { ok: true, message: THANKS, reviewId };
  },
});

/**
 * A private note after a low rating: what could be better. One per review, within NOTE_WINDOW_MS of posting, only
 * for NOTE_UP_TO stars or fewer, so knowing a review's id gains a stranger nothing worth having. The route has
 * already checked and tidied the words (checkNote).
 */
export const addNote = internalMutation({
  args: { reviewId: v.string(), note: v.string() },
  returns: v.object({ ok: v.boolean(), message: v.string() }),
  handler: async (ctx, { reviewId, note }) => {
    const id = ctx.db.normalizeId("siteReviews", reviewId);
    const row = id ? await ctx.db.get(id) : null;
    const now = Date.now();
    if (!row || row.source !== "site") {
      log.warn("review note refused: no such review");
      return { ok: false, message: "That review couldn't be found. Write to support@permtracker.app instead." };
    }
    if (row.rating > NOTE_UP_TO || row.privateNote !== undefined || now - row.createdAt > NOTE_WINDOW_MS) {
      log.warn("review note refused", { rating: row.rating, hasNote: row.privateNote !== undefined, ageMs: now - row.createdAt });
      return { ok: false, message: "A note can't be added to this review any more. Write to support@permtracker.app instead." };
    }
    await ctx.db.patch(row._id, { privateNote: note, privateNoteAt: now });
    log.info("private note added to a review", { rating: row.rating, length: note.length });
    return { ok: true, message: "Thank you. Only we read this." };
  },
});

/** A review the site shows and counts: approved, and not by someone who runs it. */
const isShown = (r: Pick<Doc<"siteReviews">, "status" | "insider">) => r.status === "approved" && r.insider !== true;

/** Every shown review counted from the table: for a missing tally, and to check one. Bounded by the read limit. */
async function countShown(ctx: QueryCtx): Promise<number[]> {
  const stars = [0, 0, 0, 0, 0];
  for await (const r of ctx.db.query("siteReviews").withIndex("by_status_created", (q) => q.eq("status", "approved"))) {
    if (r.insider !== true && r.rating >= 1 && r.rating <= 5) stars[r.rating - 1]! += 1;
  }
  return stars;
}

/** Move one review into or out of the tally. A missing tally is first made from the table, so it starts right. */
async function adjustTally(ctx: MutationCtx, rating: number, delta: 1 | -1): Promise<void> {
  if (rating < 1 || rating > 5) return;
  const row = await ctx.db.query("siteReviewTally").withIndex("by_key", (q) => q.eq("key", "shown")).unique();
  if (!row) {
    // Counted after the change was written, so the fresh count already includes it.
    await ctx.db.insert("siteReviewTally", { key: "shown", stars: await countShown(ctx), updatedAt: Date.now() });
    return;
  }
  const stars = [...row.stars];
  stars[rating - 1] = Math.max(0, (stars[rating - 1] ?? 0) + delta);
  await ctx.db.patch(row._id, { stars, updatedAt: Date.now() });
}

/** Tell the owner reviews wait: one email a day at most, charged before it's scheduled. */
async function noteWaiting(ctx: MutationCtx): Promise<void> {
  const notice = await checkAndRecordRateLimit(ctx, "admin", "site_review_notice", NOTICE_LIMIT);
  if (notice.allowed) await ctx.scheduler.runAfter(0, internal.siteReviews.notifyOwner, {});
}

// ============================================================================
// Prefill
// ============================================================================

/** A first name to greet with, from an account's full name; null when there's nothing usable. */
function firstName(full: string | undefined): string | null {
  const first = (full ?? "").trim().split(/\s+/)[0] ?? "";
  return first.length > 0 && first.length <= 80 ? first : null;
}

/** The signed-in reader's name and address, to fill the form. Null when no one is signed in. */
export const prefillForMe = query({
  args: {},
  returns: v.union(v.null(), v.object({ name: v.optional(v.string()), email: v.optional(v.string()) })),
  handler: async (ctx) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();
    const name = firstName(profile?.fullName ?? user?.name);
    return { ...(name ? { name } : {}), ...(user?.email ? { email: user.email } : {}) };
  },
});

/** A first name for an address that has an account, for a sealed link's prefill. */
export const nameForEmail = internalQuery({
  args: { email: v.string() },
  returns: v.union(v.null(), v.string()),
  handler: async (ctx, { email }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();
    if (!user) return null;
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .first();
    return firstName(profile?.fullName ?? user.name);
  },
});

/**
 * The review form's address for someone we're writing to: their address sealed into the link (never readable in
 * it), and the stars they gave already picked when there are some. Plain form link when the secret is missing.
 */
export async function reviewLinkFor(email: string, rating?: number): Promise<string> {
  const stars = rating !== undefined && Number.isInteger(rating) && rating >= 1 && rating <= 5 ? `rating=${rating}&` : "";
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) {
    log.warn("UNSUBSCRIBE_SECRET isn't set; review links go out without the address prefill", {});
    return `${SITE_URL}/reviews${stars ? `?${stars.slice(0, -1)}` : ""}#write`;
  }
  const t = await sealEmail(email, secret, Date.now() + REVIEW_LINK_TTL_MS);
  return `${SITE_URL}/reviews?${stars}t=${encodeURIComponent(t)}#write`;
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

/** How many older reviews one "Show older reviews" press loads. */
export const OLDER_PAGE = 100;

/**
 * Shown reviews older than a moment, newest first, a page at a time: the way past the newest PUBLIC_READ, however
 * many there are. `more` says whether another page waits. Public, and the same fields as listPublished.
 */
export const listOlder = query({
  args: { before: v.number() },
  returns: v.object({ reviews: v.array(publicReview), more: v.boolean() }),
  handler: async (ctx, { before }) => {
    const rows = await ctx.db
      .query("siteReviews")
      .withIndex("by_status_created", (q) => q.eq("status", "approved").lt("createdAt", before))
      .order("desc")
      .take(OLDER_PAGE + 1);
    const shown = rows.slice(0, OLDER_PAGE).filter((r) => r.insider !== true);
    return {
      reviews: shown.map((r) => ({ id: r._id as string, rating: r.rating, text: r.text, name: r.name, createdAt: r.createdAt })),
      more: rows.length > OLDER_PAGE,
    };
  },
});

/**
 * How many reviews the site shows, by stars (index 0 is one star), and whether that's the kept tally (`exact`) or
 * a count of the table made because no tally exists yet. Public: counts only, nothing about any reviewer.
 */
export const publicTally = query({
  args: {},
  returns: v.object({ stars: v.array(v.number()), exact: v.boolean() }),
  handler: async (ctx) => {
    const row = await ctx.db.query("siteReviewTally").withIndex("by_key", (q) => q.eq("key", "shown")).unique();
    if (row) return { stars: row.stars, exact: true };
    return { stars: await countShown(ctx), exact: false };
  },
});

/** Make the tally from the table (when it's missing, or to correct it), and say whether it had drifted. */
export const rebuildTally = internalMutation({
  args: {},
  returns: v.object({ stars: v.array(v.number()), drifted: v.boolean() }),
  handler: async (ctx) => {
    const stars = await countShown(ctx);
    const row = await ctx.db.query("siteReviewTally").withIndex("by_key", (q) => q.eq("key", "shown")).unique();
    const drifted = row !== null && row.stars.some((n, i) => n !== stars[i]);
    if (row) await ctx.db.patch(row._id, { stars, updatedAt: Date.now() });
    else await ctx.db.insert("siteReviewTally", { key: "shown", stars, updatedAt: Date.now() });
    if (drifted) log.warn("review tally had drifted from the table; rebuilt", { kept: row?.stars, counted: stars });
    return { stars, drifted };
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
  quick: v.boolean(),
  viaLink: v.boolean(),
  declineReason: v.optional(declineReason),
  scrubbed: v.boolean(),
  /** What the reviewer said could be better, after a low rating; private, never shown with the review. */
  privateNote: v.optional(v.string()),
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
        quick: r.quick === true,
        viaLink: r.viaLink === true,
        ...(r.declineReason ? { declineReason: r.declineReason } : {}),
        ...(r.privateNote ? { privateNote: r.privateNote } : {}),
        scrubbed: r.scrubbedAt !== undefined,
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
    if (row.scrubbedAt !== undefined) throw new Error("That review's words were deleted after it was declined, so it can't be shown.");
    await ctx.db.patch(id, { status: "approved", reviewedAt: Date.now(), declineReason: undefined });
    if (!isShown(row) && isShown({ status: "approved", insider: row.insider })) await adjustTally(ctx, row.rating, 1);
    log.info("review approved", { rating: row.rating });
    await ctx.scheduler.runAfter(0, internal.siteReviews.refreshPages, {});
    return null;
  },
});

/** Keep a review off the site, for one of the reasons 16 CFR 465.7(b) allows; never its stars. SECURITY: requireAdmin. */
export const decline = mutation({
  args: { id: v.id("siteReviews"), reason: declineReason },
  returns: v.null(),
  handler: async (ctx, { id, reason }) => {
    await requireAdmin(ctx);
    const row = await ctx.db.get(id);
    if (!row) throw new Error("That review no longer exists.");
    await ctx.db.patch(id, { status: "declined", reviewedAt: Date.now(), declineReason: reason });
    if (isShown(row)) await adjustTally(ctx, row.rating, -1);
    log.info("review declined", { rating: row.rating, reason });
    await ctx.scheduler.runAfter(0, internal.siteReviews.refreshPages, {});
    return null;
  },
});

/** Delete a review for good, and take it out of the count if it was shown. The one shared step of the two below. */
async function removeReview(ctx: MutationCtx, id: Id<"siteReviews">): Promise<boolean> {
  const row = await ctx.db.get(id);
  if (!row) return false;
  await ctx.db.delete(id);
  if (isShown(row)) await adjustTally(ctx, row.rating, -1);
  log.info("review deleted", { rating: row.rating, wasShown: isShown(row), source: row.source });
  if (isShown(row)) await ctx.scheduler.runAfter(0, internal.siteReviews.refreshPages, {});
  return true;
}

/**
 * Delete a review for good: the reviewer asked for it to be removed (the thanks screen says they can), or it was a
 * test. Declining keeps the rating and reason; this keeps nothing. SECURITY: requireAdmin.
 */
export const remove = mutation({
  args: { id: v.id("siteReviews") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    await requireAdmin(ctx);
    if (!(await removeReview(ctx, id))) throw new Error("That review no longer exists.");
    return null;
  },
});

/** The same, from the command line (`npx convex run siteReviews:removeById`), for cleaning up tests. */
export const removeById = internalMutation({
  args: { id: v.id("siteReviews") },
  returns: v.boolean(),
  handler: async (ctx, { id }) => removeReview(ctx, id),
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
    if (!to) {
      log.warn("no owner address configured; the waiting-reviews email wasn't sent", {});
      return null;
    }
    try {
      const waiting = await ctx.runQuery(internal.siteReviews.waitingCount, {});
      if (waiting.length === 0) return null;
      const lines = waiting
        .slice(0, 20)
        .map((w) => `- ${w.name}, ${w.rating} of 5${w.text ? `: ${w.text.length > 160 ? `${w.text.slice(0, 157)}...` : w.text}` : " (no words)"}`);
      const text = [
        "These reviews wait for you before they show on the site:",
        "",
        ...lines,
        "",
        `Approve or decline on the admin page: ${SITE_URL}/admin#reviews`,
        "",
        "Decline only spam or fake reviews, abuse, someone's personal information, or a review of something else; never a review for its stars.",
        "You get this at most once a day.",
      ].join("\n");
      const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const html = text
        .split("\n")
        .map((l) => (l ? `<p>${esc(l)}</p>` : ""))
        .join("");
      const result = await sendOwnerMail(ctx, "site-review", getResend(), {
        to,
        subject: `Reviews waiting for you: ${waiting.length}`,
        html,
        text,
      });
      if (result.error) await recordError(ctx, "action", "siteReviews.notifyOwner", new Error(`owner email failed: ${JSON.stringify(result.error)}`));
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
// Retention
// ============================================================================

/**
 * Delete the words, name and address of reviews declined more than DECLINED_KEEP_MS ago (daily, crons.ts). The
 * rating, the reason and Senja's id stay, so the record of what was declined and why survives, and a Senja review
 * is never copied in again. Reschedules itself while a full batch remains.
 */
export const scrubDeclined = internalMutation({
  args: {},
  returns: v.object({ scrubbed: v.number(), notes: v.number() }),
  handler: async (ctx) => {
    const now = Date.now();
    const cutoff = now - DECLINED_KEEP_MS;
    let scrubbed = 0;
    let looked = 0;
    let more = false;
    for await (const r of ctx.db.query("siteReviews").withIndex("by_status_created", (q) => q.eq("status", "declined"))) {
      looked += 1;
      if (looked > SCRUB_BATCH * 5) break;
      if (r.scrubbedAt !== undefined || r.reviewedAt === undefined || r.reviewedAt > cutoff) continue;
      await ctx.db.patch(r._id, { text: "", name: "", email: undefined, scrubbedAt: now });
      scrubbed += 1;
      if (scrubbed >= SCRUB_BATCH) {
        more = true;
        break;
      }
    }
    if (scrubbed > 0) log.info("declined reviews' words deleted", { scrubbed });
    // Private notes go after NOTE_KEEP_MS whatever became of the review; the index reads only rows that have one.
    let notes = 0;
    for await (const r of ctx.db
      .query("siteReviews")
      .withIndex("by_note_at", (q) => q.gt("privateNoteAt", 0).lt("privateNoteAt", now - NOTE_KEEP_MS))) {
      await ctx.db.patch(r._id, { privateNote: undefined, privateNoteAt: undefined });
      notes += 1;
      if (notes >= SCRUB_BATCH) {
        more = true;
        break;
      }
    }
    if (notes > 0) log.info("private review notes deleted", { notes });
    // A full batch of either: one more run, scheduled once.
    if (more) await ctx.scheduler.runAfter(0, internal.siteReviews.scrubDeclined, {});
    return { scrubbed, notes };
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
      if (shown && !insider) await adjustTally(ctx, r.rating, 1);
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
