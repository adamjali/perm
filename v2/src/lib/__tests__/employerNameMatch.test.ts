import { describe, expect, it } from "vitest";

import { cleanEmployerQuery, isPossibleMatch, pickPossibleMatch } from "../employerNameMatch";

// What a job site prints ("Meta", "Amazon") and what DOL prints ("META
// PLATFORMS, INC.", "AMAZON.COM SERVICES LLC") rarely agree exactly, so the
// lookup offers a POSSIBLE match. The rules here decide when a candidate is
// close enough to show with the word "possible", and when to say no record.

describe("cleanEmployerQuery", () => {
  it.each([
    ["  Google  ", "Google"],
    ["Acme\n\tCorp", "Acme Corp"],
    ["Acme Corp · Full-time", "Acme Corp · Full-time"],
  ])("tidies %j", (raw, want) => {
    expect(cleanEmployerQuery(raw)).toBe(want);
  });

  it.each([[""], ["a"], [" x "], ["x".repeat(121)]])("refuses %j", (raw) => {
    expect(cleanEmployerQuery(raw)).toBeNull();
  });

  it("caps the length before doing anything else with a huge string", () => {
    const huge = "a ".repeat(80_000);
    const t = performance.now();
    expect(cleanEmployerQuery(huge)).toBeNull();
    expect(performance.now() - t).toBeLessThan(50);
  });
});

describe("isPossibleMatch", () => {
  it.each([
    ["meta", "meta platforms"],
    ["amazon", "amazon services"],
    ["uber", "uber technologies"],
    ["deloitte", "deloitte consulting"],
    ["jpmorgan chase", "jpmorgan chase"],
    // The same letters with the gaps elsewhere, ending on a word boundary (Rule D).
    ["walmart", "wal mart associates"],
    ["jp morgan", "jpmorgan chase"],
    ["t mobile", "tmobile usa"],
  ])("%s may be %s", (q, c) => {
    expect(isPossibleMatch(q, c)).toBe(true);
  });

  it.each([
    // A word inside another word is a different company.
    ["meta", "metamorphosis labs"],
    ["intel", "intellectt"],
    // The query's words must all lead the candidate, in order.
    ["chase", "jpmorgan chase"],
    ["google cloud", "google"],
    // Rule D still ends on a word: these letters stop inside one.
    ["walma", "wal mart associates"],
    ["mart", "wal mart associates"],
    // Too generic to name anyone.
    ["global", "global infotech"],
    ["technology solutions", "technology solutions group"],
    // Too short to mean anything.
    ["ab", "ab inbev"],
    ["", "acme"],
  ])("%s is not %s", (q, c) => {
    expect(isPossibleMatch(q, c)).toBe(false);
  });
});

describe("pickPossibleMatch", () => {
  const candidates = [
    { name: "METAMORPHOSIS LABS INC", rank: 3 },
    { name: "META PLATFORMS, INC.", rank: 9 },
    { name: "META FINANCIAL GROUP", rank: 4000 },
  ];

  it("takes the first candidate in the given order that passes", () => {
    expect(pickPossibleMatch("Meta", candidates)?.name).toBe("META PLATFORMS, INC.");
  });

  it("returns null when none passes", () => {
    expect(pickPossibleMatch("Zebra", candidates)).toBeNull();
  });

  it("reads candidates by their program key, so a .com name still leads", () => {
    expect(pickPossibleMatch("Amazon", [{ name: "AMAZON.COM SERVICES LLC" }])?.name).toBe("AMAZON.COM SERVICES LLC");
  });
});
