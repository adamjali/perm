import { describe, expect, it } from "vitest";
import { annualised, formatWage } from "../wageFormat";

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
