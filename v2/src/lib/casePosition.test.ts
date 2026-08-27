import { describe, expect, it } from "vitest";

import type { CohortMonth } from "./liveQueue";
import {
  buildWall,
  canQuoteCohortDuration,
  cohortMaturity,
  daysElapsed,
  neighbourMonths,
  statusCheckAge,
} from "./casePosition";

/**
 * The arithmetic behind "where am I", pinned.
 *
 * Every number this file produces lands next to a real person's own case
 * number, which is exactly the context in which a plausible wrong figure does
 * the most damage: it looks tailored, so it gets believed.
 */

function m(month: string, total: number, decided: number): CohortMonth {
  return {
    month,
    total,
    pending: total - decided,
    decided,
    decidedPct: total > 0 ? (decided / total) * 100 : null,
  };
}

/** A miniature of the real shape: a cleared tail, a front, then a wall. */
const MONTHS: CohortMonth[] = [
  m("2025-07", 9_890, 9_533), //  357 pending, 96% done
  m("2025-08", 9_677, 8_954), //  723 pending, 93% done
  m("2025-09", 13_629, 11_539), // 2,090 pending, 85% done - the front
  m("2025-10", 1_616, 355), // 1,261 pending - the shutdown month
  m("2025-11", 15_034, 567), // 14,467 pending
  m("2025-12", 14_888, 432), // 14,456 pending
  m("2026-01", 11_094, 310), // 10,784 pending
];

describe("buildWall", () => {
  it("spans the front through the subject's own month, inclusive", () => {
    const wall = buildWall(MONTHS, "2025-12");
    expect(wall).not.toBeNull();
    expect(wall!.segments.map((s) => s.month)).toEqual([
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
    ]);
  });

  it("counts only STRICTLY earlier months as ahead", () => {
    const wall = buildWall(MONTHS, "2025-12")!;
    // Every pending case filed earlier, INCLUDING the 357 and 723 still open
    // in months DOL has otherwise finished. Those are real undecided cases
    // filed before this one, and both `deriveQueueAhead` and the read layer's
    // `aheadOfMonth` count them the same way - one definition, three places.
    expect(wall.ahead).toBe(357 + 723 + 2_090 + 1_261 + 14_467);
    // The subject's own 14,456 is BESIDE it, not in front of it. Folding the
    // two together would overstate the wait by a full month of filings.
    expect(wall.sameMonth).toBe(14_456);
  });

  it("separates what is drawn from what is ahead, because they differ", () => {
    const wall = buildWall(MONTHS, "2025-12")!;
    // The drawing starts at the front, so it holds less than `ahead`. A
    // reader who adds up the segments must not find a number that disagrees
    // with the headline and no explanation for the gap.
    expect(wall.drawnAhead).toBe(2_090 + 1_261 + 14_467);
    expect(wall.ahead - wall.drawnAhead).toBe(1_080);
  });

  it("marks the subject and the front, and never the same segment twice", () => {
    const wall = buildWall(MONTHS, "2025-12")!;
    expect(wall.segments.filter((s) => s.isSubject).map((s) => s.month)).toEqual([
      "2025-12",
    ]);
    expect(wall.segments.filter((s) => s.isFront).map((s) => s.month)).toEqual([
      "2025-09",
    ]);
  });

  it("gives every segment a share of the drawn total that sums to 100", () => {
    const wall = buildWall(MONTHS, "2026-01")!;
    const sum = wall.segments.reduce((n, s) => n + s.share, 0);
    expect(sum).toBeCloseTo(100, 6);
  });

  it("reports how far behind the front the subject sits", () => {
    expect(buildWall(MONTHS, "2025-12")!.monthsBehindFront).toBe(3);
    expect(buildWall(MONTHS, "2025-09")!.monthsBehindFront).toBe(0);
  });

  it("handles a straggler: a case older than the front DOL is working", () => {
    // 2025-07 is 96% decided, so DOL has moved past it. A case still open
    // there is out of filing order, and reporting "-2 months behind" or an
    // inverted wall would be nonsense.
    const wall = buildWall(MONTHS, "2025-07")!;
    expect(wall.monthsBehindFront).toBe(-2);
    expect(wall.isPastFront).toBe(true);
    // Only the subject's own month is drawn: there is no wall in front.
    expect(wall.segments.map((s) => s.month)).toEqual(["2025-07"]);
    expect(wall.ahead).toBe(0);
  });

  it("returns null when the subject's month is not in the series at all", () => {
    expect(buildWall(MONTHS, "2027-04")).toBeNull();
  });

  it("returns null for an empty series rather than an empty drawing", () => {
    expect(buildWall([], "2025-12")).toBeNull();
  });

  it("survives a series with no locatable front", () => {
    // Everything finished: findFront returns null, so there is no wall to
    // draw and the caller must be told, not handed zeroes.
    const done = [m("2024-01", 5_000, 5_000), m("2024-02", 5_000, 5_000)];
    expect(buildWall(done, "2024-02")).toBeNull();
  });
});

