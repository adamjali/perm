import { describe, expect, it } from "vitest";

import { allStatusMeanings, getStatusMeaning } from "../permStatus";

/**
 * The decoder's obligations are all about restraint: cover every status the
 * mirror actually holds, never invent a definition, never write a forecast,
 * and never tell the wrong party that a clock is running on them.
 */

/** Every distinct status in the live mirror, measured on 412,865 rows. */
const LIVE_STATUSES = [
  "CERTIFIED",
  "ANALYST REVIEW",
  "CERTIFIED - EXPIRED",
  "WITHDRAWN",
  "DENIED",
  "APPLICATION ON HOLD",
  "RFI ISSUED",
  "RECONSIDERATION APPEALS",
  "BALCA APPEALS",
  "NORD ISSUED",
  "IN PROCESS",
  "DETERMINATION ISSUED",
  "REQUEST FOR REVIEW",
  "SUPERVISED RECRUITMENT",
  "DENIED - BALCA DISMISSED",
  "PENDING AUDIT RESPONSE",
];

describe("getStatusMeaning", () => {
  it.each(LIVE_STATUSES)("decodes %s, which the mirror really holds", (s) => {
    expect(getStatusMeaning(s)).not.toBeNull();
  });

  it("is case and whitespace insensitive, because callers vary", () => {
    expect(getStatusMeaning(" analyst review ")?.status).toBe("ANALYST REVIEW");
  });

  it("returns null for a status nobody has written one for", () => {
    // The count went 15 to 16 mid-build when DENIED - BALCA DISMISSED
    // arrived with a single case. It will happen again, and returning a
    // near neighbour would put a confident wrong definition on the page.
    expect(getStatusMeaning("SOME NEW DOL STATE")).toBeNull();
    expect(getStatusMeaning("")).toBeNull();
  });

  it("cites a regulation for every deadline it states", () => {
    // A deadline is the highest-stakes thing here: acting on a wrong one
    // loses somebody their case. Any entry claiming a clock has to say
    // where the clock comes from.
    for (const m of allStatusMeanings()) {
      if (m.deadline !== null) expect(m.cite).not.toBeNull();
    }
  });

  it("puts every citation on eCFR's own text, not a summary of it", () => {
    for (const m of allStatusMeanings()) {
      if (!m.cite) continue;
      expect(m.cite.href).toMatch(
        /^https:\/\/www\.ecfr\.gov\/current\/title-20\/chapter-V\/part-656\/section-656\.\d+$/,
      );
      expect(m.cite.label).toMatch(/^20 CFR 656\./);
    }
  });

  it("names the employer, never the reader, as the party who has to act", () => {
    // In PERM the party is the employer. "You must respond within 30 days"
    // is addressed at somebody who legally cannot respond.
    for (const m of allStatusMeanings()) {
      if (m.action === null) continue;
      expect(m.action).toMatch(/employer|BALCA|Certifying Officer/);
      expect(m.action).not.toMatch(/\byou must\b|\byou need to\b|\byou have to\b/i);
    }
  });

  it("never forecasts what a status will become", () => {
    // The mirror is one observation per case. It cannot see transitions, so
    // no wording here may imply one is likely.
    const banned =
      /\blikely\b|\bchance\b|\bodds\b|\bprobabl|\bexpect to\b|\bwill be (certified|denied|approved)\b|\bmost cases (are|end)\b/i;
    for (const m of allStatusMeanings()) {
      for (const field of [m.summary, m.action ?? "", m.deadline ?? ""]) {
        expect(field).not.toMatch(banned);
      }
    }
  });

  it("says plainly that it does not know, for the undocumented states", () => {
    // These four are FLAG workflow states with no published definition.
    // Each must admit that rather than describing itself confidently.
    for (const s of ["NORD ISSUED", "APPLICATION ON HOLD", "IN PROCESS", "DETERMINATION ISSUED"]) {
      const m = getStatusMeaning(s)!;
      expect(m.summary).toMatch(/publishes no|does not publish/i);
      expect(m.cite).toBeNull();
    }
  });

  it("carries the two deadlines somebody can actually lose a case to", () => {
    const audit = getStatusMeaning("PENDING AUDIT RESPONSE")!;
    expect(audit.deadline).toContain("30 days");
    // 20 CFR 656.20(a)(3)(ii): missing it also removes the BALCA route.
    expect(audit.action).toMatch(/BALCA/);

    const certified = getStatusMeaning("CERTIFIED")!;
    expect(certified.deadline).toContain("180 calendar days");
    expect(certified.cite?.label).toBe("20 CFR 656.30(b)(1)");
  });

  it("does not let an expired certification read as a lost case", () => {
    // 57,038 cases carry this status and for most of them the I-140 was
    // filed on time and DOL was simply never told. Leading with "you lost
    // it" would frighten tens of thousands of people over a bookkeeping
    // artefact.
    const m = getStatusMeaning("CERTIFIED - EXPIRED")!;
    expect(m.action).toMatch(/usually means the I-140 was filed in time/);
  });

  it("keeps the house prose rules the rest of the site is gated on", () => {
    for (const m of allStatusMeanings()) {
      for (const field of [m.summary, m.action ?? "", m.deadline ?? ""]) {
        expect(field).not.toContain("—"); // em-dash
        expect(field).not.toContain("!");
      }
    }
  });
});
