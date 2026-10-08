import { describe, expect, it } from "vitest";

import { parseRangeCoverage } from "../rangeCoverage";

const DOC = JSON.stringify({
  end: "2026-10-04",
  current: { within7Share: 0.781 },
  rangeCoverage: { judged: 8023, insideShare: 0.287 },
});

describe("parseRangeCoverage", () => {
  it("reads the backtest's own figures", () => {
    expect(parseRangeCoverage(DOC)).toEqual({
      insideShare: 0.287,
      judged: 8023,
      within7Share: 0.781,
      through: "2026-10-04",
    });
  });

  it("keeps the newest measurement however old: a stopped test is fixed, never fallen back from", () => {
    expect(parseRangeCoverage(DOC)).toEqual(expect.objectContaining({ judged: 8023, through: "2026-10-04" }));
  });

  const MODEL = JSON.stringify({
    end: "2026-10-07",
    current: { within7Share: 0.79 },
    rangeCoverage: { judged: 8445, insideShare: 0.469 },
    rangeModel: {
      judgeDays: 14,
      buckets: [
        { fromDays: 0, toDays: 14, decided: 3786, judged: 4785, stuckShare: 0.209, measured: true, earlyDays: -6, lateDays: 13, insideShare: 0.63 },
        { fromDays: 15, toDays: 30, decided: 0, judged: 0, stuckShare: null, measured: false },
        { fromDays: 31, toDays: 60, measured: true, earlyDays: "x" },
      ],
    },
    servedRange: { judged: 451, insideShare: 0.457, stuckShare: 0.426 },
  });

  it("reads the measured ranges, only the measured and well-formed ones", () => {
    const c = parseRangeCoverage(MODEL);
    expect(c?.measured).toEqual([
      { fromDays: 0, toDays: 14, earlyDays: -6, lateDays: 13, decided: 3786, judged: 4785, insideShare: 0.63, stuckShare: 0.209 },
    ]);
    expect(c?.judgeDays).toBe(14);
    expect(c?.served).toEqual({ judged: 451, insideShare: 0.457, stuckShare: 0.426 });
  });

  it("keeps a range's edges on the right sides of the date", () => {
    const flipped = JSON.parse(MODEL);
    flipped.rangeModel.buckets[0].earlyDays = 3;
    flipped.rangeModel.buckets[0].lateDays = -2;
    const c = parseRangeCoverage(JSON.stringify(flipped));
    expect(c?.measured?.[0]).toEqual(expect.objectContaining({ earlyDays: 0, lateDays: 0 }));
  });

  it("an older doc with no model still gives the pace rule's figure", () => {
    expect(parseRangeCoverage(DOC)?.measured).toBeUndefined();
  });

  it("quotes nothing it can't read or that judged no case", () => {
    expect(parseRangeCoverage("{")).toBeNull();
    expect(parseRangeCoverage(JSON.stringify({ end: "2026-10-04", rangeCoverage: { judged: 0, insideShare: 0 } }))).toBeNull();
  });
});
