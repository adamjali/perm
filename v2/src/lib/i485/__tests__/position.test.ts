import { describe, expect, it } from "vitest";

import { certaintySplit, computeI485Position, pairKey } from "../position";
import { CELLS } from "./cells.fixture";

/**
 * `computeI485Position` is a second implementation of the rule
 * `getI485Position` states in SQL, so every expectation below was READ OUT OF
 * THAT QUERY against the live table rather than derived by hand. If the two
 * implementations ever drift, these go red.
 *
 * The fixture is the real cells for the eight pairs exercised here, as of
 * the 2026-08-05 release.
 */

/** Every expected figure here came from running the read layer's own SQL. */
const FROM_SQL = [
  {
    what: "a priority date near the front of India's EB2 backlog",
    country: "India", category: "EB2", pdYear: 2012, pdMonth: 6,
    counted: 184, suppressedCells: 49, low: 233, high: 674,
    latest: 2015, outsideCoverage: false, categoryCounted: 27736,
  },
  {
    what: "a date later than anything USCIS publishes for India EB2",
    country: "India", category: "EB2", pdYear: 2020, pdMonth: 1,
    counted: 27736, suppressedCells: 49, low: 27785, high: 28226,
    latest: 2015, outsideCoverage: true, categoryCounted: 27736,
  },
  {
    what: "a large span with negligible suppression",
    country: "Rest of the World", category: "EB2", pdYear: 2024, pdMonth: 6,
    counted: 16687, suppressedCells: 24, low: 16711, high: 16927,
    latest: 2026, outsideCoverage: false, categoryCounted: 41846,
  },
  {
    what: "a span where suppression dominates the counted figure",
    country: "China", category: "EB1", pdYear: 2019, pdMonth: 3,
    counted: 71, suppressedCells: 29, low: 100, high: 361,
    latest: 2023, outsideCoverage: false, categoryCounted: 6485,
  },
  {
    what: "the earliest offerable date in India's EB3 backlog",
    country: "India", category: "EB3", pdYear: 2006, pdMonth: 1,
    counted: 57, suppressedCells: 8, low: 65, high: 137,
    latest: 2015, outsideCoverage: false, categoryCounted: 15843,
  },
  {
    what: "a category USCIS publishes as nothing but suppressed cells",
    country: "Mexico", category: "EB5R", pdYear: 2026, pdMonth: 1,
    counted: 0, suppressedCells: 17, low: 17, high: 170,
    latest: 2026, outsideCoverage: false, categoryCounted: 0,
  },
  {
    what: "another all-suppressed category, on a different country",
    country: "Philippines", category: "CRW", pdYear: 2021, pdMonth: 5,
    counted: 0, suppressedCells: 4, low: 4, high: 40,
    latest: 2022, outsideCoverage: false, categoryCounted: 0,
  },
  {
    what: "a category whose entire published span is a single year",
    country: "China", category: "EW3", pdYear: 2017, pdMonth: 1,
    counted: 0, suppressedCells: 10, low: 10, high: 100,
    latest: 2017, outsideCoverage: false, categoryCounted: 0,
  },
] as const;

