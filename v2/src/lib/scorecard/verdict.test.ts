import { describe, expect, it } from "vitest";

import type { Cell, HeadToHead, Horizon } from "./score";
import {
  chanceOfSplit,
  chanceWords,
  letterFor,
  parseSupplyDivision,
  readMethods,
  readOurs,
  readRival,
  readSupplyDivision,
  settlesFrom,
} from "./verdict";

const h2h = (over: Partial<HeadToHead>): HeadToHead => ({
  shared: 203,
  decided: 13,
  oursTypicalDays: 6,
  rivalTypicalDays: 1,
  oursCloser: 4,
  rivalCloser: 8,
  ties: 1,
  settledWhileWaiting: 0,
  oursLateWaiting: 0,
  rivalLateWaiting: 18,
  ...over,
});

const cell = (over: Partial<Cell>): Cell => ({
  recorded: 483,
  graded: 33,
  typicalMissDays: 6,
  biasDays: -6,
  inBandShare: 0.43,
  within14Share: 0.79,
  settled: 0,
  settledHitShare: null,
  overdue: 6,
  overdueDays: 5,
  missAtLeastDays: 6,
  biasAtLeastDays: -6,
  ...over,
});

const empty = cell({ recorded: 0, graded: 0, typicalMissDays: null, biasDays: null, inBandShare: null });

describe("chanceOfSplit", () => {
  it("is the two-sided sign test", () => {
    // 8 of 12: (495 + 220 + 66 + 12 + 1) / 4096, doubled.
    expect(chanceOfSplit(4, 8)).toBeCloseTo((2 * 794) / 4096, 6);
    expect(chanceOfSplit(11, 0)).toBeCloseTo(2 / 2048, 6);
    expect(chanceOfSplit(5, 5)).toBe(1);
    expect(chanceOfSplit(0, 0)).toBeNull();
  });

  it("stays finite on a long-running scorecard", () => {
    const p = chanceOfSplit(1200, 1000);
    expect(p).not.toBeNull();
    expect(p!).toBeGreaterThan(0);
    expect(p!).toBeLessThan(0.001);
  });
});

describe("chanceWords", () => {
  it("says a chance in words", () => {
    expect(chanceWords(0.388)).toBe("about 4 times in 10");
    expect(chanceWords(0.05)).toBe("about 1 time in 20");
    expect(chanceWords(0.0098)).toBe("about 1 time in 100");
    expect(chanceWords(0.0002)).toBe("less than 1 time in 1,000");
    expect(chanceWords(1)).toBe("almost always");
  });
});

describe("readRival", () => {
  it("calls a small lead a lead, not a win, and names what grading the decided hides", () => {
    const r = readRival("rival-a", h2h({}));
    expect(r.leader).toBe("rival");
    expect(r.clear).toBe(false);
    expect(r.headline).toBe("Rival A leads so far, not clearly yet");
    const text = r.points.join(" ");
    expect(text).toContain("we were closer on 4, Rival A on 8, 1 tied");
    expect(text).toContain("us 6 days, Rival A 1 day");
    expect(text).toContain("8 to 4 could still be luck");
    expect(text).toContain("Rival A has 18 dates on these cases already passed with no decision, against none of ours");
    expect(text).toContain("so its lead can shrink");
  });

  it("calls a lopsided split clear", () => {
    const r = readRival("rival-b", h2h({ oursCloser: 11, rivalCloser: 0, ties: 2, rivalTypicalDays: 15, rivalLateWaiting: 0 }));
    expect(r.leader).toBe("ours");
    expect(r.clear).toBe(true);
    expect(r.headline).toBe("We're ahead of Rival B");
    expect(r.points.join(" ")).toContain("11 to 0 is unlikely to be luck");
    expect(r.points.join(" ")).not.toContain("already passed");
  });

  it("says when our own late dates flatter us", () => {
    const r = readRival("rival-c", h2h({ oursCloser: 8, rivalCloser: 5, oursLateWaiting: 6, rivalLateWaiting: 1 }));
    expect(r.points.join(" ")).toContain("We have 6 dates on these cases already passed with no decision, against 1 of Rival C's");
    expect(r.points.join(" ")).toContain("so our lead can shrink");
  });

  it("has nothing to say before DOL decides a shared case", () => {
    const r = readRival("rival-a", h2h({ decided: 0, oursCloser: 0, rivalCloser: 0, ties: 0, oursTypicalDays: null, rivalTypicalDays: null }));
    expect(r.leader).toBe("none");
    expect(r.headline).toBe("Nothing to compare with Rival A yet");
  });

  it("reads a doc written before the late-and-waiting counts existed", () => {
    const old = h2h({});
    delete old.oursLateWaiting;
    delete old.rivalLateWaiting;
    expect(readRival("rival-a", old).points.join(" ")).not.toContain("already passed");
  });
});

