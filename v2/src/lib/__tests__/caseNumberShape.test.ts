import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { isLegacyCaseNumber, normaliseCaseNumber } from "../caseNumberShape";
import { normaliseCaseNumber as narrowNormalise } from "../caseStatusVocabulary";
import { parseCaseNumber } from "../permCaseNumber";

/**
 * Three modules carry a case-number rule for three audiences. This is what
 * stops them drifting into each other by accident.
 */

const SERVER_SRC = readFileSync(
  join(process.cwd(), "src/lib/turso/caseLookup.ts"),
  "utf8",
);

/** Real numbers, both shapes, taken off the live tables. */
const CURRENT = [
  "G-100-26125-868956",
  "G-200-24267-358106",
  "G-300-25048-699608",
  "P-100-26021-574323",
];
const LEGACY = [
  "A-23043-00641",
  "A-22256-20380",
  "A-22271-30061",
  "A-22185-82932",
];

describe("against the server's own copies", () => {
  it("uses the identical current-format pattern", () => {
    expect(SERVER_SRC).toContain("/^[A-Z]-\\d{3}-\\d{5}-\\d+$/");
  });

  it("uses the identical legacy-format pattern", () => {
    expect(SERVER_SRC).toContain("/^[A-Z]-\\d{5}-\\d{5}$/");
  });

  it("and the server routes LOOKUP through the wide rule, not the narrow one", () => {
    // Widening the client without widening the server would show a friendly
    // form that then reports every legacy case as not found.
    expect(SERVER_SRC).toContain(
      "const caseNumber = normaliseLookupCaseNumber(input);",
    );
  });
});

describe("normaliseCaseNumber, the wide lookup rule", () => {
  it.each(CURRENT)("accepts the current format: %s", (n) => {
    expect(normaliseCaseNumber(n)).toBe(n);
  });

  it.each(LEGACY)("accepts the legacy format: %s", (n) => {
    expect(normaliseCaseNumber(n)).toBe(n);
  });

  it("upper-cases and strips whitespace that paste introduces", () => {
    expect(normaliseCaseNumber("  a-23043-00641 ")).toBe("A-23043-00641");
    expect(normaliseCaseNumber("G-100- 26125-868956")).toBe("G-100-26125-868956");
  });

  it.each([
    ["", "empty"],
    ["A-2304-00641", "legacy with a short first block"],
    ["A-23043-0064", "legacy with a short second block"],
    ["A-23043-00641-9", "legacy with a fourth segment"],
    ["A-230430-0641", "legacy with the split in the wrong place"],
    ["G-100-26125", "current with no serial"],
    ["1-100-26125-868956", "a digit where the letter goes"],
    ["A-23043-00641; DROP TABLE", "a string with SQL in it"],
  ])("still refuses %s (%s)", (input) => {
    expect(normaliseCaseNumber(input)).toBeNull();
  });

  it("has not become permissive: the widening added exactly one shape", () => {
    // The probe the lead asked for. A five-and-five rule could easily have
    // been written loosely enough to swallow anything with two number blocks.
    expect(normaliseCaseNumber("A-23043-006415")).toBeNull();
    expect(normaliseCaseNumber("A-123456-00641")).toBeNull();
    expect(normaliseCaseNumber("AA-23043-00641")).toBeNull();
    expect(normaliseCaseNumber("A-23043-00641-")).toBeNull();
  });
});

describe("the narrow alert rule stays narrow", () => {
  it.each(CURRENT)("still accepts the current format: %s", (n) => {
    expect(narrowNormalise(n)).toBe(n);
  });

  it.each(LEGACY)("still refuses the legacy format: %s", (n) => {
    // Not an oversight. Every legacy case is decided and years old, so an
    // alert on one would promise mail that can never arrive. If this ever
    // starts passing, the alert path has been widened by accident.
    expect(narrowNormalise(n)).toBeNull();
  });
});

describe("isLegacyCaseNumber", () => {
  it.each(LEGACY)("recognises %s", (n) => {
    expect(isLegacyCaseNumber(n)).toBe(true);
  });

  it.each(CURRENT)("does not claim %s is legacy", (n) => {
    expect(isLegacyCaseNumber(n)).toBe(false);
  });
});

describe("date decoding stays current-format only", () => {
  it.each(CURRENT)("decodes %s", (n) => {
    expect(parseCaseNumber(n)).not.toBeNull();
  });

  it.each(LEGACY)("refuses to decode %s", (n) => {
    // 13.4% exact against a 90.5% control. The parser must keep refusing,
    // because a plausible wrong filing month silently produces a wrong queue
    // position that the reader cannot see happen.
    expect(parseCaseNumber(n)).toBeNull();
  });

  it("stays looser than the parser on an impossible day-of-year", () => {
    expect(parseCaseNumber("G-100-26400-868956")).toBeNull();
    expect(normaliseCaseNumber("G-100-26400-868956")).toBe("G-100-26400-868956");
  });
});
