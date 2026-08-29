import { describe, expect, it } from "vitest";

import { isValidISODate as fromDateTypes } from "../dateTypes";
import { isValidISODate as fromDateValidation } from "../dateValidation";
import { isValidISODate as fromCalendarHelpers } from "../calendarHelpers";
import { isValidISODate as fromDateUtils } from "../perm/dates/dateUtils";

/**
 * Four modules exported `isValidISODate`, and three of them were a bare regex
 * that called "2024-02-31" valid while the fourth (dateTypes) rejected it. So
 * whether an impossible date was caught depended on which import a caller
 * reached for — a `2024-02-31` accepted at one boundary becomes March 2
 * downstream. They now all route through the one strict implementation.
 *
 * This test's job is to keep them agreeing: it drives the SAME cases through
 * all four. The null-accepting variants (dateValidation, dateUtils) take an
 * extra `null | undefined`; the string-only variants (dateTypes,
 * calendarHelpers) are given only string inputs.
 */

const stringVariants: Array<{ name: string; fn: (s: string) => boolean }> = [
  { name: "dateTypes", fn: fromDateTypes },
  { name: "calendarHelpers", fn: fromCalendarHelpers },
];

const nullableVariants: Array<{
  name: string;
  fn: (s: string | null | undefined) => boolean;
}> = [
  { name: "dateValidation", fn: fromDateValidation },
  { name: "dateUtils", fn: fromDateUtils },
];

const allOnStrings = [...stringVariants, ...nullableVariants];

describe("isValidISODate agreement across the four modules", () => {
  const real = ["2024-12-31", "2025-01-01", "2000-06-15", "2024-02-29"];
  const impossible = ["2024-02-31", "2025-13-01", "2024-00-10", "2024-04-31"];
  const wrongShape = ["12/31/2024", "2024/12/31", "2024-1-1", "", " ", "2024-12-31 "];

  for (const value of real) {
    it(`accepts the real date ${value} everywhere`, () => {
      for (const v of allOnStrings) expect(v.fn(value), v.name).toBe(true);
    });
  }

  for (const value of impossible) {
    it(`rejects the impossible date ${value} everywhere (the whole point)`, () => {
      for (const v of allOnStrings) expect(v.fn(value), v.name).toBe(false);
    });
  }

  for (const value of wrongShape) {
    it(`rejects the mis-shaped ${JSON.stringify(value)} everywhere`, () => {
      for (const v of allOnStrings) expect(v.fn(value), v.name).toBe(false);
    });
  }

  it("the null-accepting variants handle null and undefined", () => {
    for (const v of nullableVariants) {
      expect(v.fn(null), v.name).toBe(false);
      expect(v.fn(undefined), v.name).toBe(false);
    }
  });
});
