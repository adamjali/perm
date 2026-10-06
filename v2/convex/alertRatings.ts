/**
 * Ratings from the last alert of a case: "How useful were these alerts?",
 * one to five, with an optional note.
 *
 * The email's five boxes are links to `/case-alert/rate`, each carrying its
 * score. That GET only shows the page with the score picked; the person's
 * tap on the page is the POST that records it. Mail gateways open every link
 * in an inbox, so a GET that recorded would let a scanner rate on the
 * reader's behalf, five times over.
 *
 * The link is signed for the address (purpose `alert-rating`, good for
 * nothing else), and a rating is kept only for a case that address really
 * watched, so a forwarded link can rate that one person's alerts and no more.
 *
 * The row in the email ships only while `ALERT_RATING_ENABLED` is "1" on the
 * deployment (`ratingsOn`): the pages answer either way, the email asks only
 * once the owner has seen them.
 */

import { v } from "convex/values";

import { internalMutation, internalQuery, type QueryCtx } from "./_generated/server";
import { SITE_URL } from "./lib/links";
import { makeUnsubscribeToken, verifyUnsubscribeToken } from "./lib/unsubscribeToken";
import { normaliseFlagCaseNumber } from "../src/lib/flagCaseNumber";
import { MS_PER_DAY } from "./lib/time";

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

export const record = internalMutation({
  args: {
    token: v.string(),
    caseNumber: v.string(),
    score: v.number(),
    note: v.optional(v.string()),
    /** "Leave my email off this note": drop the address and case number from the row. */
    anonymous: v.optional(v.boolean()),
  },
  returns: v.union(
    v.object({
      caseNumber: v.string(),
      score: v.number(),
      noted: v.boolean(),
      anonymous: v.boolean(),
      /** The case's last status we alerted on, so the page's next steps fit it. */
      status: v.union(v.string(), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
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
    const key = await ratingKey(email, caseNumber);
    const existing = await ctx.db
      .query("alertRatings")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    // Once anonymous, always: a later tap from the same link can't put the
    // address back on a note they asked to keep apart from it.
    const anonymous = args.anonymous === true || existing?.anonymous === true;
    const who = anonymous
      ? { email: undefined, caseNumber: undefined, anonymous: true }
      : { email, caseNumber };
    if (existing) {
      await ctx.db.patch(existing._id, {
        ...who,
        score: args.score,
        // A second tap without a note keeps the note sent the first time.
        ...(note !== undefined ? { note } : {}),
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("alertRatings", {
        key,
        ...(anonymous ? { anonymous: true } : { email, caseNumber }),
        score: args.score,
        ...(note !== undefined ? { note } : {}),
        createdAt: now,
        updatedAt: now,
      });
    }
    return {
      caseNumber,
      score: args.score,
      noted: note !== undefined || existing?.note !== undefined,
      anonymous,
      status: watched.lastSeenStatus ?? null,
    };
  },
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
  const byScore = [0, 0, 0, 0, 0];
  for (const r of rows) byScore[r.score - 1]! += 1;
  const average = rows.length ? rows.reduce((n, r) => n + r.score, 0) / rows.length : null;
  return {
    count: rows.length,
    average,
    byScore,
    notes: rows
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
