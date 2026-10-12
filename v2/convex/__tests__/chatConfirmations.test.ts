/**
 * The chat's confirmation cards: an approval runs the stored change once.
 *
 * Oct 12 2026: one change got two cards, both ran, and the approval route ran
 * whatever the browser sent. These pin the rules that replaced that.
 */
import { describe, expect, it } from "vitest";
import {
  advanceTime,
  createAuthenticatedContext,
  createTestContext,
  finishScheduledFunctions,
  setupSchedulerTests,
} from "../../test-utils/convex";
import { api } from "../_generated/api";
import { CONFIRMATION_TTL_MS, REPEAT_WINDOW_MS } from "../chatConfirmations";

setupSchedulerTests();

async function seed() {
  const t = createTestContext();
  const owner = await createAuthenticatedContext(t, "Owner");
  const stranger = await createAuthenticatedContext(t, "Stranger");
  const caseId = await owner.mutation(api.cases.create, { employerName: "Acme", positionTitle: "Engineer" });
  await finishScheduledFunctions(t);
  const updatedAt = await t.run(async (ctx) => (await ctx.db.get(caseId))!.updatedAt);
  return { t, owner, stranger, caseId, updatedAt };
}

const card = (toolCallId: string, extra: Record<string, unknown> = {}) => ({
  toolCallId,
  toolName: "updateCase",
  args: JSON.stringify({ id: "x", pwdFilingDate: "2026-01-05" }),
  argsHash: "hash-a",
  description: "Update Acme",
  ...extra,
});

