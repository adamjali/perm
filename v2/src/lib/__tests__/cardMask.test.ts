import { describe, expect, it } from "vitest";

import { figureRuns, isBareFigure } from "../../../scripts/lib_card_mask.mjs";

describe("what a social card masks", () => {
  it("masks counts, percentages, dollars and dates", () => {
    expect(figureRuns("2,880 PERM cases are on hold, 3.3% of the 88,138 DOL has pending, as of October 27, 2026.")).toEqual([
      "2,880",
      "3.3%",
      "88,138",
      "October 27, 2026",
    ]);
    expect(figureRuns("Each bar is a $10,000 band. DOL is working January 2026, since Oct 8. Cognizant 1,831, Adobe 226.")).toEqual([
      "$10,000",
      "January 2026",
      "Oct 8",
      "1,831",
      "226",
    ]);
  });

  it("masks the moving figures a first pass let through (Oct 29 2026)", () => {
    expect(figureRuns("PERM wage requests take 3 to 4 months at DOL now; 3.4 to 10 years at that pace")).toEqual([
      "3 to 4 months",
      "3.4 to 10 years",
    ]);
    expect(figureRuns("Since the end of Tuesday: Denied +49, Reconsideration Appeals -12")).toEqual(["Tuesday", "+49", "-12"]);
    expect(figureRuns("3.4 to 10")).toEqual(["3.4 to 10"]);
    expect(figureRuns("2026-10-21 perm_queue; 2026-11 EB2 india 01NOV13")).toEqual(["2026-10-21", "2026-11", "01NOV13"]);
  });

  it("masks text that is only a figure, however short", () => {
    expect(["8", " 79 ", "+8", "-12", "26%"].map(isBareFigure)).toEqual([true, true, true, true, true]);
    expect(["EB-2", "I-140", "to", "Level II"].map(isBareFigure)).toEqual([false, false, false, false]);
  });

  it("leaves codes, form names and fixed wording alone", () => {
    expect(figureRuns("G-100-26125-868956 on an ETA-9089, the I-140, FY2016, H-1B and EB-2; 60 days' notice")).toEqual([]);
  });
});
