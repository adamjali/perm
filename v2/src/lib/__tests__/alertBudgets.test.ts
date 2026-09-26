import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { BUDGETS } from "../../../convex/lib/alertBudgets";

/**
 * The budget table the senders enforce and the admin panel reports is held to
 * the Resend arithmetic written out in convex/caseAlerts.ts, so the ledger and
 * the limits cannot drift apart again (they did once: the ledger read 10 a day
 * for case confirmations against a real 15).
 */
describe("the daily email budget table", () => {
  it("sums to the 75 a day the Resend ledger promises, line by line", () => {
    expect(Object.values(BUDGETS).reduce((a, b) => a + b.limit, 0)).toBe(75);
    const ledger = readFileSync(join(process.cwd(), "convex/caseAlerts.ts"), "utf8");
    expect(ledger).toMatch(/worst case from list mail\s+75\/day/);
    for (const [line, n] of [
      ["queue-alert confirmations", BUDGETS.queueConfirm.limit],
      ["case-alert confirmations", BUDGETS.caseConfirm.limit],
      ["case alerts", BUDGETS.caseAlert.limit],
      ["bulletin-alert confirmations", BUDGETS.bulletinConfirm.limit],
      ["bulletin alerts", BUDGETS.bulletinAlert.limit],
      ["preference-center links", BUDGETS.prefsLink.limit],
    ] as const) {
      expect(ledger).toMatch(new RegExp(`${line}\\s+${n}/day`));
    }
  });
});
