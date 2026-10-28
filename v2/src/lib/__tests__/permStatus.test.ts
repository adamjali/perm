import { describe, expect, it } from "vitest";

import { LANGS } from "@/lib/i18n/lang";

import { KIND_LABEL, allStatusMeanings, getStatusMeaning, kindLabel } from "../permStatus";

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
    // 57,038 cases carry this status. Expiry is a CALENDAR event: DOL grants
    // the certification, USCIS receives the I-140, and nothing suggests DOL
    // is told when one arrives. So a case filed on day 30 and a case nobody
    // ever filed both land here. Leading with "you lost it" would frighten
    // tens of thousands of people whose petition is fine.
    const m = getStatusMeaning("CERTIFIED - EXPIRED")!;
    expect(m.action).toMatch(/unaffected/);
    expect(m.action).toMatch(/our reading rather than DOL/);
    // And no unsourced frequency claim about which of the two is common.
    expect(m.action).not.toMatch(/\busually\b|\bmost\b|\bmany\b/i);
  });

  it("names the consequence of missing BOTH appeal windows on a denial", () => {
    const m = getStatusMeaning("DENIED")!;
    expect(m.action).toMatch(/failure to exhaust administrative remedies/);
  });

  it("states that an RFI is not an audit, which is the reassuring part", () => {
    expect(getStatusMeaning("RFI ISSUED")!.summary).toMatch(/not an audit/);
  });

  it("does not cite a section that does not contain the term", () => {
    // 656.27 lists affirm / direct-to-grant / order-a-hearing. The words
    // "dismiss" and "dismissal" do not appear in it, so citing it for
    // DENIED - BALCA DISMISSED was pointing at a definition that is not there.
    const m = getStatusMeaning("DENIED - BALCA DISMISSED")!;
    expect(m.cite).toBeNull();
    expect(m.summary).toMatch(/publishes no definition/i);
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

/**
 * The translated pages show the same meanings in the reader's language. What may change is the words;
 * DOL's status word, the citation, the kind and the order may not, and no translation may fall back to
 * English, add a clock the English doesn't state, or break the house prose rules.
 */
describe("getStatusMeaning in the translated languages", () => {
  const OTHER = LANGS.filter((l) => l !== "en");

  it("keeps DOL's word, the citation and the kind as printed, in every language", () => {
    const en = allStatusMeanings();
    for (const lang of OTHER) {
      const t = allStatusMeanings(lang);
      expect(t.map((m) => m.status)).toEqual(en.map((m) => m.status));
      t.forEach((m, i) => {
        expect(m.label).toBe(en[i]!.label);
        expect(m.cite).toEqual(en[i]!.cite);
        expect(m.kind).toBe(en[i]!.kind);
      });
    }
  });

  it("translates every summary, action and deadline, and states a clock exactly where the English does", () => {
    const en = allStatusMeanings();
    for (const lang of OTHER) {
      allStatusMeanings(lang).forEach((m, i) => {
        const e = en[i]!;
        expect(m.summary, `${lang} ${m.status}`).not.toBe(e.summary);
        expect(m.action === null, `${lang} ${m.status} action`).toBe(e.action === null);
        expect(m.deadline === null, `${lang} ${m.status} deadline`).toBe(e.deadline === null);
        if (m.action) expect(m.action).not.toBe(e.action);
        if (m.deadline) expect(m.deadline).not.toBe(e.deadline);
      });
    }
  });

  it("carries the deadlines' numbers into every language", () => {
    for (const lang of OTHER) {
      expect(getStatusMeaning("PENDING AUDIT RESPONSE", lang)!.deadline).toContain("30");
      expect(getStatusMeaning("CERTIFIED", lang)!.deadline).toContain("180");
      expect(getStatusMeaning("CERTIFIED", lang)!.deadline).toContain("I-140");
      expect(getStatusMeaning("DENIED", lang)!.deadline).toContain("30");
    }
  });

  it("keeps BALCA and the Certifying Officer as DOL names them, beside the reader's words", () => {
    for (const lang of OTHER) {
      // Chinese glosses with full-width parentheses, the others with Latin ones.
      expect(getStatusMeaning("BALCA APPEALS", lang)!.summary).toMatch(/[(（]BALCA[)）]/);
      expect(getStatusMeaning("DENIED", lang)!.summary).toMatch(/[(（]Certifying Officer[)）]/);
    }
  });

  it("reads in Spanish and Korean", () => {
    expect(getStatusMeaning("RFI ISSUED", "es")!.summary).toContain("no es una auditoría");
    expect(getStatusMeaning("ANALYST REVIEW", "es")!.summary).toMatch(/^La fila normal\./);
    expect(getStatusMeaning("CERTIFIED", "ko")!.summary).toContain("영주권");
    expect(getStatusMeaning("CERTIFIED", "ko")!.label).toBe("Certified");
    expect(getStatusMeaning("rfi issued", "zh")!.status).toBe("RFI ISSUED");
    expect(getStatusMeaning("SOME NEW DOL STATE", "vi")).toBeNull();
  });

  it("keeps the house prose rules in every language", () => {
    for (const lang of OTHER) {
      for (const m of allStatusMeanings(lang)) {
        for (const field of [m.summary, m.action ?? "", m.deadline ?? ""]) {
          expect(field, `${lang} ${m.status}`).not.toContain("\u2014");
          expect(field, `${lang} ${m.status}`).not.toMatch(/[!\uFF01]/);
        }
      }
    }
  });

  it("uses full-width punctuation in Chinese", () => {
    for (const m of allStatusMeanings("zh")) {
      for (const field of [m.summary, m.action ?? "", m.deadline ?? ""]) {
        // A Latin comma or full stop right after a Chinese character is the half-width slip.
        expect(field, m.status).not.toMatch(/[\u4e00-\u9fff][,.;:]/);
      }
    }
  });

  it("words the kind of each status in every language, and English is unchanged", () => {
    expect(KIND_LABEL).toEqual({
      queue: "Waiting",
      action: "Something is due",
      appeal: "Under appeal",
      decided: "Decided",
    });
    expect(kindLabel("action")).toBe("Something is due");
    expect(kindLabel("decided", "es")).toBe("Decidido");
    expect(kindLabel("queue", "zh")).toBe("等待中");
    for (const lang of OTHER) {
      for (const k of ["queue", "action", "appeal", "decided"] as const) {
        expect(kindLabel(k, lang)).not.toBe(KIND_LABEL[k]);
      }
    }
  });
});
