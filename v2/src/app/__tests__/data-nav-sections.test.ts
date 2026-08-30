import { describe, expect, it } from "vitest";

import {
  GROUPS,
  OVERVIEW,
  SECTIONS,
  isDataPath,
  sectionForPath,
} from "@/components/tools/dataSections";

/**
 * Every data page highlights its own entry in the rail.
 *
 * THIS TEST USED TO CHECK SOMETHING ELSE, AND THE CHANGE IS THE POINT. The old
 * two-tier bar was rendered by each of 28 pages, each passing an `active` prop
 * naming its own section - a fact stated twice, once by the route the page
 * lives at and once by hand. It drifted twice: `/perm-cases` shipped
 * `active="employers"`, telling a visitor they were on the Employers page, and
 * `/perm-queue` borrowed `"overview"`, whose entry points at `/tools`. Neither
 * was visible from reading the page it was on, which is why the gate existed.
 *
 * The rail derives the current section from the pathname, so the second copy
 * is gone and that class of drift is not possible rather than merely caught.
 * What is worth testing now is the derivation itself, and in particular the
 * two ways it could quietly be wrong.
 */

describe("sectionForPath", () => {
  it("matches every section at its own href", () => {
    // A gate that cannot see its subject reads exactly like a pass.
    expect(SECTIONS.length).toBeGreaterThan(10);
    for (const s of SECTIONS) {
      expect(sectionForPath(s.href)?.key, `${s.href} should be ${s.key}`).toBe(
        s.key,
      );
    }
  });

  it("prefers the LONGEST match, not the first one in the list", () => {
    // The trap this list actually contains: `/tools` is the Overview and
    // `/tools/priority-date-calculator` is the visa bulletin. A first-match
    // scan would file every calculator under whichever entry happened to be
    // written earlier, and the list's order is not something anyone maintains
    // deliberately.
    expect(sectionForPath("/tools/priority-date-calculator")?.key).toBe(
      "visa-bulletin",
    );
    // /tools itself belongs to no group: Overview sits above them.
    expect(sectionForPath("/tools")).toBeNull();
  });

  it("puts a detail page under its parent section", () => {
    // The behaviour an earlier path-prefix audit got wrong, reporting eleven
    // mismatches of which ten were this: a child route legitimately highlights
    // the index it belongs to.
    expect(sectionForPath("/perm-employers/apple-inc")?.key).toBe("employers");
    expect(sectionForPath("/perm-queue/2025-11")?.key).toBe("queue");
    expect(sectionForPath("/perm-rfi-audit/rfi-issued")?.key).toBe("rfi-audit");
  });

  it("does not match a route that merely starts with the same letters", () => {
    // `/perm-cases` and `/perm-case-status` share a prefix up to the hyphen.
    // A naive `startsWith` without the boundary would put the case search
    // under case status, or the reverse, depending on order.
    expect(sectionForPath("/perm-cases")?.key).toBe("cases");
    expect(sectionForPath("/perm-case-status")?.key).toBe("case-status");
  });

  it("returns null off the data surface, so the rail never appears there", () => {
    for (const p of ["/", "/faq", "/contact", "/blog", "/privacy", "/signup"]) {
      expect(sectionForPath(p), `${p} is not a data page`).toBeNull();
    }
  });

  it("ignores a trailing slash", () => {
    expect(sectionForPath("/perm-queue/")?.key).toBe("queue");
  });
});

describe("isDataPath", () => {
  it("covers Overview, every section, and every detail page", () => {
    expect(isDataPath(OVERVIEW.href)).toBe(true);
    for (const s of SECTIONS) expect(isDataPath(s.href), s.href).toBe(true);
    expect(isDataPath("/perm-employers/apple-inc")).toBe(true);
  });

  it("excludes the marketing and legal pages", () => {
    for (const p of ["/", "/faq", "/contact", "/privacy", "/terms", "/blog"]) {
      expect(isDataPath(p), p).toBe(false);
    }
  });
});

describe("the section map itself", () => {
  it("gives every section a group the rail actually renders", () => {
    // An entry whose group is not in GROUPS is unreachable: the rail iterates
    // GROUPS, so the page would exist and appear in no list. That is how
    // /perm-rfi-audit ended up with zero inbound links once already.
    for (const s of SECTIONS) {
      expect(GROUPS, `${s.key} is in group "${s.group}"`).toContain(s.group);
    }
  });

  it("has no duplicate keys or hrefs", () => {
    expect(new Set(SECTIONS.map((s) => s.key)).size).toBe(SECTIONS.length);
    expect(new Set(SECTIONS.map((s) => s.href)).size).toBe(SECTIONS.length);
  });

  it("keeps Overview out of the groups", () => {
    // It is the parent of every group rather than a peer of any item, and
    // filing it under one is what made the old first group incoherent.
    expect(SECTIONS.some((s) => s.href === OVERVIEW.href)).toBe(false);
  });

  it("leaves no group empty", () => {
    for (const g of GROUPS) {
      expect(SECTIONS.filter((s) => s.group === g).length, g).toBeGreaterThan(0);
    }
  });
});
