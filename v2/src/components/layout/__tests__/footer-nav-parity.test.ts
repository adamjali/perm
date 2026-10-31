import { describe, expect, it } from "vitest";
import { readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import {
  CALCULATOR_PAGES,
  DATA_MENU_FOOTER,
  FOOTER_COLUMNS,
  FOOTER_LEGAL,
  HEADER_PAGES,
  LEARN_PAGES,
  PAGE_NAMES,
  SECTIONS,
} from "@/lib/siteMap";

/**
 * Every public page can be reached from the header, its two menus or the
 * footer, and every one of them is called by its one name.
 *
 * The old footer and menus were transcribed separately and drifted: FAQ sat
 * under Product, Methodology was in the dropdown and nowhere in the footer,
 * and a whole reference cluster was reachable only from a side menu. They're
 * all read from lib/siteMap.ts now; this walks the page files so a new page
 * that's in no menu fails here instead of shipping unreachable.
 */

const PUBLIC = resolve(__dirname, "..", "..", "..", "app", "(site)", "(public)");

/** Every static public page (no [param] in its path). */
function staticPages(dir = PUBLIC, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (!statSync(p).isDirectory() || name.startsWith("[") || name.startsWith("_") || name === "__tests__") continue;
    if (existsSync(join(p, "page.tsx"))) out.push(`/${relative(PUBLIC, p)}`);
    staticPages(p, out);
  }
  return out;
}

/** Reached from the page they belong to, not from a menu, and why. */
const REACHED_FROM_PARENT: Record<string, string> = {
  "/perm-employers/browse": "the A to Z link on the employers list",
  "/perm-attorneys/browse": "the A to Z link on the law firms list",
  "/perm-wages/browse": "the A to Z link on the wages list",
  "/visa-bulletin/family": "a tab on the visa bulletin page",
  "/visa-bulletin/categories": "a tab on the visa bulletin page",
};

describe("every page is reachable, under one name", () => {
  const reachable = new Set<string>([
    "/",
    ...Object.values(HEADER_PAGES).map((p) => p.href),
    ...SECTIONS.map((p) => p.href),
    ...LEARN_PAGES.map((p) => p.href),
    ...DATA_MENU_FOOTER.map((p) => p.href),
    ...FOOTER_COLUMNS.flatMap((c) => c.pages.map((p) => p.href)),
    ...FOOTER_LEGAL.map((p) => p.href),
    // Calculators are in the Calculators index, its section list and the menu foot.
    ...CALCULATOR_PAGES.map((p) => p.href),
    ...Object.keys(REACHED_FROM_PARENT),
  ]);

  it("found the public pages", () => {
    expect(staticPages().length).toBeGreaterThan(80);
  });

  it("reaches every static public page from a menu, the footer or its parent", () => {
    expect(staticPages().filter((p) => !reachable.has(p))).toEqual([]);
  });

  it("names every footer link by the page's one name", () => {
    for (const c of FOOTER_COLUMNS) for (const p of c.pages) expect(p.name, p.href).toBe(PAGE_NAMES.get(p.href));
  });

  it("never points two footer links at one page", () => {
    const hrefs = [...FOOTER_COLUMNS.flatMap((c) => c.pages.map((p) => p.href)), ...FOOTER_LEGAL.map((p) => p.href)];
    expect(hrefs.length).toBe(new Set(hrefs).size);
  });

  it("keeps the footer to three columns", () => {
    expect(FOOTER_COLUMNS.map((c) => c.title)).toEqual(["Cases and data", "Learn", "PERM Tracker"]);
  });
});
