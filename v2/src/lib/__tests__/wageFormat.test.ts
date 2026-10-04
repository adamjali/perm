import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  annualised,
  formatWage,
  HOURLY_LOOKS_YEARLY,
  looksYearly,
  PERIOD_LOOKS_YEARLY,
} from "../wageFormat";

describe("formatWage", () => {
  it.each([
    [241925, "YEAR", "$241,925 per year"],
    [65, "HOUR", "$65.00 per hour"],
    [38.5, "Hourly", "$38.50 per hour"],
    [120000.5, "ANNUAL", "$120,000.50 per year"],
    [5000, "MONTH", "$5,000 per month"],
    [900, "WEEK", "$900 per week"],
  ])("%s %s -> %s", (wage, unit, want) => {
    expect(formatWage(wage, unit)).toBe(want);
  });

  it("never invents a period for a unit it does not know", () => {
    expect(formatWage(65, "FORTNIGHT")).toBe("$65 fortnight");
    expect(formatWage(65, null)).toBe("$65");
  });

  it("is null for no amount, zero, or a negative", () => {
    expect(formatWage(null, "YEAR")).toBeNull();
    expect(formatWage(0, "YEAR")).toBeNull();
    expect(formatWage(-5, "YEAR")).toBeNull();
    expect(formatWage(Number.NaN, "YEAR")).toBeNull();
  });
});

describe("annualised", () => {
  it("scales by the unit, and refuses to guess", () => {
    expect(annualised(100000, "YEAR")).toBe(100000);
    expect(annualised(50, "HOUR")).toBe(104000);
    expect(annualised(5000, "MONTH")).toBe(60000);
    expect(annualised(1000, "WEEK")).toBe(52000);
    expect(annualised(50, "FORTNIGHT")).toBeNull();
    expect(annualised(null, "YEAR")).toBeNull();
  });
});

describe("a yearly salary under the wrong unit", () => {
  it.each([
    [95_000, "HOUR", true],
    [10_000, "HOUR", true],
    [9_999, "HOUR", false],
    [480, "HOUR", false],
    [12_000, "HOURLY", true],
    [100_000, "MONTH", true],
    [40_000, "MONTH", true],
    [25_000, "MONTH", false],
    [120_000, "WEEK", true],
    [3_000, "WEEK", false],
    [92_310, "BI-WEEKLY", true],
    [8_000, "BI-WEEKLY", false],
    [400_000, "YEAR", false],
    [50_000, "FORTNIGHT", false],
    [null, "MONTH", false],
  ])("%s per %s looks yearly: %s", (wage, unit, want) => {
    expect(looksYearly(wage, unit)).toBe(want);
  });

  it("has no yearly figure, so no average can count it", () => {
    expect(annualised(100_000, "MONTH")).toBeNull();
    expect(annualised(95_000, "HOUR")).toBeNull();
    // Control: just under the floor still multiplies out.
    expect(annualised(39_999, "MONTH")).toBe(479_988);
  });

  it("uses the same floors as the SQL that every average reads", () => {
    const root = join(__dirname, "..", "..", "..");
    const sources = [
      readFileSync(join(root, "src/lib/turso/lcaWages.ts"), "utf8"),
      readFileSync(join(root, "scripts/build_lca_facets.py"), "utf8"),
    ];
    for (const src of sources) {
      expect(src).toContain(`AND wage >= ${HOURLY_LOOKS_YEARLY} THEN NULL`);
      expect(src).toContain(`AND wage >= ${PERIOD_LOOKS_YEARLY} THEN NULL`);
    }
    // Two copies in lcaWages.ts: the explorer's expression and the FLAG one.
    expect(sources[0]!.match(/AND wage >= 40000 THEN NULL/g)).toHaveLength(2);
  });
});

