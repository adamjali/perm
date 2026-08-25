import { describe, expect, it } from "vitest";

import {
  evenTicks,
  labelRows,
  measure,
  monthIndex,
  plateMetrics,
  shortLabel,
  type WaitLedgerRow,
} from "../WaitLedger";
import { fillPath } from "../SectionDivider";
import { deriveFigures } from "../dataPageFigures";

const row = (
  decisionMonth: string,
  medianFilingMonth: string,
  decisions = 1000,
): WaitLedgerRow => ({ decisionMonth, medianFilingMonth, decisions });

describe("monthIndex", () => {
  it("orders months across a year boundary", () => {
    expect(monthIndex("2026-01")! - monthIndex("2025-12")!).toBe(1);
  });

  it.each(["2026-13", "2026-00", "202606", "June 2026", ""])(
    "rejects %s rather than returning a plausible number",
    (bad) => {
      expect(monthIndex(bad)).toBeNull();
    },
  );
});

describe("shortLabel", () => {
  it("renders a two-digit year", () => {
    expect(shortLabel("2026-06")).toBe("Jun 26");
    expect(shortLabel("2025-09")).toBe("Sep 25");
  });

  it("returns the input untouched when it cannot parse it", () => {
    expect(shortLabel("2026-13")).toBe("2026-13");
    expect(shortLabel("nonsense")).toBe("nonsense");
  });
});

describe("evenTicks", () => {
  it("includes both ends", () => {
    const t = evenTicks(20, 7);
    expect(t[0]).toBe(0);
    expect(t[t.length - 1]).toBe(19);
  });

  it("never places two ticks adjacent, which is how axis labels collide", () => {
    // The naive "every nth, plus the last one" leaves 18 and 19 touching.
    const t = evenTicks(20, 7);
    const gaps = t.slice(1).map((v, i) => v - t[i]!);
    expect(Math.min(...gaps)).toBeGreaterThan(1);
  });

  it("degrades safely on tiny and empty series", () => {
    expect(evenTicks(0, 7)).toEqual([]);
    expect(evenTicks(1, 7)).toEqual([0]);
    expect(evenTicks(3, 99)).toEqual([0, 1, 2]);
  });
});

describe("plateMetrics", () => {
  /** Rows plus the gaps between them. */
  const plate = (n: number) => {
    const { rowH, gapH } = plateMetrics(n);
    return n * rowH + Math.max(0, n - 1) * gapH;
  };

  it("keeps the plate a similar height as the series grows", () => {
    // The whole point: DOL adds a month every publication, and a written-down
    // row height turns that into a figure that grows past the fold on a
    // schedule. 33 rows was the height that pushed the hero's CTAs off-screen.
    for (const n of [24, 33, 45, 60]) {
      expect(plate(n)).toBeGreaterThan(200);
      expect(plate(n)).toBeLessThan(420);
    }
  });

  it("never returns a row too thin to draw a bar in", () => {
    for (const n of [1, 33, 120, 500]) {
      expect(plateMetrics(n).rowH).toBeGreaterThanOrEqual(4);
      expect(plateMetrics(n).gapH).toBeGreaterThanOrEqual(2);
    }
  });

  it("caps the row height so a short series is not drawn as fenceposts", () => {
    expect(plateMetrics(3).rowH).toBe(9);
  });

  it("never divides by zero on an empty series", () => {
    expect(plateMetrics(0).rowH).toBeGreaterThanOrEqual(4);
  });
});

describe("labelRows", () => {
  it("always labels a pinned row", () => {
    expect(labelRows(33, 7, [19, 32])).toEqual(
      expect.arrayContaining([19, 32]),
    );
  });

  it("drops an axis tick that would print on top of a pinned row", () => {
    // 0 and 32 are both natural ticks over 33 rows; pinning 31 must remove 32
    // rather than nudge it, because a moved tick is no longer an axis.
    const out = labelRows(33, 7, [31]);
    expect(out).toContain(31);
    expect(out).not.toContain(32);
  });

  it("keeps every label at least three rows from the next", () => {
    const out = labelRows(33, 7, [19, 32]);
    const gaps = out.slice(1).map((v, i) => v - out[i]!);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(3);
  });

  it("ignores pins outside the series rather than labelling a row that is not there", () => {
    expect(labelRows(10, 4, [-1, 10, 99, 1.5])).not.toEqual(
      expect.arrayContaining([-1, 10, 99, 1.5]),
    );
  });

  it("returns nothing for an empty series", () => {
    expect(labelRows(0, 7, [0])).toEqual([]);
  });
});

