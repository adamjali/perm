import { describe, expect, it } from "vitest";

import { factSentence, parseFacts, parseParts, partBasis, partRank, partValue, type SponsorPart } from "../sponsorProfile";

const part = (over: Partial<SponsorPart>): SponsorPart => ({
  id: "perm_rate", label: "PERM approval rate", value: 0.9959, n: 736, pct: 0.259, of: 2179, ...over,
});

describe("sponsor profile words", () => {
  it("prints a near-perfect rate to one decimal so 99.6% isn't rounded up to 100%", () => {
    expect(partValue(part({}))).toBe("99.6%");
    expect(partValue(part({ value: 1 }))).toBe("100%");
    expect(partValue(part({ value: 0.5 }))).toBe("50%");
  });

  it("says what each figure counts, and the LCA detail window for the shares", () => {
    expect(partBasis(part({}))).toBe("of 736 decided PERM cases");
    expect(partBasis(part({ id: "transfer_share", n: 26, from: "2020-09-30", to: "2022-09-30" }))).toBe(
      "of 26 certified H-1B positions, LCAs decided Sep 2020 to Sep 2022",
    );
    expect(partBasis(part({ id: "perm_recent", value: 233, n: 233 }))).toBe("filed in the last 12 months");
  });

  it("places it among the sponsors it was ranked against, with their count", () => {
    expect(partRank(part({}))).toBe("Higher than 26% of the 2,179 sponsors with 20 or more decided cases.");
    expect(partRank(part({ pct: 1 }))).toBe("At the top of the 2,179 sponsors with 20 or more decided cases.");
    expect(partRank(part({ pct: 0 }))).toBe("At the bottom of the 2,179 sponsors with 20 or more decided cases.");
  });

  it("states a fact with its date", () => {
    expect(factSentence({ id: "dependent", as_of: "2022-06-30" })).toBe(
      "Its newest LCA that answered declared it H-1B dependent (decided 2022-06-30).",
    );
    expect(factSentence({ id: "willful", lcas: 1 })).toBe("It declared itself a willful violator on 1 LCA.");
    expect(factSentence({ id: "warn", notices: 2, workers: 361, since: "2024-10-04" })).toBe(
      "2 WARN layoff notices since Oct 2024, covering 361 workers.",
    );
  });

  it("reads bad JSON as nothing rather than throwing", () => {
    expect(parseParts("{nope")).toEqual([]);
    expect(parseFacts(null)).toEqual([]);
  });
});
