import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CENSUS_DAYS_FROM, queueLead, statusShift } from "../backlogMonths";

describe("CENSUS_DAYS_FROM", () => {
  it("is the replay script's first day", () => {
    const py = readFileSync(join(process.cwd(), "scripts/build_census_days.py"), "utf8");
    expect(py).toMatch(new RegExp(`^START = "${CENSUS_DAYS_FROM}"$`, "m"));
  });
});

describe("statusShift", () => {
  const s = (status: string, count: number, isFinal = false) => ({ status, count, isFinal });

  it("gives each status's change, largest first, leaving unchanged ones out", () => {
    const now = [s("ANALYST REVIEW", 9688), s("CERTIFIED", 4290, true), s("WITHDRAWN", 118, true), s("RFI ISSUED", 40)];
    const before = [s("ANALYST REVIEW", 10000), s("CERTIFIED", 4000, true), s("WITHDRAWN", 100, true), s("RFI ISSUED", 40)];
    const shift = statusShift(now, before);
    expect(shift.statuses.map((x) => [x.status, x.change])).toEqual([
      ["ANALYST REVIEW", -312],
      ["CERTIFIED", 290],
      ["WITHDRAWN", 18],
    ]);
    expect([shift.pending, shift.decided, shift.total]).toEqual([-312, 308, -4]);
  });

  it("counts a status that appeared or emptied", () => {
    const shift = statusShift([s("NORD ISSUED", 2)], [s("APPLICATION ON HOLD", 5)]);
    expect(shift.statuses.map((x) => [x.status, x.change])).toEqual([
      ["APPLICATION ON HOLD", -5],
      ["NORD ISSUED", 2],
    ]);
  });

  it("says nothing moved when the two days match", () => {
    const same = [s("ANALYST REVIEW", 10), s("CERTIFIED", 3, true)];
    expect(statusShift(same, same)).toEqual({ statuses: [], pending: 0, decided: 0, total: 0 });
  });

  it("reads each status's side from the newer count when it changed sides", () => {
    // A case reopened by an appeal: the status is pending today and wasn't held yesterday.
    const shift = statusShift([s("RECONSIDERATION APPEALS", 1)], [s("DENIED", 1, true)]);
    expect([shift.pending, shift.decided, shift.total]).toEqual([1, -1, 0]);
  });
});

describe("queueLead", () => {
  it("answers how many are waiting, then where DOL is, dated", () => {
    expect(queueLead(97123, "2025-12", "October 22, 2026")).toBe(
      "97,123 PERM cases are still waiting for DOL's decision. As of October 22, 2026, its analyst review is working cases filed in December 2025.",
    );
  });

  it("says only the count when DOL's month isn't published", () => {
    expect(queueLead(5, null, null)).toBe("5 PERM cases are still waiting for DOL's decision.");
  });

  it("leaves the date off rather than inventing one", () => {
    expect(queueLead(1, "2025-12", null)).toBe(
      "1 PERM case is still waiting for DOL's decision. Its analyst review is working cases filed in December 2025.",
    );
  });
});
