import { describe, expect, it } from "vitest";

import {
  deriveActiveRange,
  deriveQueueAhead,
  findVolumeAnomalies,
  type MonthQueue,
} from "./queueAhead";

/**
 * A month row, with decidedPct derived rather than passed, so a fixture can
 * never claim a percentage its own total and decided count disagree with.
 */
function month(filingMonth: string, total: number, decided: number): MonthQueue {
  return {
    filingMonth,
    total,
    pending: total - decided,
    decided,
    decidedPct: total > 0 ? (decided / total) * 100 : null,
  };
}

/**
 * Shaped like the real series: old months finished, a band in progress, and
 * recent months untouched. October is the shutdown collapse.
 */
const SERIES: MonthQueue[] = [
  month("2025-06", 14_000, 14_000),
  month("2025-07", 13_500, 13_400),
  month("2025-08", 14_200, 9_000),
  month("2025-09", 13_800, 4_000),
  month("2025-10", 1_616, 300),
  month("2025-11", 14_100, 0),
  month("2025-12", 13_900, 0),
];

describe("deriveQueueAhead", () => {
  it("counts pending cases in earlier months only", () => {
    const r = deriveQueueAhead(SERIES, "2025-09");
    // 0 + 100 + 5,200 pending from Jun/Jul/Aug.
    expect(r.ahead).toBe(0 + 100 + 5_200);
  });

  it("excludes the subject month from what is ahead of it", () => {
    const r = deriveQueueAhead(SERIES, "2025-09");
    expect(r.sameMonth).toBe(9_800);
    expect(r.subject?.filingMonth).toBe("2025-09");
    // Its own 9,800 pending are reported separately and are NOT in `ahead`:
    // the two together are what the whole series before October holds.
    const throughSubject = SERIES.filter((m) => m.filingMonth <= "2025-09").reduce(
      (n, m) => n + m.pending,
      0,
    );
    expect(r.ahead + r.sameMonth).toBe(throughSubject);
    expect(r.ahead).toBe(throughSubject - 9_800);
  });

  it("counts PENDING, not total - the error that flatters a wait", () => {
    const r = deriveQueueAhead(SERIES, "2025-09");
    const totalsAhead = 14_000 + 13_500 + 14_200;
    expect(r.ahead).toBeLessThan(totalsAhead);
    // Summing totals instead would be ~7x the honest figure and still plausible.
    expect(totalsAhead / r.ahead).toBeGreaterThan(5);
  });

  it("returns zero ahead for the oldest month", () => {
    expect(deriveQueueAhead(SERIES, "2025-06").ahead).toBe(0);
  });

  it("still totals earlier months for a month it holds no row for", () => {
    const r = deriveQueueAhead(SERIES, "2026-05");
    expect(r.subject).toBeNull();
    expect(r.sameMonth).toBe(0);
    expect(r.ahead).toBe(SERIES.reduce((n, m) => n + m.pending, 0));
  });

  it("handles an empty series without throwing", () => {
    expect(deriveQueueAhead([], "2025-09")).toEqual({
      ahead: 0,
      sameMonth: 0,
      subject: null,
    });
  });
});

describe("deriveActiveRange", () => {
  it("spans the months started but not finished", () => {
    // Jun is 100% and Nov/Dec are 0%, so neither end is being worked.
    expect(deriveActiveRange(SERIES)).toEqual({ from: "2025-08", to: "2025-10" });
  });

  it("is null when nothing is part-done", () => {
    expect(
      deriveActiveRange([month("2025-06", 100, 100), month("2025-07", 100, 0)]),
    ).toBeNull();
  });
});

describe("findVolumeAnomalies", () => {
  it("finds the collapsed month and reports how far it fell", () => {
    const found = findVolumeAnomalies(SERIES);
    expect(found.map((a) => a.filingMonth)).toEqual(["2025-10"]);
    expect(found[0]!.neighbourMean).toBe(13_950);
    expect(found[0]!.ratio).toBeCloseTo(0.116, 3);
  });

  it("finds nothing in an even series", () => {
    const even = ["2025-06", "2025-07", "2025-08", "2025-09"].map((m) =>
      month(m, 14_000, 1_000),
    );
    expect(findVolumeAnomalies(even)).toEqual([]);
  });

  it("never flags the newest month, which is partial by construction", () => {
    const partial = [...SERIES.slice(0, 3), month("2025-09", 400, 0)];
    expect(findVolumeAnomalies(partial).map((a) => a.filingMonth)).not.toContain(
      "2025-09",
    );
  });

  it("does not flag an ordinary dip", () => {
    const dip = [
      month("2025-06", 14_000, 0),
      month("2025-07", 9_000, 0),
      month("2025-08", 14_000, 0),
    ];
    expect(findVolumeAnomalies(dip)).toEqual([]);
  });
});