describe("readOurs", () => {
  const horizons = (near: number, far: number): Record<Horizon, Cell> => ({
    "0-30": cell({ graded: near }),
    "31-90": cell({ graded: far }),
    "91-180": empty,
    "181+": empty,
  });
  const backtest = {
    t0: "2026-09-14",
    end: "2026-10-04",
    current: { decided: 11473, typicalMissDays: 4, biasDays: -4, within7Share: 0.781 },
    rangeCoverage: { judged: 8023, insideShare: 0.287 },
  };

  it("leads with the backtest and says both checks lean the same way", () => {
    const out = readOurs(cell({}), horizons(31, 2), "2026-09-26", backtest);
    expect(out[0]).toBe("On 11,473 real DOL decisions (the weekly backtest), our dates were typically 4 days off, and 78% landed within a week.");
    expect(out[1]).toContain("Both checks say our dates run late");
    expect(out.join(" ")).toContain("Only 29% of 8,023 decisions landed inside the range");
    expect(out.join(" ")).toContain("31 of our 33 grades are for dates within a month; 2 are further out");
    expect(out.join(" ")).toContain("begins about October 27");
  });

  it("says nothing about a lean under two days, or from a handful of grades", () => {
    expect(readOurs(cell({ biasDays: -1 }), null, null, null).join(" ")).not.toContain("run late");
    expect(readOurs(cell({ graded: 4 }), null, null, null).join(" ")).not.toContain("run late");
  });

  it("drops the fair-test date once predictions have settled", () => {
    expect(readOurs(cell({ settled: 12 }), null, "2026-09-26", null).join(" ")).not.toContain("fair test");
  });
});

describe("letterFor and settlesFrom", () => {
  it("grades on the printed scale", () => {
    expect([1, 3, 4, 7, 8, 14, 15, 30, 31].map(letterFor)).toEqual(["A", "A", "B", "B", "C", "C", "D", "D", "F"]);
    expect(letterFor(null)).toBeNull();
  });

  it("puts the first settled day a month and a day after the first recording", () => {
    expect(settlesFrom("2026-09-26")).toBe("2026-10-27");
  });
});

describe("readMethods", () => {
  it("names each method, busiest first, with its misses and lean", () => {
    const out = readMethods({
      "decision-pace": cell({ graded: 11, typicalMissDays: 4, biasDays: -4, within14Share: 1 }),
      "dol-average": cell({ graded: 19, typicalMissDays: 6, biasDays: -6, within14Share: 12 / 19 }),
      stragglers: cell({ graded: 2, typicalMissDays: 7 }),
    });
    expect(out).toHaveLength(2);
    expect(out[0]).toBe(
      "DOL's published average, which the case page shows for cases DOL's queue has just passed: 19 graded, typically 6 days off, 7 more than two weeks off, and its dates run late.",
    );
    expect(out[1]).toBe("Our main method (cases ahead of yours, at DOL's measured pace): 11 graded, typically 4 days off, and its dates run late.");
  });
});

describe("readSupplyDivision", () => {
  const gap = (pace: number, supply: number, tie = 0) => ({
    pace: { reached: pace + supply + tie, readers: 136, typicalMissMonths: 1.3, stillWaitingPastEstimate: 43 },
    supply: { reached: pace + supply + tie, typicalMissMonths: 5.1, stillWaitingPastEstimate: 17 },
    closerWhenReached: { pace, supply, tie },
  });
  const doc = (byGap: Record<string, ReturnType<typeof gap>>) =>
    JSON.stringify({ byGap: {}, supplyDivision: { tableVYear: 2024, inventoryReports: ["2025-12-03", "2026-08-05"], byGap } });

  it("says who was closer, whether it could be luck, and what is still waiting", () => {
    const lines = readSupplyDivision(parseSupplyDivision(doc({ "90": gap(66, 8) })));
    expect(lines[0]).toContain("2 inventory reports since 2025-12-03");
    expect(lines[0]).toContain("robots.txt");
    expect(lines[1]).toContain("the pace was closer on 66, the division on 8");
    expect(lines[1]).toContain("unlikely to be luck");
    expect(lines[1]).toContain("43 by the pace, 17 by the division");
  });

  it("calls a close split possible luck, and a gap with nothing current says so", () => {
    const lines = readSupplyDivision(parseSupplyDivision(doc({ "180": gap(5, 4), "365": gap(0, 0) })));
    expect(lines.find((l) => l.startsWith("Dates 6 months"))).toContain("could still be luck");
    expect(lines.find((l) => l.startsWith("Dates a year"))).toBe("Dates a year past the cutoff: none has come current yet.");
  });

  it("reads nothing from a doc without the comparison, or one that isn't JSON", () => {
    expect(readSupplyDivision(parseSupplyDivision(JSON.stringify({ byGap: {} })))).toEqual([]);
    expect(readSupplyDivision(parseSupplyDivision("not json"))).toEqual([]);
    expect(readSupplyDivision(parseSupplyDivision(null))).toEqual([]);
  });
});
