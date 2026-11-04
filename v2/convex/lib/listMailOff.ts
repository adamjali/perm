/**
 * Turning list mail off for an address, shared by the preference page (convex/emailPrefs.ts) and account
 * deletion (convex/lib/deletion.ts).
 *
 * Every alert table is keyed by address, not by account, so deleting an account's user-keyed rows left the alerts
 * its own address held still mailing (Nov 4 2026): onboarding's "Waiting on my own case" writes a case alert that a
 * verified account confirms at once, and the same address can follow a queue month, a bulletin line, an employer,
 * the news and the digest. Each is switched off here the way its own opt-out does it: the row is tombstoned
 * (`unsubscribedAt`, staged changes dropped so a replayed confirm link can't bring it back), and what was still
 * waiting to go (the outbox, the retry queue) is dropped with it.
 */

import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { dropQueued } from "./alertOutboxStore";

/**
 * Tombstone every alert row for an address (all four kinds, staged changes dropped so a replayed confirm link
 * cannot resurrect one), and drop every alert still waiting in the outbox or the retry queue. News, the digest and
 * account mail are not alerts and are left alone.
 */
export async function turnOffAlerts(ctx: MutationCtx, email: string, now: number): Promise<number> {
  let changed = 0;
  for (const row of await ctx.db
    .query("dolQueueAlerts")
    .withIndex("by_email", (q) => q.eq("email", email))
    .collect()) {
    if (row.unsubscribedAt === undefined || row.pendingFilingMonth !== undefined) {
      await ctx.db.patch(row._id, {
        unsubscribedAt: row.unsubscribedAt ?? now,
        pendingFilingMonth: undefined,
      });
      changed += 1;
    }
  }
  for (const row of await ctx.db
    .query("caseStatusAlerts")
    .withIndex("by_email", (q) => q.eq("email", email))
    .collect()) {
    if (row.unsubscribedAt === undefined || row.pendingCaseNumber !== undefined) {
      await ctx.db.patch(row._id, {
        unsubscribedAt: row.unsubscribedAt ?? now,
        pendingCaseNumber: undefined,
      });
      changed += 1;
    }
  }
  for (const row of await ctx.db
    .query("bulletinAlerts")
    .withIndex("by_email", (q) => q.eq("email", email))
    .collect()) {
    if (row.unsubscribedAt === undefined || row.pendingSeries !== undefined) {
      await ctx.db.patch(row._id, {
        unsubscribedAt: row.unsubscribedAt ?? now,
        pendingSeries: undefined,
      });
      changed += 1;
    }
  }
  for (const row of await ctx.db
    .query("employerAlerts")
    .withIndex("by_email", (q) => q.eq("email", email))
    .collect()) {
    if (row.unsubscribedAt === undefined || row.pendingSlug !== undefined) {
      await ctx.db.patch(row._id, {
        unsubscribedAt: row.unsubscribedAt ?? now,
        pendingSlug: undefined,
        pendingName: undefined,
      });
      changed += 1;
    }
  }
  await dropQueued(ctx, email, "all");
  return changed;
}

/** Tombstone the address's product-news and weekly-digest consent. Returns how many rows it turned off. */
export async function turnOffNewsAndDigest(ctx: MutationCtx, email: string, now: number): Promise<number> {
  let changed = 0;
  const news = await ctx.db
    .query("newsSubscribers")
    .withIndex("by_email", (q) => q.eq("email", email))
    .first();
  if (news && news.unsubscribedAt === undefined) {
    await ctx.db.patch(news._id, { unsubscribedAt: now });
    changed += 1;
  }
  const newsletter = await ctx.db
    .query("newsletterSubscribers")
    .withIndex("by_email", (q) => q.eq("email", email))
    .first();
  if (newsletter && newsletter.unsubscribedAt === undefined) {
    await ctx.db.patch(newsletter._id, { unsubscribedAt: now });
    changed += 1;
  }
  return changed;
}

type ConfirmationKind = Doc<"confirmationQueue">["kind"];
const CONFIRMATION_KINDS = [
  "case",
  "employer",
  "queue",
  "bulletin",
  "prefs",
  "firm",
  "firmEdit",
  "digest",
] as const satisfies readonly ConfirmationKind[];
// A kind added to the table and not here fails the typecheck, so a waiting confirmation can't be missed.
type MissingKind = Exclude<ConfirmationKind, (typeof CONFIRMATION_KINDS)[number]>;
const everyKind: [MissingKind] extends [never] ? true : never = true;
void everyKind;

export interface ListMailStopped {
  /** Alert, news and digest rows turned off. */
  subscriptions: number;
  /** Confirmation requests that were waiting for room in a pool. */
  confirmations: number;
  /** Congratulations notes still due, marked skipped. */
  congratsNotes: number;
}

/**
 * Stop every list mail to an address: every alert, the news, the digest, a confirmation still waiting to go, and a
 * founder's note still due. For an account being deleted; the preference page turns things off one at a time.
 */
export async function stopListMail(ctx: MutationCtx, email: string, now: number): Promise<ListMailStopped> {
  const subscriptions = (await turnOffAlerts(ctx, email, now)) + (await turnOffNewsAndDigest(ctx, email, now));

  let confirmations = 0;
  for (const kind of CONFIRMATION_KINDS) {
    for await (const row of ctx.db
      .query("confirmationQueue")
      .withIndex("by_kind_email", (q) => q.eq("kind", kind).eq("email", email))) {
      await ctx.db.delete(row._id);
      confirmations += 1;
    }
  }

  // A note is written and sent by a person from the press mailbox (convex/congratsNotes.ts). One still due is
  // skipped; one already scheduled in that mailbox is the person's to cancel, and stays as it is.
  let congratsNotes = 0;
  for (const note of await ctx.db
    .query("congratsNotes")
    .withIndex("by_email", (q) => q.eq("email", email))
    .take(100)) {
    if (note.state === "due") {
      await ctx.db.patch(note._id, { state: "skipped", reason: "the account was deleted" });
      congratsNotes += 1;
    }
  }

  return { subscriptions, confirmations, congratsNotes };
}
