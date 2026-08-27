/**
 * The server-side Wilson copy must agree with RateBars', digit for digit.
 *
 * There are two copies on purpose. `RateBars.tsx` is a `"use client"` module,
 * so a server component calling its export throws at runtime with "Attempted
 * to call wilsonInterval() from the server". Neither `pnpm typecheck` nor a
 * jsdom component test reproduces that boundary — both were green while the
 * occupation section was broken in a real browser — so the duplication is
 * forced. `src/lib/wageLadder.ts` reached the same conclusion and pinned its
 * copy the same way.
 *
 * A duplicate that nothing pins is a fork waiting to happen. This is the pin.
 */
import { describe, expect, it } from "vitest";

import { wilsonInterval as rateBarsWilson } from "@/components/tools/RateBars";
import { wilsonInterval } from "@/lib/turso/rfi";

describe("rfi wilsonInterval matches RateBars", () => {
  it("agrees across the range these rates actually live in", () => {
    // Real rows from the page plus the awkward ends: a zero numerator, a
    // numerator equal to the denominator, and single-digit denominators.
    const cases: [number, number][] = [
      [15, 51], [18, 157], [19, 208], [12, 136], [14, 304],
      [11, 1275], [14, 1848], [894, 52690],
      [0, 50], [1, 1], [1, 4], [7, 7], [6, 71],
    ];
    for (const [k, n] of cases) {
      expect(wilsonInterval(k, n)).toEqual(rateBarsWilson(k, n));
    }
  });

  it("agrees on the inputs that should return null", () => {
    for (const [k, n] of [[0, 0], [1, Number.NaN], [1, -5], [Number.NaN, 10]] as const) {
      expect(wilsonInterval(k, n)).toEqual(rateBarsWilson(k, n));
      expect(wilsonInterval(k, n)).toBeNull();
    }
  });

  it("stays inside 0 to 100, which is the whole reason it is Wilson", () => {
    for (const [k, n] of [[0, 12], [12, 12], [1, 3]] as const) {
      const ci = wilsonInterval(k, n)!;
      expect(ci.lo).toBeGreaterThanOrEqual(0);
      expect(ci.hi).toBeLessThanOrEqual(100);
    }
  });
});
