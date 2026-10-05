import { describe, expect, it } from "vitest";

import { lookupUrl, parseLookup, type LookupAnswer } from "../src/api";
import { panelFor } from "../src/model";

// What the panel says for each answer. The rules that matter: a possible
// match always says "possible" and names what it matched; no record is said
// plainly with a way to search; a certified share appears only when the API
// gave one (the site withholds it under 30 decided cases).

const meta = { source: "DOL", asOf: "2026-06-30", url: "https://permtracker.app/perm-employers/google-llc" };

function answer(match: "exact" | "possible" | "none", employer: Record<string, unknown> | null): LookupAnswer {
  return { data: { query: "Google", match, employer, shareFloor: 30 } as LookupAnswer["data"], meta };
}

const google = {
  name: "GOOGLE LLC",
  slug: "google-llc",
  url: "https://permtracker.app/perm-employers/google-llc",
  page: "perm",
  perm: { published: 9000, certified: 8800, denied: 100, certifiedShare: 0.989, pending: 160, newestFiling: "2026-10-01", filingsLast12Months: 2100 },
  h1bLcas: 54321,
  wageRequests: null,
};

describe("panelFor", () => {
  it("an exact match: the figures, the date they're true for and the record's link", () => {
    const p = panelFor({ kind: "answer", answer: answer("exact", google) });
    expect(p.title).toBe("GOOGLE LLC");
    expect(p.notice).toBeUndefined();
    expect(p.rows).toEqual([
      { label: "PERM cases published", value: "9,000" },
      { label: "Certified", value: "99%", note: "of decided cases" },
      { label: "Waiting at DOL now", value: "160" },
      { label: "Newest PERM filing", value: "Oct 1, 2026" },
      { label: "H-1B applications (LCAs)", value: "54,321" },
    ]);
    expect(p.link).toEqual({ href: google.url, text: "See the full record" });
    expect(p.footer).toContain("Jun 30, 2026");
  });

  it("a possible match says so and names what it matched", () => {
    const p = panelFor({ kind: "answer", answer: answer("possible", google) });
    expect(p.notice).toMatch(/^Possible match: GOOGLE LLC\./);
    expect(p.tone).toBe("caution");
  });

  it("no record is said plainly, with a search", () => {
    const p = panelFor({ kind: "answer", answer: { ...answer("none", null), meta: { ...meta, url: "https://permtracker.app/perm-employers?q=Acme" } } });
    expect(p.title).toBe("Google");
    expect(p.rows).toEqual([]);
    expect(p.notice).toMatch(/No PERM or H-1B record/);
    expect(p.link).toEqual({ href: "https://permtracker.app/perm-employers?q=Acme", text: "Search PERM Tracker" });
  });

  it("gives no rate when the API withheld it, and says why", () => {
    const thin = { ...google, perm: { ...google.perm, published: 12, certified: 10, denied: 1, certifiedShare: null } };
    const p = panelFor({ kind: "answer", answer: answer("exact", thin) });
    expect(p.rows.find((r) => r.label === "Certified")).toEqual({ label: "Certified", value: "Too few to say", note: "under 30 decided" });
  });

  it("an employer with no published PERM case leads with what it does file", () => {
    const other = { ...google, page: "other", perm: { ...google.perm, published: 0, certifiedShare: null, pending: null, newestFiling: null }, h1bLcas: 50, wageRequests: 4 };
    const p = panelFor({ kind: "answer", answer: answer("exact", other) });
    expect(p.rows).toEqual([
      { label: "PERM cases published", value: "None yet" },
      { label: "H-1B applications (LCAs)", value: "50" },
      { label: "Prevailing wage requests", value: "4" },
    ]);
  });

  it("loading, and a failure with the server's own words", () => {
    expect(panelFor({ kind: "loading", name: "Acme" }).title).toBe("Acme");
    const e = panelFor({ kind: "error", name: "Acme", message: "This address has made 60 lookups this minute. Try again in 20 seconds." });
    expect(e.notice).toContain("Try again in 20 seconds");
    expect(e.retry).toBe(true);
  });
});

describe("the API answer", () => {
  it("asks for the name and nothing else", () => {
    expect(lookupUrl("Acme & Sons")).toBe("https://permtracker.app/v1/lookup/employer?name=Acme+%26+Sons");
  });

  it("accepts a well-formed answer and refuses anything else", () => {
    const good = answer("exact", google);
    expect(parseLookup(good)).toEqual(good);
    expect(parseLookup({ data: { match: "maybe" }, meta })).toBeNull();
    expect(parseLookup({ data: { match: "exact", employer: { name: 3 } }, meta })).toBeNull();
    expect(parseLookup({ data: { match: "exact", query: "G", shareFloor: 30, employer: { ...google, url: "https://evil.example/x" } }, meta })).toBeNull();
    expect(parseLookup("nope")).toBeNull();
  });
});
