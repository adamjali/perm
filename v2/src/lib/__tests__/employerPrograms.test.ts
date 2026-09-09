import { describe, expect, it } from "vitest";

import { medianOffset, wageGap, wageGapSentence, type ProgramLine } from "../employerPrograms";

const line = (program: ProgramLine["program"], over: Partial<ProgramLine> = {}): ProgramLine => ({
  program,
  published: 100,
  pending: 5,
  medianAnnualWage: 120_000,
  wageN: 100,
  ...over,
});

describe("medianOffset", () => {
  it("lands on the middle row for odd counts and the lower-middle for even, never below zero", () => {
    expect(medianOffset(1)).toBe(0);
    expect(medianOffset(2)).toBe(0);
    expect(medianOffset(3)).toBe(1);
    expect(medianOffset(100)).toBe(49);
    expect(medianOffset(0)).toBe(0);
  });
});

describe("wageGap", () => {
  it("compares the two medians and reports the share against the PERM median", () => {
    const gap = wageGap(line("perm", { medianAnnualWage: 100_000 }), line("lca", { medianAnnualWage: 125_000 }));
    expect(gap).toEqual({ dollars: 25_000, share: 0.25, permMedian: 100_000, lcaMedian: 125_000, permN: 100, lcaN: 100 });
  });

  it("refuses when either side is missing, has no median, or sits under the floor", () => {
    expect(wageGap(null, line("lca"))).toBeNull();
    expect(wageGap(line("perm", { medianAnnualWage: null }), line("lca"))).toBeNull();
    expect(wageGap(line("perm", { wageN: 9 }), line("lca"))).toBeNull();
    expect(wageGap(line("perm"), line("lca", { wageN: 3 }))).toBeNull();
  });
});

describe("wageGapSentence", () => {
  it("prints both figures and both counts, and the direction", () => {
    const s = wageGapSentence(wageGap(line("perm", { medianAnnualWage: 100_000, wageN: 40 }), line("lca", { medianAnnualWage: 125_000, wageN: 2_000 }))!);
    expect(s).toContain("$125,000 across 2,000 LCAs");
    expect(s).toContain("25% higher");
    expect(s).toContain("$100,000 across 40 cases");
    expect(s).toContain("not a finding");
  });

  it("calls a gap under two percent a match rather than a direction", () => {
    const s = wageGapSentence(wageGap(line("perm", { medianAnnualWage: 100_000 }), line("lca", { medianAnnualWage: 101_000 }))!);
    expect(s).toContain("within 2%");
  });
});
