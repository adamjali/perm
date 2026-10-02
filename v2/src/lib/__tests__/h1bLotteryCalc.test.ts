import { describe, expect, it } from "vitest";

import { WEIGHTED_ESTIMATE } from "../h1bLottery";
import { levelAtSite, lotteryLevel, oddsAt, parseOffer, timesWord } from "../h1bLotteryCalc";
import type { WageLevel } from "../wageLevels";

/**
 * The weighted lottery's level rule, 8 CFR 214.2(h)(8)(iii)(A)(4) as DHS wrote
 * it in 90 FR 60864: the highest OEWS level the offer "equals or exceeds", a
 * wage under level I entered as level I, and the LOWEST level across several
 * worksites. Each clause gets a case, including the equal-to-the-figure edge
 * the words "equals or exceeds" decide.
 */

const SF: WageLevel[] = [
  { level: "I", hourly: 50, yearly: 104_000 },
  { level: "II", hourly: 60, yearly: 124_800 },
  { level: "III", hourly: 70, yearly: 145_600 },
  { level: "IV", hourly: 80, yearly: 166_400 },
];
const AUSTIN: WageLevel[] = [
  { level: "I", hourly: 40, yearly: 83_200 },
  { level: "II", hourly: 48, yearly: 99_840 },
  { level: "III", hourly: 56, yearly: 116_480 },
  { level: "IV", hourly: 64, yearly: 133_120 },
];

describe("levelAtSite", () => {
  it("takes the highest level the offer equals or exceeds, an exact match included", () => {
    expect(levelAtSite(124_800, "year", SF).level).toBe("II");
    expect(levelAtSite(124_799, "year", SF).level).toBe("I");
    expect(levelAtSite(200_000, "year", SF)).toMatchObject({ level: "IV", next: null });
  });

  it("enters an offer under level I as level I, and says so", () => {
    expect(levelAtSite(90_000, "year", SF)).toMatchObject({ level: "I", belowLevelI: true, next: { level: "II", amount: 124_800 } });
    expect(levelAtSite(104_000, "year", SF).belowLevelI).toBe(false);
  });

  it("compares an hourly offer against DOL's hourly figures, not an annualised guess", () => {
    expect(levelAtSite(70, "hour", SF)).toMatchObject({ level: "III", next: { level: "IV", amount: 80 } });
  });
});

describe("lotteryLevel", () => {
  it("takes the lowest level across worksites and names the site that set it", () => {
    const sites = [levelAtSite(130_000, "year", AUSTIN), levelAtSite(130_000, "year", SF)];
    expect(sites.map((s) => s.level)).toEqual(["III", "II"]);
    expect(lotteryLevel(sites)).toEqual({ level: "II", limiting: 1 });
    expect(lotteryLevel([])).toBeNull();
  });
});

describe("oddsAt", () => {
  it("reads DHS's estimate and entry count straight from the rule's table", () => {
    for (const l of WEIGHTED_ESTIMATE.levels) {
      expect(oddsAt(l.level)).toEqual({ entries: l.entries, percent: l.percent });
    }
    expect(oddsAt("IV")).toEqual({ entries: 4, percent: 61.16 });
    expect(timesWord(1)).toBe("once");
    expect(timesWord(2)).toBe("twice");
    expect(timesWord(4)).toBe("four times");
  });
});

describe("parseOffer", () => {
  it("reads a typed wage and refuses nothing or a negative", () => {
    expect(parseOffer("$120,000")).toBe(120_000);
    expect(parseOffer("52.50")).toBe(52.5);
    expect(parseOffer("")).toBeNull();
    expect(parseOffer("-5")).toBeNull();
    expect(parseOffer("abc")).toBeNull();
  });
});
