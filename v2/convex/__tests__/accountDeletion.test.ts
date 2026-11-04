import { describe, it, expect } from "vitest";
import { createTestContext } from "../../test-utils/convex";
import { internal } from "../_generated/api";

const DAY = 24 * 60 * 60 * 1000;

/**
 * cleanupAndPurge is the irreversible account-purge path. Its safety rests on a
 * grace-window gate (getDeletionInfo.shouldPurge) — these lock that gate so a
 * future refactor can't accidentally purge a user who is still inside their
 * 30-day cancellation window, or one who cancelled outright.
 */
describe("cleanupAndPurge — grace-window gate", () => {
  it("purges a user whose grace period has expired (deletedAt in the past)", async () => {
    const t = createTestContext();
    const userId = await t.run(async (ctx) =>
      ctx.db.insert("users", { email: "expired@example.com", deletedAt: Date.now() - DAY })
    );
    await t.action(internal.accountDeletion.cleanupAndPurge, { userId });
    const user = await t.run(async (ctx) => ctx.db.get(userId));
    expect(user).toBeNull(); // fully purged
  });

  it("does NOT purge a user still inside the grace window (deletedAt in the future)", async () => {
    const t = createTestContext();
    const userId = await t.run(async (ctx) =>
      ctx.db.insert("users", { email: "grace@example.com", deletedAt: Date.now() + 30 * DAY })
    );
    await t.action(internal.accountDeletion.cleanupAndPurge, { userId });
    const user = await t.run(async (ctx) => ctx.db.get(userId));
    expect(user).not.toBeNull(); // cancellation window respected
  });

  it("leaves no list mail going to the deleted account's address, and nobody else's touched", async () => {
    const t = createTestContext();
    const now = Date.now();
    const userId = await t.run(async (ctx) =>
      ctx.db.insert("users", { email: "Owner@Example.com", deletedAt: now - DAY }),
    );
    const ids = await t.run(async (ctx) => {
      const own = "owner@example.com";
      // The row onboarding's "Waiting on my own case" writes for a verified account (caseAlerts.watchMyCase).
      const caseAlert = await ctx.db.insert("caseStatusAlerts", {
        email: own,
        caseNumber: "G-100-26100-111111",
        createdAt: now,
        source: "onboarding",
        confirmedAt: now,
      });
      const queueAlert = await ctx.db.insert("dolQueueAlerts", {
        email: own,
        filingMonth: "2026-03",
        confirmedAt: now,
        pendingFilingMonth: "2026-04",
        createdAt: now,
      });
      const bulletinAlert = await ctx.db.insert("bulletinAlerts", {
        email: own,
        category: "EB2",
        country: "INDIA",
        confirmedAt: now,
        createdAt: now,
      });
      const employerAlert = await ctx.db.insert("employerAlerts", {
        email: own,
        slug: "acme-inc",
        employerName: "Acme Inc",
        confirmedAt: now,
        createdAt: now,
      });
      const news = await ctx.db.insert("newsSubscribers", { email: own, confirmedAt: now, createdAt: now });
      const digest = await ctx.db.insert("newsletterSubscribers", { email: own, confirmedAt: now, createdAt: now });
      const outbox = await ctx.db.insert("alertOutbox", {
        email: own,
        kind: "case",
        ref: `case:${caseAlert}`,
        status: "queued",
        subject: "Your case moved",
        html: "<p>moved</p>",
        text: "moved",
        summary: { title: "G-100-26100-111111", line: "moved", url: "https://permtracker.app" },
        createdAt: now,
      });
      await ctx.db.insert("emailRetries", {
        kind: "alert",
        to: own,
        payload: "{}",
        queuedAt: now,
        nextAttemptAt: now,
        attempts: 1,
        lastError: "rate limited",
        refs: [`queue:${queueAlert}`],
      });
      await ctx.db.insert("confirmationQueue", {
        kind: "bulletin",
        pool: "bulletinConfirm",
        email: own,
        payload: "{}",
        queuedAt: now,
      });
      const note = await ctx.db.insert("congratsNotes", {
        alertId: caseAlert,
        email: own,
        caseNumber: "G-100-26100-111111",
        program: "perm",
        status: "CERTIFIED",
        decidedAt: now,
        dueOn: "2026-11-06",
        state: "due",
        createdAt: now,
      });
      // Someone else's, on the same tables.
      const otherCase = await ctx.db.insert("caseStatusAlerts", {
        email: "other@example.com",
        caseNumber: "G-100-26100-111111",
        createdAt: now,
        confirmedAt: now,
      });
      const otherNews = await ctx.db.insert("newsSubscribers", {
        email: "other@example.com",
        confirmedAt: now,
        createdAt: now,
      });
      return { caseAlert, queueAlert, bulletinAlert, employerAlert, news, digest, outbox, note, otherCase, otherNews };
    });

    await t.action(internal.accountDeletion.cleanupAndPurge, { userId });

    await t.run(async (ctx) => {
      expect(await ctx.db.get(userId)).toBeNull();
      // Every subscription is off, the way its own opt-out leaves it, and the staged change is gone.
      for (const id of [ids.caseAlert, ids.queueAlert, ids.bulletinAlert, ids.employerAlert, ids.news, ids.digest]) {
        expect((await ctx.db.get(id))?.unsubscribedAt).toBeGreaterThan(0);
      }
      expect((await ctx.db.get(ids.queueAlert))?.pendingFilingMonth).toBeUndefined();
      // No sweep can reach them: each sweep reads only rows with no unsubscribedAt.
      const liveCases = await ctx.db
        .query("caseStatusAlerts")
        .withIndex("by_alert_sweep", (q) => q.eq("unsubscribedAt", undefined))
        .collect();
      expect(liveCases.map((r) => r.email)).toEqual(["other@example.com"]);
      const liveQueue = await ctx.db
        .query("dolQueueAlerts")
        .withIndex("by_alert_sweep", (q) => q.eq("notifiedAt", undefined).eq("unsubscribedAt", undefined))
        .collect();
      expect(liveQueue).toEqual([]);
      // Nothing waiting to go: the outbox item dropped, the retry, the queued confirmation and the note.
      expect((await ctx.db.get(ids.outbox))?.status).toBe("dropped");
      expect(
        await ctx.db.query("emailRetries").withIndex("by_to", (q) => q.eq("to", "owner@example.com")).collect(),
      ).toEqual([]);
      expect(
        await ctx.db
          .query("confirmationQueue")
          .withIndex("by_kind_email", (q) => q.eq("kind", "bulletin").eq("email", "owner@example.com"))
          .collect(),
      ).toEqual([]);
      expect(await ctx.db.get(ids.note)).toMatchObject({ state: "skipped", reason: "the account was deleted" });
      // Another address's rows are untouched.
      expect((await ctx.db.get(ids.otherCase))?.unsubscribedAt).toBeUndefined();
      expect((await ctx.db.get(ids.otherNews))?.unsubscribedAt).toBeUndefined();
    });
  });

  it("does NOT purge a user who cancelled (deletedAt unset)", async () => {
    const t = createTestContext();
    const userId = await t.run(async (ctx) =>
      ctx.db.insert("users", { email: "cancelled@example.com" })
    );
    await t.action(internal.accountDeletion.cleanupAndPurge, { userId });
    const user = await t.run(async (ctx) => ctx.db.get(userId));
    expect(user).not.toBeNull();
  });
});
