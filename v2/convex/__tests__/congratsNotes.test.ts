/**
 * The congratulations-note record end to end: who `due` hands back, what it skips and why, and that a note is
 * recorded once. The rules and the words are tested in convex/lib/congratsNote.test.ts.
 */

import { describe, expect, it } from "vitest";
import { createTestContext } from "../../test-utils/convex";
import { internal } from "../_generated/api";
import { NOTES_FROM_MS } from "../lib/congratsNote";

/** 2:15 PM EDT, Monday Oct 19 2026: due Wednesday Oct 21. */
const MON = Date.parse("2026-10-19T18:15:00Z");
/** 9:15 AM EDT, Friday Oct 23 2026. */
const FRI = Date.parse("2026-10-23T13:15:00Z");
const DAY = 86_400_000;

type Row = {
  email?: string;
  caseNumber?: string;
  lastSeenStatus?: string;
  confirmedAt?: number;
  decidedAt?: number;
  lastAlertSentAt?: number;
  unsubscribedAt?: number;
};

async function watch(t: ReturnType<typeof createTestContext>, over: Row = {}) {
  return t.run((ctx) =>
    ctx.db.insert("caseStatusAlerts", {
      email: over.email ?? "watcher@example.com",
      caseNumber: over.caseNumber ?? "G-100-26070-123456",
      createdAt: MON - 40 * DAY,
      confirmedAt: "confirmedAt" in over ? over.confirmedAt : MON - 30 * DAY,
      lastSeenStatus: over.lastSeenStatus ?? "CERTIFIED",
      decidedAt: "decidedAt" in over ? over.decidedAt : MON,
      lastAlertSentAt: "lastAlertSentAt" in over ? over.lastAlertSentAt : MON,
      ...(over.unsubscribedAt !== undefined ? { unsubscribedAt: over.unsubscribedAt } : {}),
    }),
  );
}

