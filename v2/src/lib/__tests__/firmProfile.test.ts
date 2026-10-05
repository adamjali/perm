import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DESCRIPTION_MAX,
  PERSONAL_DOMAINS,
  PERSONAL_FIRST_LABELS,
  SHARED_LIMIT,
  checkProfile,
  claimVerdict,
  emailDomain,
  hasContent,
  isPersonalDomain,
  normalizeWebsite,
  websiteMatchesDomain,
  type DomainRow,
} from "../firmProfile";

describe("what a firm may publish", () => {
  it("keeps a clean profile, normalised", () => {
    const r = checkProfile({
      website: " https://www.smithimmigration.com/about#team ",
      description: "We  file PERM and H-1B cases.\n\n\n\nSpanish spoken.",
      languages: ["Spanish", "spanish", "Mandarin"],
      offices: [{ city: "Tampa", state: "fl" }, { city: "tampa", state: "FL" }],
      focus: ["h1b", "perm", "perm", "made-up"],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.profile.website).toBe("https://www.smithimmigration.com/about");
    expect(r.profile.description).toBe("We file PERM and H-1B cases.\n\nSpanish spoken.");
    expect(r.profile.languages).toEqual(["Spanish", "Mandarin"]);
    expect(r.profile.offices).toEqual([{ city: "Tampa", state: "FL" }]);
    // Fixed order and only known ids.
    expect(r.profile.focus).toEqual(["perm", "h1b"]);
    expect(hasContent(r.profile)).toBe(true);
  });

  it.each([
    ["http://firm.com", "plain http"],
    ["https://user:pw@firm.com", "credentials"],
    ["https://firm.com:8443", "a port"],
    ["javascript:alert(1)", "a script"],
    ["https://localhost", "no dot"],
    [`https://firm.com/${"a".repeat(200)}`, "too long"],
  ])("refuses a website with %s (%s)", (site) => {
    expect(normalizeWebsite(site)).toBeNull();
    const r = checkProfile({ website: site });
    expect(r.ok).toBe(false);
  });

  it.each([
    ["Visit https://firm.com", "a link"],
    ["See www.firm.com", "a bare host"],
    ["Our site firm.law has more", "a domain"],
    ["Write to us at info@firm.com", "an address"],
    ["Call (813) 555-0100 today", "a phone number"],
    ["<b>Bold</b>", "markup"],
  ])("refuses a description with %s (%s)", (description) => {
    const r = checkProfile({ description });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.description).toBeTruthy();
  });

  it("refuses a description over the limit, measured after spaces collapse", () => {
    expect(checkProfile({ description: "a ".repeat(DESCRIPTION_MAX) }).ok).toBe(false);
    expect(checkProfile({ description: "a".repeat(DESCRIPTION_MAX) }).ok).toBe(true);
  });

  it("refuses an office outside the state list or without a city", () => {
    expect(checkProfile({ offices: [{ city: "Tampa", state: "ZZ" }] }).ok).toBe(false);
    expect(checkProfile({ offices: [{ city: "", state: "FL" }] }).ok).toBe(false);
    // An empty row is a blank form line, not an error.
    expect(checkProfile({ offices: [{ city: "", state: "" }] }).ok).toBe(true);
  });

  it("refuses a language that isn't a word, and too many of them", () => {
    expect(checkProfile({ languages: ["Spanish1"] }).ok).toBe(false);
    expect(checkProfile({ languages: Array.from({ length: 13 }, (_, i) => `Lang${"a".repeat(i)}`) }).ok).toBe(false);
  });

  it("treats a non-array or non-object as nothing", () => {
    const r = checkProfile({ languages: "Spanish", offices: "Tampa", focus: "perm" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(hasContent(r.profile)).toBe(false);
  });
});

describe("a website on the verified domain", () => {
  it.each([
    ["https://www.firm.com", "firm.com", true],
    ["https://immigration.firm.com", "firm.com", true],
    ["https://firm.com", "us.firm.com", true],
    ["https://firm.com.evil.net", "firm.com", false],
    ["https://otherfirm.com", "firm.com", false],
  ])("%s for an address at %s: %s", (site, domain, ok) => {
    expect(websiteMatchesDomain(site, domain)).toBe(ok);
  });
});

describe("the claim check", () => {
  const row = (page_slug: string, filings: number, firm_filings: number, program = "perm"): DomainRow => ({
    page_slug,
    program,
    filings,
    firm_filings,
  });

  it("reads a domain from an address, or nothing", () => {
    expect(emailDomain(" Jane@Firm.COM ")).toBe("firm.com");
    expect(emailDomain("no-at-sign")).toBeNull();
    expect(emailDomain("a@localhost")).toBeNull();
    expect(emailDomain(`${"a".repeat(250)}@firm.com`)).toBeNull();
  });

  it("verifies a domain DOL prints beside the firm on two filings", () => {
    expect(claimVerdict("firm.com", "firm", [row("firm", 2, 40)])).toEqual({ verified: true, filings: 2 });
  });

  it("sums the programs", () => {
    expect(claimVerdict("firm.com", "firm", [row("firm", 1, 30), row("firm", 1, 20, "lca")]).verified).toBe(true);
  });

  it("verifies a one-filing firm whose only emailed filing used the domain", () => {
    expect(claimVerdict("tiny.com", "tiny", [row("tiny", 1, 1)]).verified).toBe(true);
  });

  it("sends one stray filing at a big firm to review", () => {
    expect(claimVerdict("x.com", "big", [row("big", 1, 500)])).toEqual({ verified: false, reason: "too_few", filings: 1 });
  });

  it("sends a domain DOL never printed beside this firm to review", () => {
    expect(claimVerdict("x.com", "firm", [row("other", 9, 9)])).toMatchObject({ verified: false, reason: "not_listed" });
    expect(claimVerdict("x.com", "firm", [])).toMatchObject({ verified: false, reason: "not_listed" });
  });

  it("never verifies personal mail, whatever DOL printed", () => {
    expect(claimVerdict("gmail.com", "firm", [row("firm", 50, 50)])).toMatchObject({ verified: false, reason: "personal" });
    expect(claimVerdict("yahoo.co.uk", "firm", [])).toMatchObject({ verified: false, reason: "personal" });
  });

  it("never verifies a domain DOL prints beside more than SHARED_LIMIT firms", () => {
    const rows = Array.from({ length: SHARED_LIMIT + 1 }, (_, i) => row(i === 0 ? "firm" : `f${i}`, 5, 5));
    expect(claimVerdict("shared.com", "firm", rows)).toMatchObject({ verified: false, reason: "shared" });
    expect(claimVerdict("shared.com", "firm", rows.slice(0, SHARED_LIMIT)).verified).toBe(true);
  });
});

describe("the personal-mail list matches the table builder's", () => {
  it("is the same set in scripts/build_firm_domains.py", () => {
    const py = readFileSync(join(process.cwd(), "scripts/build_firm_domains.py"), "utf8");
    const set = (name: string) => {
      const m = py.match(new RegExp(`${name} = frozenset\\(\\{([^}]*)\\}\\)`));
      expect(m, name).not.toBeNull();
      return new Set([...(m![1]!.matchAll(/"([^"]+)"/g))].map((x) => x[1]));
    };
    expect(set("PERSONAL_DOMAINS")).toEqual(new Set(PERSONAL_DOMAINS));
    expect(set("PERSONAL_FIRST_LABELS")).toEqual(new Set(PERSONAL_FIRST_LABELS));
    expect(Number(py.match(/^SHARED_LIMIT = (\d+)/m)?.[1])).toBe(SHARED_LIMIT);
    expect(isPersonalDomain("hotmail.fr")).toBe(true);
  });
});
