import { describe, expect, it } from "vitest";

import { easternDay, parseSeasonalTiming, timingView, type SeasonalTiming } from "../seasonalTiming";

// The production doc of Oct 3 2026 (FY2026 files), trimmed to what the tests read.
const DOC = {
  asOf: "2026-10-03T20:17:12Z",
  minN: 50,
  "H-2A": {
    daysToDecision: { n: 20180, p10: 11, p25: 18, p50: 27, p75: 36, p90: 46 },
    leadDays: { n: 20179, p10: 11, p25: 24, p50: 32, p75: 40, p90: 51 },
    decidedFrom: "2025-11-03",
    decidedTo: "2026-06-30",
    files: 1,
    onTime: { n: 20179, share: 0.6147, deadlineDays: 30 },
  },
  "H-2B": {
    daysToDecision: { n: 12512, p10: 28, p25: 39, p50: 70, p75: 102, p90: 116 },
    leadDays: { n: 12512, p10: -28, p25: -15, p50: 17, p75: 49, p90: 61 },
    decidedFrom: "2025-11-03",
    decidedTo: "2026-06-30",
    files: 1,
  },
};
const timing = parseSeasonalTiming(JSON.stringify(DOC)) as SeasonalTiming;

describe("parseSeasonalTiming", () => {
  it("reads the builder's doc, per visa", () => {
    expect(timing["H-2A"]?.leadDays?.p50).toBe(32);
    expect(timing["H-2A"]?.onTime?.share).toBe(0.6147);
    expect(timing["H-2B"]?.daysToDecision?.p75).toBe(102);
    expect(timing["CW-1"]).toBeUndefined();
  });

  it("refuses what the builder never writes: bad JSON, falling percentiles, no usable visa", () => {
    expect(parseSeasonalTiming("not json")).toBeNull();
    expect(parseSeasonalTiming(JSON.stringify({ asOf: "x" }))).toBeNull();
    const falling = { ...DOC, "H-2A": { ...DOC["H-2A"], leadDays: { n: 9, p10: 50, p25: 40, p50: 30, p75: 20, p90: 10 } } };
    expect(parseSeasonalTiming(JSON.stringify(falling))?.["H-2A"]?.leadDays).toBeNull();
  });
});

describe("timingView", () => {
  it("places an H-2A case against its first day of work, the clock the rule sets", () => {
    const v = timingView({
      caseNumber: "H-300-26260-241810",
      filingDate: "2026-09-17",
      firstDay: "2026-12-01",
      today: "2026-10-03",
      timing,
    });
    expect(v).toMatchObject({
      visa: "H-2A",
      basis: "start",
      // 51, 40, 32, 24 and 11 days before December 1.
      early: "2026-10-11",
      from: "2026-10-22",
      typical: "2026-10-30",
      to: "2026-11-07",
      late: "2026-11-20",
      pastMost: false,
      onTimeShare: 0.6147,
      todayAt: 0,
      today: "2026-10-03",
      days: { from: 40, typical: 32, to: 24 },
      // 30 days before December 1 (20 CFR 655.160).
      ruleDay: "2026-11-01",
    });
  });

  it("counts an H-2A case with no known first day forward from filing instead", () => {
    const v = timingView({ caseNumber: "H-300-26260-241810", filingDate: "2026-09-17", firstDay: null, today: "2026-10-03", timing });
    expect(v).toMatchObject({
      basis: "filed",
      typical: "2026-10-14",
      from: "2026-10-05",
      to: "2026-10-23",
      onTimeShare: null,
      ruleDay: null,
      days: { from: 18, typical: 27, to: 36 },
    });
  });

  it("counts H-2B from filing, because its decisions land on both sides of the start date", () => {
    const v = timingView({ caseNumber: "H-400-26200-100001", filingDate: "2026-07-19", firstDay: "2026-10-01", today: "2026-10-03", timing });
    expect(v).toMatchObject({ visa: "H-2B", basis: "filed", from: "2026-08-27", typical: "2026-09-27", to: "2026-10-29" });
    // August 16 (p10) to November 12 (p90) is 88 days; October 3 is day 48.
    expect(v?.todayAt).toBeCloseTo(48 / 88, 5);
  });

  it("says when three in four certified cases were decided by today", () => {
    const v = timingView({ caseNumber: "H-400-26100-100001", filingDate: "2026-04-10", firstDay: null, today: "2026-10-03", timing });
    expect(v?.pastMost).toBe(true);
    expect(v?.todayAt).toBe(1);
  });

  it("answers nothing for a wage request, a job order, a visa with no doc, or no date to count from", () => {
    const base = { filingDate: "2026-09-17", firstDay: null, today: "2026-10-03", timing };
    expect(timingView({ ...base, caseNumber: "P-400-26272-268643" })).toBeNull();
    expect(timingView({ ...base, caseNumber: "JO-A-300-26271-264525" })).toBeNull();
    expect(timingView({ ...base, caseNumber: "C-500-26271-263466" })).toBeNull();
    expect(timingView({ ...base, caseNumber: "H-400-26200-100001", filingDate: null })).toBeNull();
    expect(timingView({ ...base, caseNumber: "H-300-26260-241810", timing: null })).toBeNull();
  });
});

