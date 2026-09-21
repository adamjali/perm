import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The sitemap never advertises a page that tells Google not to index it.
 *
 * `/perm-employers/compare` did exactly that until 2026-09-21: the route sets
 * `robots: { index: false }` - it renders whatever two slugs the query names,
 * so there is nothing stable to index - and the static list in
 * `src/lib/sitemap/build.ts` listed it anyway. A sitemap is a request to index;
 * a noindex is a refusal. Shipping both is the one ERROR Ahrefs found on the
 * whole site, and robots.txt already disallowed the parameterised form, so the
 * bare path was the only thing being advertised.
 *
 * ONLY AN UNCONDITIONAL NOINDEX COUNTS, and the distinction is load-bearing:
 * `/perm-queue` and `/perm-queue/[month]` carry
 * `robots: MIRROR_COMPLETE ? undefined : { index: false, follow: true }`, and
 * the sitemap gates those same pages on the same flag - so they agree, and a
 * gate that matched `index: false` anywhere would fail them forever and be
 * switched off within a week. Matching `robots: {` followed by `index: false`
 * is what separates a direct refusal from a conditional one.
 */
const PUBLIC = join(__dirname, "..", "(site)", "(public)");
const BUILD = join(__dirname, "..", "..", "lib", "sitemap", "build.ts");

/** `robots: { index: false ... }` written directly, not behind a condition. */
const UNCONDITIONAL_NOINDEX = /robots:\s*\{\s*index:\s*false/;

function staticPages(dir: string, route: string[] = []): Array<{ route: string; file: string }> {
  const out: Array<{ route: string; file: string }> = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name.startsWith("[")) continue;
      const seg = name.startsWith("(") && name.endsWith(")") ? [] : [name];
      out.push(...staticPages(full, [...route, ...seg]));
    } else if (name === "page.tsx") {
      out.push({ route: "/" + route.join("/"), file: full });
    }
  }
  return out;
}

const pages = staticPages(PUBLIC);
const buildSrc = readFileSync(BUILD, "utf8");

/** The routes the static half of `pagesEntries` hardcodes, as `${base}/x` literals. */
const listed = new Set(
  [...buildSrc.matchAll(/\$\{base\}(\/[A-Za-z0-9\-/]*)`/g)].map((m) => m[1]),
);

const noindexed = pages.filter((p) =>
  UNCONDITIONAL_NOINDEX.test(readFileSync(p.file, "utf8")),
);

describe("the sitemap and the pages agree about indexing", () => {
  it("reads both sides (a path typo would read as a pass)", () => {
    expect(pages.length).toBeGreaterThan(45);
    expect(listed.size).toBeGreaterThan(30);
    // At least one public page really is noindex, or this gate proves nothing.
    expect(noindexed.length).toBeGreaterThan(0);
  });

  it("separates a conditional noindex from an unconditional one (control)", () => {
    expect(UNCONDITIONAL_NOINDEX.test("robots: { index: false, follow: true },")).toBe(true);
    expect(
      UNCONDITIONAL_NOINDEX.test(
        "robots: MIRROR_COMPLETE ? undefined : { index: false, follow: true },",
      ),
    ).toBe(false);
  });

  it("lists no unconditionally-noindexed page", () => {
    const advertised = noindexed.filter((p) => listed.has(p.route)).map((p) => p.route);
    expect(advertised).toEqual([]);
  });
});
