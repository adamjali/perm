import { describe, expect, it } from "vitest";

import {
  newestAnswer,
  parseLayoffDoc,
  shareSquares,
  yearComplete,
  yesBand,
  type LayoffYear,
} from "../layoffDisclosures";

const outcomes = { certified: 0, denied: 0, withdrawn: 0 };
const year = (fy: number, through: string | null): LayoffYear => ({
  fy,
  cases: 10,
  answered: 10,
  yes: 1,
  from: null,
  through,
  yesOutcomes: outcomes,
  noOutcomes: outcomes,
});

describe("layoff disclosures", () => {
  it("reads a doc only when the newest year is among its years", () => {
    const good = { years: [year(2026, "2026-06-30")], newestFy: 2026, employers: [], jobs: [] };
    expect(parseLayoffDoc(good)?.newestFy).toBe(2026);
    expect(parseLayoffDoc({ ...good, newestFy: 2025 })).toBeNull();
    expect(parseLayoffDoc({ ...good, employers: undefined })).toBeNull();
    expect(parseLayoffDoc(null)).toBeNull();
  });

  it("calls a year complete only once its decisions reach its last week", () => {
    expect(yearComplete(year(2026, "2026-06-30"))).toBe(false);
    expect(yearComplete(year(2025, "2025-09-30"))).toBe(true);
    expect(yearComplete(year(2025, null))).toBe(false);
  });

  it("splits 100 squares by the largest remainder, and never hides a real share", () => {
    expect(shareSquares(1470, 3286)).toEqual({ top: 45, rest: 55 });
    expect(shareSquares(1, 3286)).toEqual({ top: 1, rest: 99 });
    expect(shareSquares(3285, 3286)).toEqual({ top: 99, rest: 1 });
    expect(shareSquares(10, 10)).toEqual({ top: 100, rest: 0 });
    expect(shareSquares(0, 10)).toEqual({ top: 0, rest: 100 });
  });

  it("names how much of an employer's filing said yes", () => {
    expect(yesBand({ yes: 98, answered: 98 })).toBe("Every application");
    expect(yesBand({ yes: 1470, answered: 1683 })).toBe("Most");
    expect(yesBand({ yes: 3, answered: 18 })).toBe("Some");
    expect(yesBand({ yes: 5, answered: 10 })).toBe("Some");
  });

  it("gives an employer's newest answered year, and nothing when it said no there", () => {
    const rows = [
      { fy: 2026, layoff: "Y", n: 1470, from: "2025-10-01", through: "2026-06-30" },
      { fy: 2026, layoff: "N", n: 213, from: "2025-10-02", through: "2026-06-29" },
      { fy: 2026, layoff: null, n: 4, from: "2025-10-01", through: "2026-06-30" },
      { fy: 2025, layoff: "Y", n: 900, from: "2024-10-01", through: "2025-09-30" },
    ];
    expect(newestAnswer(rows)).toEqual({ fy: 2026, yes: 1470, answered: 1683, from: "2025-10-01", through: "2026-06-30" });
    expect(newestAnswer([{ fy: 2026, layoff: "N", n: 843, from: null, through: null }, rows[3]!])).toBeNull();
    expect(newestAnswer([{ fy: 2026, layoff: null, n: 5, from: null, through: null }])).toBeNull();
  });
});