describe("congratsNotes.due", () => {
  it("hands back a note on its day, with the case named, and records it once", async () => {
    const t = createTestContext();
    await watch(t);
    const tue = await t.mutation(internal.congratsNotes.due, { now: MON + DAY });
    expect(tue.added).toBe(1);
    expect(tue.notes).toHaveLength(0); // due Wednesday, not yet

    const fri = await t.mutation(internal.congratsNotes.due, { now: FRI });
    expect(fri.added).toBe(0);
    expect(fri.notes).toHaveLength(1);
    const note = fri.notes[0]!;
    expect(note.email).toBe("watcher@example.com");
    expect(note.dueOn).toBe("2026-10-21");
    expect(note.decidedOn).toBe("2026-10-19");
    expect(note.body).toContain("your PERM case, G-100-26070-123456, and DOL has certified it");
  });

  it("a scheduled note isn't handed back again, and can be scheduled only once", async () => {
    const t = createTestContext();
    await watch(t);
    const [note] = (await t.mutation(internal.congratsNotes.due, { now: FRI })).notes;
    const args = { id: note!.id, zohoMessageId: "z1", scheduledFor: "10/23/2026 10:15:00", now: FRI };
    expect(await t.mutation(internal.congratsNotes.markScheduled, args)).toBe(true);
    expect(await t.mutation(internal.congratsNotes.markScheduled, args)).toBe(false);
    expect((await t.mutation(internal.congratsNotes.due, { now: FRI + 3600_000 })).notes).toHaveLength(0);
    expect(await t.mutation(internal.congratsNotes.markSent, { id: note!.id, now: FRI })).toBe(true);
  });

  it("one note per address, even with two certified cases", async () => {
    const t = createTestContext();
    await watch(t, { caseNumber: "G-100-26070-111111" });
    await watch(t, { caseNumber: "G-100-26070-222222" });
    const r = await t.mutation(internal.congratsNotes.due, { now: FRI });
    expect(r.added).toBe(2);
    expect(r.notes).toHaveLength(1);
    const rows = await t.run((ctx) => ctx.db.query("congratsNotes").collect());
    expect(rows.find((n) => n.state === "skipped")?.reason).toBe("already has a note (one per address)");
  });

  it("skips someone written to by hand in an earlier round", async () => {
    const t = createTestContext();
    const early = NOTES_FROM_MS - 5 * DAY;
    await watch(t, { caseNumber: "P-100-26000-111111", lastSeenStatus: "DETERMINATION ISSUED", decidedAt: early, lastAlertSentAt: early, confirmedAt: early - 30 * DAY });
    await watch(t, { caseNumber: "G-100-26070-222222" });
    const r = await t.mutation(internal.congratsNotes.due, { now: FRI });
    expect(r.notes).toHaveLength(0);
    const [row] = await t.run((ctx) => ctx.db.query("congratsNotes").collect());
    expect(row?.reason).toBe("written to by hand in an earlier round");
  });

  it("no note for a denial, a case first seen decided, or a watcher who signed up after", async () => {
    const t = createTestContext();
    await watch(t, { email: "a@example.com", lastSeenStatus: "DENIED" });
    await watch(t, { email: "b@example.com", lastAlertSentAt: MON - 9 * DAY });
    await watch(t, { email: "c@example.com", confirmedAt: MON + 60_000 });
    const r = await t.mutation(internal.congratsNotes.due, { now: FRI });
    expect(r.added).toBe(0);
    expect(r.notes).toHaveLength(0);
  });

  it("drops a note whose case moved, whose watcher unsubscribed, or that is too late", async () => {
    const t = createTestContext();
    const moved = await watch(t, { email: "moved@example.com" });
    const gone = await watch(t, { email: "gone@example.com" });
    await watch(t, { email: "late@example.com" });
    await t.mutation(internal.congratsNotes.due, { now: MON + DAY });
    await t.run(async (ctx) => {
      await ctx.db.patch(moved, { lastSeenStatus: "RECONSIDERATION APPEALS", decidedAt: undefined });
      await ctx.db.patch(gone, { unsubscribedAt: MON + 2 * DAY });
    });
    // Thursday Oct 29: past Wednesday Oct 28, five business days after the 21st.
    const r = await t.mutation(internal.congratsNotes.due, { now: Date.parse("2026-10-29T13:15:00Z") });
    expect(r.notes).toHaveLength(0);
    const reasons = (await t.run((ctx) => ctx.db.query("congratsNotes").collect())).map((n) => n.reason).sort();
    expect(reasons).toEqual([
      "more than five business days late",
      "more than five business days late",
      "more than five business days late",
    ]);
  });

  it("a case that moved or an unsubscribe on its day drops the note with its own reason", async () => {
    const t = createTestContext();
    const moved = await watch(t, { email: "moved@example.com" });
    const gone = await watch(t, { email: "gone@example.com" });
    await t.mutation(internal.congratsNotes.due, { now: MON + DAY });
    await t.run(async (ctx) => {
      await ctx.db.patch(moved, { lastSeenStatus: "RECONSIDERATION APPEALS", decidedAt: undefined });
      await ctx.db.patch(gone, { unsubscribedAt: MON + 2 * DAY });
    });
    const r = await t.mutation(internal.congratsNotes.due, { now: FRI });
    expect(r.notes).toHaveLength(0);
    const reasons = (await t.run((ctx) => ctx.db.query("congratsNotes").collect())).map((n) => n.reason).sort();
    expect(reasons).toEqual(["the case moved again", "unsubscribed from the alert"]);
  });

  it("an opt-out drops what's waiting and blocks every later note", async () => {
    const t = createTestContext();
    await watch(t, { email: "Quiet@Example.com" });
    await t.mutation(internal.congratsNotes.due, { now: MON + DAY });
    const out = await t.mutation(internal.congratsNotes.optOut, { email: "quiet@example.com", now: MON + DAY });
    expect(out).toEqual({ recorded: true, dropped: 1 });
    await watch(t, { email: "Quiet@Example.com", caseNumber: "I-200-26070-333333" });
    const r = await t.mutation(internal.congratsNotes.due, { now: FRI });
    expect(r.notes).toHaveLength(0);
  });

  it("no note to the site's own test addresses", async () => {
    const t = createTestContext();
    await watch(t, { email: "demo@permtracker.app" });
    expect((await t.mutation(internal.congratsNotes.due, { now: FRI })).notes).toHaveLength(0);
  });
});
