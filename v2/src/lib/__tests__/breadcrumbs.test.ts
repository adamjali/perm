import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { breadcrumbTrail } from "../breadcrumbs";

const names = (path: string) => breadcrumbTrail(path).map((c) => c.name);

describe("breadcrumbTrail", () => {
  it.each([
    ["/about", ["Home", "About"]],
    ["/tools", ["Home", "Data"]],
    ["/perm-case-status", ["Home", "Data", "Case status"]],
    ["/perm-employers/adobe-inc", ["Home", "Data", "Employers"]],
    ["/perm-employers/browse/a", ["Home", "Data", "Employers", "Browse A to Z", "A"]],
    ["/perm-queue/2025-11", ["Home", "Data", "Queue backlog", "November 2025"]],
    ["/visa-bulletin/2026-10", ["Home", "Data", "Visa bulletin", "October 2026"]],
    ["/visa-bulletin/categories/eb2-india", ["Home", "Data", "Visa bulletin", "By category and country"]],
    ["/tools/perm-timeline-calculator", ["Home", "Data", "Calculators", "PERM processing time"]],
    ["/tools/priority-date-calculator", ["Home", "Data", "Priority dates"]],
    ["/guides/what-emma-told-you", ["Home", "Guides"]],
    ["/privacy/", ["Home", "Privacy Policy"]],
  ])("%s", (path, want) => {
    expect(names(path)).toEqual(want);
  });

  it("has no trail on the home page", () => {
    expect(breadcrumbTrail("/")).toEqual([]);
  });

  it("links every ancestor to a page that exists", () => {
    const routes = new Set<string>(JSON.parse(readFileSync("scripts/known-routes.json", "utf8")));
    routes.add("/");
    for (const path of ["/tools/perm-timeline-calculator", "/perm-employers/browse/a", "/visa-bulletin/2026-10"]) {
      // The last crumb is the page itself, which may be generated (a month).
      for (const crumb of breadcrumbTrail(path).slice(0, -1)) {
        expect(routes.has(crumb.href), `${path}: ${crumb.href}`).toBe(true);
      }
    }
  });

  it("names every top-level public page, so no page ships without a trail", () => {
    // Read from the page files themselves, so a new page is checked the day it lands.
    const root = join("src", "app", "(site)", "(public)");
    const pages = readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("[") && !d.name.startsWith("("))
      .filter((d) => readdirSync(join(root, d.name)).includes("page.tsx"))
      .map((d) => `/${d.name}`);
    expect(pages.length).toBeGreaterThan(40);
    const unnamed = pages.filter((r) => breadcrumbTrail(r).at(-1)?.href !== r);
    expect(unnamed).toEqual([]);
  });
});
