import { describe, expect, it } from "vitest";

import { busiestQuarter, capExemptAsOf, likelyCapExempt, monthShares } from "../capExempt";

/** The cap-exempt inference fires only when most coded filings name a college or university. */
describe("likelyCapExempt", () => {
  const uni = { key: "611310", label: "Colleges, Universities, and Professional Schools", n: 60 };

  it("fires at a majority of filings under 611310", () => {
    expect(likelyCapExempt([uni, { key: "541511", label: "Custom Computer Programming Services", n: 40 }])).toMatchObject({ n: 60, share: 0.6 });
  });

  it("stays quiet under half, or with another education code", () => {
    expect(likelyCapExempt([{ ...uni, n: 40 }, { key: "541511", label: "x", n: 60 }])).toBeNull();
    expect(likelyCapExempt([{ key: "611710", label: "Educational Support Services", n: 90 }])).toBeNull();
    expect(likelyCapExempt([])).toBeNull();
    expect(likelyCapExempt(null)).toBeNull();
  });
});

describe("monthShares", () => {
  it("gives each month its share of its own group's year, so two groups of any size compare", () => {
    const s = monthShares({ months: [{ month: "2025-03", exempt: 10, others: 900 }, { month: "2025-04", exempt: 10, others: 100 }] });
    expect(s).toEqual([
      { month: "2025-03", exempt: 0.5, others: 0.9 },
      { month: "2025-04", exempt: 0.5, others: 0.1 },
    ]);
  });

  it("is zero, never a division by zero, for a group with no filings", () => {
    expect(monthShares({ months: [{ month: "2025-03", exempt: 0, others: 4 }] })).toEqual([{ month: "2025-03", exempt: 0, others: 1 }]);
  });
});

describe("busiestQuarter", () => {
  it("finds the three months running that hold the most of a year, and their share", () => {
    const q = busiestQuarter([0.05, 0.05, 0.1, 0.2, 0.2, 0.15, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05]);
    expect(q.start).toBe(3);
    expect(q.share).toBeCloseTo(0.55);
  });
});

describe("capExemptAsOf", () => {
  it("is the newest day either file covers", () => {
    expect(capExemptAsOf({ asOf: { pwFrom: null, pwThrough: "2026-06-30", lcaFy: 2025, lcaThrough: "2025-09-30", uscisFy: 2026 } })).toBe("2026-06-30");
    expect(capExemptAsOf(null)).toBeNull();
  });
});
