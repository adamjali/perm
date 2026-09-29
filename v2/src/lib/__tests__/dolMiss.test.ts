import { describe, expect, it } from "vitest";

import { budgetResetEastern, isLookupGap, isUnsettledMiss, unsettledClause, unsettledVerdict } from "../dolMiss";

describe("an unsettled DOL lookup says what happened", () => {
  it("only 'none' may read as no record", () => {
    expect(isUnsettledMiss("none")).toBe(false);
    for (const m of ["unavailable", "budget", "not-asked"] as const) expect(isUnsettledMiss(m)).toBe(true);
    expect(isLookupGap("records")).toBe(true);
    expect(isLookupGap("none")).toBe(false);
    expect(isLookupGap(null)).toBe(false);
  });

  it("blames the daily allowance only when it was the allowance", () => {
    expect(unsettledClause("budget")).toMatch(/daily allowance of live checks is used up/);
    expect(unsettledClause("not-asked")).not.toMatch(/allowance|limit/);
    expect(unsettledClause("records")).toMatch(/own case records couldn't be read/);
    expect(new Set(["unavailable", "budget", "not-asked", "records"].map((m) => unsettledVerdict(m as never))).size).toBe(4);
  });

  it("gives the reset in Eastern time: midnight UTC is 8 PM in summer, 7 PM in winter", () => {
    expect(budgetResetEastern(new Date("2026-09-29T15:00:00Z"))).toBe("8 PM");
    expect(budgetResetEastern(new Date("2026-12-15T15:00:00Z"))).toBe("7 PM");
  });
});