describe("easternDay", () => {
  it("is still the evening's date after midnight UTC", () => {
    // 11:30 PM EDT Oct 3 is 03:30 UTC Oct 4.
    expect(easternDay(new Date("2026-10-04T03:30:00Z"))).toBe("2026-10-03");
    expect(easternDay(new Date("2026-10-04T05:00:00Z"))).toBe("2026-10-04");
  });
});

describe("H-2B reads its season", () => {
  // The Oct 7 2026 doc's shape: H-2B carries its receipt quarters and the
  // builder's useSeason flag; H-2A carries quarters too but reads them pooled.
  const SEASONED = {
    ...DOC,
    "H-2A": {
      ...DOC["H-2A"],
      seasons: { "2025-Q4": { daysToDecision: { n: 9000, p10: 1, p25: 2, p50: 3, p75: 4, p90: 5 }, leadDays: null } },
    },
    "H-2B": {
      ...DOC["H-2B"],
      useSeason: true,
      seasons: {
        "2025-Q1": { daysToDecision: { n: 9436, p10: 40, p25: 54, p50: 72, p75: 90, p90: 104 }, leadDays: null },
        "2025-Q3": { daysToDecision: { n: 3034, p10: 20, p25: 27, p50: 37, p75: 52, p90: 70 }, leadDays: null },
        "bad key": { daysToDecision: { n: 1, p10: 1, p25: 1, p50: 1, p75: 1, p90: 1 }, leadDays: null },
      },
    },
  };
  const t = parseSeasonalTiming(JSON.stringify(SEASONED)) as SeasonalTiming;
  const view = (caseNumber: string, filingDate: string, firstDay: string | null = null) =>
    timingView({ caseNumber, filingDate, firstDay, today: "2026-10-07", timing: t });

  it("keeps only well-formed quarters", () => {
    expect(Object.keys(t["H-2B"]?.seasons ?? {})).toEqual(["2025-Q1", "2025-Q3"]);
    expect(t["H-2B"]?.useSeason).toBe(true);
  });

  it("dates a January filing from last January-to-March's certifications", () => {
    const v = view("H-400-26010-000001", "2026-01-10")!;
    expect(v.season).toBe("January to March 2025");
    expect(v.days).toEqual({ from: 54, typical: 72, to: 90 });
    expect(v.typical).toBe("2026-03-23");
  });

  it("falls back to every quarter pooled when last year's season is missing", () => {
    const v = view("H-400-26100-000001", "2026-04-10")!;
    expect(v.season).toBeNull();
    expect(v.days).toEqual({ from: 39, typical: 70, to: 102 });
  });

  it("leaves H-2A pooled, as the backtest chose", () => {
    const v = view("H-300-26280-000001", "2026-10-07", "2026-12-01")!;
    expect(v.basis).toBe("start");
    expect(v.season).toBeNull();
  });

  it("names the quarter a year before the filing", async () => {
    const { seasonKeyFor, seasonLabel } = await import("../seasonalTiming");
    expect(seasonKeyFor("2026-02-10")).toBe("2025-Q1");
    expect(seasonKeyFor("2026-12-31")).toBe("2025-Q4");
    expect(seasonKeyFor("junk")).toBeNull();
    expect(seasonLabel("2025-Q3")).toBe("July to September 2025");
  });
});

describe("parseSeasonalCheck", () => {
  it("reads each visa's own method's result from the backtest", async () => {
    const { parseSeasonalCheck } = await import("../seasonalTiming");
    const doc = {
      visas: {
        "H-2A": { pageMethod: "pooled/start", page: { quarters: 5, cases: 32539, middleHalfShare: 0.51, wideShare: 0.788 } },
        "H-2B": { pageMethod: "same-season/filed", page: { quarters: 3, cases: 15225, middleHalfShare: 0.427 } },
        "CW-1": { pageMethod: "pooled/filed", page: null },
      },
    };
    expect(parseSeasonalCheck(JSON.stringify(doc))).toEqual({
      "H-2A": { share: 0.51, cases: 32539, quarters: 5 },
      "H-2B": { share: 0.427, cases: 15225, quarters: 3 },
    });
    expect(parseSeasonalCheck("not json")).toBeNull();
    expect(parseSeasonalCheck(JSON.stringify({ visas: { "H-2A": { page: { middleHalfShare: 2, cases: 5, quarters: 1 } } } }))).toBeNull();
  });
});
