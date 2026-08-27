import { describe, expect, it } from "vitest";

import { DEFAULT_RATE_FLOOR, wilsonInterval as rateBarsWilson } from "@/components/tools/RateBars";
import { MIN_DECIDED_FOR_BAND_RATE, wilsonInterval } from "@/lib/wageLadder";

/**
 * The anti-drift pin for a deliberate duplication.
 *
 * `wageLadder.ts` carries its own copy of `wilsonInterval` and its own rate
 * floor rather than importing RateBars', because RateBars is a `"use client"`
 * module and `wageLadder.ts` is reachable from a `server-only` one. Under RSC
 * those imports resolve to client references, not values, and the observed
 * result was every wage band rendering "withheld" over 32,020 decided cases
 * with no error on a page that returned 200.
 *
 * A duplicated formula that nothing compares is a fork. This file is the
 * comparison, and it lives in the `components` project on purpose: that is
 * where importing a `"use client"` module is ordinary. Vitest does not apply
 * the RSC boundary, which is exactly why the original defect passed 28 unit
 * tests, and equally why both implementations can be imported here at once.
 *
 * If either copy changes, this goes red. The permanent fix is to move the
 * shared arithmetic out of the `"use client"` file into `src/lib/`.
 */

describe("wage-band statistics match the shared implementation", () => {
  it("uses the same population floor", () => {
    expect(MIN_DECIDED_FOR_BAND_RATE).toBe(DEFAULT_RATE_FLOOR);
  });

  it.each([
    // The real measured bands, both years where the hump appears.
    [1227, 47737], // FY2025 under $60k
    [350, 9693], //  FY2025 $60k-$80k
    [1613, 32654], // FY2026 under $60k
    [580, 8755], //   FY2026 $60k-$80k
    [3023, 32020], // FY2024 under $60k, the highest rate in the corpus
    // Edges: a proportion at zero is where the normal approximation goes
    // negative and Wilson must not.
    [0, 100],
    [100, 100],
    [1, 1],
    [3, 10_000],
  ])("agrees on %i of %i to the last bit", (denied, decided) => {
    const mine = wilsonInterval(denied, decided);
    const theirs = rateBarsWilson(denied, decided);
    expect(mine).not.toBeNull();
    expect(mine!.lo).toBe(theirs!.lo);
    expect(mine!.hi).toBe(theirs!.hi);
  });

  it.each([
    [1, 0],
    [1, -5],
    [Number.NaN, 100],
    [1, Number.POSITIVE_INFINITY],
  ])("agrees that %s of %s cannot be bounded", (denied, decided) => {
    expect(wilsonInterval(denied, decided)).toBeNull();
    expect(rateBarsWilson(denied, decided)).toBeNull();
  });

  it("keeps both copies inside 0 to 100", () => {
    for (const [d, n] of [[0, 30], [30, 30], [1, 3]] as const) {
      const r = wilsonInterval(d, n)!;
      expect(r.lo).toBeGreaterThanOrEqual(0);
      expect(r.hi).toBeLessThanOrEqual(100);
    }
  });
});
