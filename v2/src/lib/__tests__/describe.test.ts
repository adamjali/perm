import { describe, expect, it } from "vitest";

import { DESCRIPTION_MAX, andList, firstThatFits, seeCandidates } from "../describe";

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

describe("seeCandidates", () => {
  it("joins items as a list", () => {
    expect(andList(["a"])).toBe("a");
    expect(andList(["a", "b"])).toBe("a and b");
    expect(andList(["a", "b", "c"])).toBe("a, b and c");
  });

  it("keeps the first item and the order, longest first", () => {
    const c = seeCandidates("Lead.", ["first", "second", "third"], [", tail", ""]);
    expect(c[0]).toBe("Lead. See first, second and third, tail.");
    expect(c.every((x) => x.startsWith("Lead. See first"))).toBe(true);
    expect(c).toContain("Lead. See first and third.");
    expect(c).not.toContain("Lead. See third and first.");
    for (let i = 1; i < c.length; i++) expect(c[i - 1]!.length).toBeGreaterThanOrEqual(c[i]!.length);
  });

  it("lets firstThatFits take the most that fits", () => {
    const lead = "x".repeat(100) + ".";
    const out = firstThatFits(seeCandidates(lead, ["where they stand", "how long DOL takes", "how it compares with other sponsors"]));
    expect(out.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
    expect(out).toBe(`${lead} See where they stand and how long DOL takes.`);
  });

  it("offers nothing without items", () => {
    expect(seeCandidates("Lead.", [])).toEqual([]);
  });
});
