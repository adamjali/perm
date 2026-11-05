import { describe, expect, it } from "vitest";

import {
  buckets,
  dayHref,
  fillDays,
  parseFilingsDoc,
  periodTotal,
  shiftDay,
  shortDay,
  shortMonth,
  usualFor,
  weekStart,
  type FilingDay,
} from "../filingsByDay";

const doc = (programs: unknown) => JSON.stringify({ asOf: "2026-11-05", computedAt: 1793887134000, from: "2019-10-01", programs });

describe("the filings document", () => {
  it("reads each program's days in order, and a program it lacks as no days", () => {
    const d = parseFilingsDoc(doc({ perm: { days: [["2026-11-05", 39, 39, 0, 0], ["2026-11-04", 331, 326, 2, 1]], liveFrom: "2023-06-01" } }));
    expect(d?.programs.perm.days.map((x) => x.day)).toEqual(["2026-11-04", "2026-11-05"]);
    expect(d?.programs.perm.days[0]).toEqual({ day: "2026-11-04", filed: 331, waiting: 326, fileOnly: 2, mismatch: 1 });
    expect(d?.programs.perm.liveFrom).toBe("2023-06-01");
    expect(d?.programs.lca.days).toEqual([]);
  });

  it("never reads a broken document as a day with no filings", () => {
    expect(parseFilingsDoc(null)).toBeNull();
    expect(parseFilingsDoc("{not json")).toBeNull();
    expect(parseFilingsDoc(JSON.stringify({ programs: {} }))).toBeNull();
  });

  it("drops a row it can't read and a count below zero", () => {
    const d = parseFilingsDoc(doc({ pwd: { days: [["bad", 1], ["2026-11-01", -4, "x", 2, 0]] } }));
    expect(d?.programs.pwd.days).toEqual([{ day: "2026-11-01", filed: 0, waiting: 0, fileOnly: 2, mismatch: 0 }]);
  });
});

const days: FilingDay[] = [
  { day: "2026-10-26", filed: 400, waiting: 390, fileOnly: 0, mismatch: 1 },
  { day: "2026-11-02", filed: 380, waiting: 370, fileOnly: 0, mismatch: 0 },
  { day: "2026-11-03", filed: 353, waiting: 349, fileOnly: 0, mismatch: 0 },
  { day: "2026-11-04", filed: 331, waiting: 326, fileOnly: 5, mismatch: 2 },
];

describe("periods and days", () => {
  it("sums a period, both ends included", () => {
    expect(periodTotal(days, "2026-11-02", "2026-11-04")).toEqual({
      from: "2026-11-02", to: "2026-11-04", filed: 1064, waiting: 1045, fileOnly: 5, mismatch: 2, days: 3,
    });
    expect(periodTotal(days, "2026-12-01", "2026-12-31").filed).toBe(0);
  });

  it("fills every day of a period, a quiet day as zero", () => {
    const f = fillDays(days, "2026-11-01", "2026-11-04");
    expect(f.map((d) => [d.day, d.filed])).toEqual([["2026-11-01", 0], ["2026-11-02", 380], ["2026-11-03", 353], ["2026-11-04", 331]]);
  });

  it("moves across a month's end and a year's", () => {
    expect(shiftDay("2026-10-31", 1)).toBe("2026-11-01");
    expect(shiftDay("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("sets a day against the same weekday, and says nothing with too few", () => {
    const mondays: FilingDay[] = [1, 2, 3, 4, 5].map((k) => ({ day: shiftDay("2026-11-02", -7 * k), filed: 300 + k * 10, waiting: 0, fileOnly: 0, mismatch: 0 }));
    expect(usualFor(mondays, "2026-11-02")).toBe(330);
    expect(usualFor(mondays.slice(0, 3), "2026-11-02")).toBeNull();
    expect(usualFor(mondays, "2026-11-03")).toBeNull();
  });

  it("links a day's page, opened on a program", () => {
    expect(dayHref("2026-11-04")).toBe("/perm-queue/2026-11/04");
    expect(dayHref("2026-11-04", "lca")).toBe("/perm-queue/2026-11/04?kind=lca");
  });
});

describe("chart columns", () => {
  it("draws a day each for two months, a week each for two years, a month beyond", () => {
    expect(buckets(days, "2026-10-06", "2026-11-04", "2026-11-05").unit).toBe("day");
    expect(buckets(days, "2025-11-05", "2026-11-04", "2026-11-05").unit).toBe("week");
    expect(buckets(days, "2022-01-01", "2026-11-04", "2026-11-05").unit).toBe("month");
  });

  it("sums a week from its Monday and keeps a week's columns inside the period", () => {
    const { rows } = buckets(days, "2026-08-01", "2026-11-04", "2026-11-05");
    const wk = rows.find((r) => r.key === "2026-11-02");
    expect(wk).toMatchObject({ from: "2026-11-02", to: "2026-11-04", filed: 1064, partial: true });
    expect(rows[0].from).toBe("2026-08-01");
    expect(rows.find((r) => r.key === "2026-10-26")).toMatchObject({ filed: 400, partial: false });
  });

  it("marks only today's day column as filling", () => {
    const { rows } = buckets(days, "2026-11-03", "2026-11-05", "2026-11-05");
    expect(rows.map((r) => r.partial)).toEqual([false, false, true]);
  });

  it("writes short labels and finds a week's Monday", () => {
    expect(shortDay("2026-11-04")).toBe("Nov 4");
    expect(shortMonth("2026-11-04")).toBe("Nov 2026");
    expect(weekStart("2026-11-08")).toBe("2026-11-02");
    expect(weekStart("2026-11-02")).toBe("2026-11-02");
  });
});
