import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * A public route with a URL parameter caches only if it exports
 * generateStaticParams (an empty list is enough). Without it Next renders the
 * route fresh on every request even when it exports `revalidate`: production
 * served /perm-queue/<month> `private, no-store` at 1 to 1.5 s a page until
 * Oct 1 2026. Every [param] page under the public tree that declares a
 * revalidate window must therefore export generateStaticParams.
 */

const ROOT = join(process.cwd(), "src/app/(site)/(public)");

function pages(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) pages(p, out);
    else if (name === "page.tsx") out.push(p);
  }
  return out;
}

const dynamic = pages(ROOT).filter((p) => /\/\[[^/]+\]\/page\.tsx$/.test(p));

describe("cached [param] routes", () => {
  it("found the parameter routes it is meant to check", () => {
    expect(dynamic.length).toBeGreaterThanOrEqual(15);
    expect(dynamic.some((p) => p.includes("perm-queue/[month]"))).toBe(true);
  });

  it.each(dynamic.map((p) => [p.slice(ROOT.length + 1), p]))("%s exports generateStaticParams when it caches", (_name, p) => {
    const src = readFileSync(p, "utf8");
    const caches = /export const revalidate\s*=/.test(src);
    const forcedDynamic = /export const dynamic\s*=\s*["']force-dynamic["']/.test(src);
    if (!caches || forcedDynamic) return;
    // `export async function generateStaticParams` or a re-export of one
    // (`export { generateStaticParams, ... }`, the content pages' shape).
    expect(src).toMatch(/export (async )?function generateStaticParams|export \{[^}]*\bgenerateStaticParams\b/);
  });
});
