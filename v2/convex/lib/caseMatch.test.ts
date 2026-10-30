import { describe, expect, it } from "vitest";

import { dateWindow, employerLike, rankCandidates, type MatchRow } from "./caseMatch";

describe("employerLike", () => {
  it("drops form words and keeps a distinctive core", () => {
    expect(employerLike("Google LLC")).toBe("%google%");
    expect(employerLike("Test Tech Corp")).toBe("%test tech%");
    expect(employerLike("Fragomen, Del Rey, Bernsen & Loewy, LLP")).toBe("%fragomen del%");
  });

  it("refuses a name with no distinctive core, so it can't match the whole corpus", () => {
    expect(employerLike("A B Inc")).toBeNull(); // core "a b" -> "ab", under four letters
    expect(employerLike("The Co")).toBeNull(); // all form words
    expect(employerLike("   ")).toBeNull();
    expect(employerLike("LLC")).toBeNull();
  });
});

function row(caseNumber: string, filingDate: string | null, status = "ANALYST REVIEW"): MatchRow {
  return { caseNumber, status, employer: "ACME INC", jobTitle: "Engineer", filingDate };
}

describe("rankCandidates", () => {
  it("ranks by filing-date proximity and flags the lone close one", () => {
    const r = rankCandidates(
      [row("G-100-1", "2026-03-01"), row("G-100-2", "2026-01-15"), row("G-100-3", "2025-06-01")],
      "2026-01-20",
    );
    expect(r.candidates.map((c) => c.caseNumber)).toEqual(["G-100-2", "G-100-1", "G-100-3"]);
    expect(r.likely).toBe("G-100-2"); // only G-100-2 is within 14 days
  });

  it("names no single likely when several sit in the tight window", () => {
    const r = rankCandidates([row("G-100-1", "2026-01-18"), row("G-100-2", "2026-01-22")], "2026-01-20");
    expect(r.likely).toBeNull();
    expect(r.candidates).toHaveLength(2);
  });

  it("names no likely when the only candidate is far off", () => {
    expect(rankCandidates([row("G-100-1", "2025-01-01")], "2026-01-20").likely).toBeNull();
  });

  it("drops rows with no or unparseable filing date", () => {
    const r = rankCandidates([row("G-100-1", null), row("G-100-2", "2026-01-20")], "2026-01-20");
    expect(r.candidates.map((c) => c.caseNumber)).toEqual(["G-100-2"]);
    expect(r.likely).toBe("G-100-2");
  });

  it("returns no likely and no candidates for an empty set", () => {
    expect(rankCandidates([], "2026-01-20")).toEqual({ candidates: [], likely: null });
  });
});

describe("dateWindow", () => {
  it("spans the days either side of the filing date", () => {
    expect(dateWindow("2026-01-20", 45)).toEqual(["2025-12-06", "2026-03-06"]);
  });
});
