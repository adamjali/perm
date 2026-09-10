import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Every public page must be reachable from the search palette.
 *
 * The palette builds its index from the shared nav constants rather than a
 * hand-kept list, which is the right design: it cannot go stale when a nav
 * changes. Its one blind spot is a page that is in NO nav list, and there were
 * three - the A-to-Z hubs at /perm-employers/browse, /perm-attorneys/browse and
 * /perm-wages/browse. Not top-level, so not in PUBLIC_NAV_LINKS. Not in the
 * rail map, which lists the entity indexes rather than their alphabetical
 * hubs. Not tools. So they were unsearchable, and nobody noticed: they were
 * found by walking every route against the index, which is what this does.
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

/** Every href the palette can produce for a static destination. */
function indexedHrefs(): Set<string> {
  const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
  const fromConstants = [
    ...read("src/lib/constants/navigation.ts").matchAll(/href:\s*"([^"]+)"/g),
    ...read("src/components/tools/dataSections.ts").matchAll(/href:\s*"([^"]+)"/g),
  ].map((m) => m[1] ?? "");
  // Destinations the palette adds itself (email preferences, the browse hubs).
  const fromPalette = [...read("src/components/search/SearchPalette.tsx").matchAll(/"(\/[a-z0-9/-]+)"/g)]
    .map((m) => m[1] ?? "");
  return new Set([...fromConstants, ...fromPalette]);
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
        `Add them to a nav constant, the rail map, or the palette's own list.`,
    ).toEqual([]);
  });
});
