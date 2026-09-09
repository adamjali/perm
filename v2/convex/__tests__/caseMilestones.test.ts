import { describe, expect, it } from "vitest";

import { createTestContext } from "../../test-utils/convex";
import { internal } from "../_generated/api";

/**
 * The milestone report endpoint: what it refuses, what it dedupes, and that
 * both limits actually refuse. The budget test fills until the endpoint says
 * no and THROWS if it never does, so an unexhausted budget cannot read as a
 * pass (the same shape as subscribeBudgetOrder.test.ts).
 */

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const CASE = "G-100-25324-425560";

describe("caseMilestones.report", () => {
  it("records a report and reads it back as a count with the latest date", async () => {
    const t = createTestContext();
    const r = await t.mutation(internal.caseMilestones.report, { caseNumber: CASE, kind: "i140-filed", eventDate: "2026-06-01", ipHash: HASH_A });
    expect(r.ok).toBe(true);
    await t.mutation(internal.caseMilestones.report, { caseNumber: CASE, kind: "i140-filed", eventDate: "2026-06-03", ipHash: HASH_B });
    const s = await t.query(internal.caseMilestones.summary, { caseNumber: CASE });
    expect(s.reports).toBe(2);
    expect(s.reporters).toBe(2);
    expect(s.kinds.find((k) => k.kind === "i140-filed")).toMatchObject({ count: 2, latest: "2026-06-03" });
    expect(s.kinds.find((k) => k.kind === "i485-filed")).toMatchObject({ count: 0, latest: null });
  });

  it("updates the same reporter's earlier report of the same kind instead of adding one", async () => {
    const t = createTestContext();
    await t.mutation(internal.caseMilestones.report, { caseNumber: CASE, kind: "i140-approved", eventDate: "2026-07-01", ipHash: HASH_A });
    const again = await t.mutation(internal.caseMilestones.report, { caseNumber: CASE, kind: "i140-approved", eventDate: "2026-07-02", ipHash: HASH_A });
    expect(again.ok).toBe(true);
    expect(again.message).toMatch(/updated/);
    const s = await t.query(internal.caseMilestones.summary, { caseNumber: CASE });
    expect(s.reports).toBe(1);
    expect(s.kinds.find((k) => k.kind === "i140-approved")?.latest).toBe("2026-07-02");
  });

  it("refuses bad shapes without writing and without charging a limit", async () => {
    const t = createTestContext();
    const bad = [
      { caseNumber: "P-100-26125-868956", kind: "i140-filed", eventDate: "2026-06-01", ipHash: HASH_A },
      { caseNumber: CASE, kind: "married", eventDate: "2026-06-01", ipHash: HASH_A },
      { caseNumber: CASE, kind: "i140-filed", eventDate: "2099-01-01", ipHash: HASH_A },
      { caseNumber: CASE, kind: "i140-filed", eventDate: "June 1", ipHash: HASH_A },
      { caseNumber: CASE, kind: "i140-filed", eventDate: "2026-06-01", ipHash: "short" },
    ];
    for (const b of bad) {
      const r = await t.mutation(internal.caseMilestones.report, b);
      expect(r.ok, JSON.stringify(b)).toBe(false);
      expect(r.throttled).toBeUndefined();
    }
    const s = await t.query(internal.caseMilestones.summary, { caseNumber: CASE });
    expect(s.reports).toBe(0);
    const limits = await t.run(async (ctx) => ctx.db.query("rateLimits").take(1000));
    expect(limits).toHaveLength(0);
  });

  it("throttles one address after six reports in an hour", async () => {
    const t = createTestContext();
    for (let i = 0; i < 6; i++) {
      const r = await t.mutation(internal.caseMilestones.report, {
        caseNumber: `G-100-25324-4${String(i).padStart(5, "0")}`,
        kind: "i485-filed",
        eventDate: "2026-06-01",
        ipHash: HASH_A,
      });
      expect(r.ok, `report ${i}`).toBe(true);
    }
    const seventh = await t.mutation(internal.caseMilestones.report, { caseNumber: CASE, kind: "i485-filed", eventDate: "2026-06-01", ipHash: HASH_A });
    expect(seventh.ok).toBe(false);
    expect(seventh.throttled).toBe(true);
  });

  it("refuses everyone once the daily budget is spent, and nothing is written past it", async () => {
    const t = createTestContext();
    const CAP = 320;
    let refusedAt = -1;
    for (let i = 0; i < CAP; i++) {
      const r = await t.mutation(internal.caseMilestones.report, {
        caseNumber: `G-100-25324-${String(100000 + i)}`,
        kind: "i140-filed",
        eventDate: "2026-06-01",
        ipHash: String(i).padStart(64, "0"),
      });
      if (!r.ok) {
        expect(r.throttled).toBe(true);
        refusedAt = i;
        break;
      }
    }
    if (refusedAt < 0) throw new Error(`budget not exhausted after ${CAP} reports`);
    expect(refusedAt).toBe(300);
    const rows = await t.run(async (ctx) => ctx.db.query("caseMilestones").take(1000));
    expect(rows).toHaveLength(300);
  });
});
