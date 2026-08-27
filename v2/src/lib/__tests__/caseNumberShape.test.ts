import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { normaliseCaseNumber } from "../caseNumberShape";
import { parseCaseNumber } from "../permCaseNumber";

/**
 * Two rules about the same string, kept from drifting apart.
 *
 * The client copy must agree with the server's authority, and it must stay
 * LOOSER than the date-decoding parser rather than accidentally becoming a
 * third, stricter opinion nobody asked for.
 */

const SERVER_SRC = readFileSync(
  join(process.cwd(), "src/lib/turso/caseLookup.ts"),
  "utf8",
);

describe("normaliseCaseNumber, against the server's copy", () => {
  it("uses the identical pattern", () => {
    expect(SERVER_SRC).toContain("/^[A-Z]-\\d{3}-\\d{5}-\\d+$/");
  });

  it("uses the identical normalisation", () => {
    expect(SERVER_SRC).toContain(
      'const raw = input.trim().toUpperCase().replace(/\\s+/g, "");',
    );
  });
});

describe("normaliseCaseNumber", () => {
  it("accepts a real case number and returns it upper-cased", () => {
    expect(normaliseCaseNumber("g-100-26125-868956")).toBe("G-100-26125-868956");
  });

  it("tolerates surrounding and interior whitespace, which paste introduces", () => {
    expect(normaliseCaseNumber("  G-100-26125-868956 ")).toBe(
      "G-100-26125-868956",
    );
    expect(normaliseCaseNumber("G-100- 26125-868956")).toBe(
      "G-100-26125-868956",
    );
  });

  it.each([
    ["", "empty"],
    ["G-100-26125", "no serial"],
    ["G100261258689 56", "no separators"],
    ["GG-100-26125-868956", "two prefix letters"],
    ["G-10-26125-868956", "short office"],
    ["G-100-2612-868956", "short date block"],
    ["1-100-26125-868956", "digit where the letter goes"],
    ["G-100-26125-868956; DROP TABLE", "a string with SQL in it"],
  ])("refuses %s (%s)", (input) => {
    expect(normaliseCaseNumber(input)).toBeNull();
  });

  it("accepts every prefix the mirror actually holds", () => {
    // Measured on 412,865 rows: G-100, G-200, G-300, G-400 and P-100. A
    // pattern that only knew about G would refuse nine real cases.
    for (const p of ["G-100", "G-200", "G-300", "G-400", "P-100"]) {
      expect(normaliseCaseNumber(`${p}-26125-868956`)).toBe(`${p}-26125-868956`);
    }
  });

  it("stays looser than the date-decoding parser, on purpose", () => {
    // Day 400 of 2026 does not exist, so parseCaseNumber refuses to decode a
    // date from it. The shape check still passes it through to the server,
    // which will simply find no such case. Refusing it in the form would
    // report a lookup failure as a typo.
    expect(parseCaseNumber("G-100-26400-868956")).toBeNull();
    expect(normaliseCaseNumber("G-100-26400-868956")).toBe("G-100-26400-868956");
  });

  it("agrees with the parser on everything the parser does accept", () => {
    for (const n of [
      "G-100-26125-868956",
      "G-200-24267-358106",
      "G-300-25048-699608",
      "P-100-26021-574323",
    ]) {
      expect(parseCaseNumber(n)).not.toBeNull();
      expect(normaliseCaseNumber(n)).toBe(n);
    }
  });
});
