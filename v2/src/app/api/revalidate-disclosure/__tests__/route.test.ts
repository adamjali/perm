import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { DISCLOSURE_PAGES } from "../paths";

/**
 * The list must not drift from the app tree.
 *
 * A page added later that reads quarterly disclosure data and sits on a long
 * window, but is missing from this list, serves a stale figure until its own
 * window turns over - with nothing failing and nothing logged. That is the
 * failure this re-derives the list to catch, the same way
 * `revalidate-dol/route.test.ts` does for the processing-times pages.
 */

const PUBLIC = join(process.cwd(), "src/app/(site)/(public)");

/** Modules whose data comes from a quarterly disclosure file. */
const QUARTERLY = ["wages", "states", "wageBands", "entities", "entityDetail"];

/** A week. Anything on this list must be on a long window, or the list is moot. */
const LONG_WINDOW = 604800;

function pages(dir: string, base = ""): { route: string; file: string }[] {
  const out: { route: string; file: string }[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      out.push(...pages(p, `${base}/${name}`));
    } else if (name === "page.tsx") {
      out.push({ route: base === "" ? "/" : base, file: p });
    }
  }
  return out;
}

describe("the disclosure revalidation list tracks the app tree", () => {
  const all = pages(PUBLIC);

  it("finds a plausible number of public pages", () => {
    // A gate that cannot see its subject reads exactly like a pass.
    expect(all.length).toBeGreaterThan(25);
  });

  it("every listed page exists and is on a long window", () => {
    for (const route of DISCLOSURE_PAGES) {
      const hit = all.find((p) => p.route === route);
      expect([route, Boolean(hit)]).toEqual([route, true]);
      const src = readFileSync(hit!.file, "utf8");
      const m = /export const revalidate = (\d+)/.exec(src);
      // A page on a SHORT window does not need the trigger, so its presence
      // here is a sign the two drifted apart.
      expect([route, Number(m?.[1] ?? 0)]).toEqual([route, LONG_WINDOW]);
    }
  });

  it("no page on a long window reading quarterly data is missing from the list", () => {
    const missing: string[] = [];
    for (const { route, file } of all) {
      // The generated `[slug]` templates are excluded on purpose: expiring
      // ~30,000 entity pages in one call costs far more than the staleness.
      if (route.includes("[")) continue;
      const src = readFileSync(file, "utf8");
      const m = /export const revalidate = (\d+)/.exec(src);
      if (!m || Number(m[1]) < LONG_WINDOW) continue;
      const reads = [...src.matchAll(/from "@\/lib\/turso\/(\w+)"/g)].map((x) => x[1]!);
      if (!reads.some((r) => QUARTERLY.includes(r))) continue;
      if (!(DISCLOSURE_PAGES as readonly string[]).includes(route)) missing.push(route);
    }
    expect(missing).toEqual([]);
  });
});
