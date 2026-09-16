// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@react-email/render";

import { BulletinWeekly } from "../BulletinWeekly";
import type { DigestData } from "../../../convex/lib/newsletterCompose";

const base: DigestData = {
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

describe("BulletinWeekly", () => {
  it("renders the queue, the bulletin figures and the notice", async () => {
    const html = await render(BulletinWeekly(base));
    expect(html).toContain("November 2025");
    expect(html).toContain("336");
    expect(html).toContain("97,025");
    expect(html).toContain("Fee for Certain H-1B Petitions");
    // The three bulletin figures each stand as their own number with a label under.
    expect(html).toContain("advanced");
    expect(html).toContain("unchanged");
    expect(html).toContain("went backwards");
  });

  it("opens with the recipient's watched case when one is supplied, and not otherwise", async () => {
    const personal = await render(
      BulletinWeekly({
        ...base,
        watchedCase: {
          caseNumber: "G-100-26120-123456",
          status: "ANALYST REVIEW",
          url: "https://permtracker.app/perm-case-status?case=G-100-26120-123456",
        },
      }),
    );
    expect(personal).toContain("G-100-26120-123456");
    expect(personal).toContain("ANALYST REVIEW");
    expect(personal).toContain("https://permtracker.app/perm-case-status?case=G-100-26120-123456");
    const generic = await render(BulletinWeekly(base));
    expect(generic).not.toContain("Your case");
  });

  it("carries the two doors and the per-recipient preferences link", async () => {
    const html = await render(BulletinWeekly(base));
    expect(html).toContain("https://permtracker.app/perm-case-status");
    expect(html).toContain("https://permtracker.app/signup");
    expect(html).toContain("https://permtracker.app/prefs?token=abc");
  });

  it("is email-safe: tables only, no images, no flex or grid, no external stylesheet", async () => {
    const html = await render(BulletinWeekly(base));
    expect(html).not.toMatch(/<img\b/i);
    expect(html).not.toMatch(/display:\s*(flex|grid)/i);
    expect(html).not.toMatch(/<link\b[^>]*rel="stylesheet"/i);
  });

  it("leaves out a section with nothing to say", async () => {
    const html = await render(BulletinWeekly({ ...base, bulletinMonth: null, bulletinMoves: null, notices: [] }));
    // The preview and footer name the bulletin generically; the SECTION is
    // what must be absent, and its three figures are the tell.
    expect(html).not.toContain("went backwards");
    expect(html).not.toContain("Every cutoff and what moved");
    expect(html).not.toContain("On the record");
  });
});

describe("BulletinWeekly, repeated bulletin", () => {
  it("replaces the three figures with one line when the previous issue carried the same bulletin", async () => {
    const html = await render(BulletinWeekly({ ...base, bulletinRepeat: true }));
    expect(html).toContain("Same bulletin as last week");
    expect(html).not.toContain("went backwards");
    expect(html).toContain("Email preferences");
  });
});
