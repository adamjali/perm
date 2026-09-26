import { describe, expect, it } from "vitest";

import {
  grade,
  horizonOf,
  isGradedOutcome,
  pick,
  rngFor,
  summarise,
  summariseCell,
  type PredictionRow,
} from "./score";

const row = (over: Partial<PredictionRow>): PredictionRow => ({
  source: "ours",
  program: "perm",
  model: "decision-pace",
  recordedOn: "2026-09-01",
  predicted: "2026-09-20",
  bandEarly: "2026-09-15",
  bandLate: "2026-09-30",
  decidedOn: null,
  outcome: null,
  ...over,
});

describe("grade", () => {
  it("is decided minus predicted: positive means DOL was later", () => {
    expect(grade(row({}), "2026-09-25").errorDays).toBe(5);
    expect(grade(row({}), "2026-09-10").errorDays).toBe(-10);
  });

  it("checks the band inclusively, and says null when there is none", () => {
    expect(grade(row({}), "2026-09-15").inBand).toBe(true);
    expect(grade(row({}), "2026-10-01").inBand).toBe(false);
    expect(grade(row({ bandEarly: null, bandLate: null }), "2026-09-20").inBand).toBeNull();
  });
});

describe("horizonOf", () => {
  it("buckets by days from recording to the predicted date", () => {
    expect(horizonOf("2026-09-01", "2026-09-30")).toBe("0-30");
    expect(horizonOf("2026-09-01", "2026-11-15")).toBe("31-90");
    expect(horizonOf("2026-09-01", "2027-01-15")).toBe("91-180");
    expect(horizonOf("2026-09-01", "2027-06-01")).toBe("181+");
  });
});

describe("withdrawals are recorded, never graded", () => {
  it("does not treat a withdrawal as a decision", () => {
    expect(isGradedOutcome("WITHDRAWN")).toBe(false);
    expect(isGradedOutcome("CERTIFIED")).toBe(true);
    expect(isGradedOutcome("DENIED")).toBe(true);
    const c = summariseCell([row({ decidedOn: "2026-09-02", outcome: "WITHDRAWN" })], "2026-12-01");
    expect(c.graded).toBe(0);
    expect(c.settled).toBe(0);
  });
});

describe("summariseCell", () => {
  it("reports the typical miss as the median absolute error, and the bias signed", () => {
    const rows = [
      row({ decidedOn: "2026-09-22", outcome: "CERTIFIED" }), // +2
      row({ decidedOn: "2026-09-30", outcome: "CERTIFIED" }), // +10
      row({ decidedOn: "2026-09-14", outcome: "DENIED" }), //   -6
    ];
    const c = summariseCell(rows, "2026-10-01");
    expect(c.graded).toBe(3);
    expect(c.typicalMissDays).toBe(6);
    expect(c.biasDays).toBe(2);
    expect(c.inBandShare).toBeCloseTo(2 / 3);
    expect(c.within14Share).toBe(1);
  });

  it("counts a still-pending case as a miss once its date is long past (no survivorship)", () => {
    const rows = [
      row({ predicted: "2026-08-01", decidedOn: "2026-08-05", outcome: "CERTIFIED" }),
      row({ predicted: "2026-08-01" }), // never decided
    ];
    const c = summariseCell(rows, "2026-10-01");
    expect(c.settled).toBe(2);
    expect(c.settledHitShare).toBe(0.5);
    // Graded-only error would say "perfect"; the settled figure says half.
    expect(c.typicalMissDays).toBe(4);
  });

  it("does not settle a prediction whose date is recent", () => {
    const c = summariseCell([row({ predicted: "2026-09-25" })], "2026-10-01");
    expect(c.settled).toBe(0);
    expect(c.settledHitShare).toBeNull();
  });
});

describe("summarise", () => {
  it("splits by source, model and horizon, and keeps programs apart", () => {
    const rows = [
      row({ decidedOn: "2026-09-21", outcome: "CERTIFIED" }),
      row({ source: "rival-a", model: "rival", decidedOn: "2026-09-21", outcome: "CERTIFIED", predicted: "2026-09-10", bandEarly: null, bandLate: null }),
      row({ program: "pwd", model: "pwd-queue" }),
    ];
    const s = summarise(rows, "2026-10-01");
    expect(Object.keys(s.bySource).sort()).toEqual(["ours", "rival-a"]);
    expect(s.bySource.ours!.byModel["decision-pace"]!.graded).toBe(1);
    expect(s.bySource["rival-a"]!.all.biasDays).toBe(11);
    expect(s.bySource.ours!.byHorizon["0-30"]!.recorded).toBe(1);
    expect(s.since).toBe("2026-09-01");
    expect(summarise(rows, "2026-10-01", "pwd").bySource.ours!.all.recorded).toBe(1);
  });
});

describe("the sample", () => {
  it("is reproducible from its seed and draws without replacement", () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    const a = pick(items, 10, rngFor("2026-09-26"));
    const b = pick(items, 10, rngFor("2026-09-26"));
    const c = pick(items, 10, rngFor("2026-09-27"));
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(new Set(a).size).toBe(10);
    expect(pick([1, 2], 5, rngFor("x"))).toHaveLength(2);
  });
});