describe("computeI485Position", () => {
  it.each(FROM_SQL)(
    "matches the read layer's SQL for $what",
    ({ country, category, pdYear, pdMonth, ...expected }) => {
      const p = computeI485Position(CELLS, country, category, pdYear, pdMonth);
      expect(p).not.toBeNull();
      expect(p!.counted).toBe(expected.counted);
      expect(p!.suppressedCells).toBe(expected.suppressedCells);
      expect(p!.low).toBe(expected.low);
      expect(p!.high).toBe(expected.high);
      expect(p!.coverage.latest).toBe(expected.latest);
      expect(p!.outsideCoverage).toBe(expected.outsideCoverage);
      expect(p!.categoryCounted).toBe(expected.categoryCounted);
    },
  );

  it("counts a category holding no published figure as a range, never as zero", () => {
    // Seven of the 47 pairs publish nothing but suppressed cells. Reporting
    // `categoryCounted` as the category size would print a bare 0 over a
    // category that holds between 21 and 210 applications.
    const p = computeI485Position(CELLS, "Mexico", "EB5R", 2026, 1)!;
    expect(p.categoryCounted).toBe(0);
    expect(p.categorySuppressedCells).toBe(21);
    expect(p.categoryLow).toBe(21);
    expect(p.categoryHigh).toBe(210);
  });

  it("reports an exact figure where USCIS suppressed nothing", () => {
    // India EB1 has no suppressed cell anywhere in its span, so low and high
    // agree and the page owes the reader one number, not a range of one value
    // printed twice.
    const p = computeI485Position(CELLS, "India", "EB1", 2023, 1)!;
    expect(p.suppressedCells).toBe(0);
    expect(p.exact).toBe(true);
    expect(p.low).toBe(p.high);
  });

  it("treats the same month as behind, not ahead", () => {
    // "Ahead" is strictly earlier. A case is not in front of itself, and the
    // SQL's `pd_month < ?` says so.
    const may = computeI485Position(CELLS, "India", "EB2", 2012, 5)!;
    const jun = computeI485Position(CELLS, "India", "EB2", 2012, 6)!;
    expect(jun.counted).toBeGreaterThanOrEqual(may.counted);
    const mayCell = CELLS[pairKey("India", "EB2")]!.find(([y, m]) => y === 2012 && m === 5);
    expect(jun.counted - may.counted).toBe(mayCell ? mayCell[2] : 0);
  });

  it("counts the Prior Years column ahead of every real priority date", () => {
    // USCIS's "Prior Years" bucket is encoded as year 0 so that it sorts
    // ahead of every real year. Asserted as an EQUALITY, not a lower bound:
    // the first version of this test allowed >= and so stayed green when the
    // prior bucket was dropped entirely. At the earliest date the form
    // offers for India EB3, the prior column IS the whole answer.
    const rows = CELLS[pairKey("India", "EB3")]!;
    const prior = rows.filter(([y]) => y === 0);
    const priorCounted = prior.reduce((n, [, , c]) => n + c, 0);
    const priorSuppressed = prior.reduce((n, [, , , s]) => n + s, 0);
    expect(priorSuppressed).toBeGreaterThan(0);

    const p = computeI485Position(CELLS, "India", "EB3", 2006, 1)!;
    expect(p.counted).toBe(priorCounted);
    expect(p.suppressedCells).toBe(priorSuppressed);
  });

  it("flags a date past the last published MONTH, which the year test misses", () => {
    // India EB2's last published cell is 2015-01, so every month of 2015 from
    // February on returns the entire category total (27,736 counted) with the
    // read layer's year-level `outsideCoverage` reading false. Printing that
    // as an ordinary position is exactly the "silently return the total as
    // though it were precise" failure. 33 of the 47 pairs stop before
    // December, so this is the common case and not an edge.
    const p = computeI485Position(CELLS, "India", "EB2", 2015, 6)!;
    expect(p.counted).toBe(27736);
    expect(p.counted).toBe(p.categoryCounted);
    expect(p.outsideCoverage).toBe(false);
    expect(p.beyondPublished).toBe(true);
    expect(p.latestPublished).toEqual([2015, 1]);
  });

  it("does not flag a date inside the published span", () => {
    const p = computeI485Position(CELLS, "India", "EB2", 2015, 1)!;
    expect(p.counted).toBe(26737);
    expect(p.beyondPublished).toBe(false);
  });

  it("finds the latest published cell whatever order the rows arrive in", () => {
    // Order independence matters because the shape is a plain array and
    // nothing in the type enforces the SQL's ORDER BY.
    const forward = computeI485Position(CELLS, "India", "EB2", 2020, 1)!;
    const shuffled = computeI485Position(
      { "India|EB2": [...CELLS[pairKey("India", "EB2")]!].reverse() },
      "India", "EB2", 2020, 1,
    )!;
    expect(shuffled.latestPublished).toEqual(forward.latestPublished);
    expect(shuffled.counted).toBe(forward.counted);
  });

  it("returns null for a pair the release does not carry", () => {
    // The deploy-skew window, not a bad selection: the form builds its
    // options from the same release this table came from.
    expect(computeI485Position(CELLS, "India", "EB4", 2020, 1)).toBeNull();
    expect(computeI485Position(CELLS, "Atlantis", "EB2", 2020, 1)).toBeNull();
  });
});

describe("certaintySplit", () => {
  it("gives the whole bar to the counted floor when nothing is suppressed", () => {
    const p = computeI485Position(CELLS, "India", "EB1", 2023, 1)!;
    expect(certaintySplit(p)).toEqual({ solid: 100, hatched: 0 });
  });

  it("bottoms out at one tenth solid when everything is suppressed", () => {
    // low = s, high = 10s, so the floor is a tenth of the ceiling however
    // many cells were withheld. The segment can never vanish by accident.
    const p = computeI485Position(CELLS, "Mexico", "EB5R", 2026, 1)!;
    expect(certaintySplit(p).solid).toBeCloseTo(10, 6);
  });

  it("lets a genuinely negligible span disappear", () => {
    // 24 suppressed cells against 16,687 counted is half a percent of the
    // bar. That it renders as nothing is the finding, not a bug.
    const p = computeI485Position(CELLS, "Rest of the World", "EB2", 2024, 6)!;
    expect(certaintySplit(p).hatched).toBeLessThan(1.5);
  });

  it("never returns a segment outside the bar", () => {
    for (const key of Object.keys(CELLS)) {
      const [country, category] = key.split("|") as [string, string];
      const p = computeI485Position(CELLS, country, category, 2026, 12)!;
      const { solid, hatched } = certaintySplit(p);
      expect(solid).toBeGreaterThanOrEqual(0);
      expect(hatched).toBeGreaterThanOrEqual(0);
      expect(solid + hatched).toBeCloseTo(100, 6);
    }
  });
});
