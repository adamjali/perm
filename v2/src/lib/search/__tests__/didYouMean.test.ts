import { describe, expect, it } from "vitest";

import { familyOf, suggestForPath } from "../didYouMean";

const PAGES = [
  { label: "Processing times", href: "/perm-processing-times", group: "Data", keywords: "" },
  { label: "Visa bulletin", href: "/visa-bulletin", group: "Data", keywords: "" },
  { label: "For attorneys", href: "/for-attorneys", group: "Go to", keywords: "" },
  { label: "Employers", href: "/perm-employers", group: "Data", keywords: "" },
];
const ARTICLES = [
  { title: "How to check a PERM case status", href: "/guides/check-perm-case-status", kind: "Guide" },
  { title: "Common PERM audit triggers", href: "/blog/common-perm-audit-triggers", kind: "Blog" },
];

describe("suggestForPath", () => {
  it("finds the page a mistyped address meant", () => {
    expect(suggestForPath("/perm-procesing-times", PAGES, ARTICLES).pages[0]?.href).toBe("/perm-processing-times");
    expect(suggestForPath("/vissa-bulletin", PAGES, ARTICLES).pages[0]?.href).toBe("/visa-bulletin");
    expect(suggestForPath("/for-attorney", PAGES, ARTICLES).pages[0]?.href).toBe("/for-attorneys");
  });

  it("turns a missing employer page into a search of employers for the words", () => {
    const s = suggestForPath("/perm-employers/amazn-services", PAGES, ARTICLES);
    expect(s.family?.kind).toBe("employer");
    expect(s.family?.query).toBe("amazn services");
    expect(s.family?.searchHref).toBe("/perm-employers?q=amazn%20services");
  });

  it("knows a family even when its own name is mistyped", () => {
    expect(familyOf("perm-employer")?.base).toBe("/perm-employers");
    expect(familyOf("perm-cites")?.base).toBe("/perm-cities");
    expect(familyOf("nothing-like-it")).toBeNull();
  });

  it("matches a mistyped article address against the articles", () => {
    const s = suggestForPath("/guides/check-perm-case-staus", PAGES, ARTICLES);
    expect(s.pages[0]?.href).toBe("/guides/check-perm-case-status");
  });

  it("suggests nothing for an address that resembles nothing", () => {
    const s = suggestForPath("/zzqx-wpvk", PAGES, ARTICLES);
    expect(s.pages).toEqual([]);
    expect(s.family).toBeNull();
  });

  it("reads an encoded address as the words someone typed", () => {
    const s = suggestForPath("/perm-employers/Jos%C3%A9%20Farms", PAGES, ARTICLES);
    expect(s.family?.query).toBe("josé farms");
  });
});
