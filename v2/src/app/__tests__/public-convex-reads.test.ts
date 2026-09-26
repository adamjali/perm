import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `fetchQuery` from `convex/nextjs` always fetches with `cache: "no-store"`,
 * which makes a whole route dynamic whatever `revalidate` it exports. On
 * 2026-09-26 one such read turned `/perm-processing-times` from prerendered
 * into a server render per visit, and two calculators had been dynamic in
 * production that way for weeks. Public pages read Convex through
 * `queryStatic` (src/lib/convexStatic.ts), which sends the page's own window.
 */
const ROOT = join(__dirname, "..", "(site)", "(public)");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === "__tests__" ? [] : walk(p);
    return /\.(tsx?|jsx?)$/.test(name) ? [p] : [];
  });
}

describe("public pages read Convex without forcing a dynamic render", () => {
  const files = walk(ROOT);

  it("found the public tree", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it("imports nothing from convex/nextjs", () => {
    const offenders = files.filter((f) =>
      /from\s+["']convex\/nextjs["']/.test(readFileSync(f, "utf8").replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, "")),
    );
    expect(offenders).toEqual([]);
  });
});
