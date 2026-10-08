import { describe, expect, it } from "vitest";

import { parseRfiClock } from "../rfiClockDoc";

const DOC = JSON.stringify({
  end: "2026-10-07",
  rfiClock: {
    watched: 1021,
    leaveDays: { p25: 31, p50: 31, p75: 31 },
    afterLeaveDays: { p25: 2, p50: 4, p75: 7, p90: null },
    afterLeaveWatched: 259,
    slowEndDays: 14,
    slowEndFrom: "an immigration attorney's estimate",
    test: null,
    watchedFrom: "2026-08-27",
  },
});

describe("parseRfiClock", () => {
  it("reads the clock the backtest wrote", () => {
    expect(parseRfiClock(DOC)).toEqual({
      leaveDays: { p25: 31, p50: 31, p75: 31 },
      afterLeaveDays: { p25: 2, p50: 4, p75: 7, p90: null },
      slowEndDays: 14,
      slowEndFrom: "an immigration attorney's estimate",
      watched: 1021,
      watchedFrom: "2026-08-27",
      test: null,
    });
  });

  it("gives nothing without the medians, the slow end or the record's first day", () => {
    const d = JSON.parse(DOC);
    for (const strip of [["leaveDays", "p50"], ["afterLeaveDays", "p50"]]) {
      const x = JSON.parse(DOC);
      delete x.rfiClock[strip[0]!][strip[1]!];
      expect(parseRfiClock(JSON.stringify(x))).toBeNull();
    }
    delete d.rfiClock.watchedFrom;
    expect(parseRfiClock(JSON.stringify(d))).toBeNull();
    expect(parseRfiClock("{")).toBeNull();
    expect(parseRfiClock(JSON.stringify({ end: "2026-10-07" }))).toBeNull();
  });
});
