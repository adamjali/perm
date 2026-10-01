import { describe, expect, it } from "vitest";

import { DESCRIPTION_MAX, firstThatFits } from "../describe";

/**
 * Search descriptions: the richest candidate that fits 155 characters wins.
 * Each template used to offer a short form and a shorter one, and 285 of 855
 * sampled pages sat under 110 characters (Oct 1 2026).
 */
describe("firstThatFits", () => {
  const long = "x".repeat(200);

  it("takes the first candidate that fits", () => {
    expect(firstThatFits([long, "a fuller one that fits.", "short."])).toBe("a fuller one that fits.");
  });

  it("never returns more than the cap", () => {
    const words = Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ");
    const out = firstThatFits([words, words]);
    expect(out.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
    expect(out.endsWith(".")).toBe(true);
    // Cut at a word boundary, not mid-word.
    expect(out.slice(0, -1).split(" ").every((w) => /^word\d+$/.test(w))).toBe(true);
  });

  it("uses a custom cap", () => {
    expect(firstThatFits(["twelve chars", "six c"], 10)).toBe("six c");
  });
});
