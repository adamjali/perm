import { describe, expect, it } from "vitest";

import { bulletinCheckSentence, nearestGap, parseBulletinCheck, waitMarks } from "../bulletinCheck";

// The stored doc of Oct 7 2026, trimmed to what the reader uses.
const DOC = JSON.stringify({
  byGap: {
    "90": { readers: 1829, reached: 1734, typicalMissMonths: 2.1, withinQuarterShare: 0.595 },
    "180": { readers: 1829, reached: 1657, typicalMissMonths: 3.9, withinQuarterShare: 0.403 },
    "365": { readers: 1829, reached: 1539, typicalMissMonths: 7.7, withinQuarterShare: 0.23 },
    "730": { readers: 1829, reached: 1187, typicalMissMonths: 13.1, withinQuarterShare: 0.145 },
  },
});

describe("bulletinCheck", () => {
  const check = parseBulletinCheck(DOC)!;

  it("reads the backtest's result per distance", () => {
    expect(Object.keys(check)).toEqual(["90", "180", "365", "730"]);
    expect(parseBulletinCheck("nope")).toBeNull();
    expect(parseBulletinCheck(JSON.stringify({ byGap: { "90": { readers: 0 } } }))).toBeNull();
  });

  it("picks the nearest tested distance on a log scale", () => {
    expect(nearestGap(check, 30)).toBe(90);
    expect(nearestGap(check, 400)).toBe(365);
    // 530 days: nearer a year than two years by ratio.
    expect(nearestGap(check, 500)).toBe(365);
    expect(nearestGap(check, 3000)).toBe(730);
    expect(nearestGap(check, 0)).toBeNull();
  });

  it("says how the pace did, plainly", () => {
    expect(bulletinCheckSentence(check, 380)).toBe(
      "Tested on 1,829 past bulletin readings: for a date about a year past the cutoff, this pace was typically 8 months off, and within a quarter of the real wait 1 time in 4.",
    );
    expect(bulletinCheckSentence(check, 80)).toContain("about three months past the cutoff, this pace was typically 2 months off, and within a quarter of the real wait 6 times in 10.");
    expect(bulletinCheckSentence(null, 380)).toBeNull();
    expect(bulletinCheckSentence(check, 0)).toBeNull();
  });

  it("gives the reader's own wait three ways from the measured marks, and nothing it can't place", () => {
    // The Oct 31 2026 run: a year past the cutoff, fast 0.49, typical 1.18, slow 2.93; two years, no slow mark.
    const marked = parseBulletinCheck(
      JSON.stringify({
        byGap: {
          "365": { readers: 1853, reached: 1544, typicalMissMonths: 7.6, withinQuarterShare: 0.229, ratioMarks: { fast: 0.49, typical: 1.18, slow: 2.93 } },
          "730": { readers: 1853, reached: 1218, typicalMissMonths: 13.4, withinQuarterShare: 0.141, ratioMarks: { fast: 0.44, typical: 1.43, slow: null } },
        },
      }),
    )!;
    expect(waitMarks(marked, 380, 20)).toEqual({ fast: 9.8, typical: 23.6, slow: 58.6 });
    expect(waitMarks(marked, 900, 30)).toEqual({ fast: 13.2, typical: 42.9, slow: null });
    // A doc written before the marks existed has none: nothing is said.
    expect(waitMarks(check, 380, 20)).toBeNull();
    expect(waitMarks(marked, 380, 0)).toBeNull();
  });
});
