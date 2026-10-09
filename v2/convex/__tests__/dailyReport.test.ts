/**
 * The daily operator report's Convex half: the counts it adds, and the store
 * behind the admin page's Monitor tab. The pure rules (verdict, subject,
 * section statuses) are in convex/lib/__tests__/dailyReportCompose.test.ts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestContext } from "../../test-utils/convex";
import { api, internal } from "../_generated/api";
import { easternDay } from "../lib/time";

const ADMIN = "admin@report-test.com";
beforeEach(() => vi.stubEnv("ADMIN_EMAIL", ADMIN));
afterEach(() => vi.unstubAllEnvs());

describe("dailyReport.facts", () => {
  it("counts the last 24 hours and holds no address", async () => {
    const t = createTestContext();
    const now = Date.now();
    await t.run(async (ctx) => {
      await ctx.db.insert("users", { email: "a@x.com" });
      const base = { subject: "s", summary: { title: "T", line: "L", url: "https://permtracker.app" }, createdAt: now };
      await ctx.db.insert("alertOutbox", { ...base, email: "a@x.com", kind: "case", ref: "case:1", status: "sent", sentAt: now - 60_000, bundleSize: 1, direct: true });
      await ctx.db.insert("alertOutbox", { ...base, email: "b@x.com", kind: "case", ref: "case:2", status: "sent", sentAt: now - 30 * 3_600_000, bundleSize: 1, direct: true });
      await ctx.db.insert("alertOutbox", { ...base, email: "c@x.com", kind: "queue", ref: "queue:1", status: "failed", lastError: "x" });
      await ctx.db.insert("alertOutbox", { ...base, email: "d@x.com", kind: "bulletin", ref: "bulletin:1", status: "queued" });
      await ctx.db.insert("systemErrors", { source: "action", operation: "sweep", message: "m", resolved: false, createdAt: now - 1000 });
      await ctx.db.insert("systemErrors", { source: "action", operation: "sweep", message: "m", resolved: false, createdAt: now - 2 * 86_400_000 });
      const userId = await ctx.db.insert("users", { email: "dev@x.com", deletedAt: now });
      await ctx.db.insert("apiKeys", { userId, account: "acct_1", keyHash: "h1", keyId: "AAAAAAAA", name: "ci", createdAt: now, scopes: ["read", "export"] });
      await ctx.db.insert("apiKeys", { userId, account: "acct_1", keyHash: "h2", keyId: "BBBBBBBB", name: "old", createdAt: now, revokedAt: now });
      await ctx.db.insert("webhookEndpoints", {
        userId, account: "acct_1", url: "https://hooks.example.org/perm", events: ["queue.moved"], secretEnc: "x", secretHint: "abcd", createdAt: now,
      });
    });
    const f = await t.query(internal.dailyReport.facts, {});
    expect(f.users).toBe(1);
    expect(f.outbox).toMatchObject({ sent24h: 1, failed24h: 1, queued: 1 });
    expect(f.errors).toEqual({ count: 1, top: [["sweep", 1]] });
    expect(f.developers.keys).toMatchObject({ live: 1, sandbox: 0, byScope: { read: 1, export: 1, webhooks: 0 } });
    expect(f.developers.webhooks).toMatchObject({ endpoints: 1, paused: 0, watches: 0 });
    expect(JSON.stringify(f)).not.toMatch(/@|hooks\.example\.org|acct_1/);
  });
});

describe("dailyReport.store and latest", () => {
  it("keeps one report per day, prunes past 60 days, and shows them only to the admin", async () => {
    const t = createTestContext();
    // Days relative to now: pruning reads the clock, so fixed dates would age out of the test.
    const today = easternDay(Date.now());
    const yesterday = easternDay(Date.now() - 86_400_000);
    const ancient = easternDay(Date.now() - 400 * 86_400_000);
    const report = (day: string, status: string) => ({ day, generatedAt: 1, sections: [{ key: "a", title: "A", status, summary: "s", lines: [] }] });
    await t.mutation(internal.dailyReport.store, { day: yesterday, overall: "warn", report: report(yesterday, "warn") });
    await t.mutation(internal.dailyReport.store, { day: yesterday, overall: "ok", report: report(yesterday, "ok") });
    await t.mutation(internal.dailyReport.store, { day: ancient, overall: "ok", report: report(ancient, "ok") });
    await t.mutation(internal.dailyReport.store, { day: today, overall: "fail", report: report(today, "fail") });

    const adminId = await t.run(async (ctx) => ctx.db.insert("users", { email: ADMIN }));
    const admin = t.withIdentity({ subject: adminId, email: ADMIN });
    const got = await admin.query(api.dailyReport.latest, {});
    expect(got.history).toEqual([
      { day: today, overall: "fail" },
      { day: yesterday, overall: "ok" },
    ]);
    expect(got.report.day).toBe(today);

    const strangerId = await t.run(async (ctx) => ctx.db.insert("users", { email: "s@x.com" }));
    await expect(t.withIdentity({ subject: strangerId, email: "s@x.com" }).query(api.dailyReport.latest, {})).rejects.toThrow(/Admin access required/);
  });
});