describe("measure", () => {
  // The real shape of the series as published: the wait rose, then fell.
  const real = [
    row("2024-10", "2023-08", 7505),
    row("2026-02", "2024-09", 14327),
    row("2026-06", "2025-05", 19787),
  ];

  it("computes the wait as whole months from filing to determination", () => {
    const m = measure(real)!;
    expect(m.items.map((i) => i.wait)).toEqual([14, 17, 13]);
  });

  it("puts every segment inside the axis", () => {
    const m = measure(real)!;
    for (const i of m.items) {
      expect(i.left).toBeGreaterThanOrEqual(0);
      expect(i.left + i.width).toBeLessThanOrEqual(100.0001);
    }
  });

  it("spans the axis exactly from the first filing to the last decision", () => {
    const m = measure(real)!;
    expect(m.items[0]!.left).toBe(0);
    const last = m.items[m.items.length - 1]!;
    expect(last.left + last.width).toBeCloseTo(100, 6);
  });

  it("drops a row decided before it was filed instead of drawing it backwards", () => {
    const m = measure([...real, row("2024-01", "2025-01")])!;
    expect(m.items).toHaveLength(3);
  });

  it("drops unparseable months", () => {
    const m = measure([...real, row("garbage", "2025-05")])!;
    expect(m.items).toHaveLength(3);
  });

  it("returns null rather than dividing by a zero-length axis", () => {
    expect(measure([row("2026-06", "2026-06")])).toBeNull();
    expect(measure([])).toBeNull();
  });
});

describe("fillPath", () => {
  it("closes an open top edge down to the viewBox floor", () => {
    expect(fillPath("M0,40 L1440,44")).toBe("M0,40 L1440,44 L1440,64 L0,64 Z");
  });
});

describe("deriveFigures", () => {
  const full = {
    uniqueCases: 259489,
    byState: [
      { state: "CA", total: 45727 },
      { state: "VI", total: 39 },
    ],
    wageLadder: { p10: 29120, p50: 102066, p90: 176500 },
    topEmployers: [{ total: 90449 }],
    topAttorneys: [{ total: 168241 }],
    risk: { baseline: { denialRate: 2.57, denied: 6379, decided: 248158 } },
  };

  it("derives the published figures", () => {
    const f = deriveFigures(full);
    expect(f.states).toEqual({
      count: 2,
      top: "CA",
      topCases: 45727,
      low: "VI",
      lowCases: 39,
    });
    expect(f.wages).toEqual({ p10: 29120, p50: 102066, p90: 176500 });
    expect(f.employerShare).toBe(35);
    expect(f.attorneyShare).toBe(65);
    expect(f.denial).toEqual({ rate: 2.57, denied: 6379, decided: 248158 });
  });

  it("degrades every field to null rather than to a wrong number", () => {
    const f = deriveFigures(null);
    expect(Object.values(f).every((v) => v === null)).toBe(true);
  });

  it("withholds a wage ladder whose rungs are missing or out of order", () => {
    expect(
      deriveFigures({
        ...full,
        wageLadder: { p10: 29120, p50: null, p90: 176500 },
      }).wages,
    ).toBeNull();
    expect(
      deriveFigures({
        ...full,
        wageLadder: { p10: 200000, p50: 102066, p90: 176500 },
      }).wages,
    ).toBeNull();
  });

  it("withholds a share that exceeds the case total, which means the inputs disagree", () => {
    expect(
      deriveFigures({ ...full, topEmployers: [{ total: 999999999 }] })
        .employerShare,
    ).toBeNull();
  });

  it("withholds a state span when one row is both the largest and the smallest", () => {
    expect(
      deriveFigures({ ...full, byState: [{ state: "CA", total: 45727 }] })
        .states,
    ).toBeNull();
  });

  it("withholds a denial rate with no decided cases behind it", () => {
    expect(
      deriveFigures({
        ...full,
        risk: { baseline: { denialRate: 0, denied: 0, decided: 0 } },
      }).denial,
    ).toBeNull();
  });
});
