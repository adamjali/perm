import { describe, expect, it } from "vitest";

import {
  caseLookupUrl,
  CHECK_CASE_URL,
  composeSubject,
  composeText,
  pickEmployerMoves,
  pickUscisMedians,
  SIGNUP_URL,
  SUBJECT_MAX,
  uscisIsNews,
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

describe("the USCIS quarterly section (2026-09-22)", () => {
  const rowsIn = [
    { form: "I-131", title: "Application for Travel Documents, Parole Documents, and Arrival/Departure Records", medianMonths: 14.4 },
    { form: "I-131", title: "Application for Advance Parole Document for Aliens Inside the United States", medianMonths: 5.8 },
    { form: "I-140", title: "Immigrant Petition for Alien Workers", medianMonths: 3.9 },
    { form: "I-485", title: "Application to Register Permanent Residence or Adjust Status (Family)", medianMonths: 7.0 },
    { form: "I-485", title: "Application to Register Permanent Residence or Adjust Status (Employment)", medianMonths: 6.0 },
    { form: "I-765", title: "Application for Employment Authorization (All Other)", medianMonths: 3.3 },
    { form: "I-765", title: "Application for Employment Authorization (Adjustment Of Status)", medianMonths: 6.4 },
    { form: "I-129", title: "Petition for a Nonimmigrant Worker", medianMonths: 2.1 },
  ];
  const medians = pickUscisMedians(rowsIn);
  const news: DigestData = { ...full, uscisQuarter: "FY2026 Q3", uscisMedians: medians };

  it("picks the reader's line per form by title, not the busiest line, in the order the forms are met", () => {
    expect(medians).toEqual([
      { form: "I-140", label: "I-140", medianMonths: 3.9 },
      { form: "I-485", label: "I-485 (employment)", medianMonths: 6.0 },
      { form: "I-765", label: "I-765 EAD", medianMonths: 6.4 },
      { form: "I-131", label: "I-131 advance parole", medianMonths: 5.8 },
    ]);
  });

  it("leaves a form out rather than guessing when no line matches or the median is missing", () => {
    const picked = pickUscisMedians([
      { form: "I-485", title: "Application to Register Permanent Residence or Adjust Status (Family)", medianMonths: 7.0 },
      { form: "I-140", title: "Immigrant Petition for Alien Workers", medianMonths: null },
    ]);
    expect(picked).toEqual([]);
  });

  it("is news the week the quarter lands: in the subject, and in the text between the bulletin and the notices", () => {
    expect(uscisIsNews(news)).toBe(true);
    // The subject cap (78) drops the USCIS part first when DOL, the bulletin
    // and a notice already fill it; with room, it is named.
    expect(composeSubject({ ...news, bulletinMonth: null, bulletinMoves: null, notices: [] })).toBe(
      "DOL at Nov 2025, USCIS FY2026 Q3 medians · week of Sep 8",
    );
    expect(composeSubject(news).length).toBeLessThanOrEqual(SUBJECT_MAX);
    const text = composeText(news);
    expect(text).toContain("USCIS'S QUARTERLY MEDIANS, FY2026 Q3");
    expect(text).toContain("I-485 (employment): 6 months to a decision");
    expect(text).toContain("I-131 advance parole: 5.8 months to a decision");
    expect(text).toContain("https://permtracker.app/uscis-processing-times");
    expect(text.indexOf("VISA BULLETIN")).toBeLessThan(text.indexOf("USCIS'S QUARTERLY"));
    expect(text.indexOf("USCIS'S QUARTERLY")).toBeLessThan(text.indexOf("ON THE RECORD"));
    expect(text).toContain("comes from DOL, USCIS, the State Department or the Federal Register");
  });

  it("is silent, not restated, once the previous issue carried the quarter, and silent with no medians", () => {
    const repeat: DigestData = { ...news, uscisRepeat: true };
    expect(uscisIsNews(repeat)).toBe(false);
    expect(composeSubject(repeat)).not.toContain("USCIS");
    expect(composeText(repeat)).not.toContain("QUARTERLY MEDIANS");
    const empty: DigestData = { ...news, uscisMedians: [] };
    expect(uscisIsNews(empty)).toBe(false);
    expect(composeText(empty)).not.toContain("QUARTERLY MEDIANS");
  });

  it("drops the USCIS part before the DOL and bulletin parts when the subject runs long", () => {
    const long: DigestData = { ...news, notices: Array.from({ length: 4 }, (_, i) => ({ ...full.notices[0]!, title: `n${i}` })) };
    const subject = composeSubject(long);
    expect(subject.length).toBeLessThanOrEqual(SUBJECT_MAX);
    expect(subject).toMatch(/^DOL at/);
  });
});

describe("the employer-wide moves block (2026-09-26)", () => {
  const mv = (key: string, date: string, n: number, slug: string | null = "adobe-inc") => ({
    key: `${date}|${key}`,
    date,
    slug,
    name: slug ? "Adobe Inc." : "No Page LLC",
    sentence: key.startsWith("hold-on") ? `DOL put ${n} of its cases on hold` : `DOL certified ${n} of its cases`,
    n,
  });

  it("keeps the week ending on the issue date, holds first, biggest first, capped", () => {
    const picked = pickEmployerMoves(
      [
        mv("decided|CERTIFIED", "2026-09-07", 44),
        mv("hold-on|APPLICATION ON HOLD", "2026-09-04", 14),
        mv("hold-on|APPLICATION ON HOLD", "2026-08-25", 900),
        mv("decided|CERTIFIED", "2026-09-09", 50),
        ...Array.from({ length: 8 }, (_, i) => mv("decided|CERTIFIED", "2026-09-05", 10 + i)),
      ],
      "2026-09-08",
    );
    expect(picked).toHaveLength(6);
    expect(picked[0]!.sentence).toBe("DOL put 14 of its cases on hold");
    expect(picked.map((m) => m.date)).not.toContain("2026-08-25");
    expect(picked.map((m) => m.date)).not.toContain("2026-09-09");
    expect(picked[1]!.sentence).toBe("DOL certified 44 of its cases");
  });

  it("links an employer with a page, prints one without, and says no reason is given", () => {
    const d: DigestData = {
      ...full,
      employerMoves: pickEmployerMoves(
        [mv("hold-on|APPLICATION ON HOLD", "2026-09-07", 215), mv("decided|CERTIFIED", "2026-09-06", 12, null)],
        "2026-09-08",
      ),
    };
    expect(d.employerMoves![0]!.url).toBe("https://permtracker.app/perm-employers/adobe-inc");
    expect(d.employerMoves![1]!.url).toBeNull();
    const text = composeText(d);
    expect(text).toContain("EMPLOYER-WIDE MOVES THIS WEEK");
    expect(text).toContain("Adobe Inc.: DOL put 215 of its cases on hold (recorded Sep 7, 2026).");
    expect(text).toContain("DOL gives no reason");
    expect(composeText(full)).not.toContain("EMPLOYER-WIDE");
  });
});
