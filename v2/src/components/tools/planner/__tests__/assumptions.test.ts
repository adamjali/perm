import { describe, expect, it } from "vitest";

import type { PlanBase } from "@/lib/db/planFigures";
import type { PlanAnswer } from "@/lib/planQuery";

import { baseSpan, changedCount, figuresFor, missFrom, NO_OVERRIDES, withTrack } from "../assumptions";

const SPAN = { low: 1, mid: 2, high: 3 };
const BASE: PlanBase = {
  spans: { pwd: SPAN, recruitment: SPAN, perm: SPAN, i140Prep: SPAN, i140: { EB2: SPAN, EB3: { low: 4, mid: 5, high: 6 } }, i485: SPAN, ead: SPAN, ap: SPAN },
  pace: {},
  bulletinMonth: "2026-11",
};
const ANSWER: PlanAnswer = {
  pwd: { low: "2026-11-20", mid: "2026-11-24", high: "2026-11-30", casesAhead: 41000, perDay: 760 },
  perm: { low: "2026-12-01", mid: "2026-12-20", high: "2027-01-15", casesAhead: 18000, perDay: 625 },
  permNote: null,
  line: { peopleAhead: { low: 20000, mid: 30000, high: 40000 }, perYear: 40000, fy: 2024 },
};

describe("figuresFor", () => {
  it("runs on today's figures and the queue answer when nothing is changed", () => {
    const f = figuresFor(BASE, NO_OVERRIDES, "EB2", ANSWER, null);
    expect(f.spans).toEqual(BASE.spans);
    expect(f.permByQueue).toBe(ANSWER.perm);
    expect(f.pwdByQueue).toBe(ANSWER.pwd);
    expect(f.supply).toEqual({ peopleAhead: ANSWER.line!.peopleAhead, perYear: 40000 });
    expect(f.bulletinMethod).toBe("pace");
  });

  it("puts the reader's own lengths in place, the I-140's for the chosen category only", () => {
    const own = { low: 10, mid: 20, high: 30 };
    const f = figuresFor(BASE, { ...NO_OVERRIDES, lengths: { perm: own, i140: own } }, "EB3", null, null);
    expect(f.spans.perm).toBe(own);
    expect(f.spans.i140).toEqual({ EB2: SPAN, EB3: own });
    expect(f.spans.pwd).toBe(SPAN);
  });

  it("drops a queue dating the reader turned off, and takes their green cards a year", () => {
    const f = figuresFor(BASE, { ...NO_OVERRIDES, byQueue: { pwd: true, perm: false }, perYear: 9000, method: "supply" }, "EB2", ANSWER, null);
    expect(f.permByQueue).toBeNull();
    expect(f.pwdByQueue).toBe(ANSWER.pwd);
    expect(f.supply).toEqual({ peopleAhead: ANSWER.line!.peopleAhead, perYear: 9000 });
    expect(f.bulletinMethod).toBe("supply");
  });

  it("has no people-ahead reading without the line's answer", () => {
    expect(figuresFor(BASE, NO_OVERRIDES, "EB2", null, null).supply).toBeNull();
  });
});

describe("missFrom", () => {
  it("reads the backtest's miss at the nearest tested distance", () => {
    const miss = missFrom({
      90: { readers: 10, reached: 9, typicalMissMonths: 1, withinQuarterShare: 0.6 },
      365: { readers: 10, reached: 8, typicalMissMonths: 7, withinQuarterShare: 0.25 },
    })!;
    expect(miss(400)).toBe(7);
    expect(miss(60)).toBe(1);
    expect(missFrom(null)).toBeNull();
  });
});

describe("changedCount and baseSpan", () => {
  it("counts every change, and nothing for today's figures", () => {
    expect(changedCount(NO_OVERRIDES)).toBe(0);
    expect(changedCount({ lengths: { perm: SPAN, i485: SPAN }, method: "supply", paceDaysPerMonth: 30, perYear: 1, byQueue: { pwd: false, perm: false } })).toBe(7);
  });

  it("reads the I-140's base for the category", () => {
    expect(baseSpan(BASE, "i140", "EB3")).toEqual({ low: 4, mid: 5, high: 6 });
    expect(baseSpan(BASE, "perm", "EB3")).toBe(SPAN);
  });
});

describe("withTrack", () => {
  it("keeps the typed number in its own box, pushing the others to keep the order", () => {
    const s = { low: 280, mid: 290, high: 300 };
    expect(withTrack(s, "mid", 500)).toEqual({ low: 280, mid: 500, high: 500 });
    expect(withTrack(s, "mid", 100)).toEqual({ low: 100, mid: 100, high: 300 });
    expect(withTrack(s, "low", 295)).toEqual({ low: 295, mid: 295, high: 300 });
    expect(withTrack(s, "high", 285)).toEqual({ low: 280, mid: 285, high: 285 });
    expect(withTrack(s, "mid", -5)).toEqual({ low: 0, mid: 0, high: 300 });
  });
});
