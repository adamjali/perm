/**
 * The founder's congratulations notes: who is due one, and what happened to each.
 *
 * Nothing here sends. Zoho's usage policy (Oct 13 2026) bars automated mail from Zoho Mail, and the owner wants
 * every note read before it goes, so a script on the owner's Mac asks `due` each weekday morning, a person reads
 * every note, sends the good ones from the press mailbox (scheduled about an hour out, so the owner can still
 * cancel one from Zoho's Outbox) and records each with `markScheduled`; `markSent` or `skip` close it. The rules
 * and the words are in convex/lib/congratsNote.ts.
 *
 *   npx convex run congratsNotes:due '{"now": <ms>}' --prod     who is due today, with each note's text
 *   npx convex run congratsNotes:status '{"today": "YYYY-MM-DD"}' --prod
 *
 * @module convex/congratsNotes
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { isEmailBlocked, isOwnTestAddress } from "./lib/emailBlocklist";
import { easternDay } from "./lib/time";
import {
  NOTES_FROM_MS,
  composeNotes,
  dueOn,
  earnsNote,
  lateAfter,
  noteProgram,
} from "./lib/congratsNote";

/** Live case alerts one run reads. Far above how many exist (436 rows on Oct 22 2026). */
const ALERTS_READ = 5000;
/** Notes one run hands back. */
const DUE_READ = 200;

function norm(email: string): string {
  return email.trim().toLowerCase();
}

/** Why this address gets no note for this case, or null when it may. */
async function addressBlocked(ctx: MutationCtx, row: Doc<"caseStatusAlerts">): Promise<string | null> {
  const email = norm(row.email);
  if (isOwnTestAddress(email)) return "the site's own address";
  if (isEmailBlocked(email)) return "on the blocklist";
  const optedOut = await ctx.db
    .query("congratsNoteOptOuts")
    .withIndex("by_email", (q) => q.eq("email", email))
    .first();
  if (optedOut) return "asked not to be written to again";
  // A note still waiting doesn't block: this case joins it in the same email. One already scheduled or sent does.
  const before = await ctx.db
    .query("congratsNotes")
    .withIndex("by_email", (q) => q.eq("email", email))
    .take(20);
  if (before.some((n) => n.state === "scheduled" || n.state === "sent")) {
    return "already had a note (one per address)";
  }
  // The rounds sent by hand covered every good decision our alerts told before NOTES_FROM_MS.
  const watched = await ctx.db
    .query("caseStatusAlerts")
    .withIndex("by_email", (q) => q.eq("email", row.email))
    .take(100);
  const handRound = watched.some(
    (w) =>
      w.decidedAt !== undefined &&
      w.decidedAt < NOTES_FROM_MS &&
      w.lastAlertSentAt === w.decidedAt &&
      noteProgram(w.caseNumber, w.lastSeenStatus) !== null,
  );
  if (handRound) return "written to by hand in an earlier round";
  return null;
}

/** Record a row for every decided case that earned a note and has none yet. */
async function enqueue(ctx: MutationCtx, now: number): Promise<number> {
  let added = 0;
  let read = 0;
  for await (const row of ctx.db
    .query("caseStatusAlerts")
    .withIndex("by_alert_sweep", (q) => q.eq("unsubscribedAt", undefined).eq("caseClosedAt", undefined))) {
    if (++read > ALERTS_READ) break;
    const program = earnsNote(row, now);
    if (!program || row.decidedAt === undefined || !row.lastSeenStatus) continue;
    const decidedAt = row.decidedAt;
    const existing = await ctx.db
      .query("congratsNotes")
      .withIndex("by_alert", (q) => q.eq("alertId", row._id))
      .take(10);
    if (existing.some((n) => n.decidedAt === decidedAt)) continue;
    const reason = await addressBlocked(ctx, row);
    await ctx.db.insert("congratsNotes", {
      alertId: row._id,
      email: norm(row.email),
      caseNumber: row.caseNumber,
      program,
      status: row.lastSeenStatus,
      decidedAt,
      dueOn: dueOn(decidedAt),
      state: reason ? "skipped" : "due",
      ...(reason ? { reason } : {}),
      createdAt: now,
    });
    added += 1;
  }
  return added;
}

