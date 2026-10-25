import { describe, expect, it } from "vitest";

import {
  bulletinCalendar,
  bulletinTally,
  daysBefore,
  foldSpellings,
  mondayOf,
  rankEmployers,
  weeklyCounts,
} from "@/lib/byTheNumbers";

describe("foldSpellings", () => {
  it("folds case and spacing into one value and shows the spelling filed most", () => {
    // Arrange
    const rows = [
      { value: "SOFTWARE ENGINEER", slug: "a", n: 3 },
      { value: "Software Engineer", slug: "b", n: 5 },
      { value: " software  engineer ", slug: "a", n: 1 },
      { value: "CREW MEMBER", slug: "c", n: 4 },
    ];
    // Act
    const out = foldSpellings(rows, 10);
    // Assert
    expect(out[0]).toEqual({ label: "Software Engineer", cases: 9, employers: 2, slug: null });
    expect(out[1]).toEqual({ label: "CREW MEMBER", cases: 4, employers: 1, slug: "c" });
  });

  it("drops blank values and keeps only the largest few", () => {
    const rows = [
      { value: null, slug: "a", n: 50 },
      { value: "  ", slug: "a", n: 40 },
      { value: "A", slug: "a", n: 3 },
      { value: "B", slug: "a", n: 2 },
      { value: "C", slug: "a", n: 1 },
    ];
    const out = foldSpellings(rows, 2);
    expect(out.map((v) => v.label)).toEqual(["A", "B"]);
  });

  it("breaks a tie between spellings the same way every time", () => {
    const one = foldSpellings([{ value: "Nurse", slug: "a", n: 2 }, { value: "NURSE", slug: "b", n: 2 }], 1);
    const two = foldSpellings([{ value: "NURSE", slug: "b", n: 2 }, { value: "Nurse", slug: "a", n: 2 }], 1);
    expect(one[0]!.label).toBe(two[0]!.label);
  });
});

describe("rankEmployers", () => {
  it("sums each slug's cases, names it by its commonest spelling and leaves out rows without a slug", () => {
    const out = rankEmployers(
      [
        { slug: "goldman", name: "Goldman Sachs & Co. LLC", n: 100 },
        { slug: "goldman", name: "GOLDMAN SACHS & CO. LLC", n: 55 },
        { slug: null, name: "No page", n: 500 },
        { slug: "tesla", name: "Tesla, Inc.", n: 60 },
      ],
      5,
    );
    expect(out).toEqual([
      { label: "Goldman Sachs & Co. LLC", cases: 155, employers: 1, slug: "goldman" },
      { label: "Tesla, Inc.", cases: 60, employers: 1, slug: "tesla" },
    ]);
  });
});

describe("weeks", () => {
  it("finds the Monday on or before a day", () => {
    expect(mondayOf("2026-10-25")).toBe("2026-10-19"); // a Sunday
    expect(mondayOf("2026-10-19")).toBe("2026-10-19"); // a Monday
    expect(mondayOf("2026-10-21")).toBe("2026-10-19");
  });

  it("starts on the first whole week, fills empty weeks with 0 and marks the last one partial", () => {
    // Arrange: the record starts on a Thursday, so that week isn't drawn.
    const days = [
      { date: "2026-07-02", count: 99 },
      { date: "2026-07-06", count: 3 },
      { date: "2026-07-12", count: 2 },
      { date: "2026-07-21", count: 4 },
    ];
    // Act
    const weeks = weeklyCounts(days, "2026-07-02", "2026-07-22");
    // Assert
    expect(weeks).toEqual([
      { week: "2026-07-06", count: 5, partial: false },
      { week: "2026-07-13", count: 0, partial: false },
      { week: "2026-07-20", count: 4, partial: true },
    ]);
  });

  it("keeps a whole week whole when the record starts on its Monday", () => {
    const weeks = weeklyCounts([{ date: "2026-07-06", count: 1 }], "2026-07-06", "2026-07-12");
    expect(weeks).toEqual([{ week: "2026-07-06", count: 1, partial: false }]);
  });

  it("never counts a day after the last one", () => {
    const weeks = weeklyCounts([{ date: "2026-07-08", count: 7 }, { date: "2026-07-09", count: 5 }], "2026-07-06", "2026-07-08");
    expect(weeks[0]!.count).toBe(7);
  });

  it("counts back days across a month end", () => {
    expect(daysBefore("2026-10-25", 29)).toBe("2026-09-26");
    expect(daysBefore("2026-06-30", -1)).toBe("2026-07-01");
  });
});

describe("bulletinCalendar", () => {
  it("draws every year in the span, marks missing months and leaves months outside it out", () => {
    // Arrange
    const held = ["2005-06", "2005-08", "2006-01-01", "2006-02"];
    // Act
    const years = bulletinCalendar(held);
    // Assert
    expect(years.map((y) => y.year)).toEqual([2005, 2006]);
    expect(years[0]!.months.slice(0, 5)).toEqual([null, null, null, null, null]);
    expect(years[0]!.months.slice(5, 8)).toEqual([true, false, true]);
    expect(years[1]!.months.slice(0, 3)).toEqual([true, true, null]);
    expect(bulletinTally(years)).toEqual({ held: 4, missing: 5 }); // Jul, then Sep to Dec 2005
  });

  it("is empty for an empty archive", () => {
    expect(bulletinCalendar([])).toEqual([]);
  });
});
