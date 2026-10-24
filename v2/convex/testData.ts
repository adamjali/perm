/**
 * Removing the owner's own test runs from production (Oct 24 2026).
 *
 * The owner tests the alert emails end to end on production with a real case: a watch signed up with
 * `source: "owner-test"`, the alert it sends, a rating tapped in that alert. This removes what such a run left: the
 * watch, its rating, its congratulations note and any alert still waiting in the outbox for it. It acts only on a
 * watch marked "owner-test", so it can't remove a real subscriber's row, and it runs dry unless told otherwise.
 *
 *   npx convex run testData:removeOwnerTest '{"email":"...","caseNumber":"G-100-...","dryRun":true}' --prod
 *
 * The same for a visa-bulletin watch (removeOwnerBulletinTest): every bulletin watch on the address must be marked
 * "owner-test", because a bulletin link confirms or stops every watch an address holds.
 *
 *   npx convex run testData:removeOwnerBulletinTest '{"email":"...","dryRun":true}' --prod
 */

import { v } from "convex/values";

import { internalMutation } from "./_generated/server";
import { ratingKey } from "./alertRatings";
import { normaliseFlagCaseNumber } from "../src/lib/flagCaseNumber";

/** The source a watch carries when the owner signs up for a test. */
export const OWNER_TEST_SOURCE = "owner-test";

export const removeOwnerTest = internalMutation({
  args: { email: v.string(), caseNumber: v.string(), dryRun: v.boolean() },
  returns: v.object({
    dryRun: v.boolean(),
    watches: v.number(),
    ratings: v.number(),
    congratsNotes: v.number(),
    outbox: v.number(),
    refused: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const parsed = normaliseFlagCaseNumber(args.caseNumber);
    const none = { dryRun: args.dryRun, watches: 0, ratings: 0, congratsNotes: 0, outbox: 0 };
    if (!parsed) return { ...none, refused: "That isn't a case number." };
    const caseNumber = parsed.caseNumber;

    const watches = await ctx.db
      .query("caseStatusAlerts")
      .withIndex("by_email_case", (q) => q.eq("email", email).eq("caseNumber", caseNumber))
      .collect();
    if (watches.length === 0) return { ...none, refused: "No watch for that address and case." };
    if (watches.some((w) => w.source !== OWNER_TEST_SOURCE)) {
      return { ...none, refused: `A watch for that address and case isn't marked "${OWNER_TEST_SOURCE}"; nothing removed.` };
    }

    const key = await ratingKey(email, caseNumber);
    const rated = await ctx.db
      .query("alertRatings")
      .withIndex("by_key", (q) => q.eq("key", key))
      .collect();

    const notes = (
      await Promise.all(
        watches.map((w) =>
          ctx.db
            .query("congratsNotes")
            .withIndex("by_alert", (q) => q.eq("alertId", w._id))
            .collect(),
        ),
      )
    ).flat();

    const refs = new Set(watches.map((w) => `case:${w._id}`));
    const waiting = (
      await ctx.db
        .query("alertOutbox")
        .withIndex("by_email_status", (q) => q.eq("email", email))
        .collect()
    ).filter((o) => refs.has(o.ref));

    if (!args.dryRun) {
      for (const row of [...rated, ...notes, ...waiting, ...watches]) await ctx.db.delete(row._id);
    }
    return {
      dryRun: args.dryRun,
      watches: watches.length,
      ratings: rated.length,
      congratsNotes: notes.length,
      outbox: waiting.length,
      refused: null,
    };
  },
});

export const removeOwnerBulletinTest = internalMutation({
  args: { email: v.string(), dryRun: v.boolean() },
  returns: v.object({
    dryRun: v.boolean(),
    watches: v.number(),
    outbox: v.number(),
    refused: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const none = { dryRun: args.dryRun, watches: 0, outbox: 0 };
    const watches = await ctx.db
      .query("bulletinAlerts")
      .withIndex("by_email", (q) => q.eq("email", email))
      .collect();
    if (watches.length === 0) return { ...none, refused: "No bulletin watch for that address." };
    if (watches.some((w) => w.source !== OWNER_TEST_SOURCE)) {
      return { ...none, refused: `A bulletin watch on that address isn't marked "${OWNER_TEST_SOURCE}"; nothing removed.` };
    }
    const refs = new Set(watches.map((w) => `bulletin:${w._id}`));
    const waiting = (
      await ctx.db
        .query("alertOutbox")
        .withIndex("by_email_status", (q) => q.eq("email", email))
        .collect()
    ).filter((o) => refs.has(o.ref));
    if (!args.dryRun) {
      for (const row of [...waiting, ...watches]) await ctx.db.delete(row._id);
    }
    return { dryRun: args.dryRun, watches: watches.length, outbox: waiting.length, refused: null };
  },
});
