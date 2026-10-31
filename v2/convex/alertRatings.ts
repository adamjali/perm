/**
 * Ratings from the last alert of a case: "How useful were these alerts?",
 * one to five, with an optional note.
 *
 * The email's five boxes are links to `/case-alert/rate`, each carrying its
 * score. Opening one saves the pick at once and goes straight on: a 3, 4 or 5
 * to the review form, a 1 or 2 to the page that asks what went wrong (owner,
 * Oct 24 2026). Every open is kept with its time and browser (`clicks`).
 *
 * Mail gateways (Outlook Safe Links, Mimecast, Proofpoint) open every link in
 * an inbox, five boxes being five links. Such an open is no one's rating, so
 * an open is marked a scanner when its browser names itself a bot or a
 * fetcher, or when a different score was opened for the same person and case
 * within BURST_MS: a person picks one box, a scanner opens them all. The
 * score is always the newest pick that wasn't a scanner's, and a row a
 * scanner alone opened has none.
 *
 * The link is signed for the address (purpose `alert-rating`, good for
 * nothing else), and a rating is kept only for a case that address really
 * watched, so a forwarded link can rate that one person's alerts and no more.
 * Changing `r` in the address only changes the holder's own pick. At most
 * CLICKS_PER_HOUR opens a row an hour are written, so a link opened in a loop
 * can't grow the row or run up writes.
 *
 * The row in the email ships only while `ALERT_RATING_ENABLED` is "1" on the
 * deployment (`ratingsOn`): the pages answer either way, the email asks only
 * once the owner has seen them.
 */

import { v } from "convex/values";

import { internalMutation, internalQuery, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireAdmin } from "./lib/admin";
import { SITE_URL } from "./lib/links";
import { makeUnsubscribeToken, verifyUnsubscribeToken } from "./lib/unsubscribeToken";
import { normaliseFlagCaseNumber } from "../src/lib/flagCaseNumber";
import { MS_PER_DAY } from "./lib/time";
import { queueAlertRating, raterKeyFor } from "./siteReviews";

/** Whether the last alert carries the rating row: the owner's switch. */
export function ratingsOn(): boolean {
  return process.env.ALERT_RATING_ENABLED === "1";
}

