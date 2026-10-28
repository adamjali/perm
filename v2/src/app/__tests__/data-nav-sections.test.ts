import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  CALCULATORS,
  CALCULATOR_PAGES,
  FOOTER_COLUMNS,
  GROUPS,
  LEARN_PAGES,
  OVERVIEW,
  PAGE_NAMES,
  SECTIONS,
  isDataPath,
  sectionForPath,
  sectionPages,
} from "@/lib/siteMap";

/**
 * The site map (lib/siteMap.ts): one name per page, and every data page in
 * exactly one group of the Data menu.
 *
 * The section a page is in comes from its URL, never from a prop the page
 * passes, so a page can't claim the wrong section. What's tested here is that
 * derivation, and that the map points only at pages that exist.
 */

const PUBLIC = resolve(__dirname, "..", "(site)", "(public)");

/** Whether a public path has a page file (static or under a [param] folder). */
function pageExists(href: string): boolean {
  if (href === "/") return existsSync(join(PUBLIC, "page.tsx"));
  return existsSync(join(PUBLIC, ...href.split("/").filter(Boolean), "page.tsx"));
}

describe("sectionForPath", () => {
  it("matches every section at its own href", () => {
    expect(SECTIONS.length).toBeGreaterThan(30);
    for (const s of SECTIONS) expect(sectionForPath(s.href)?.key, s.href).toBe(s.key);
  });

  it("files every calculator under the step it serves, by the longest match", () => {
    expect(sectionForPath("/tools/priority-date-calculator")?.key).toBe("priority-dates");
    expect(sectionForPath("/tools/perm-timeline-calculator")?.group).toBe("PERM");
    expect(sectionForPath("/tools/rfi-deadline")?.group).toBe("PERM");
    expect(sectionPages("/tools/rfi-deadline")?.title).toBe("PERM");
    // /tools itself is the Data hub, above every group.
    expect(sectionForPath(OVERVIEW.href)).toBeNull();
  });

  it("lists every calculator once, in its step's group, and nothing else as one", () => {
    const tools = SECTIONS.filter((s) => s.tool);
    expect(CALCULATOR_PAGES.map((p) => p.href)).toEqual(tools.map((s) => s.href));
    for (const s of tools) expect(GROUPS, s.href).toContain(s.group);
  });

  it("files a calculator with no entry under the calculators index", () => {
    expect(sectionForPath("/tools/not-a-real-calculator")?.key).toBe(CALCULATORS.key);
    expect(sectionPages("/tools/not-a-real-calculator")?.pages).toBe(CALCULATOR_PAGES);
  });

  it("puts a detail page under its parent section", () => {
    expect(sectionForPath("/perm-employers/apple-inc")?.key).toBe("employers");
    expect(sectionForPath("/perm-queue/2025-11")?.key).toBe("queue");
    expect(sectionForPath("/perm-rfi-audit/rfi-issued")?.key).toBe("rfi-audit");
    expect(sectionForPath("/visa-bulletin/2026-10")?.key).toBe("visa-bulletin");
  });

  it("does not match a route that merely starts with the same letters", () => {
    expect(sectionForPath("/perm-cases")?.key).toBe("cases");
    expect(sectionForPath("/perm-case-status")?.key).toBe("case-status");
  });

  it("returns null off the data surface", () => {
    for (const p of ["/", "/faq", "/contact", "/blog", "/privacy", "/signup", "/glossary"]) {
      expect(sectionForPath(p), p).toBeNull();
      expect(isDataPath(p), p).toBe(false);
    }
  });

  it("ignores a trailing slash and a query", () => {
    expect(sectionForPath("/perm-queue/")?.key).toBe("queue");
    expect(sectionForPath("/perm-case-status?case=G-100-26005-533577")?.key).toBe("case-status");
  });
});

describe("the map itself", () => {
  it("gives every section one of the groups, the steps in the order a case takes them, and no group is empty", () => {
    const steps = ["Wage request", "Recruitment", "PERM", "I-140", "Green card line"] as const;
    expect(steps.map((g) => GROUPS.indexOf(g))).toEqual([...steps.map((g) => GROUPS.indexOf(g))].sort((a, b) => a - b));
    for (const s of SECTIONS) expect(GROUPS, s.key).toContain(s.group);
    for (const g of GROUPS) expect(SECTIONS.filter((s) => s.group === g).length, g).toBeGreaterThan(0);
  });

  it("keeps each group short enough to scan: at most nine pages", () => {
    for (const g of GROUPS) expect(SECTIONS.filter((s) => s.group === g).length, g).toBeLessThanOrEqual(9);
  });

  it("has no duplicate keys or hrefs", () => {
    expect(new Set(SECTIONS.map((s) => s.key)).size).toBe(SECTIONS.length);
    expect(new Set(SECTIONS.map((s) => s.href)).size).toBe(SECTIONS.length);
  });

  it("points only at pages that exist", () => {
    const hrefs = [
      ...SECTIONS.map((s) => s.href),
      ...CALCULATOR_PAGES.map((p) => p.href),
      ...LEARN_PAGES.map((p) => p.href),
      ...FOOTER_COLUMNS.flatMap((c) => c.pages.map((p) => p.href)),
      OVERVIEW.href,
      CALCULATORS.href,
    ];
    const missing = [...new Set(hrefs)].filter((h) => !pageExists(h));
    expect(missing).toEqual([]);
  });

  it("names every page it lists", () => {
    for (const s of SECTIONS) expect(PAGE_NAMES.get(s.href), s.href).toBe(s.name);
    for (const p of CALCULATOR_PAGES) expect(PAGE_NAMES.get(p.href), p.href).toBeTruthy();
  });

  it("lists every calculator page the site has", () => {
    // A calculator page nobody lists is reachable only by search.
    const tools = resolve(PUBLIC, "tools");
    const onDisk = readdirSync(tools)
      .filter((d) => statSync(join(tools, d)).isDirectory() && existsSync(join(tools, d, "page.tsx")))
      .map((d) => `/tools/${d}`);
    const listed = new Set(CALCULATOR_PAGES.map((p) => p.href));
    expect(onDisk.filter((h) => !listed.has(h))).toEqual([]);
  });
});
