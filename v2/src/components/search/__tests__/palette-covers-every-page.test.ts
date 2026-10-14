import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { staticIndex } from "@/lib/search/siteIndex";

/**
 * Every public page must be reachable from the search palette.
 *
 * The palette's index is built from the site map (lib/siteMap.ts), so a page
 * the map names is searchable. A page the map doesn't name isn't, which is
 * how the A-to-Z hubs were once unsearchable without anyone noticing; this
 * walks every route against the index.
 *
 * Reads the app tree rather than a list, so a page added tomorrow is covered
 * by the same walk.
 */

const ROOT = join(__dirname, "..", "..", "..", "..");
const PUBLIC_DIR = join(ROOT, "src", "app", "(site)", "(public)");

/** Every static public route, from the file system. */
function publicRoutes(): string[] {
  const out: string[] = [];
  const walk = (dir: string, seg: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (!statSync(full).isDirectory()) continue;
      // Dynamic segments have no single URL to index.
      if (entry.startsWith("[")) continue;
      // Route groups do not appear in the URL.
      const next = entry.startsWith("(") ? seg : `${seg}/${entry}`;
      if (readdirSync(full).includes("page.tsx") && !entry.startsWith("(")) out.push(next);
      walk(full, next);
    }
  };
  walk(PUBLIC_DIR, "");
  return [...new Set(out)];
}

/** Every page the palette's index lists. */
function indexedHrefs(): Set<string> {
  return new Set(staticIndex().map((e) => e.href));
}

describe("the search palette reaches every public page", () => {
  const routes = publicRoutes();
  const indexed = indexedHrefs();

  it("found a plausible number of routes and index entries", () => {
    // Without this a broken walk would compare two empty sets and pass.
    expect(routes.length, "public route walk found nothing").toBeGreaterThan(40);
    expect(indexed.size, "palette index looks empty").toBeGreaterThan(40);
  });

  it("indexes every one of them", () => {
    const missing = routes.filter((r) => !indexed.has(r));
    expect(
      missing,
      `these public pages cannot be found in the search palette: ${missing.join(", ")}. ` +
        `Name them in lib/siteMap.ts.`,
    ).toEqual([]);
  });
});
