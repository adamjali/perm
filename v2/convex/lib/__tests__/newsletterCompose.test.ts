import { describe, expect, it } from "vitest";

import { composeSubject, composeText, type DigestData } from "../newsletterCompose";

const full: DigestData = {
  weekOf: "2026-09-08",
  dolAsOf: "2026-08-31",
  frontierMonth: "2025-11",
  averageDays: 336,
  pendingCases: 97025,
  bulletinMonth: "2026-09",
  bulletinMoves: { advanced: 5, held: 25, retrogressed: 0, total: 30 },
  notices: [
    { title: "Fee for Certain H-1B Petitions", url: "https://www.federalregister.gov/d/2026-1", publicationDate: "2026-08-25", type: "Proposed Rule" },
  ],
  prefsUrl: "https://permtracker.app/prefs?token=abc",
};

describe("newsletter composition", () => {
  it("leads the subject with DOL's frontier, then the bulletin, then the notice count", () => {
    expect(composeSubject(full)).toBe(
      "DOL at November 2025, 5 cutoffs moved in the September 2026 bulletin, 1 new notice (week of Sep 8, 2026)",
    );
  });

  it("says a bulletin was unchanged rather than inventing movement", () => {
    expect(composeSubject({ ...full, bulletinMoves: { advanced: 0, held: 30, retrogressed: 0, total: 30 }, notices: [] })).toBe(
      "DOL at November 2025, September 2026 bulletin unchanged (week of Sep 8, 2026)",
    );
  });

  it("leaves out a section with nothing to say instead of padding it", () => {
    const text = composeText({ ...full, bulletinMonth: null, bulletinMoves: null, notices: [] });
    expect(text).toContain("DOL'S QUEUE");
    expect(text).not.toContain("VISA BULLETIN");
    expect(text).not.toContain("ON THE RECORD");
    expect(text).toContain("Nothing is predicted.");
  });

  it("carries every figure with the same numbers the data holds, and the opt-out link", () => {
    const text = composeText(full);
    expect(text).toContain("Analyst review is deciding cases filed in November 2025.");
    expect(text).toContain("Average to a determination: 336 days.");
    expect(text).toContain("Pending PERM cases in the live record: 97,025.");
    expect(text).toContain("5 advanced, 25 unchanged, 0 went backwards, of 30 cells.");
    expect(text).toContain("https://permtracker.app/visa-bulletin/2026-09");
    expect(text).toContain("Fee for Certain H-1B Petitions");
    expect(text).toContain("Manage or stop this email: https://permtracker.app/prefs?token=abc");
  });

  it("falls back to a plain subject when nothing moved and nothing is held", () => {
    expect(composeSubject({ ...full, frontierMonth: null, bulletinMonth: null, bulletinMoves: null, notices: [] })).toBe(
      "The week in PERM and the visa bulletin (week of Sep 8, 2026)",
    );
  });
});