describe("cohortMaturity", () => {
  it("calls a nearly-finished month mature", () => {
    expect(cohortMaturity(m("2024-06", 13_985, 13_984))).toBe("mature");
  });

  it("calls the month DOL is chewing through working", () => {
    expect(cohortMaturity(m("2025-09", 13_629, 11_539))).toBe("working");
  });

  it("calls a barely-touched month untouched", () => {
    // 3.3% decided. Its decided cases are almost entirely instant
    // withdrawals, so any duration computed from them is a fiction - this
    // is the guard that keeps a 1-day median off the page.
    expect(cohortMaturity(m("2026-05", 8_172, 273))).toBe("untouched");
  });

  it("refuses to judge a month too small to judge", () => {
    expect(cohortMaturity(m("2025-10", 40, 30))).toBe("unknown");
  });

  it("refuses to judge a month with no percentage", () => {
    expect(cohortMaturity(m("2026-09", 0, 0))).toBe("unknown");
  });
});

describe("canQuoteCohortDuration", () => {
  // Every pair below is a real measurement off the live tables: the count in
  // DOL's decided files against the mirror's total for that filing month.
  it("clears a month the disclosure files hold in full", () => {
    expect(canQuoteCohortDuration(14_083, 13_985)).toBe(true); // 2024-06
    expect(canQuoteCohortDuration(6_509, 6_534)).toBe(true); // 2025-01
  });

  it("refuses September 2025, which the mirror calls 85% decided", () => {
    // The trap this guard exists for. The mirror says the month is nearly
    // finished; the disclosure files hold 527 of its 13,629 cases, and their
    // median is 56 days against a cohort that runs past 400. Maturity alone
    // would have published that.
    expect(cohortMaturity(m("2025-09", 13_629, 11_539))).toBe("working");
    expect(canQuoteCohortDuration(527, 13_629)).toBe(false);
  });

  it("refuses a young cohort whose only decided cases are instant exits", () => {
    expect(canQuoteCohortDuration(291, 8_172)).toBe(false); // 2026-05, median 5 days
    expect(canQuoteCohortDuration(248, 10_186)).toBe(false); // 2026-06, median 1 day
  });

  it("refuses rather than dividing by zero", () => {
    expect(canQuoteCohortDuration(0, 0)).toBe(false);
    expect(canQuoteCohortDuration(100, 0)).toBe(false);
  });
});

describe("neighbourMonths", () => {
  it("returns the subject flanked by its neighbours, oldest first", () => {
    expect(neighbourMonths(MONTHS, "2025-11", 1).map((x) => x.month)).toEqual([
      "2025-10",
      "2025-11",
      "2025-12",
    ]);
  });

  it("clips at the ends of the series instead of inventing months", () => {
    expect(neighbourMonths(MONTHS, "2025-07", 2).map((x) => x.month)).toEqual([
      "2025-07",
      "2025-08",
      "2025-09",
    ]);
  });

  it("returns nothing when the subject is absent", () => {
    expect(neighbourMonths(MONTHS, "2030-01", 2)).toEqual([]);
  });
});

describe("daysElapsed", () => {
  it("counts whole days between two ISO dates", () => {
    expect(daysElapsed("2026-05-05", "2026-08-27")).toBe(114);
  });

  it("is zero on the day itself, never negative by rounding", () => {
    expect(daysElapsed("2026-08-27", "2026-08-27")).toBe(0);
  });

  it("returns null rather than NaN for anything unparseable", () => {
    expect(daysElapsed(null, "2026-08-27")).toBeNull();
    expect(daysElapsed("2026-05", "2026-08-27")).toBeNull();
    expect(daysElapsed("not a date", "2026-08-27")).toBeNull();
  });
});

describe("statusCheckAge", () => {
  it("reads a FLAG timestamp and returns its age in days", () => {
    expect(statusCheckAge("2026-08-05T22:31:24", "2026-08-27")).toEqual({
      date: "2026-08-05",
      ageDays: 22,
      stale: true,
    });
  });

  it("accepts a bare date as well as a timestamp", () => {
    expect(statusCheckAge("2026-08-25", "2026-08-27")?.ageDays).toBe(2);
  });

  it("does not call a recent check stale", () => {
    expect(statusCheckAge("2026-08-25", "2026-08-27")?.stale).toBe(false);
  });

  it("returns null when the mirror never recorded a check", () => {
    // 11,955 pending cases carry no timestamp. Rendering "checked never
    // days ago" or silently implying today would both be worse than saying
    // we do not know.
    expect(statusCheckAge(null, "2026-08-27")).toBeNull();
    expect(statusCheckAge("", "2026-08-27")).toBeNull();
  });
});
