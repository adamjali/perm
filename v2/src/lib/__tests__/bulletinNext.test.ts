import { describe, expect, it } from "vitest";
import type { BulletinMonth } from "@/lib/perm";
import {
  archiveFloorDays,
  monthsToReach,
  nextBulletinMonth,
  sameMonthMoves,
  summariseMoves,
  scenarioMonths,
} from "@/lib/bulletinNext";

function month(bulletinMonth: string, fa: Record<string, Record<string, string>>): BulletinMonth {
  return { bulletinMonth, finalAction: fa, datesForFiling: {} } as BulletinMonth;
}

// Four fiscal-year starts, deliberately mixed: a date advance, a hold, a
// retrogression, an opening from unavailable, and a category that is current.
const SERIES: BulletinMonth[] = [
  month("2023-09", { EB2: { india: "01JAN11", china: "U", worldwide: "C" } }),
  month("2023-10", { EB2: { india: "01JAN12", china: "01JAN19", worldwide: "C" } }),
  month("2024-09", { EB2: { india: "15MAR12", china: "01MAR20", worldwide: "C" } }),
  month("2024-10", { EB2: { india: "15MAR12", china: "22MAR20", worldwide: "C" } }),
  month("2025-09", { EB2: { india: "01JAN13", china: "01OCT20", worldwide: "C" } }),
  month("2025-10", { EB2: { india: "01OCT12", china: "01DEC20", worldwide: "01JAN24" } }),
  month("2026-09", { EB2: { india: "01FEB13", china: "01FEB21", worldwide: "C" } }),
];

describe("nextBulletinMonth", () => {
  it("rolls the calendar, including the year boundary", () => {
    expect(nextBulletinMonth("2026-09")).toBe("2026-10");
    expect(nextBulletinMonth("2026-12")).toBe("2027-01");
  });
});

describe("sameMonthMoves", () => {
  it("lists every October in the series with the September before it", () => {
    const moves = sameMonthMoves(SERIES, "finalAction", "EB2", "india", 10);
    expect(moves.map((m) => m.bulletinMonth)).toEqual(["2023-10", "2024-10", "2025-10"]);
  });

  it("measures a date-to-date move in days, signed", () => {
    const moves = sameMonthMoves(SERIES, "finalAction", "EB2", "india", 10);
    expect(moves[0]).toMatchObject({ kind: "advanced", movedDays: 365 });
    expect(moves[1]).toMatchObject({ kind: "held", movedDays: 0 });
    expect(moves[2]).toMatchObject({ kind: "retrogressed", movedDays: -92 });
  });

  it("names the non-date transitions instead of inventing a number", () => {
    const china = sameMonthMoves(SERIES, "finalAction", "EB2", "china", 10);
    expect(china[0]).toMatchObject({ kind: "opened", movedDays: null });
    const world = sameMonthMoves(SERIES, "finalAction", "EB2", "worldwide", 10);
    expect(world[0]).toMatchObject({ kind: "current", movedDays: null });
    expect(world[2]).toMatchObject({ kind: "retrogressed-from-current", movedDays: null });
  });

  it("skips a year whose September is missing rather than pairing across a gap", () => {
    const gappy = SERIES.filter((b) => b.bulletinMonth !== "2024-09");
    const moves = sameMonthMoves(gappy, "finalAction", "EB2", "india", 10);
    expect(moves.map((m) => m.bulletinMonth)).toEqual(["2023-10", "2025-10"]);
  });
});

describe("summariseMoves", () => {
  it("counts kinds and takes the median of the measured days only", () => {
    const s = summariseMoves(sameMonthMoves(SERIES, "finalAction", "EB2", "india", 10));
    expect(s).toMatchObject({ count: 3, advanced: 1, held: 1, retrogressed: 1, medianDays: 0, minDays: -92, maxDays: 365 });
  });

  it("has no median when nothing was a date-to-date move", () => {
    const s = summariseMoves(sameMonthMoves(SERIES, "finalAction", "EB2", "worldwide", 10));
    expect(s.medianDays).toBeNull();
    expect(s.count).toBe(3);
  });
});

describe("archiveFloorDays", () => {
  it("reports the day of the prior month each bulletin was first captured, ignoring captures after its own month starts", () => {
    const days = archiveFloorDays([
      { bulletinMonth: "2026-08", archivedAt: "2026-07-14T10:00:00Z" },
      { bulletinMonth: "2026-09", archivedAt: "2026-08-19T03:00:00Z" },
      { bulletinMonth: "2026-07", archivedAt: "2026-07-02T00:00:00Z" }, // captured late, no floor
      { bulletinMonth: "2026-06", archivedAt: null },
    ]);
    expect(days).toEqual([
      { bulletinMonth: "2026-08", day: 14 },
      { bulletinMonth: "2026-09", day: 19 },
    ]);
  });
});

describe("monthsToReach", () => {
  it("divides the gap by the measured pace and carries the basis", () => {
    const r = monthsToReach({ latest: { kind: "date", iso: "2013-02-01" }, movedDays: 365, spanMonths: 12, retrogressions: ["2025-10"] }, "2014-02-01");
    expect(r).toMatchObject({ months: 12, gapDays: 365, basis: { movedDays: 365, spanMonths: 12, retrogressions: 1 } });
  });

  it("withholds when the category is shut, current, or has not advanced", () => {
    expect(monthsToReach({ latest: { kind: "unavailable" }, movedDays: 365, spanMonths: 12, retrogressions: [] }, "2014-02-01")).toBeNull();
    expect(monthsToReach({ latest: { kind: "current" }, movedDays: 365, spanMonths: 12, retrogressions: [] }, "2014-02-01")).toBeNull();
    expect(monthsToReach({ latest: { kind: "date", iso: "2013-02-01" }, movedDays: 0, spanMonths: 12, retrogressions: [] }, "2014-02-01")).toBeNull();
  });

  it("says zero when the date is already behind the cutoff", () => {
    expect(monthsToReach({ latest: { kind: "date", iso: "2013-02-01" }, movedDays: 365, spanMonths: 12, retrogressions: [] }, "2012-01-01")).toMatchObject({ months: 0 });
  });
});

describe("scenarioMonths", () => {
  it("divides the queue ahead by a monthly share of the supply", () => {
    expect(scenarioMonths(5911, 7235)).toBeCloseTo(9.8, 1);
    expect(scenarioMonths(0, 2803)).toBe(0);
  });
  it("refuses a supply that is not a positive number", () => {
    expect(scenarioMonths(5911, 0)).toBeNull();
    expect(scenarioMonths(5911, -5)).toBeNull();
    expect(scenarioMonths(5911, Number.NaN)).toBeNull();
  });
});