/** The row's key: one per address and case, and all that's left when they go anonymous. */
export async function ratingKey(email: string, caseNumber: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${email}|${caseNumber}`));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Where the email's boxes and the page's form point. */
export const RATING_PATH = "/case-alert/rate";
/** The longest note kept; a longer one is cut, not refused. */
export const NOTE_MAX = 1000;
/** A different score opened for the same person and case this soon after another is a scanner, not a person. */
export const BURST_MS = 60_000;
/** Opens and taps kept per row, newest last. */
export const CLICKS_KEPT = 20;
/** Opens written per row in an hour; past this an open still goes on to its page, unwritten. */
export const CLICKS_PER_HOUR = 20;
/** The browser line kept with an open, cut to this length. */
export const BROWSER_MAX = 300;
/** A browser line that names a fetcher rather than a person's browser. */
const SCANNER_BROWSER =
  /bot\b|crawl|spider|preview|scanner|fetch|python|curl|wget|java\/|go-http|okhttp|headless|phantom|safelinks|mimecast|proofpoint|barracuda|ms-office|microsoft office\/|microsoft office existence|google-safety|appengine/i;

/** The rating link for one address and case; the email adds `&r=1` to `&r=5`. */
export async function ratingLink(email: string, caseNumber: string, secret: string): Promise<string> {
  const token = await makeUnsubscribeToken(email, secret, "alert-rating");
  return `${SITE_URL}${RATING_PATH}?token=${encodeURIComponent(token)}&c=${encodeURIComponent(caseNumber)}`;
}

/** A score from a form or a URL, or null when it isn't a whole number from 1 to 5. */
export function parseScore(raw: string | null | undefined): number | null {
  if (!raw || !/^[1-5]$/.test(raw.trim())) return null;
  return Number(raw.trim());
}

/** Plain text only: no tags, no control characters, trimmed and capped. */
export function cleanNote(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const text = raw.slice(0, NOTE_MAX * 2).replace(/<[^>]*>/g, " ").replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "");
  const out = text.replace(/[ \t]+/g, " ").trim().slice(0, NOTE_MAX);
  return out || undefined;
}

/** The browser line as kept: control characters out, cut short; undefined when there's none. */
export function cleanBrowser(raw: string | null | undefined): string | undefined {
  const out = (raw ?? "").slice(0, BROWSER_MAX * 2).replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, BROWSER_MAX);
  return out || undefined;
}

/** Whether a browser line belongs to a fetcher. A missing one counts: every person's browser sends one. */
export function looksLikeScanner(browser: string | undefined): boolean {
  return !browser || SCANNER_BROWSER.test(browser);
}

type Click = NonNullable<Doc<"alertRatings">["clicks"]>[number];

/**
 * The opens with this one added: a different score opened within BURST_MS of another marks every open in that
 * minute a scanner's, this one included. Newest CLICKS_KEPT kept.
 */
export function addClick(previous: Click[], click: Click): Click[] {
  const recent = previous.filter((c) => click.at - c.at <= BURST_MS && c.via === "email");
  const burst = click.via === "email" && recent.some((c) => c.score !== click.score);
  const marked = burst
    ? previous.map((c) => (click.at - c.at <= BURST_MS && c.via === "email" ? { ...c, scanner: true } : c))
    : previous;
  return [...marked, burst ? { ...click, scanner: true } : click].slice(-CLICKS_KEPT);
}

/** The newest pick that wasn't a scanner's, or undefined when there's none. */
export function scoreFrom(clicks: Click[]): number | undefined {
  for (let i = clicks.length - 1; i >= 0; i--) if (!clicks[i]!.scanner) return clicks[i]!.score;
  return undefined;
}

/** What a saved open or tap answers with, for the page that follows. */
export interface SavedRating {
  email: string;
  caseNumber: string;
  /** The score picked this time, whoever picked it. */
  score: number;
  /** False when this open looked like a scanner's or wasn't written, so it isn't the rating. */
  counted: boolean;
  noted: boolean;
  anonymous: boolean;
  /** The case's last status we alerted on, so the page's next steps fit it. */
  status: string | null;
}

/** Shared by the email's link and the page's tap. Null when the link or the case doesn't check out. */
async function saveRating(
  ctx: MutationCtx,
  args: {
    token: string;
    caseNumber: string;
    score: number;
    via: "email" | "page";
    browser?: string;
    note?: string;
    anonymous?: boolean;
  },
): Promise<SavedRating | null> {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) throw new Error("UNSUBSCRIBE_SECRET is not configured");
  if (!Number.isInteger(args.score) || args.score < 1 || args.score > 5) return null;
  const email = await verifyUnsubscribeToken(args.token.slice(0, 512), secret, "alert-rating");
  if (!email) return null;
  const parsed = normaliseFlagCaseNumber(args.caseNumber.slice(0, 64));
  if (!parsed) return null;
  const caseNumber = parsed.caseNumber;

  // Only a case this address actually watched can be rated through its link.
  const watched = await ctx.db
    .query("caseStatusAlerts")
    .withIndex("by_email_case", (q) => q.eq("email", email).eq("caseNumber", caseNumber))
    .first();
  if (!watched) return null;

  const now = Date.now();
  const note = cleanNote(args.note);
  const browser = cleanBrowser(args.browser);
  const key = await ratingKey(email, caseNumber);
  const existing = await ctx.db
    .query("alertRatings")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();
  // Once anonymous, always: a later tap from the same link can't put the
  // address back on a note they asked to keep apart from it.
  const anonymous = args.anonymous === true || existing?.anonymous === true;
  const previous = existing?.clicks ?? [];
  const status = watched.lastSeenStatus ?? null;
  const answer = (counted: boolean, noted: boolean): SavedRating => ({
    email,
    caseNumber,
    score: args.score,
    counted,
    noted,
    anonymous,
    status,
  });

  // A link opened in a loop: go on to the page, write nothing.
  const lastHour = previous.filter((c) => now - c.at < 60 * 60 * 1000).length;
  if (args.via === "email" && lastHour >= CLICKS_PER_HOUR) return answer(false, existing?.note !== undefined);

  // A tap on the page is a person: the page's buttons are a form that scanners don't post.
  const scannerBrowser = args.via === "email" && looksLikeScanner(browser);
  const clicks = addClick(previous, { score: args.score, at: now, via: args.via, ...(browser ? { browser } : {}), ...(scannerBrowser ? { scanner: true } : {}) });
  const score = scoreFrom(clicks);
  const counted = !clicks[clicks.length - 1]!.scanner;
  const who = anonymous ? { email: undefined, caseNumber: undefined, anonymous: true } : { email, caseNumber };

  let ratingId = existing?._id;
  if (existing) {
    await ctx.db.patch(existing._id, {
      ...who,
      score,
      clicks,
      // A second tap without a note keeps the note sent the first time.
      ...(note !== undefined ? { note } : {}),
      updatedAt: now,
    });
  } else {
    ratingId = await ctx.db.insert("alertRatings", {
      key,
      ...(anonymous ? { anonymous: true } : { email, caseNumber }),
      ...(score !== undefined ? { score } : {}),
      clicks,
      ...(note !== undefined ? { note } : {}),
      createdAt: now,
      updatedAt: now,
    });
  }
  // A person's pick (never a scanner's) waits for the owner as a review with no words.
  if (score !== undefined) await queueAlertRating(ctx, { email, score, at: now, ratingId });
  return answer(counted, note !== undefined || existing?.note !== undefined);
}

const savedShape = v.union(
  v.object({
    email: v.string(),
    caseNumber: v.string(),
    score: v.number(),
    counted: v.boolean(),
    noted: v.boolean(),
    anonymous: v.boolean(),
    status: v.union(v.string(), v.null()),
  }),
  v.null(),
);

/** A tap on the rating page: a pick, or a pick with a note. */
export const record = internalMutation({
  args: {
    token: v.string(),
    caseNumber: v.string(),
    score: v.number(),
    note: v.optional(v.string()),
    /** "Leave my email off this note": drop the address and case number from the row. */
    anonymous: v.optional(v.boolean()),
    browser: v.optional(v.string()),
  },
  returns: savedShape,
  handler: async (ctx, args) => saveRating(ctx, { ...args, via: "page" }),
});

/** An open of one of the email's five boxes: saved at once, then the page the score leads to. */
export const recordClick = internalMutation({
  args: {
    token: v.string(),
    caseNumber: v.string(),
    score: v.number(),
    browser: v.optional(v.string()),
  },
  returns: savedShape,
  handler: async (ctx, args) => saveRating(ctx, { ...args, via: "email" }),
});

export interface RatingsSummary {
  count: number;
  average: number | null;
  /** How many gave 1, 2, 3, 4 and 5. */
  byScore: number[];
  /** The newest notes, with their score: no address, no case number. */
  notes: Array<{ score: number; note: string; updatedAt: number }>;
}

/** Ratings given or changed since `since`, counted. Shared by the report. */
export async function ratingsSince(ctx: QueryCtx, since: number): Promise<RatingsSummary> {
  const rows = await ctx.db
    .query("alertRatings")
    .withIndex("by_updatedAt", (q) => q.gt("updatedAt", since))
    .order("desc")
    .take(500);
  // A row only a scanner opened has no score and isn't anyone's rating.
  const rated = rows.filter((r): r is typeof r & { score: number } => r.score !== undefined);
  const byScore = [0, 0, 0, 0, 0];
  for (const r of rated) byScore[r.score - 1]! += 1;
  const average = rated.length ? rated.reduce((n, r) => n + r.score, 0) / rated.length : null;
  return {
    count: rated.length,
    average,
    byScore,
    notes: rated
      .filter((r) => r.note)
      .slice(0, 10)
      .map((r) => ({ score: r.score, note: r.note!, updatedAt: r.updatedAt })),
  };
}

/** The last week's ratings, for a look by hand: counts and notes, no addresses. */
export const lastWeek = internalQuery({
  args: {},
  returns: v.object({
    count: v.number(),
    average: v.union(v.number(), v.null()),
    byScore: v.array(v.number()),
    notes: v.array(v.object({ score: v.number(), note: v.string(), updatedAt: v.number() })),
  }),
  handler: async (ctx) => ratingsSince(ctx, Date.now() - 7 * MS_PER_DAY),
});

/** How many ratings the admin page lists, newest first. */
export const ADMIN_LIST = 100;

const clickShape = v.object({
  score: v.number(),
  at: v.number(),
  via: v.union(v.literal("email"), v.literal("page")),
  browser: v.optional(v.string()),
  scanner: v.optional(v.boolean()),
});

/**
 * Every rating with what we know of who gave it: their taps (when, which score, which browser, scanner or not),
 * their note, the watch it came from (signed up, confirmed, where, alerts sent, last status), the name on their
 * account if they have one, and the newest review they left on the site.
 *
 * SECURITY: requireAdmin; rows carry addresses.
 */
export const forAdmin = query({
  args: {},
  returns: v.array(
    v.object({
      id: v.id("alertRatings"),
      email: v.union(v.string(), v.null()),
      caseNumber: v.union(v.string(), v.null()),
      anonymous: v.boolean(),
      score: v.union(v.number(), v.null()),
      note: v.union(v.string(), v.null()),
      clicks: v.array(clickShape),
      createdAt: v.number(),
      updatedAt: v.number(),
      name: v.union(v.string(), v.null()),
      watch: v.union(
        v.null(),
        v.object({
          signedUpAt: v.number(),
          confirmedAt: v.union(v.number(), v.null()),
          source: v.union(v.string(), v.null()),
          lastSeenStatus: v.union(v.string(), v.null()),
          alertCount: v.number(),
          lastAlertSentAt: v.union(v.number(), v.null()),
          unsubscribedAt: v.union(v.number(), v.null()),
        }),
      ),
      review: v.union(
        v.null(),
        v.object({
          status: v.union(v.literal("pending"), v.literal("approved"), v.literal("declined")),
          rating: v.number(),
          at: v.number(),
        }),
      ),
    }),
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("alertRatings").withIndex("by_updatedAt").order("desc").take(ADMIN_LIST);
    // Reviews have no address index and are few: the newest 500, newest first, read once.
    const reviews = await ctx.db.query("siteReviews").withIndex("by_created").order("desc").take(500);
    const reviewFor = new Map<string, (typeof reviews)[number]>();
    for (const r of reviews) if (r.email && !reviewFor.has(r.email)) reviewFor.set(r.email, r);

    return Promise.all(
      rows.map(async (r) => {
        const email = r.email ?? null;
        const caseNumber = r.caseNumber ?? null;
        const watchRow =
          email && caseNumber
            ? await ctx.db
                .query("caseStatusAlerts")
                .withIndex("by_email_case", (q) => q.eq("email", email).eq("caseNumber", caseNumber))
                .first()
            : null;
        let name: string | null = null;
        if (email) {
          const user = await ctx.db
            .query("users")
            .withIndex("email", (q) => q.eq("email", email))
            .first();
          if (user) {
            const profile = await ctx.db
              .query("userProfiles")
              .withIndex("by_user_id", (q) => q.eq("userId", user._id))
              .first();
            name = profile?.fullName || user.name || null;
          }
        }
        // A written review from the address first; otherwise the review this rating queued (Oct 31 2026).
        let review = email ? reviewFor.get(email) : undefined;
        if (!review && email) {
          const key = await raterKeyFor(email);
          review = (await ctx.db.query("siteReviews").withIndex("by_rater_key", (q) => q.eq("raterKey", key)).take(5))[0];
        }
        return {
          id: r._id,
          email,
          caseNumber,
          anonymous: r.anonymous === true,
          score: r.score ?? null,
          note: r.note ?? null,
          clicks: r.clicks ?? [],
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          name,
          watch: watchRow
            ? {
                signedUpAt: watchRow.createdAt,
                confirmedAt: watchRow.confirmedAt ?? null,
                source: watchRow.source ?? null,
                lastSeenStatus: watchRow.lastSeenStatus ?? null,
                alertCount: watchRow.alertCount ?? 0,
                lastAlertSentAt: watchRow.lastAlertSentAt ?? null,
                unsubscribedAt: watchRow.unsubscribedAt ?? null,
              }
            : null,
          review: review ? { status: review.status, rating: review.rating, at: review.createdAt } : null,
        };
      }),
    );
  },
});

/**
 * One time (Oct 31 2026): queue chosen ratings left before ratings became reviews. Run with `dryRun: true` first.
 * A rating whose address was dropped (anonymous) can't be matched to a person, so it is left out.
 */
export const queueExistingAsReviews = internalMutation({
  args: { ids: v.array(v.id("alertRatings")), dryRun: v.boolean() },
  returns: v.array(v.object({ id: v.id("alertRatings"), result: v.string() })),
  handler: async (ctx, { ids, dryRun }) => {
    const out: { id: Id<"alertRatings">; result: string }[] = [];
    for (const id of ids) {
      const row = await ctx.db.get(id);
      if (!row) out.push({ id, result: "missing" });
      else if (row.score === undefined) out.push({ id, result: "no score: only a scanner opened it" });
      else if (!row.email) out.push({ id, result: "anonymous: no address to count it once" });
      else if (dryRun) out.push({ id, result: `would queue ${row.score} of 5` });
      else {
        await queueAlertRating(ctx, { email: row.email, score: row.score, at: row.createdAt, ratingId: row._id });
        out.push({ id, result: `queued ${row.score} of 5` });
      }
    }
    return out;
  },
});
