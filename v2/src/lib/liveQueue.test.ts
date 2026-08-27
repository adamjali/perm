import { describe, expect, it } from "vitest";

import {
  findFront,
  FRONT_DONE_PCT,
  FRONT_MIN_CASES,
  monthsBetween,
  splitCohort,
  type CohortMonth,
  type StatusCount,
} from "./liveQueue";

function m(month: string, total: number, decided: number): CohortMonth {
  return {
    month,
    total,
    pending: total - decided,
    decided,
    decidedPct: total > 0 ? (decided / total) * 100 : null,
  };
}

/**
 * Shaped like the real series: old months essentially finished but carrying a
 * few stragglers in audit, a front in the middle, untouched months after it.
 */
const SERIES: CohortMonth[] = [
  m("2025-04", 10_000, 9_980), // 99.8% - done, 20 stragglers
  m("2025-05", 10_000, 9_600), // 96%   - done
  m("2025-06", 10_000, 8_000), // 80%   - THE FRONT
  m("2025-07", 10_000, 3_000),
  m("2025-08", 10_000, 0),
];

describe("findFront", () => {
  it("puts the front at the oldest month that is not substantially done", () => {
    expect(findFront(SERIES)?.month).toBe("2025-06");
  });

  it("does NOT let a handful of stragglers drag the front backwards", () => {
    // April still has 20 open cases. Reporting DOL as working April because of
    // them would overstate the backlog by two months.
    const front = findFront(SERIES);
    expect(front?.month).not.toBe("2025-04");
    expect(SERIES[0]!.pending).toBeGreaterThan(0);
  });

  it("reports the WHOLE backlog as the wall, not just the front month's remainder", () => {
    // Every undecided case: 20 + 400 + 2,000 + 7,000 + 10,000.
    expect(findFront(SERIES)?.wallTotal).toBe(19_420);
  });

  it("separately reports what DOL must clear to move past the front", () => {
    // At or before June only. These are two different questions and an
    // earlier version answered the second while calling it the first.
    expect(findFront(SERIES)?.pendingToClear).toBe(20 + 400 + 2_000);
  });

  it("measures how far back the front sits from the newest month", () => {
    expect(findFront(SERIES)?.monthsBack).toBe(2);
  });

  it("ignores a month too thin to place a front on", () => {
    const thin = [m("2025-05", FRONT_MIN_CASES - 1, 0), ...SERIES];
    expect(findFront(thin)?.month).toBe("2025-06");
  });

  it("returns null rather than inventing a front", () => {
    expect(findFront([])).toBeNull();
    // Everything finished: there is no front, and saying so beats a date.
    expect(findFront([m("2025-04", 10_000, 10_000)])).toBeNull();
  });

  it("treats the done threshold as exclusive", () => {
    const at = [m("2025-06", 1_000, FRONT_DONE_PCT * 10)];
    expect(findFront(at)).toBeNull();
    const justUnder = [m("2025-06", 1_000, FRONT_DONE_PCT * 10 - 1)];
    expect(findFront(justUnder)?.month).toBe("2025-06");
  });
});

describe("monthsBetween", () => {
  it("counts across a year boundary", () => {
    expect(monthsBetween("2025-11", "2026-02")).toBe(3);
    expect(monthsBetween("2025-06", "2025-06")).toBe(0);
  });
});

describe("splitCohort", () => {
  const COUNTS: StatusCount[] = [
    { status: "ANALYST REVIEW", count: 9_000, isFinal: false },
    { status: "RFI ISSUED", count: 300, isFinal: false },
    { status: "APPLICATION ON HOLD", count: 120, isFinal: false },
    { status: "CERTIFIED", count: 4_000, isFinal: true },
    { status: "DENIED", count: 90, isFinal: true },
  ];

  it("separates the ordinary queue from the queues that break filing order", () => {
    const s = splitCohort(COUNTS);
    expect(s.ordinary).toBe(9_000);
    expect(s.outOfOrder.map((x) => x.status)).toEqual([
      "RFI ISSUED",
      "APPLICATION ON HOLD",
    ]);
  });

  it("adds up: pending plus decided is the total", () => {
    const s = splitCohort(COUNTS);
    expect(s.pending).toBe(9_000 + 300 + 120);
    expect(s.total).toBe(s.pending + 4_000 + 90);
  });

  it("orders each group largest first", () => {
    const s = splitCohort(COUNTS);
    expect(s.decided[0]!.status).toBe("CERTIFIED");
    expect(s.outOfOrder[0]!.status).toBe("RFI ISSUED");
  });

  it("classifies by isFinal, never by a status name", () => {
    // A status nobody has seen before still lands correctly.
    const s = splitCohort([
      { status: "SOME NEW STATUS", count: 5, isFinal: false },
      { status: "ANOTHER FINAL ONE", count: 7, isFinal: true },
    ]);
    expect(s.outOfOrder.map((x) => x.status)).toEqual(["SOME NEW STATUS"]);
    expect(s.decided.map((x) => x.status)).toEqual(["ANOTHER FINAL ONE"]);
  });

  it("handles an empty cohort", () => {
    expect(splitCohort([])).toMatchObject({ ordinary: 0, pending: 0, total: 0 });
  });
});
