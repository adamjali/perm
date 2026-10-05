import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { BUDGETS, LIST_MAIL_POOLS } from "@convex/lib/alertBudgets";
import { LIST_CEILING, RESEND_DAILY_CAP } from "@convex/lib/emailLimits";

/**
 * The budget table the senders enforce and the admin panel reports is held to
 * the arithmetic written out in convex/caseAlerts.ts, so the two cannot drift
 * apart again (they did once: the ledger read 10 a day for case confirmations
 * against a real 15). Since Sep 29 2026 the pools are per-kind bounds and the
 * day's real count guards Resend's 100 (convex/lib/emailLimits.ts).
 */
describe("the daily email budget table", () => {
  it("matches the ledger in convex/caseAlerts.ts, line by line", () => {
    // Every pool is either list mail or the sign-in codes; nothing is uncounted.
    expect(Object.keys(BUDGETS).sort()).toEqual([...LIST_MAIL_POOLS, "authMail"].sort());
    const ledger = readFileSync(join(process.cwd(), "convex/caseAlerts.ts"), "utf8");
    for (const [line, n] of [
      ["queue-alert confirmations", BUDGETS.queueConfirm.limit],
      ["case-alert confirmations", BUDGETS.caseConfirm.limit],
      ["case alerts", BUDGETS.caseAlert.limit],
      ["bulletin-alert confirmations", BUDGETS.bulletinConfirm.limit],
      ["bulletin alerts", BUDGETS.bulletinAlert.limit],
      ["preference-center links", BUDGETS.prefsLink.limit],
      ["firm-page claim emails", BUDGETS.firmClaim.limit],
      ["sign-in and reset codes", BUDGETS.authMail.limit],
    ] as const) {
      expect(ledger).toMatch(new RegExp(`${line}\\s+${n}/day`));
    }
    expect(ledger).toMatch(new RegExp(`list mail[\\s*]+stops at ${LIST_CEILING} of Resend's ${RESEND_DAILY_CAP}`));
  });

  it("keeps room for sign-in codes under Resend's daily cap", () => {
    expect(LIST_CEILING).toBeLessThan(RESEND_DAILY_CAP);
    expect(RESEND_DAILY_CAP - LIST_CEILING).toBeGreaterThanOrEqual(10);
  });

  it("never shrinks a pool below what Sep 28 2026 needed", () => {
    // 15 case confirmations went out in 20 hours and 15 more were refused.
    expect(BUDGETS.caseConfirm.limit).toBeGreaterThanOrEqual(30);
    expect(BUDGETS.authMail.limit).toBeGreaterThan(40);
  });
});
