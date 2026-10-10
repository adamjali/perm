import { describe, expect, it } from "vitest";

import { createTestContext, fillRateWindow } from "../../test-utils/convex";
import { internal } from "../_generated/api";
import { BUDGETS } from "../lib/alertBudgets";

describe("forwarding inbound support mail", () => {
  it("forwards within the day's pool, then stops forwarding and counts the refusal", async () => {
    const t = createTestContext();
    await fillRateWindow(t, "all", BUDGETS.supportForward.key, BUDGETS.supportForward.limit - 1);
    expect(await t.mutation(internal.supportEmail.admitForward, {})).toBe(true);
    expect(await t.mutation(internal.supportEmail.admitForward, {})).toBe(false);
    const refusals = await t.run(async (ctx) => ctx.db.query("budgetRefusals").collect());
    expect(refusals.map((r) => r.pool)).toContain("supportForward");
  });
});
