import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import PAGE_DATES from "@/lib/sitemap/page-dates.json";
import {
  bulletinMonthDate,
  changed,
  DATE_SOURCE,
  employerOwnDate,
  OWN_DATE,
  pageDate,
  routeOf,
  TEMPLATE_DAY,
} from "@/lib/pageDates";

const dates = PAGE_DATES as Record<string, string>;
const ROOT = path.resolve(__dirname, "../../..");

describe("pageDate", () => {
  it("is the code's day when the page prints no figures", () => {
    expect(pageDate("/terms", { dol: "2099-01-01" })).toBe(dates["/terms"]);
  });

  it("is the figures' day when they moved after the code did", () => {
    expect(pageDate("/perm-processing-times", { dol: "2099-01-01" })).toBe("2099-01-01");
    expect(pageDate("/perm-queue", { sweep: "2099-01-02" })).toBe("2099-01-02");
    expect(pageDate("/blog", { posts: "2099-01-03" })).toBe("2099-01-03");
  });

  it("is never older than the code, however old the figures", () => {
    expect(pageDate("/perm-processing-times", { dol: "2001-01-01" })).toBe(changed("/perm-processing-times"));
  });

  it("falls back to the code's day when a source is missing", () => {
    expect(pageDate("/perm-processing-times", {})).toBe(changed("/perm-processing-times"));
  });

  it("dates an older bulletin by its code alone and the newest by DOL's day too", () => {
    expect(bulletinMonthDate(false, { dol: "2099-01-01" })).toBe(changed("/visa-bulletin/[month]"));
    expect(bulletinMonthDate(true, { dol: "2099-01-01" })).toBe("2099-01-01");
  });

  it("dates an unpublished employer by its own cases, else the sweep", () => {
    expect(employerOwnDate("2099-05-05", { sweep: "2099-01-01" })).toBe("2099-05-05");
    expect(employerOwnDate(null, { sweep: "2099-01-01" })).toBe("2099-01-01");
    expect(employerOwnDate(null, {})).toBe(changed("/perm-employers/[slug]"));
  });
});

describe("a template's day", () => {
  const templates = Object.keys(dates).filter((r) => r.includes("[") && !r.startsWith("/cases"));

  it("is set by hand for every public template", () => {
    // A template left to git would take the day of any commit to anything it
    // imports, and re-date every page it serves.
    expect(templates.filter((r) => !(r in TEMPLATE_DAY))).toEqual([]);
    expect(Object.keys(TEMPLATE_DAY).filter((r) => !(r in dates))).toEqual([]);
  });

  it("is the hand-set day, never the git day", () => {
    for (const r of templates) expect(changed(r), r).toBe(TEMPLATE_DAY[r]);
  });

  it("is a date", () => {
    for (const [r, day] of Object.entries(TEMPLATE_DAY)) expect(day, r).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("still gives way to newer figures", () => {
    expect(pageDate("/perm-employers/[slug]", { corpus: "2099-01-01" })).toBe("2099-01-01");
    expect(pageDate("/perm-employers/[slug]", { corpus: "2001-01-01" })).toBe(TEMPLATE_DAY["/perm-employers/[slug]"]);
  });
});

describe("routeOf", () => {
  it("names a page by its own route", () => {
    expect(routeOf("/perm-processing-times")).toBe("/perm-processing-times");
    expect(routeOf("/")).toBe("/");
    expect(routeOf("/perm-processing-times/")).toBe("/perm-processing-times");
  });

  it("names a filled template by the template", () => {
    expect(routeOf("/perm-wages/software-developers")).toBe("/perm-wages/[slug]");
    expect(routeOf("/perm-queue/2025-11")).toBe("/perm-queue/[month]");
    expect(routeOf("/visa-bulletin/categories/eb2-india")).toBe("/visa-bulletin/categories/[line]");
  });

  it("prefers a fixed route over a template that would also match", () => {
    expect(routeOf("/perm-employers/compare")).toBe("/perm-employers/compare");
    expect(routeOf("/perm-employers/browse")).toBe("/perm-employers/browse");
    expect(routeOf("/perm-employers/browse/a")).toBe("/perm-employers/browse/[letter]");
  });

  it("names nothing for an address no route serves", () => {
    expect(routeOf("/no-such-page/at-all")).toBeNull();
  });
});

describe("the date table", () => {
  it("names only routes the app has", () => {
    expect(Object.keys(DATE_SOURCE).filter((r) => !(r in dates))).toEqual([]);
    expect([...OWN_DATE].filter((r) => !(r in dates))).toEqual([]);
  });

  it("is what the sitemap dates its pages by", () => {
    // The sitemap reads pageDate for every static page and family. A date
    // worked out beside it would let the lastmod and the "Updated" line drift.
    const build = readFileSync(path.join(ROOT, "src/lib/sitemap/build.ts"), "utf8");
    expect(build).toMatch(/const at = \(route: string\) => pageDate\(route, sources\)/);
    expect(build).not.toMatch(/lastModified: (?:dol|latest|asOf|queueAsOf|h1bAsOf|lastChanged \?\? fallback)\b/);
  });

  it("is what every page that dates itself reads", () => {
    for (const file of [
      "src/app/(site)/(public)/perm-employers/[slug]/page.tsx",
      "src/app/(site)/(public)/visa-bulletin/[month]/page.tsx",
      "src/components/h1b/H1bEmployersPage.tsx",
    ]) {
      const src = readFileSync(path.join(ROOT, file), "utf8");
      expect(src, file).toMatch(/<SiteBreadcrumbs date=\{updated\} \/>/);
      expect(src, file).toMatch(/(?:pageDate|employerOwnDate|bulletinMonthDate)\(/);
    }
  });
});
