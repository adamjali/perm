import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { permLineFrom, permLineNote, permLineSentence } from "../permLine";

const row = (month: string, decided: number, waiting: number) => [
  { month, is_final: 1, n: decided },
  { month, is_final: 0, n: waiting },
];

const MATRIX = [
  ...row("2025-11", 9_900, 100),
  ...row("2025-12", 8_900, 1_100),
  ...row("2026-01", 4_200, 5_800),
  ...row("2026-02", 200, 4_800),
  ...row("2026-03", 0, 40), // too few cases to say anything
  { month: "", is_final: 0, n: 500 },
];

describe("permLineFrom", () => {
  it("names the oldest busy month DOL hasn't decided half of", () => {
    expect(permLineFrom(MATRIX, "2026-11-02")).toEqual({ month: "2026-01", total: 10_000, decided: 4_200, asOf: "2026-11-02" });
  });

  it("says nothing when the record starts inside the line, rather than guessing", () => {
    expect(permLineFrom([...row("2026-01", 100, 900), ...row("2026-02", 0, 500)], "2026-11-02")).toBeNull();
    expect(permLineFrom([], "2026-11-02")).toBeNull();
  });

  it("skips months too small to say where the line is", () => {
    const m = [...row("2025-12", 900, 100), ...row("2026-01", 1, 50), ...row("2026-02", 100, 900)];
    expect(permLineFrom(m, "2026-11-02")?.month).toBe("2026-02");
  });
});

describe("the line's words", () => {
  const line = permLineFrom(MATRIX, "2026-11-02")!;

  it("leads with our check and says DOL's table agrees, with DOL's own date", () => {
    expect(permLineNote(line, { month: "2026-01", asOf: "October 21, 2026" })).toBe(
      "42% decided by our check of DOL's records on Nov 2. DOL's own table agrees, as of October 21, 2026.",
    );
  });

  it("names DOL's month when it differs", () => {
    expect(permLineNote(line, { month: "2025-12", asOf: "October 21, 2026" })).toBe(
      "42% decided by our check of DOL's records on Nov 2. DOL's own table says December 2025, as of October 21, 2026.",
    );
    expect(permLineSentence(line, { month: "2025-12-01", asOf: "October 21, 2026" })).toBe(
      "By our daily check of DOL's case status on November 2, 2026, DOL is deciding PERM cases filed in January 2026. DOL's own table, dated October 21, 2026, names December 2025.",
    );
  });

  it("stands alone when DOL's table can't be read", () => {
    expect(permLineNote(line, { month: null, asOf: null })).toBe("42% decided by our check of DOL's records on Nov 2.");
  });
});

describe("permLineFrom and scripts/lib_perm_line.py give the same month", () => {
  // The shared fixture: the Python twin reads it in scripts/test_perm_line.py.
  const fixture = JSON.parse(
    readFileSync(join(process.cwd(), "scripts/fixtures/perm_line.json"), "utf8"),
  ) as { cases: { name: string; matrix: { month: string; is_final: number; n: number }[]; month: string | null }[] };

  it("reads at least the four shared cases", () => {
    expect(fixture.cases.length).toBeGreaterThanOrEqual(4);
  });

  for (const c of fixture.cases) {
    it(c.name, () => {
      expect(permLineFrom(c.matrix, "2026-11-02")?.month ?? null).toBe(c.month);
    });
  }
});

describe("the line rule's two constants", () => {
  it("equal the site's FRONT_MIN_CASES and WORKING_BELOW", async () => {
    const rule = await import("@convex/lib/permLine");
    const { FRONT_MIN_CASES } = await import("@/lib/liveQueue");
    const { WORKING_BELOW } = await import("@/lib/pwdLine");
    expect(rule.LINE_MIN_CASES).toBe(FRONT_MIN_CASES);
    expect(rule.LINE_WORKING_BELOW).toBe(WORKING_BELOW);
  });
});
