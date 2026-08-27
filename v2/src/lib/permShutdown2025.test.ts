import { describe, expect, it } from "vitest";

import { calculatePWDExpiration } from "@/lib/perm";
import {
  SHUTDOWN_QUOTE,
  SHUTDOWN_WINDOW_END,
  SHUTDOWN_WINDOW_START,
  inShutdownWindow,
} from "./permShutdown2025";

/**
 * The boundaries are DOL's own, quoted in the module, so the tests that matter
 * are the edges: an off-by-one either side changes who gets told about an
 * exception that applied to them.
 */
describe("inShutdownWindow", () => {
  it("includes both endpoints DOL named", () => {
    expect(inShutdownWindow(SHUTDOWN_WINDOW_START)).toBe(true);
    expect(inShutdownWindow(SHUTDOWN_WINDOW_END)).toBe(true);
    expect(inShutdownWindow("2025-10-15")).toBe(true);
  });

  it("excludes the day either side", () => {
    expect(inShutdownWindow("2025-09-30")).toBe(false);
    expect(inShutdownWindow("2025-11-03")).toBe(false);
  });

  it("excludes the same calendar days in other years", () => {
    // A naive month/day check would fire every October forever. The window is
    // a single 33-day span that cannot recur.
    expect(inShutdownWindow("2024-10-15")).toBe(false);
    expect(inShutdownWindow("2026-10-15")).toBe(false);
  });

  it("treats absent and malformed input as outside, never throwing", () => {
    // It runs inside a useMemo that already catches, but a predicate that
    // throws on a half-typed date would blank the whole result panel.
    expect(inShutdownWindow(null)).toBe(false);
    expect(inShutdownWindow(undefined)).toBe(false);
    expect(inShutdownWindow("")).toBe(false);
    expect(inShutdownWindow("not-a-date")).toBe(false);
  });

  /**
   * DOL's exception covers recruitment OR a wage determination that expired in
   * that window. The deadline calculator only implements the recruitment half,
   * and this is the evidence for why: under the OEWS wage-year rule a
   * determination expires on a June 30, or 90 days after issue when issued
   * between 2 April and 30 June, which lands between 1 July and 28 September.
   * October is unreachable, so a PWD branch would be dead code.
   *
   * Sweep every determination date across the relevant years rather than
   * asserting the boundary arithmetic from memory. If the wage-year rule
   * changes, this goes red and the calculator needs its second branch back.
   */
  it("proves a PWD expiration can never land in the window", () => {
    let checked = 0;
    const hits: string[] = [];
    // The control. A sweep that can never match reports a clean bill of
    // health, so the same loop also counts expirations landing on a date the
    // rule DOES produce. If this comes back empty the sweep is blind and its
    // headline result means nothing.
    const control: string[] = [];
    for (const year of [2024, 2025, 2026]) {
      for (let m = 0; m < 12; m += 1) {
        for (let d = 1; d <= 31; d += 1) {
          const iso = `${year}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const parsed = new Date(`${iso}T00:00:00Z`);
          // Skip the 31sts of short months rather than feeding the calculator
          // a date that does not exist.
          if (parsed.getUTCMonth() !== m || parsed.getUTCDate() !== d) continue;
          checked += 1;
          const expiry = calculatePWDExpiration(iso);
          if (inShutdownWindow(expiry)) hits.push(`${iso} -> ${expiry}`);
          if (expiry >= "2025-09-01" && expiry <= "2025-09-30") {
            control.push(`${iso} -> ${expiry}`);
          }
        }
      }
    }
    // Coverage before the verdict: a sweep that examined nothing reads exactly
    // like a sweep that found nothing.
    expect(checked).toBe(1096); // 2024 is a leap year
    expect(control.length).toBeGreaterThan(0);
    expect(hits).toEqual([]);
  });

  it("carries DOL's sentence verbatim, not a paraphrase", () => {
    // The value of the note is that a reader can check it against the source.
    // If someone tightens this into a summary, the citation stops being one.
    expect(SHUTDOWN_QUOTE).toContain("October 1 and November 2, 2025");
    expect(SHUTDOWN_QUOTE).toContain("33 calendar day period");
    expect(SHUTDOWN_QUOTE).toContain("expired recruitment efforts");
  });
});