/** Why a waiting note shouldn't go now, or null when it should. */
async function stale(ctx: MutationCtx, note: Doc<"congratsNotes">, today: string): Promise<string | null> {
  if (today > lateAfter(note.dueOn)) return "more than five business days late";
  const alert = await ctx.db.get(note.alertId);
  if (!alert) return "the alert is gone";
  if (alert.unsubscribedAt !== undefined) return "unsubscribed from the alert";
  if (alert.decidedAt !== note.decidedAt) return "the case moved again";
  if (noteProgram(alert.caseNumber, alert.lastSeenStatus) !== note.program) return "the status changed";
  const optedOut = await ctx.db
    .query("congratsNoteOptOuts")
    .withIndex("by_email", (q) => q.eq("email", note.email))
    .first();
  if (optedOut) return "asked not to be written to again";
  return null;
}

const program = v.union(v.literal("perm"), v.literal("lca"), v.literal("pwd"));

/**
 * One email: every case this address is owed a note for. `id`, `caseNumber`, `program` and `status` describe the
 * first case; `ids` and `cases` hold all of them, and every id is recorded when the email is scheduled.
 */
const dueNote = v.object({
  id: v.id("congratsNotes"),
  ids: v.array(v.id("congratsNotes")),
  email: v.string(),
  caseNumber: v.string(),
  program,
  status: v.string(),
  cases: v.array(v.object({ caseNumber: v.string(), program, status: v.string() })),
  decidedOn: v.string(),
  dueOn: v.string(),
  subject: v.string(),
  body: v.string(),
});

/**
 * Today's notes: records any newly earned ones, closes the ones that went stale, and hands back one email per
 * address with a note due today or earlier, naming every case that address is still owed a note for (a later
 * case's note rides along rather than wait for a day that would come after this email). A mutation because it
 * writes the record; `now` is passed in so a run can be repeated and tested.
 */
export const due = internalMutation({
  args: { now: v.number() },
  returns: v.object({ added: v.number(), dropped: v.number(), notes: v.array(dueNote) }),
  handler: async (ctx, args) => {
    const added = await enqueue(ctx, args.now);
    const today = easternDay(args.now);
    const waiting = await ctx.db
      .query("congratsNotes")
      .withIndex("by_state_due", (q) => q.eq("state", "due").lte("dueOn", today))
      .take(DUE_READ);
    let dropped = 0;
    const byEmail = new Map<string, Array<Doc<"congratsNotes">>>();
    const keep = async (note: Doc<"congratsNotes">): Promise<boolean> => {
      const why = await stale(ctx, note, today);
      if (!why) return true;
      await ctx.db.patch(note._id, { state: "skipped", reason: why });
      dropped += 1;
      return false;
    };
    for (const note of waiting) {
      if (!(await keep(note))) continue;
      const group = byEmail.get(note.email) ?? [];
      group.push(note);
      byEmail.set(note.email, group);
    }
    for (const [email, group] of byEmail) {
      const later = await ctx.db
        .query("congratsNotes")
        .withIndex("by_email", (q) => q.eq("email", email))
        .take(20);
      for (const note of later) {
        if (note.state === "due" && note.dueOn > today && (await keep(note))) group.push(note);
      }
      group.sort((a, b) => a.decidedAt - b.decidedAt || a.caseNumber.localeCompare(b.caseNumber));
    }
    const notes = [...byEmail.values()].map((group) => {
      const firstNote = group[0]!;
      const { subject, body } = composeNotes(
        group.map((n) => ({ program: n.program, caseNumber: n.caseNumber })),
      );
      return {
        id: firstNote._id,
        ids: group.map((n) => n._id),
        email: firstNote.email,
        caseNumber: firstNote.caseNumber,
        program: firstNote.program,
        status: firstNote.status,
        cases: group.map((n) => ({ caseNumber: n.caseNumber, program: n.program, status: n.status })),
        decidedOn: easternDay(firstNote.decidedAt),
        dueOn: group.reduce((d, n) => (n.dueOn < d ? n.dueOn : d), firstNote.dueOn),
        subject,
        body,
      };
    });
    return { added, dropped, notes };
  },
});

