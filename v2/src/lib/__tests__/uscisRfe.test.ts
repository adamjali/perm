import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  RFE_VISAS,
  calendarYear,
  fiscalYears,
  monthEnd,
  monthKey,
  monthLabel,
  monthSeries,
  monthsFor,
  pct,
  peakMonth,
  sameMonths,
  share,
  totals,
  visaLabel,
  visaYears,
  yearsFor,
  type RfeMonth,
} from "../uscisRfe";

const FY_ORDER = [10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/** A visa's months, `n` of them from October, with counts that move by month. */
function months(visa: string, fy: number, n: number, rfe: (i: number) => number, completions = 1000): RfeMonth[] {
  return FY_ORDER.slice(0, n).map((month, i) => ({
    fy,
    month,
    visa,
    received: 900,
    approved: completions - 20,
    denied: 20,
    completions,
    pending: null,
    rfeCompletions: rfe(i),
    rfeApproved: Math.round(rfe(i) * 0.8),
    sourceFile: `file-${fy}.xlsx`,
  }));
}

describe("months and dates", () => {
  it("puts October to December in the calendar year before the fiscal year", () => {
    expect([calendarYear(2026, 10), calendarYear(2026, 12), calendarYear(2026, 1), calendarYear(2026, 9)]).toEqual([
      2025, 2025, 2026, 2026,
    ]);
    expect(monthKey(2026, 10)).toBe("2025-10");
    expect(monthLabel(2026, 6)).toBe("June 2026");
  });

  it("ends a month on its real last day, leap years included", () => {
    expect(monthEnd(2026, 6)).toBe("2026-06-30");
    expect(monthEnd(2024, 2)).toBe("2024-02-29");
    expect(monthEnd(2026, 12)).toBe("2025-12-31");
  });
});

describe("shares", () => {
  it("computes a share from the counts, and none from nothing decided", () => {
    expect(share(85, 1000)).toBe(0.085);
    expect(share(0, 0)).toBeNull();
    expect(pct(0.0849)).toBe("8.5%");
    expect(pct(null)).toBe("n/a");
  });

  it("totals the counts, then divides: a share of sums, never a mean of shares", () => {
    const rows = [...months("h1b", 2026, 1, () => 10, 100), ...months("h1b", 2025, 1, () => 900, 1000)];
    const t = totals(rows);
    expect(t.completions).toBe(1100);
    expect(t.rfeShare).toBeCloseTo(910 / 1100, 12);
    expect(t.rfeShare).not.toBeCloseTo((0.1 + 0.9) / 2, 3);
    expect(t.approvedAfterRfe).toBeCloseTo((8 + 720) / 910, 12);
    expect(t.approvalRate).toBeCloseTo((80 + 980) / 1100, 12);
  });
});

describe("fiscal years", () => {
  const rows = [
    ...months("h1b", 2024, 12, (i) => 100 + i),
    ...months("h1b", 2025, 12, (i) => 50 + i),
    ...months("h1b", 2026, 9, (i) => 60 + i),
    ...months("tn", 2026, 9, () => 5),
  ];

  it("orders a visa's months October first, whatever order they came in", () => {
    const shuffled = [...rows].reverse();
    const list = monthsFor(shuffled, "h1b");
    expect(list[0]).toMatchObject({ fy: 2024, month: 10 });
    expect(list[list.length - 1]).toMatchObject({ fy: 2026, month: 6 });
  });

  it("marks a year with fewer than twelve months as under way", () => {
    const years = yearsFor(rows, "h1b");
    expect(years.map((y) => [y.fy, y.months, y.complete])).toEqual([
      [2024, 12, true],
      [2025, 12, true],
      [2026, 9, false],
    ]);
  });

  it("compares the year to date with the SAME months a year earlier", () => {
    const s = sameMonths(rows, "h1b")!;
    expect(s.fy).toBe(2026);
    expect(s.months).toEqual(FY_ORDER.slice(0, 9));
    expect(s.first).toEqual({ fy: 2026, month: 10 });
    expect(s.last).toEqual({ fy: 2026, month: 6 });
    // October to June of FY2025: 50 + 51 + ... + 58, not the whole year's 12 months.
    const nine = Array.from({ length: 9 }, (_, i) => 50 + i).reduce((a, b) => a + b, 0);
    expect(s.yearBefore?.rfeCompletions).toBe(nine);
    expect(s.yearBefore?.months).toBe(9);
    expect(s.yearBefore?.fy).toBe(2025);
  });

  it("gives no comparison when the year before doesn't hold every one of those months", () => {
    const short = [...months("o", 2025, 3, () => 1), ...months("o", 2026, 9, () => 2)];
    expect(sameMonths(short, "o")?.yearBefore).toBeNull();
    expect(sameMonths(short, "nothing")).toBeNull();
  });

  it("finds the month with the highest share", () => {
    const spike = [...months("h1b", 2018, 12, (i) => (i === 1 ? 661 : 100))];
    const p = peakMonth(monthSeries(spike, "h1b"));
    expect(p).toMatchObject({ fy: 2018, month: 11 });
    expect(p?.rfeShare).toBeCloseTo(0.661, 12);
  });

  it("lists visas in the page's order and leaves out a visa with no rows", () => {
    expect(visaYears(rows).map((v) => v.key)).toEqual(["h1b", "tn"]);
    expect(fiscalYears(rows)).toEqual([2024, 2025, 2026]);
    expect(visaLabel("l1")).toBe("L-1A and L-1B");
  });

  it("draws the approved part as a share of all the month's decisions, inside the RFE share", () => {
    const s = monthSeries(months("h1b", 2026, 1, () => 100, 1000), "h1b")[0]!;
    expect(s.rfeShare).toBe(0.1);
    expect(s.approvedAfterRfeOfAll).toBe(0.08);
    expect(s.approvedAfterRfeOfAll!).toBeLessThanOrEqual(s.rfeShare!);
  });
});

describe("the two copies of the visa list", () => {
  it("names every visa the ingest writes, with the same label", () => {
    const py = readFileSync(join(__dirname, "../../../scripts/ingest_uscis_rfe.py"), "utf8");
    const block = py.slice(py.indexOf("VISAS: list["), py.indexOf("VISA_LABELS ="));
    const pyVisas = [...block.matchAll(/\("([a-z0-9_]+)", "([^"]+)", re\.compile/g)].map((m) => ({ key: m[1], label: m[2] }));
    expect(pyVisas.length).toBeGreaterThanOrEqual(11);
    const left = /LEFT_OUT = \{([^}]*)\}/.exec(py)?.[1] ?? "";
    const leftOut = new Set([...left.matchAll(/"([a-z0-9_]+)"/g)].map((m) => m[1]));
    expect(leftOut.size).toBeGreaterThan(0);
    const written = pyVisas.filter((v) => !leftOut.has(v.key));
    const byKey = (a: { key: string | undefined }, b: { key: string | undefined }) => String(a.key).localeCompare(String(b.key));
    expect([...RFE_VISAS].sort(byKey)).toEqual(written.sort(byKey));
  });
});
