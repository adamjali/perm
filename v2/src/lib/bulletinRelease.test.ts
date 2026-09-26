import { describe, expect, it } from "vitest";

import { ordinal, releaseByDay, releaseSummary, type FirstCapture } from "./bulletinRelease";

/**
 * Six bulletins whose first archive capture fell on the 8th, 10th, 12th,
 * 14th, 20th of the month before, and one first captured only after its own
 * month began (the archive was late; it says nothing about the day).
 */
const CAPTURES: FirstCapture[] = [
  { month: "2025-02", captured: "2025-01-08" },
  { month: "2025-03", captured: "2025-02-10" },
  { month: "2025-04", captured: "2025-03-12" },
  { month: "2025-05", captured: "2025-04-14" },
  { month: "2025-06", captured: "2025-05-20" },
  { month: "2025-07", captured: "2025-07-03" },
];

describe("releaseByDay", () => {
  it("counts, for each day of the month before, the bulletins already captured by then", () => {
    const rows = releaseByDay(CAPTURES);
    expect(rows).toHaveLength(31);
    // The late capture is left out of the count entirely: the archive wasn't
    // watching, so it's no evidence either way about the day.
    expect(rows[6]).toEqual({ day: 7, captured: 0, of: 5 });
    expect(rows[7]).toEqual({ day: 8, captured: 1, of: 5 });
    expect(rows[13]).toEqual({ day: 14, captured: 4, of: 5 });
    expect(rows[30]).toEqual({ day: 31, captured: 5, of: 5 });
  });

  it("is never more than the months it measured, and never goes down", () => {
    const rows = releaseByDay(CAPTURES);
    for (let i = 1; i < rows.length; i += 1) expect(rows[i]!.captured).toBeGreaterThanOrEqual(rows[i - 1]!.captured);
  });

  it("ignores a capture from before the month before, which can't be this bulletin", () => {
    const rows = releaseByDay([{ month: "2025-02", captured: "2024-12-30" }]);
    expect(rows[30]).toEqual({ day: 31, captured: 0, of: 0 });
  });
});

describe("releaseSummary", () => {
  it("names the earliest day and the first day by which half, and nine in ten, were out, over the bulletins with evidence", () => {
    const s = releaseSummary([...CAPTURES, { month: "2025-08", captured: "2025-07-09" }]);
    // Six with evidence (8, 9, 10, 12, 14, 20), one set aside.
    expect(s).toEqual({ months: 6, setAside: 1, earliestDay: 8, halfBy: 10, ninetyBy: 20, first: "2025-02", last: "2025-08" });
  });

  it("dates its span by the bulletins with evidence, not by a set-aside earlier one", () => {
    const s = releaseSummary([{ month: "2016-05", captured: "2017-12-03" }, ...CAPTURES, { month: "2025-08", captured: "2025-07-09" }]);
    expect(s!.first).toBe("2025-02");
    expect(s!.setAside).toBe(2);
  });

  it("says nothing from fewer than six bulletins with evidence, however many were captured late", () => {
    expect(releaseSummary(CAPTURES)).toBeNull(); // five with evidence
  });
});

describe("ordinal", () => {
  it.each([
    [1, "1st"], [2, "2nd"], [3, "3rd"], [4, "4th"], [11, "11th"], [12, "12th"],
    [13, "13th"], [21, "21st"], [22, "22nd"], [23, "23rd"], [30, "30th"], [31, "31st"],
  ])("%d is %s", (n, out) => {
    expect(ordinal(n)).toBe(out);
  });
});

describe("the measured table the page reads", () => {
  it("is one row per bulletin, in order, with no capture before the month before it", async () => {
    const { BULLETIN_FIRST_CAPTURES } = await import("./bulletinCaptures");
    const months = BULLETIN_FIRST_CAPTURES.map((c) => c.month);
    expect(new Set(months).size).toBe(months.length);
    expect([...months].sort()).toEqual(months);
    for (const c of BULLETIN_FIRST_CAPTURES) {
      expect(c.captured, c.month).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      // A capture two months early would be another month's page matched by mistake.
      const [y, m] = c.month.split("-").map(Number) as [number, number];
      const floor = m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, "0")}-01`;
      expect(c.captured >= floor, `${c.month} captured ${c.captured}`).toBe(true);
    }
    expect(releaseSummary(BULLETIN_FIRST_CAPTURES)).not.toBeNull();
  });
});
