import { describe, expect, it } from "vitest";

import {
  grade,
  headToHead,
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

  it("counts a case still pending past its date at the days it is already late", () => {
    // Predicted Sep 20, Sep 25 and Oct 5; on Oct 1 the first two are still
    // pending, so they are at least 11 and 6 days late. The third's date is
    // ahead, so it says nothing yet.
    const rows = [
      row({ predicted: "2026-09-20" }),
      row({ predicted: "2026-09-25" }),
      row({ predicted: "2026-10-05" }),
      row({ predicted: "2026-09-28", decidedOn: "2026-09-26", outcome: "CERTIFIED" }), // -2
    ];
    const c = summariseCell(rows, "2026-10-01");
    expect(c.overdue).toBe(2);
    expect(c.overdueDays).toBe(9); // median of 11 and 6, rounded
    // Decided-only, the method looks 2 days early. Counting what is already
    // late, it runs at least 6 days late: a floor that only rises.
    expect(c.biasDays).toBe(-2);
    expect(c.missAtLeastDays).toBe(6);
    expect(c.biasAtLeastDays).toBe(6);
    expect(c.missAtLeastDays!).toBeGreaterThanOrEqual(c.typicalMissDays!);
  });

  it("leaves withdrawals out of the overdue count", () => {
    const c = summariseCell([row({ predicted: "2026-09-01", decidedOn: "2026-09-03", outcome: "WITHDRAWN" })], "2026-10-01");
    expect(c.overdue).toBe(0);
    expect(c.missAtLeastDays).toBeNull();
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

describe("headToHead", () => {
  const r = (over: Partial<PredictionRow> & { caseNumber: string }) => ({ ...row(over), caseNumber: over.caseNumber });

  it("compares a rival with ours only on the cases both predicted that day", () => {
    const rows = [
      r({ caseNumber: "G-1", predicted: "2026-09-10", decidedOn: "2026-09-12", outcome: "CERTIFIED" }), // ours off 2
      r({ caseNumber: "G-1", source: "rival-a", model: "rival", predicted: "2026-09-01", decidedOn: "2026-09-12", outcome: "CERTIFIED" }), // off 11
      r({ caseNumber: "G-2", source: "rival-a", model: "rival", predicted: "2026-09-12", decidedOn: "2026-09-12", outcome: "CERTIFIED" }), // no ours: not shared
    ];
    const h = headToHead(rows, "2026-10-01")["rival-a"]!;
    expect(h.shared).toBe(1);
    expect(h.decided).toBe(1);
    expect(h.oursTypicalDays).toBe(2);
    expect(h.rivalTypicalDays).toBe(11);
    expect(h.oursCloser).toBe(1);
    expect(h.rivalCloser).toBe(0);
  });

  it("settles a case still waiting past both dates in favour of the later one", () => {
    const rows = [
      r({ caseNumber: "G-3", predicted: "2026-09-20" }),
      r({ caseNumber: "G-3", source: "rival-b", model: "rival", predicted: "2026-09-05" }),
    ];
    const h = headToHead(rows, "2026-10-01")["rival-b"]!;
    expect(h.settledWhileWaiting).toBe(1);
    expect(h.oursCloser).toBe(1);
    expect(h.decided).toBe(0);
  });

  it("leaves a waiting case alone while one of the two dates is still ahead", () => {
    const rows = [
      r({ caseNumber: "G-4", predicted: "2026-10-20" }),
      r({ caseNumber: "G-4", source: "rival-b", model: "rival", predicted: "2026-09-05" }),
    ];
    const h = headToHead(rows, "2026-10-01")["rival-b"]!;
    expect(h.shared).toBe(1);
    expect(h.oursCloser + h.rivalCloser + h.ties).toBe(0);
  });

  it("counts the shared cases still waiting past each side's own date", () => {
    const rows = [
      r({ caseNumber: "G-6", predicted: "2026-10-20" }), // ours still ahead
      r({ caseNumber: "G-6", source: "rival-a", model: "rival", predicted: "2026-09-25" }), // theirs passed
      r({ caseNumber: "G-7", predicted: "2026-09-28" }),
      r({ caseNumber: "G-7", source: "rival-a", model: "rival", predicted: "2026-09-27" }), // both passed
      r({ caseNumber: "G-8", predicted: "2026-09-10", decidedOn: "2026-09-12", outcome: "CERTIFIED" }),
      r({ caseNumber: "G-8", source: "rival-a", model: "rival", predicted: "2026-09-01", decidedOn: "2026-09-12", outcome: "CERTIFIED" }), // decided: not waiting
    ];
    const h = headToHead(rows, "2026-10-01")["rival-a"]!;
    expect(h.rivalLateWaiting).toBe(2);
    expect(h.oursLateWaiting).toBe(1);
  });

  it("never grades a withdrawal", () => {
    const rows = [
      r({ caseNumber: "G-5", predicted: "2026-09-10", decidedOn: "2026-09-11", outcome: "WITHDRAWN" }),
      r({ caseNumber: "G-5", source: "rival-c", model: "rival-method", predicted: "2026-09-01", decidedOn: "2026-09-11", outcome: "WITHDRAWN" }),
    ];
    const h = headToHead(rows, "2026-10-01")["rival-c"]!;
    expect(h.shared).toBe(1);
    expect(h.decided + h.oursCloser + h.rivalCloser).toBe(0);
  });
});
