/**
 * The DOL live-status watch for a SAVED case in the signed-in app.
 *
 * ## Why this exists beside caseAlerts.ts
 *
 * `caseAlerts.ts` is the PUBLIC, account-free path: a person types a case
 * number and an email, double-opts-in, and gets an alert email. It is keyed by
 * `(email, caseNumber)` and knows nothing about a saved case or a user.
 *
 * An attorney who saves a case in the app should not have to re-enter its
 * number on the public site to hear when DOL moves it. So a saved case with a
 * valid DOL number watches itself: the account is the consent, so there is no
 * double opt-in, and the signal lands as an in-app notification first and an
 * email only by the user's own preference.
 *
 * ## The one rule that cannot bend
 *
 * The sweep writes `liveStatus` / `liveStatusSeenAt` / `liveStatusIsFinal` on
 * the case and NEVER touches `caseStatus` or `progressStatus`. Those are the
 * firm's own bookkeeping; silently overwriting them with DOL's word would
 * destroy the attorney's record. DOL's live status sits BESIDE the firm's
 * stage, and a mismatch between the two is itself a useful signal. A
 * beneficiary's own-case account, which keeps no stage of its own, can read
 * `liveStatus` as the status.
 *
 * ## How it joins the existing machinery
 *
 * The server pulls every watched case number through `GET /watched-cases`
 * (`convex/watchedCases.ts`), asks DOL, writes any change into the public
 * mirror, then calls `POST /watched-cases/sweep`. That route already schedules
 * the email, push and webhook sweeps; it now also schedules
 * `sweepAppCaseStatuses`, which reads the SAME mirror (no DOL call here) and
 * writes `liveStatus` back to the matching cases. `watchedCaseNumbers` unions
 * these cases' numbers in, so a case the app watches and a separate email
 * subscription on the same number coalesce to one DOL request.
 *
 * ## The first sighting is silent
 *
 * As in `caseAlerts.ts`: the first time the sweep sees a case it records the
 * baseline and notifies no one. Our first sight cannot tell "it just arrived"
 * from "it has sat in this status for months"; mailing the second as news is a
 * false alarm.
 *
 * @module convex/appCaseWatch
 */

import { v } from "convex/values";

import {
  internalAction,
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  normaliseFlagCaseNumber,
  programOf,
  statusTableFor,
  type FlagProgram,
} from "../src/lib/flagCaseNumber";
import { canonicalStatus } from "../src/lib/caseStatusVocabulary";
import { placeholders, query, type Row, type Statement } from "./lib/publicMirror";
import {
  buildUserNotificationPrefs,
  shouldSendEmail,
} from "./lib/notificationHelpers";
import { emailStamp } from "./lib/time";
import { createLogger } from "./lib/logging";

const log = createLogger("appCaseWatch");

/**
 * The most cases one sweep will carry, matched to `watchedCaseNumbers`' own
 * WATCHED_CAP. A flood of saved cases cannot turn the 5-minute job into a full
 * sweep; the overflow is dropped and logged, exactly as the email path drops
 * its overflow.
 */
export const APP_WATCH_CAP = 2_000;

/** The IN-list size per mirror statement, so a single round trip stays bounded. */
const MIRROR_CHUNK = 200;

/** One watchable saved case, reduced to what the sweep and the union need. */
export interface AppWatchRow {
  caseId: Id<"cases">;
  userId: Id<"users">;
  /** The normalised DOL case number, as the mirror keys its rows. */
  caseNumber: string;
  /** DOL's status as last recorded on the case, or undefined if never seen. */
  liveStatus: string | undefined;
}

