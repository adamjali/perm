import { describe, expect, it } from "vitest";

import {
  caseLookupUrl,
  CHECK_CASE_URL,
  composeSubject,
  composeText,
  SIGNUP_URL,
  SUBJECT_MAX,
  type DigestData,
} from "../newsletterCompose";

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
      "DOL at Nov 2025, 5 cutoffs moved (Sep bulletin), 1 new notice · week of Sep 8",
    );
    expect(composeSubject(full).length).toBeLessThanOrEqual(SUBJECT_MAX);
  });

  it("says a bulletin was unchanged rather than inventing movement", () => {
    expect(composeSubject({ ...full, bulletinMoves: { advanced: 0, held: 30, retrogressed: 0, total: 30 }, notices: [] })).toBe(
      "DOL at Nov 2025, Sep bulletin unchanged · week of Sep 8",
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
      "The week in PERM and the visa bulletin · week of Sep 8",
    );
  });
});

describe("newsletter composition, September 2026 fixes", () => {
  const manyNotices: DigestData = {
    ...full,
    notices: Array.from({ length: 12 }, (_, i) => ({
      title: `Notice ${i}`,
      url: `https://www.federalregister.gov/d/2026-${i}`,
      publicationDate: "2026-08-25",
      type: "Notice",
    })),
    bulletinMoves: { advanced: 14, held: 12, retrogressed: 4, total: 30 },
  };

  it("caps the subject at SUBJECT_MAX by dropping the LAST movement parts, never the week suffix", () => {
    const s = composeSubject(manyNotices);
    expect(s.length).toBeLessThanOrEqual(SUBJECT_MAX);
    expect(s.endsWith("· week of Sep 8")).toBe(true);
    expect(s.startsWith("DOL at Nov 2025")).toBe(true);
    // Twelve notices tipped it over, so the notice count is what went.
    expect(s).not.toContain("notices");
    expect(s).toContain("14 cutoffs moved");
  });

  it("still hard-cuts a single over-long part rather than exceeding the cap", () => {
    const s = composeSubject({ ...full, frontierMonth: null, bulletinMonth: null, bulletinMoves: null, notices: [], weekOf: "2026-09-08" });
    expect(s.length).toBeLessThanOrEqual(SUBJECT_MAX);
  });

  it("opens with the recipient's own watched case when there is one, and links its lookup", () => {
    const text = composeText({
      ...full,
      watchedCase: { caseNumber: "G-100-26120-123456", status: "ANALYST REVIEW", url: caseLookupUrl("G-100-26120-123456") },
    });
    const lines = text.split("\n");
    expect(lines[0]).toBe("PERM Tracker, the week of Sep 8, 2026");
    expect(lines[2]).toBe("YOUR CASE");
    expect(text).toContain("G-100-26120-123456");
    expect(text).toContain("ANALYST REVIEW");
    expect(text).toContain("https://permtracker.app/perm-case-status?case=G-100-26120-123456");
    // The generic issue never carries it.
    expect(composeText(full)).not.toContain("YOUR CASE");
  });

  it("carries the two doors and the opt-out link in the plain-text part", () => {
    const text = composeText(full);
    expect(text).toContain(CHECK_CASE_URL);
    expect(text).toContain(SIGNUP_URL);
    expect(text).toContain("Manage or stop this email: https://permtracker.app/prefs?token=abc");
  });

  it("builds every URL on the public site, never on a Convex host", () => {
    const text = composeText({ ...full, watchedCase: { caseNumber: "P-100-26125-868956", status: null, url: caseLookupUrl("P-100-26125-868956") } });
    expect(text).not.toMatch(/convex\.(site|cloud)/);
    expect(caseLookupUrl("P-100-26125-868956")).toBe("https://permtracker.app/perm-case-status?case=P-100-26125-868956");
  });
});

describe("a bulletin already reported last week", () => {
  it("says so in the subject and the text instead of restating the same moves as news", () => {
    const repeat: DigestData = { ...full, bulletinRepeat: true };
    expect(composeSubject(repeat)).toContain("Sep bulletin, same as last week");
    const text = composeText(repeat);
    expect(text).toContain("Same bulletin as last week's issue");
    expect(text).not.toContain("Final action dates: 5 advanced");
    // The first issue for a bulletin still reports the moves.
    expect(composeText(full)).toContain("Final action dates: 5 advanced");
  });
});
