import { describe, expect, it } from "vitest";

import {
  MATCH_AMBIGUOUS_OVER,
  MATCH_CAP,
  normaliseTitle,
  pickCandidates,
  titlesMatch,
  type PermCandidate,
} from "@convex/lib/pipelineMatch";

/** The wage request to PERM match's rules (convex/lib/pipelineMatch.ts). */

const perm = (caseNumber: string, filingDate: string, jobTitle: string): PermCandidate => ({
  caseNumber,
  filingDate,
  employerName: "Example Systems, Inc.",
  jobTitle,
});

describe("job titles", () => {
  it("ignores case, punctuation, abbreviations, plural endings and word order", () => {
    expect(titlesMatch("Sr. Software Engineer", "Senior Software Engineer")).toBe(true);
    expect(titlesMatch("Applied AI/ML", "Applied AI ML")).toBe(true);
    expect(titlesMatch("Engineer, Software", "Software Engineer")).toBe(true);
    expect(titlesMatch("Data Analysts", "Data Analyst")).toBe(true);
    expect(titlesMatch("R&D Manager", "R and D Manager")).toBe(true);
  });

  it("keeps different jobs apart", () => {
    expect(titlesMatch("Software Engineer II", "Software Engineer III")).toBe(false);
    expect(titlesMatch("Software Engineer", "Senior Software Engineer")).toBe(false);
    expect(titlesMatch("", "Software Engineer")).toBe(false);
    expect(titlesMatch(null, null)).toBe(false);
  });

  it("counts a code only when both titles carry one", () => {
    // DOL's own rows, Oct 2026: two requisitions, and one job written twice.
    expect(titlesMatch("Senior Software Engineer [*AID060]", "Senior Software Engineer [*AID010]")).toBe(false);
    expect(titlesMatch("Senior Software Engineer [*AID010]", "Senior Software Engineer (*AID010)")).toBe(true);
    expect(titlesMatch("IT Manager (DBA)", "IT Manager")).toBe(true);
    expect(normaliseTitle("AVP, Regulatory Reporting [SOC 15-1199.08, LEVEL 2 WAGE]").tags).toHaveLength(1);
  });
});

describe("which PERMs to tell", () => {
  const since = "2026-09-02";
  const opts = (rows: PermCandidate[], extra: Partial<Parameters<typeof pickCandidates>[0]> = {}) =>
    pickCandidates({ pwdTitle: "Software Engineer", since, rows, told: new Set(), watched: new Set(), toldCount: 0, ...extra });

  it("takes only PERMs filed on or after the wage was issued, newest first", () => {
    const pick = opts([
      perm("G-100-26240-1", "2026-08-28", "Software Engineer"),
      perm("G-100-26245-1", "2026-09-02", "Software Engineer"),
      perm("G-100-26280-1", "2026-10-07", "Software Engineer"),
    ]);
    expect(pick.send.map((c) => c.caseNumber)).toEqual(["G-100-26280-1", "G-100-26245-1"]);
    expect(pick.matched).toBe(2);
  });

  it("skips what the address was told or already watches, and counts a PERM once", () => {
    const rows = [
      perm("G-100-26280-1", "2026-10-07", "Software Engineer"),
      perm("G-100-26280-1", "2026-10-07", "Software Engineer"),
      perm("G-100-26281-1", "2026-10-08", "Software Engineer"),
    ];
    const pick = opts(rows, { told: new Set(["G-100-26281-1"]), toldCount: 1 });
    expect(pick.send.map((c) => c.caseNumber)).toEqual(["G-100-26280-1"]);
    expect(opts(rows, { watched: new Set(["G-100-26280-1", "G-100-26281-1"]) }).send).toEqual([]);
  });

  it("tells three at most, ever", () => {
    expect(MATCH_CAP).toBe(3);
    const rows = [1, 2, 3].map((i) => perm(`G-100-2628${i}-1`, `2026-10-0${i}`, "Software Engineer"));
    expect(opts(rows).send).toHaveLength(3);
    expect(opts(rows, { toldCount: 2, told: new Set(["G-100-26283-1", "G-100-26282-1"]) }).send).toHaveLength(1);
    expect(opts(rows, { toldCount: 3 }).send).toEqual([]);
  });

  it("says nothing when the employer filed too many for the title to point at anyone", () => {
    const rows = Array.from({ length: MATCH_AMBIGUOUS_OVER + 1 }, (_, i) =>
      perm(`G-100-2629${i}-1`, `2026-10-1${i}`, "Software Engineer"),
    );
    const pick = opts(rows);
    expect(pick.ambiguous).toBe(true);
    expect(pick.send).toEqual([]);
    // Other titles at the same employer don't count against it.
    expect(opts([...rows.slice(0, 2), perm("G-100-26300-1", "2026-10-20", "Accountant")]).send).toHaveLength(2);
  });
});
