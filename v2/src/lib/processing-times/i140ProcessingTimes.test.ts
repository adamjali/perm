import { describe, expect, it } from "vitest";
import {
  PROCESSING_TIMES_AS_OF,
  formatMonthRange,
  formatMonths,
  getI140ProcessingTime,
  getPremiumBusinessDays,
  type I140Category,
} from "./i140ProcessingTimes";

describe("getI140ProcessingTime", () => {
  it("returns null for an unset category rather than a default", () => {
    // The predecessor to this module effectively shipped a placeholder for
    // every input, which is how a wrong number reached a live form.
    expect(getI140ProcessingTime("")).toBeNull();
  });

  it("spans the whole category when its subtypes disagree", () => {
    // EB-1 runs from an outstanding professor at 15 months to extraordinary
    // ability at 32.5 (USCIS, read 2026-09-26). Collapsing that to one figure
    // is the original bug.
    const eb1 = getI140ProcessingTime("EB-1");
    expect(eb1?.lowMonths).toBe(15);
    expect(eb1?.highMonths).toBe(32.5);
    expect(eb1?.subtypes).toHaveLength(3);
  });

  it.each([
    ["EB-2", 3, 3],
    ["EB-2-NIW", 30, 30],
    ["EB-3", 4, 25.5],
  ])("reports %s as %s to %s months", (category, low, high) => {
    const range = getI140ProcessingTime(category as I140Category);
    expect(range?.lowMonths).toBe(low);
    expect(range?.highMonths).toBe(high);
  });

  it("reports NIW at roughly four times the figure it replaced", () => {
    // The old table said 7 months median for NIW. Guarding the specific
    // regression, not just the shape.
    const niw = getI140ProcessingTime("EB-2-NIW");
    expect(niw?.lowMonths).toBeGreaterThan(20);
  });

  it("gives every subtype one positive 80% figure", () => {
    // USCIS prints one number per subtype now ("80% of cases are completed
    // within N months"); a zero or a missing figure would render as an answer.
    const subtypes = (["EB-1", "EB-2", "EB-2-NIW", "EB-3"] as const).flatMap(
      (c) => getI140ProcessingTime(c)?.subtypes ?? [],
    );
    expect(subtypes).toHaveLength(8);
    for (const s of subtypes) {
      expect(Number.isFinite(s.months80), s.code).toBe(true);
      expect(s.months80, s.code).toBeGreaterThan(0);
    }
  });

  it("reports a one-subtype category as a single figure, low equal to high", () => {
    // The span is across subtypes, never a percentile range: EB-2 and the
    // waiver have one subtype each, so their two ends must be the same number.
    for (const c of ["EB-2", "EB-2-NIW"] as const) {
      const r = getI140ProcessingTime(c);
      expect(r?.subtypes).toHaveLength(1);
      expect(r?.lowMonths).toBe(r?.subtypes[0]?.months80);
      expect(r?.highMonths).toBe(r?.lowMonths);
    }
  });

  it("names every subtype with a USCIS code", () => {
    const codes = (["EB-1", "EB-2", "EB-2-NIW", "EB-3"] as const).flatMap(
      (c) => getI140ProcessingTime(c)?.subtypes.map((s) => s.code) ?? [],
    );
    expect(codes).toEqual(["E11", "E12", "E13", "E21", "NIW", "E31", "EW3", "NUR"]);
  });
});

describe("getPremiumBusinessDays", () => {
  it.each([
    ["EB-2", 15],
    ["EB-2-NIW", 45],
    ["EB-3", 15],
  ])("returns %s business days for %s", (category, days) => {
    expect(getPremiumBusinessDays(category as I140Category)).toBe(days);
  });

  it("returns null for EB-1, whose subtypes use different windows", () => {
    // E11 and E12 are 15 business days, E13 is 45. A single shared constant
    // reported all three as 15.
    expect(getPremiumBusinessDays("EB-1")).toBeNull();
  });

  it("returns null for an unset category", () => {
    expect(getPremiumBusinessDays("")).toBeNull();
  });
});

describe("formatMonthRange", () => {
  it.each([
    [15, 32.5, "15 to 32.5 months"],
    [4, 25.5, "4 to 25.5 months"],
    [3, 3, "3 months"],
    [27.5, 27.5, "27.5 months"],
  ])("formats %s-%s", (low, high, expected) => {
    expect(formatMonthRange(low, high)).toBe(expected);
  });

  it("formats one figure", () => {
    expect(formatMonths(3)).toBe("3 months");
    expect(formatMonths(32.5)).toBe("32.5 months");
  });
});

describe("the as-of date", () => {
  /**
   * The previous table sat untouched for sixteen months, reporting figures a
   * quarter of the real value, and nothing could tell it had rotted. The AGE
   * check now lives in scripts/check_ingest_health.py (`check_hand_read_figures`:
   * a warning past 120 days, a failure past 270). Here it failed the suite
   * after eight months, which would have blocked every deploy on the day it
   * tripped, for figures only a browser can refresh (USCIS challenges scripts).
   * The health check reads this constant, so it must stay in this exact shape.
   */
  it("has an as-of date in the documented format", () => {
    expect(PROCESSING_TIMES_AS_OF).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
