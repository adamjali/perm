import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Employers whose only filings are H-2A, H-2B or CW-1 get a page, the page is
 * indexable, and the sitemap lists every one (owner's decision, Oct 3 2026).
 *
 * The invariant is the live-only family's: the page and the sitemap read ONE
 * source, `seasonal_employer_index`, written nightly by
 * scripts/build_seasonal_employers.py, so neither can list or render an
 * employer the other doesn't know.
 */

const ROOT = join(__dirname, "..", "..");
const source = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

function fnBody(src: string, name: string): string {
  const start = src.indexOf(`export async function ${name}(`);
  if (start === -1) return "";
  const end = src.indexOf("\n}", start);
  return end === -1 ? src.slice(start) : src.slice(start, end + 2);
}

describe("seasonal-only employer pages", () => {
  it("are listed from the nightly table through a rank window, as a family of their own", () => {
    const sitemap = source("lib/sitemap/build.ts");
    const reads = source("lib/turso/seasonalEmployers.ts");
    // Control: the live-only family is wired the same way in the same file.
    expect(sitemap).toContain("getLiveOnlySlugWindow(chunk, SITEMAP_CHUNK)");

    expect(sitemap).toContain("getSeasonalEmployerSlugWindow(chunk, SITEMAP_CHUNK)");
    expect(sitemap).toContain("countSeasonalEmployerRanks()");
    expect(sitemap).toMatch(/seasonal-employer-\$\{c \+ 1\}/);
    const window = fnBody(reads, "getSeasonalEmployerSlugWindow");
    expect(window).toContain("FROM seasonal_employer_index");
    expect(window).toContain("rank > ? AND rank <= ?");
    expect(window).not.toMatch(/OFFSET/);
    expect(source("app/sitemaps/[name]/route.ts")).toContain('parsed.kind === "seasonal-employer"');
  });

  it("render from the same table, after the published and live-only lookups miss, and never ask for noindex", () => {
    const page = source("app/(site)/(public)/perm-employers/[slug]/page.tsx");
    const start = page.indexOf("const seasonal = await seasonalEmployerRecord(slug);");
    expect(start).toBeGreaterThan(page.indexOf("const record = await liveEmployerRecord(slug);"));
    const branch = page.slice(start, page.indexOf("return entityMetadata(", start) + 80);
    expect(branch).toContain("if (!seasonal) notFound();");
    expect(branch).toContain("return entityMetadata(");
    expect(branch).not.toMatch(/noindex:|index: false/);
    expect(source("lib/turso/seasonalEmployers.ts")).toContain("FROM seasonal_employer_index WHERE slug = ?");
  });

  it("carry a social card resolved in the page's own order, so no listed page advertises a 404 image", () => {
    const og = source("app/(site)/(public)/perm-employers/[slug]/opengraph-image.tsx");
    const order = ["resolveEntity(", "liveEmployerRecord(", "seasonalEmployerRecord("].map((s) => og.indexOf(s));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("the nightly sweep rebuilds the table the sitemap and the page read", () => {
    const py = source("../scripts/build_seasonal_employers.py");
    expect(py).toContain('TABLE = "seasonal_employer_index"');
    const wf = readFileSync(join(ROOT, "..", "..", ".github", "workflows", "case-status-direct.yml"), "utf8");
    expect(wf).toContain("python3 scripts/build_seasonal_employers.py");
    // After the live-only rebuild, which writes the table it excludes.
    expect(wf.indexOf("build_seasonal_employers.py")).toBeGreaterThan(wf.indexOf("--live-recent-only"));
  });
});
