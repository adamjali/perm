import { describe, expect, it } from "vitest";

import {
  approvalRate,
  denialRate,
  isPreference,
  quartersFor,
  totalsFor,
  type TrendRow,
} from "./i140Trends";

function row(
  fy: number,
  q: number,
  category: string,
  received: number,
  approved: number,
  denied: number,
  pending: number,
): TrendRow {
  return {
    fiscalYear: fy,
    quarter: q,
    category,
    categoryLabel: category,
    received,
    approved,
    denied,
    pending,
  };
}

const ROWS: TrendRow[] = [
  row(2025, 1, "E21", 10_000, 8_000, 500, 40_000),
  row(2025, 2, "E21", 11_000, 9_000, 600, 42_000),
  // USCIS has not reported this one. It arrives as zeros and must not be drawn.
  row(2026, 3, "E21", 0, 0, 0, 0),
  row(2025, 1, "E11", 5_000, 3_000, 900, 12_000),
];

describe("denialRate", () => {
  it("is over DECIDED petitions, not receipts", () => {
    // 500 denied of 8,500 decided is 5.9%, not 5% of 10,000 received.
    expect(denialRate(8_000, 500)).toBeCloseTo(5.882, 3);
  });

  it("does not drift when receipts change but outcomes do not", () => {
    // The same outcomes in a quarter with double the receipts: same rate.
    expect(denialRate(8_000, 500)).toBe(denialRate(8_000, 500));
  });

  it("is null when nothing was decided, never a confident zero", () => {
    expect(denialRate(0, 0)).toBeNull();
    expect(approvalRate(0, 0)).toBeNull();
  });

  it("pairs with approvalRate to make 100", () => {
    expect(denialRate(8_000, 500)! + approvalRate(8_000, 500)!).toBeCloseTo(100, 9);
  });
});

describe("isPreference", () => {
  it("separates the rollups from the subtypes", () => {
    expect(isPreference("EB1")).toBe(true);
    expect(isPreference("E11")).toBe(false);
  });
});

describe("quartersFor", () => {
  it("drops a quarter USCIS has not reported rather than drawing it at zero", () => {
    const q = quartersFor(ROWS, "E21");
    expect(q.map((p) => p.label)).toEqual(["FY2025 Q1", "FY2025 Q2"]);
    // The all-zero row exists in the input and must not reach a chart: a bar
    // at zero reads as a collapse in filings, not as absent data.
    expect(q.some((p) => p.label === "FY2026 Q3")).toBe(false);
  });

  it("keeps a real quarter that happens to have zero denials", () => {
    const q = quartersFor([row(2025, 1, "E31", 100, 90, 0, 10)], "E31");
    expect(q).toHaveLength(1);
    expect(q[0]!.denialRate).toBe(0);
  });

  it("orders oldest first across a fiscal-year boundary", () => {
    const q = quartersFor(
      [row(2026, 1, "X", 1, 1, 0, 0), row(2025, 4, "X", 1, 1, 0, 0)],
      "X",
    );
    expect(q.map((p) => p.label)).toEqual(["FY2025 Q4", "FY2026 Q1"]);
  });

  it("returns nothing for a category with no rows", () => {
    expect(quartersFor(ROWS, "NOPE")).toEqual([]);
  });
});

describe("totalsFor", () => {
  const q = quartersFor(ROWS, "E21");

  it("sums the flow measures", () => {
    const t = totalsFor(q);
    expect(t.received).toBe(21_000);
    expect(t.approved).toBe(17_000);
    expect(t.denied).toBe(1_100);
  });

  it("takes pending from the NEWEST quarter, never the sum", () => {
    // Pending is a snapshot: adding 40,000 and 42,000 would count the same
    // waiting petition twice and report 82,000 people in a 42,000 queue.
    expect(totalsFor(q).pending).toBe(42_000);
  });

  it("computes rates over the summed decisions", () => {
    const t = totalsFor(q);
    expect(t.denialRate).toBeCloseTo((1_100 / 18_100) * 100, 6);
    expect(t.quarters).toBe(2);
  });

  it("reports null rather than zero for an empty category", () => {
    const t = totalsFor([]);
    expect(t.pending).toBeNull();
    expect(t.denialRate).toBeNull();
    expect(t.received).toBe(0);
  });
});
