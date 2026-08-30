import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Every internal link on the homepage points at a route that exists.
 *
 * WHY: while splitting the final stage into its two halves I gave the visa
 * bulletin card a "Priority dates" link to `/priority-dates`, a page that has
 * never existed. It typechecked, it rendered, the tests passed, and the only
 * reason it did not ship was a manual curl. A dead link in the site's main
 * navigation is worse than a dead link anywhere else: it is the path a
 * first-time visitor is most likely to take, and Google reads these same hrefs
 * as the site's own statement about its structure.
 *
 * The check is deliberately STATIC and offline. Resolving hrefs over the
 * network would pass against production while the branch being tested is
 * broken - the failure this is meant to catch is a route that does not exist
 * IN THIS TREE.
 *
 * Scope is the homepage bands, because that is where a fabricated href does
 * the most damage and where new cards get added. It is not a whole-site link
 * checker; `scripts/audit_all_pages.py` walks the live sitemap for that.
 */

const APP = join(process.cwd(), "src/app");
const COMPONENTS = [
  "src/components/home/StageStrip.tsx",
  "src/components/home/LiveDataBand.tsx",
];

/** Route segments Next treats as grouping only, so they vanish from the URL. */
function isTransparent(segment: string): boolean {
  return segment.startsWith("(") && segment.endsWith(")");
}

/** Every URL path this app serves from a page.tsx, ignoring dynamic segments. */
function routePaths(dir: string, prefix = ""): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith("_") || entry.name === "__tests__") continue;
    const next = join(dir, entry.name);
    const path = isTransparent(entry.name) ? prefix : `${prefix}/${entry.name}`;
    if (existsSync(join(next, "page.tsx"))) out.push(path || "/");
    out.push(...routePaths(next, path));
  }
  return out;
}

describe("homepage internal links", () => {
  const routes = new Set(routePaths(APP));

  it("finds the app's routes at all, so the assertions below are not vacuous", () => {
    // A gate that cannot see its subject reads exactly like a pass.
    expect(routes.size).toBeGreaterThan(20);
    expect(routes.has("/perm-employers")).toBe(true);
  });

  it.each(COMPONENTS)("%s links only to routes that exist", (rel) => {
    const src = readFileSync(join(process.cwd(), rel), "utf8");
    const hrefs = [...src.matchAll(/href:\s*"(\/[^"]*)"/g)].map((m) => m[1]!);

    expect(hrefs.length, `no hrefs found in ${rel}`).toBeGreaterThan(0);

    for (const href of hrefs) {
      // A dynamic route cannot be checked by string equality; those are
      // covered by not-found-status.test.ts instead.
      if (href.includes("[")) continue;
      expect(routes.has(href), `${rel} links to ${href}, which is not a route`).toBe(
        true,
      );
    }
  });
});
