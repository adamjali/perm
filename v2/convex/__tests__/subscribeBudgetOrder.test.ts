import { describe, it, expect } from "vitest";
import { createTestContext } from "../../test-utils/convex";
import { internal } from "../_generated/api";

/**
 * A refused confirmation must leave NO ROW and NO COOLDOWN STAMP behind.
 *
 * All three subscribe mutations used to write the row first and check the
 * global confirmation budget second. An exhausted budget therefore stamped
 * `lastConfirmationSentAt` on a row while sending nothing, and the
 * compensating `clearConfirmationCooldown` is only reachable from inside
 * `sendConfirmation`, which that branch returns before ever scheduling.
 *
 * The user-visible failure was the nasty part. They are told "we're busy, try
 * later", they retry a minute later, and the ten-minute per-address cooldown
 * now sees the stamp the refused attempt left, absorbs the request, and
 * answers with the SUCCESS message. So they sit waiting for a confirmation
 * email that was never sent and never will be.
 *
 * These assert the ordering by its effect rather than by reading the source:
 * exhaust the budget, then confirm the next caller left no trace. Probed by
 * reverting the reorder in each module - every "leaves no row" case goes red.
 */

/**
 * The three modules do NOT share a budget value - caseAlerts is 15/day,
 * queueAlerts 18 and bulletinAlerts 6 - so this fills until the endpoint
 * actually refuses rather than counting to a constant. A hardcoded 15 passed
 * against caseAlerts and silently never exhausted queueAlerts, which is the
 * usual shape of a gate's first run being mostly the gate.
 */
const FILL_CAP = 40;

async function exhaust(call: (i: number) => Promise<{ ok: boolean }>) {
  for (let i = 0; i < FILL_CAP; i++) {
    const r = await call(i);
    if (!r.ok) return i + 1;
  }
  // Never silently proceed on an unexhausted budget: that would make every
  // assertion below vacuous and the test would read as a pass.
  throw new Error(`budget not exhausted after ${FILL_CAP} calls`);
}

describe("subscribe: a budget refusal writes nothing", () => {
  it("caseAlerts leaves no row for the refused address", async () => {
    const t = createTestContext();

    // Burn the shared daily budget. Distinct addresses so the per-address
    // cooldown never absorbs one of these and leaves budget on the table.
    await exhaust((i) =>
      t.mutation(internal.caseAlerts.subscribe, {
        email: `filler${i}@example.com`,
        caseNumber: `G-100-25324-4${String(i).padStart(5, "0")}`,
      }),
    );

    const refused = await t.mutation(internal.caseAlerts.subscribe, {
      email: "refused@example.com",
      caseNumber: "G-100-25324-425560",
    });
    expect(refused.ok).toBe(false);
    expect(refused.throttled).toBe(true);

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("caseStatusAlerts")
        .withIndex("by_email", (q) => q.eq("email", "refused@example.com"))
        .collect(),
    );
    // The whole point: no row, so nothing carries a stamp that would make the
    // retry look like a duplicate request.
    expect(rows).toHaveLength(0);
  });

  it("caseAlerts: a retry after a refusal is not swallowed by the cooldown", async () => {
    const t = createTestContext();
    await exhaust((i) =>
      t.mutation(internal.caseAlerts.subscribe, {
        email: `filler${i}@example.com`,
        caseNumber: `G-100-25324-4${String(i).padStart(5, "0")}`,
      }),
    );
    await t.mutation(internal.caseAlerts.subscribe, {
      email: "refused@example.com",
      caseNumber: "G-100-25324-425560",
    });

    // Same address again, immediately. With a stamp left behind this returns
    // ok:true (the neutral "check your inbox" reply) and sends nothing, which
    // is the lie. Without one it is refused honestly for the same real reason.
    const retry = await t.mutation(internal.caseAlerts.subscribe, {
      email: "refused@example.com",
      caseNumber: "G-100-25324-425560",
    });
    expect(retry.ok).toBe(false);
    expect(retry.throttled).toBe(true);
  });

  it("queueAlerts leaves no row for the refused address", async () => {
    const t = createTestContext();
    await exhaust((i) =>
      t.mutation(internal.queueAlerts.subscribe, {
        email: `filler${i}@example.com`,
        filingMonth: "2026-01",
      }),
    );

    const refused = await t.mutation(internal.queueAlerts.subscribe, {
      email: "refused@example.com",
      filingMonth: "2026-01",
    });
    expect(refused.ok).toBe(false);

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("dolQueueAlerts")
        .withIndex("by_email", (q) => q.eq("email", "refused@example.com"))
        .collect(),
    );
    expect(rows).toHaveLength(0);
  });

  it("bulletinAlerts leaves no row for the refused address", async () => {
    const t = createTestContext();
    await exhaust((i) =>
      t.mutation(internal.bulletinAlerts.subscribe, {
        email: `filler${i}@example.com`,
        category: "EB2",
        country: "india",
      }),
    );

    const refused = await t.mutation(internal.bulletinAlerts.subscribe, {
      email: "refused@example.com",
      category: "EB2",
      country: "india",
    });
    expect(refused.ok).toBe(false);

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("bulletinAlerts")
        .withIndex("by_email", (q) => q.eq("email", "refused@example.com"))
        .collect(),
    );
    expect(rows).toHaveLength(0);
  });
});