/**
 * Every saved case that should be watching DOL right now, across all accounts.
 *
 * A case qualifies when it is not deleted, is not the onboarding sample, is not
 * switched off at the case (`watchEnabled === false`) or the account
 * (`userProfiles.watchSavedCases === false`), and carries a case number that
 * normalises to a real DOL serial. A number that does not normalise (an
 * internal reference, a half-typed number) is simply not watchable.
 *
 * Read through `by_case_number`: a `gte("caseNumber", "")` range returns the
 * cases that carry a number and skips the drafts that do not, since undefined
 * sorts before "". Shared by the server union and the sweep so the two can
 * never disagree about which cases are watched.
 */
export async function collectWatchableCases(
  ctx: QueryCtx,
): Promise<{ rows: AppWatchRow[]; capped: boolean }> {
  const rows: AppWatchRow[] = [];
  const accountOn = new Map<string, boolean>();

  const cases = ctx.db
    .query("cases")
    .withIndex("by_case_number", (q) => q.gte("caseNumber", ""));

  for await (const c of cases) {
    if (!c.caseNumber) continue; // the range should exclude these; belt and braces
    if (c.deletedAt !== undefined) continue;
    if (c.isSample === true) continue;
    if (c.watchEnabled === false) continue;

    const parsed = normaliseFlagCaseNumber(c.caseNumber);
    if (!parsed) continue;

    // The account's global switch, read once per account.
    const key = c.userId as unknown as string;
    let on = accountOn.get(key);
    if (on === undefined) {
      const profile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user_id", (q) => q.eq("userId", c.userId))
        .unique();
      on = profile?.watchSavedCases !== false; // absent = on
      accountOn.set(key, on);
    }
    if (!on) continue;

    rows.push({
      caseId: c._id,
      userId: c.userId,
      caseNumber: parsed.caseNumber,
      liveStatus: c.liveStatus,
    });
    if (rows.length >= APP_WATCH_CAP) return { rows, capped: true };
  }

  return { rows, capped: false };
}

/** The sweep's view of the watchable cases. Internal; the action is its only caller. */
export const watchableCases = internalQuery({
  args: {},
  returns: v.object({
    rows: v.array(
      v.object({
        caseId: v.id("cases"),
        userId: v.id("users"),
        caseNumber: v.string(),
        liveStatus: v.optional(v.string()),
      }),
    ),
    capped: v.boolean(),
  }),
  handler: async (ctx) => {
    const { rows, capped } = await collectWatchableCases(ctx);
    return {
      rows: rows.map((r) => ({
        caseId: r.caseId,
        userId: r.userId,
        caseNumber: r.caseNumber,
        liveStatus: r.liveStatus,
      })),
      capped,
    };
  },
});

/** `str`: a value that is a non-empty string, else null. */
function str(value: string | number | null | undefined): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** `is_final` as a boolean. `Number(x) === 1` handles the string "1" and the integer 1 alike. */
function isFinalFlag(value: string | number | null | undefined): boolean {
  return Number(value) === 1;
}