describe("chatConfirmations", () => {
  it("runs a card once: the second approval of the same card is refused", async () => {
    const { owner } = await seed();
    await owner.mutation(api.chatConfirmations.issue, card("tc-1"));
    const first = await owner.mutation(api.chatConfirmations.claim, { toolCallId: "tc-1" });
    expect(first.ok).toBe(true);
    // Still running: a second tab can't start it again.
    const second = await owner.mutation(api.chatConfirmations.claim, { toolCallId: "tc-1" });
    expect(second).toMatchObject({ ok: false, reason: "in_progress" });
    await owner.mutation(api.chatConfirmations.finish, { toolCallId: "tc-1", ok: true, result: "Saved." });
    const third = await owner.mutation(api.chatConfirmations.claim, { toolCallId: "tc-1" });
    expect(third).toMatchObject({ ok: false, reason: "already_done", result: "Saved." });
  });

  it("returns the stored arguments, whatever the browser holds", async () => {
    const { owner } = await seed();
    await owner.mutation(api.chatConfirmations.issue, card("tc-2"));
    const claimed = await owner.mutation(api.chatConfirmations.claim, { toolCallId: "tc-2" });
    expect(claimed).toMatchObject({ ok: true, toolName: "updateCase" });
    if (claimed.ok) expect(JSON.parse(claimed.args)).toEqual({ id: "x", pwdFilingDate: "2026-01-05" });
  });

  it("refuses a card nobody issued, and another account's card", async () => {
    const { owner, stranger } = await seed();
    expect(await owner.mutation(api.chatConfirmations.claim, { toolCallId: "never" })).toMatchObject({ ok: false, reason: "not_found" });
    await owner.mutation(api.chatConfirmations.issue, card("tc-3"));
    expect(await stranger.mutation(api.chatConfirmations.claim, { toolCallId: "tc-3" })).toMatchObject({ ok: false, reason: "not_found" });
  });

  it("two identical cards make the change once, whichever is approved", async () => {
    const { owner } = await seed();
    await owner.mutation(api.chatConfirmations.issue, card("tc-a"));
    const dup = await owner.mutation(api.chatConfirmations.issue, card("tc-b"));
    expect(dup.sameAs).toBe("tc-a");
    // Approve the second card: it runs, the first is retired.
    const claimedB = await owner.mutation(api.chatConfirmations.claim, { toolCallId: "tc-b" });
    expect(claimedB.ok).toBe(true);
    await owner.mutation(api.chatConfirmations.finish, { toolCallId: "tc-b", ok: true, result: "Saved." });
    const claimedA = await owner.mutation(api.chatConfirmations.claim, { toolCallId: "tc-a" });
    expect(claimedA.ok).toBe(false);
  });

  it("an identical card can't start while the other is still running", async () => {
    const { owner } = await seed();
    await owner.mutation(api.chatConfirmations.issue, card("tc-x"));
    await owner.mutation(api.chatConfirmations.issue, card("tc-y"));
    expect((await owner.mutation(api.chatConfirmations.claim, { toolCallId: "tc-y" })).ok).toBe(true);
    // tc-y is running, not finished: tc-x must not run alongside it.
    expect((await owner.mutation(api.chatConfirmations.claim, { toolCallId: "tc-x" })).ok).toBe(false);
  });

  it("approving the first of two identical cards also settles the second", async () => {
    const { owner } = await seed();
    await owner.mutation(api.chatConfirmations.issue, card("tc-c"));
    await owner.mutation(api.chatConfirmations.issue, card("tc-d"));
    expect((await owner.mutation(api.chatConfirmations.claim, { toolCallId: "tc-c" })).ok).toBe(true);
    await owner.mutation(api.chatConfirmations.finish, { toolCallId: "tc-c", ok: true, result: "Saved." });
    expect(await owner.mutation(api.chatConfirmations.claim, { toolCallId: "tc-d" })).toMatchObject({ ok: false, reason: "already_done" });
  });

  it("doesn't repeat a change made minutes ago by a different card, but does after the window", async () => {
    const { owner } = await seed();
    await owner.mutation(api.chatConfirmations.issue, card("tc-e"));
    await owner.mutation(api.chatConfirmations.claim, { toolCallId: "tc-e" });
    await owner.mutation(api.chatConfirmations.finish, { toolCallId: "tc-e", ok: true, result: "Saved." });
    await owner.mutation(api.chatConfirmations.issue, card("tc-f"));
    expect(await owner.mutation(api.chatConfirmations.claim, { toolCallId: "tc-f" })).toMatchObject({ ok: false, reason: "already_done" });
    advanceTime(REPEAT_WINDOW_MS + 1000);
    await owner.mutation(api.chatConfirmations.issue, card("tc-g"));
    expect((await owner.mutation(api.chatConfirmations.claim, { toolCallId: "tc-g" })).ok).toBe(true);
  });

  it("refuses a card once its case has changed since it was shown", async () => {
    const { owner, caseId, updatedAt } = await seed();
    await owner.mutation(api.chatConfirmations.issue, card("tc-h", { caseId, caseUpdatedAt: updatedAt }));
    advanceTime(1000);
    await owner.mutation(api.cases.update, { id: caseId, positionTitle: "Senior Engineer" });
    expect(await owner.mutation(api.chatConfirmations.claim, { toolCallId: "tc-h" })).toMatchObject({ ok: false, reason: "case_changed" });
  });

  it("accepts a card whose case is unchanged", async () => {
    const { owner, caseId, updatedAt } = await seed();
    await owner.mutation(api.chatConfirmations.issue, card("tc-i", { caseId, caseUpdatedAt: updatedAt }));
    expect((await owner.mutation(api.chatConfirmations.claim, { toolCallId: "tc-i" })).ok).toBe(true);
  });

  it("expires a card after a day", async () => {
    const { owner } = await seed();
    await owner.mutation(api.chatConfirmations.issue, card("tc-j"));
    advanceTime(CONFIRMATION_TTL_MS + 1000);
    expect(await owner.mutation(api.chatConfirmations.claim, { toolCallId: "tc-j" })).toMatchObject({ ok: false, reason: "expired" });
  });

  it("a cancelled card can't be approved, and a failed one can be tried again", async () => {
    const { owner } = await seed();
    await owner.mutation(api.chatConfirmations.issue, card("tc-k"));
    await owner.mutation(api.chatConfirmations.cancel, { toolCallId: "tc-k" });
    expect(await owner.mutation(api.chatConfirmations.claim, { toolCallId: "tc-k" })).toMatchObject({ ok: false, reason: "cancelled" });

    await owner.mutation(api.chatConfirmations.issue, card("tc-l", { argsHash: "hash-l" }));
    await owner.mutation(api.chatConfirmations.claim, { toolCallId: "tc-l" });
    await owner.mutation(api.chatConfirmations.finish, { toolCallId: "tc-l", ok: false, result: "Rate limited." });
    expect((await owner.mutation(api.chatConfirmations.claim, { toolCallId: "tc-l" })).ok).toBe(true);
  });

  it("issuing the same card id twice is idempotent", async () => {
    const { t, owner } = await seed();
    await owner.mutation(api.chatConfirmations.issue, card("tc-m"));
    await owner.mutation(api.chatConfirmations.issue, card("tc-m"));
    const rows = await t.run(async (ctx) => ctx.db.query("chatConfirmations").take(50));
    expect(rows.filter((r) => r.toolCallId === "tc-m")).toHaveLength(1);
  });
});
