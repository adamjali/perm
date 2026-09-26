/**
 * The admin view of alert email.
 *
 * The figures that matter are the ones a wrong join would quietly inflate: a
 * bundle of two alerts is ONE email, and a pool at its ceiling must read as
 * full. The budget table itself is held to the Resend ledger in
 * src/lib/__tests__/alertBudgets.test.ts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestContext } from "../../test-utils/convex";
import { api } from "../_generated/api";
import { BUDGETS } from "../lib/alertBudgets";
import { etDay } from "../lib/alertDelivery";

const ADMIN = "admin@delivery-test.com";

beforeEach(() => vi.stubEnv("ADMIN_EMAIL", ADMIN));
afterEach(() => vi.unstubAllEnvs());

describe("adminDelivery.getDelivery", () => {
  it("refuses everyone who is not the admin", async () => {
    const t = createTestContext();
    const id = await t.run(async (ctx) => ctx.db.insert("users", { email: "stranger@example.com" }));
    const auth = t.withIdentity({ subject: id, email: "stranger@example.com" });
    await expect(auth.query(api.adminDelivery.getDelivery, {})).rejects.toThrow(/Admin access required/);
  });

  it("counts a bundle as one email, a full pool as full, and the week's refusals", async () => {
    const t = createTestContext();
    const adminId = await t.run(async (ctx) => ctx.db.insert("users", { email: ADMIN }));
    const now = Date.now();
    await t.run(async (ctx) => {
      const base = {
        subject: "s",
        summary: { title: "T", line: "L", url: "https://permtracker.app" },
        createdAt: now - 3_600_000,
      };
      await ctx.db.insert("alertOutbox", { ...base, email: "a@x.com", kind: "case", ref: "case:1", status: "sent", sentAt: now - 60_000, bundleSize: 1, direct: true });
      await ctx.db.insert("alertOutbox", { ...base, email: "b@x.com", kind: "employer", ref: "employer:1", status: "sent", sentAt: now - 30_000, bundleSize: 2 });
      await ctx.db.insert("alertOutbox", { ...base, email: "b@x.com", kind: "case", ref: "case:2", status: "sent", sentAt: now - 30_000, bundleSize: 2 });
      await ctx.db.insert("alertOutbox", { ...base, email: "c@x.com", kind: "bulletin", ref: "bulletin:1", status: "queued" });
      await ctx.db.insert("alertOutbox", { ...base, email: "d@x.com", kind: "queue", ref: "queue:1", status: "failed", lastError: "rate_limit_exceeded" });
      for (let i = 0; i < BUDGETS.caseAlert.limit; i++) {
        await ctx.db.insert("rateLimits", {
          key: `${BUDGETS.caseAlert.key}:all`,
          identifier: "all",
          action: BUDGETS.caseAlert.key,
          timestamp: now - i * 1000,
        });
      }
      await ctx.db.insert("budgetRefusals", { day: etDay(now), pool: "caseAlert", count: 4 });
      await ctx.db.insert("employerAlerts", { email: "e@x.com", slug: "adobe-inc", employerName: "Adobe Inc.", createdAt: now, confirmedAt: now });
      await ctx.db.insert("employerAlerts", { email: "f@x.com", slug: "adobe-inc", employerName: "Adobe Inc.", createdAt: now, confirmedAt: now });
      await ctx.db.insert("employerAlerts", { email: "g@x.com", slug: "maplebear-inc", employerName: "Maplebear Inc.", createdAt: now });
    });

    const d = await t.withIdentity({ subject: adminId, email: ADMIN }).query(api.adminDelivery.getDelivery, {});
    expect(d.outbox.last7d).toMatchObject({ emails: 2, items: 3, bundles: 1, direct: 1, failed: 1 });
    expect(d.outbox.queued).toBe(1);
    const pool = d.pools.find((p) => p.name === "caseAlert")!;
    expect(pool).toMatchObject({ usedLast24h: 18, limit: 18, refusedLast7d: 4 });
    expect(d.follows).toMatchObject({ confirmed: 2, pending: 1 });
    expect(d.follows.top[0]).toMatchObject({ slug: "adobe-inc", followers: 2 });
  });
});
