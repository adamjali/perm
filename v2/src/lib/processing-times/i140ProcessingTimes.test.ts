import { describe, expect, it } from "vitest";
import {
  PROCESSING_TIMES_AS_OF,
  formatMonthRange,
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
    // EB-1 runs from an outstanding professor at 15.5 months to extraordinary
    // ability at 34.5. Collapsing that to one figure is the original bug.
    const eb1 = getI140ProcessingTime("EB-1");
    expect(eb1?.lowMonths).toBe(15.5);
    expect(eb1?.highMonths).toBe(34.5);
    expect(eb1?.subtypes).toHaveLength(3);
  });

  it.each([
    ["EB-2", 2.5, 7.5],
    ["EB-2-NIW", 29, 32],
    ["EB-3", 4, 26],
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
    [2.5, 7.5, "2.5 to 7.5 months"],
    [29, 32, "29 to 32 months"],
    [4, 26, "4 to 26 months"],
  ])("formats %s-%s", (low, high, expected) => {
    expect(formatMonthRange(low, high)).toBe(expected);
  });
});

describe("staleness gate", () => {
  /**
   * The defect this exists to prevent: the previous table sat untouched for
   * sixteen months, reporting figures a quarter of the real value, and nothing
   * in the codebase could tell it had rotted. USCIS republishes monthly.
   *
   * When this fails it is not flaky. It means the numbers need refreshing from
   * the source, and the failure message says how.
   */
  const MAX_AGE_MONTHS = 8;

  it("has an as-of date in the documented format", () => {
    expect(PROCESSING_TIMES_AS_OF).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it(`is no more than ${MAX_AGE_MONTHS} months old`, () => {
    const asOf = new Date(`${PROCESSING_TIMES_AS_OF}T00:00:00Z`);
    const ageMonths = (Date.now() - asOf.getTime()) / (1000 * 60 * 60 * 24 * 30.44);

    expect(
      ageMonths,
      `I-140 processing times are ${ageMonths.toFixed(1)} months old ` +
        `(as of ${PROCESSING_TIMES_AS_OF}). Refresh them from ` +
        `https://egov.uscis.gov/processing-times/ (select Form I-140), then ` +
        `update PROCESSING_TIMES_AS_OF and the subtype figures in ` +
        `src/lib/processing-times/i140ProcessingTimes.ts. This test is the ` +
        `only thing that notices when these numbers go stale.`,
    ).toBeLessThan(MAX_AGE_MONTHS);
  });
});
