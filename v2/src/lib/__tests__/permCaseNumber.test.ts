import { describe, expect, it } from "vitest";
import { parseCaseNumber } from "../permCaseNumber";

describe("parseCaseNumber", () => {
  // Every one of these is a real case number with the receipt date DOL
  // recorded for it, taken from our own corpus rather than invented.
  it.each([
    ["G-100-24158-078964", "2024-06-06"],
    ["G-100-24145-037253", "2024-05-24"],
    ["G-400-25190-162081", "2025-07-09"],
    ["G-400-24183-166114", "2024-07-01"],
    ["P-100-26125-868956", "2026-05-05"],
    ["P-100-26021-574323", "2026-01-21"],
  ])("decodes %s to %s", (input, expected) => {
    expect(parseCaseNumber(input)?.filingDate).toBe(expected);
  });

  it("derives the filing month, which is the grain queue figures use", () => {
    expect(parseCaseNumber("P-100-26125-868956")?.filingMonth).toBe("2026-05");
  });

  it("accepts lowercase and surrounding whitespace", () => {
    expect(parseCaseNumber("  g-100-24158-078964 ")?.filingDate).toBe("2024-06-06");
  });

  it.each([
    ["", "empty"],
    ["not a case number", "prose"],
    ["G-100-24158", "truncated"],
    ["G100-24158-078964", "missing separator"],
    ["G-100-24000-078964", "day 000 does not exist"],
    ["G-100-24367-078964", "day 367 does not exist"],
    ["G-100-99001-078964", "year 2099 is in the future"],
    ["G-100-04001-078964", "predates the modern format"],
  ])("returns null for %s (%s)", (input) => {
    expect(parseCaseNumber(input)).toBeNull();
  });

  it("rejects day 366 in a non-leap year rather than rolling into January", () => {
    // 2025 is not a leap year. A naive Date(Date.UTC(2025, 0, 366)) yields
    // 2026-01-01, which would silently place the case a year late.
    expect(parseCaseNumber("G-100-25366-078964")).toBeNull();
    // 2024 IS a leap year, so the same day number is valid there.
    expect(parseCaseNumber("G-100-24366-078964")?.filingDate).toBe("2024-12-31");
  });
});