/** Case numbers bucketed by the program table that holds them. */
function groupByProgram(caseNumbers: string[]): Map<FlagProgram, string[]> {
  const out = new Map<FlagProgram, string[]>();
  for (const n of caseNumbers) {
    const program = programOf(n);
    const held = out.get(program);
    if (held) held.push(n);
    else out.set(program, [n]);
  }
  return out;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Read the mirror for a saved case and write DOL's live status back onto it.
 *
 * No DOL call: the server has already refreshed the mirror for these numbers
 * before calling the sweep route. This reads what the mirror holds and records
 * it on the case, raising an in-app notification (and an email by preference)
 * on a real change. The first sighting of a case is silent.
 */
export const sweepAppCaseStatuses = internalAction({
  args: {},
  returns: v.object({
    checked: v.number(),
    seeded: v.number(),
    changed: v.number(),
    notified: v.number(),
    emailed: v.number(),
    capped: v.boolean(),
  }),
  handler: async (
    ctx,
  ): Promise<{
    checked: number;
    seeded: number;
    changed: number;
    notified: number;
    emailed: number;
    capped: boolean;
  }> => {
    const { rows, capped } = await ctx.runQuery(internal.appCaseWatch.watchableCases, {});
    if (capped) {
      log.error("app watch over cap; overflow not swept this run", {
        cap: APP_WATCH_CAP,
      });
    }
    if (rows.length === 0) {
      return { checked: 0, seeded: 0, changed: 0, notified: 0, emailed: 0, capped };
    }

    // One round trip for the whole batch: one statement per program per chunk.
    // De-duplicated because the same number can be saved by several accounts.
    const uniqueCases = Array.from(new Set(rows.map((r) => r.caseNumber)));
    const statements: Statement[] = [];
    for (const [program, numbers] of groupByProgram(uniqueCases)) {
      for (const part of chunk(numbers, MIRROR_CHUNK)) {
        const marks = placeholders(part.length);
        if (!marks) continue;
        statements.push({
          sql: `SELECT case_number, current_status, is_final
                  FROM ${statusTableFor(program)} WHERE case_number IN (${marks})`,
          args: part,
        });
      }
    }
    if (statements.length === 0) {
      return { checked: 0, seeded: 0, changed: 0, notified: 0, emailed: 0, capped };
    }

    const mirror: Row[] = (await query(statements)).flat();
    const nowByCase = new Map<string, { status: string; isFinal: boolean }>();
    for (const row of mirror) {
      const numKey = str(row.case_number);
      const status = str(row.current_status);
      if (!numKey || !status) continue;
      nowByCase.set(numKey, {
        status: canonicalStatus(status),
        isFinal: isFinalFlag(row.is_final),
      });
    }

    let seeded = 0;
    let changed = 0;
    let notified = 0;
    let emailed = 0;

    for (const r of rows) {
      const current = nowByCase.get(r.caseNumber);
      // Not in the mirror: a recent filing legitimately sits outside it for
      // weeks. Not an error and not a change.
      if (!current) continue;

      // First sighting: establish the baseline, notify no one.
      if (r.liveStatus === undefined) {
        await ctx.runMutation(internal.appCaseWatch.seedLiveStatus, {
          caseId: r.caseId,
          status: current.status,
          isFinal: current.isFinal,
        });
        seeded += 1;
        continue;
      }

      // No change since we last recorded DOL's word on this case.
      if (r.liveStatus === current.status) continue;

      const res = await ctx.runMutation(internal.appCaseWatch.recordLiveChange, {
        caseId: r.caseId,
        previousStatus: r.liveStatus,
        status: current.status,
        isFinal: current.isFinal,
      });
      if (res.changed) changed += 1;
      if (res.notified) notified += 1;
      if (res.emailed) emailed += 1;
    }

    return { checked: rows.length, seeded, changed, notified, emailed, capped };
  },
});

/** Does this case still qualify for the watch? Guards every write against a race. */
function stillWatchable(caseDoc: Doc<"cases"> | null): caseDoc is Doc<"cases"> {
  return (
    caseDoc !== null &&
    caseDoc.deletedAt === undefined &&
    caseDoc.isSample !== true &&
    caseDoc.watchEnabled !== false
  );
}

/**
 * Record DOL's live status on a case as the baseline, silently.
 *
 * Idempotent: if a racing sweep already set this status, or the case stopped
 * qualifying between the read and the write, it does nothing. It never touches
 * `caseStatus` or `progressStatus`.
 */
export const seedLiveStatus = internalMutation({
  args: {
    caseId: v.id("cases"),
    status: v.string(),
    isFinal: v.boolean(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const caseDoc = await ctx.db.get(args.caseId);
    if (!stillWatchable(caseDoc)) return false;
    if (caseDoc.liveStatus === args.status) return false;
    await ctx.db.patch(args.caseId, {
      liveStatus: args.status,
      liveStatusSeenAt: Date.now(),
      liveStatusIsFinal: args.isFinal,
      updatedAt: Date.now(),
    });
    return true;
  },
});

/**
 * Record a real DOL status change: write it, raise an in-app notification, and
 * schedule an email by the user's preference.
 *
 * The write is conditional on the case still holding the old status (so two
 * sweeps racing notify once, keyed on the case's own field, which is the
 * dedup the plan asks for). The email is suppressed when the owner is ALSO a
 * confirmed public email subscriber on this same number — that path owns the
 * email, and the in-app notification still fires here. `caseStatus` and
 * `progressStatus` are never touched.
 */
export const recordLiveChange = internalMutation({
  args: {
    caseId: v.id("cases"),
    previousStatus: v.string(),
    status: v.string(),
    isFinal: v.boolean(),
  },
  returns: v.object({
    changed: v.boolean(),
    notified: v.boolean(),
    emailed: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const caseDoc = await ctx.db.get(args.caseId);
    if (!stillWatchable(caseDoc)) return { changed: false, notified: false, emailed: false };
    // A racing sweep already recorded this status: do not notify twice.
    if (caseDoc.liveStatus === args.status) {
      return { changed: false, notified: false, emailed: false };
    }

    const now = Date.now();
    await ctx.db.patch(args.caseId, {
      liveStatus: args.status,
      liveStatusSeenAt: now,
      liveStatusIsFinal: args.isFinal,
      updatedAt: now,
    });

    const who = caseDoc.beneficiaryIdentifier || "this case";
    const notificationId = await ctx.db.insert("notifications", {
      userId: caseDoc.userId,
      caseId: args.caseId,
      type: "status_change",
      title: "DOL updated this case",
      message: `DOL's live status for ${caseDoc.employerName} moved from ${args.previousStatus} to ${args.status}.`,
      priority: args.isFinal ? "high" : "normal",
      isRead: false,
      emailSent: false,
      createdAt: now,
      updatedAt: now,
    });

    // Email by preference, unless the owner is already a confirmed public
    // subscriber on this number (that path sends the email).
    let emailed = false;
    const user = await ctx.db.get(caseDoc.userId);
    const ownerEmail = user?.email;
    if (ownerEmail) {
      const profile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user_id", (q) => q.eq("userId", caseDoc.userId))
        .unique();
      const prefs = buildUserNotificationPrefs(profile);
      const wantsEmail = shouldSendEmail("status_change", "normal", prefs);
      if (wantsEmail && !(await hasPublicSubscription(ctx, ownerEmail, caseDoc.caseNumber))) {
        await ctx.scheduler.runAfter(0, internal.notificationActions.sendStatusChangeEmail, {
          notificationId,
          to: ownerEmail,
          beneficiaryName: who,
          companyName: caseDoc.employerName,
          previousStatus: args.previousStatus,
          newStatus: args.status,
          changeType: "stage",
          changedAt: emailStamp(),
          caseId: args.caseId.toString(),
          caseNumber: caseDoc.caseNumber,
        });
        emailed = true;
      }
    }

    return { changed: true, notified: true, emailed };
  },
});

/**
 * Is this address already a confirmed, live public email subscriber on this
 * case number? Read by `by_email` (a handful of rows) and matched on the
 * normalised number, so the index key's own normalisation cannot cause a miss.
 */
async function hasPublicSubscription(
  ctx: MutationCtx,
  email: string,
  caseNumber: string | undefined,
): Promise<boolean> {
  if (!caseNumber) return false;
  const want = normaliseFlagCaseNumber(caseNumber)?.caseNumber;
  if (!want) return false;
  const subs = await ctx.db
    .query("caseStatusAlerts")
    .withIndex("by_email", (q) => q.eq("email", email))
    .collect();
  return subs.some(
    (s) =>
      s.confirmedAt !== undefined &&
      s.unsubscribedAt === undefined &&
      s.caseClosedAt === undefined &&
      normaliseFlagCaseNumber(s.caseNumber)?.caseNumber === want,
  );
}