/** The note is in Zoho's Outbox. Only a waiting note can be scheduled, so a second run can't record it twice. */
export const markScheduled = internalMutation({
  args: { id: v.id("congratsNotes"), zohoMessageId: v.string(), scheduledFor: v.string(), now: v.number() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const note = await ctx.db.get(args.id);
    if (!note || note.state !== "due") return false;
    await ctx.db.patch(args.id, {
      state: "scheduled",
      zohoMessageId: args.zohoMessageId,
      scheduledFor: args.scheduledFor,
      scheduledAt: args.now,
    });
    return true;
  },
});

/** Zoho sent it (it's in Sent, gone from the Outbox). */
export const markSent = internalMutation({
  args: { id: v.id("congratsNotes"), now: v.number() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const note = await ctx.db.get(args.id);
    if (!note || note.state !== "scheduled") return false;
    await ctx.db.patch(args.id, { state: "sent", sentAt: args.now });
    return true;
  },
});

/** Not sending this one: held by the person reading it, or cancelled from the Outbox. */
export const skip = internalMutation({
  args: { id: v.id("congratsNotes"), reason: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const note = await ctx.db.get(args.id);
    if (!note || note.state === "sent" || note.state === "skipped") return false;
    await ctx.db.patch(args.id, { state: "skipped", reason: args.reason.slice(0, 300) });
    return true;
  },
});

/** "If you'd rather I didn't write again": never another note to this address, and none still waiting. */
export const optOut = internalMutation({
  args: { email: v.string(), note: v.optional(v.string()), now: v.number() },
  returns: v.object({ recorded: v.boolean(), dropped: v.number() }),
  handler: async (ctx, args) => {
    const email = norm(args.email);
    const existing = await ctx.db
      .query("congratsNoteOptOuts")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (!existing) {
      await ctx.db.insert("congratsNoteOptOuts", {
        email,
        at: args.now,
        ...(args.note ? { note: args.note.slice(0, 300) } : {}),
      });
    }
    let dropped = 0;
    for (const n of await ctx.db
      .query("congratsNotes")
      .withIndex("by_email", (q) => q.eq("email", email))
      .take(50)) {
      if (n.state === "due") {
        await ctx.db.patch(n._id, { state: "skipped", reason: "asked not to be written to again" });
        dropped += 1;
      }
    }
    return { recorded: !existing, dropped };
  },
});

/** Counts by state, the notes waiting in Zoho (for the sent check), and what falls due next. No addresses. */
export const status = internalQuery({
  args: { today: v.string() },
  returns: v.object({
    counts: v.record(v.string(), v.number()),
    scheduled: v.array(
      v.object({ id: v.id("congratsNotes"), zohoMessageId: v.string(), scheduledFor: v.string() }),
    ),
    upcoming: v.array(v.object({ dueOn: v.string(), program: v.string() })),
  }),
  handler: async (ctx, args) => {
    const counts: Record<string, number> = {};
    for (const state of ["due", "scheduled", "sent", "skipped"] as const) {
      const rows = await ctx.db
        .query("congratsNotes")
        .withIndex("by_state_due", (q) => q.eq("state", state))
        .take(2000);
      counts[state] = rows.length;
    }
    const scheduled = (
      await ctx.db
        .query("congratsNotes")
        .withIndex("by_state_due", (q) => q.eq("state", "scheduled"))
        .take(500)
    ).map((n) => ({ id: n._id, zohoMessageId: n.zohoMessageId ?? "", scheduledFor: n.scheduledFor ?? "" }));
    const upcoming = (
      await ctx.db
        .query("congratsNotes")
        .withIndex("by_state_due", (q) => q.eq("state", "due").gt("dueOn", args.today))
        .take(200)
    ).map((n) => ({ dueOn: n.dueOn, program: n.program }));
    return { counts, scheduled, upcoming };
  },
});
