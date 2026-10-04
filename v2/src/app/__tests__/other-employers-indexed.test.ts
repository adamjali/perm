import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Employers with no PERM record get a page, the page is indexable, and the
 * sitemap lists every one (owner's decisions, Oct 3 2026 for the seasonal
 * ones and Oct 4 for the H-1B and wage-request ones).
 *
 * The invariant is the live-only family's: the page and the sitemap read ONE
 * source, `employer_other_index`, written nightly by
 * scripts/build_employer_map.py, so neither can list or render an employer
 * the other doesn't know. Until its first build, the Oct 3 table answers.
 */

const ROOT = join(__dirname, "..", "..");
const source = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

function fnBody(src: string, name: string): string {
  const start = src.search(new RegExp(`export (async function|const) ${name}\\b`));
  if (start === -1) return "";
  const end = src.indexOf("\n}", start);
  return end === -1 ? src.slice(start) : src.slice(start, end + 2);
}

describe("pages for employers with no PERM record", () => {
  it("are listed from the nightly table through a rank window, as a family of their own", () => {
    const sitemap = source("lib/sitemap/build.ts");
    const reads = source("lib/turso/otherEmployers.ts");
    // Control: the live-only family is wired the same way in the same file.
    expect(sitemap).toContain("getLiveOnlySlugWindow(chunk, SITEMAP_CHUNK)");

    expect(sitemap).toContain("getOtherEmployerSlugWindow(chunk, SITEMAP_CHUNK)");
    expect(sitemap).toContain("countOtherEmployerRanks()");
    expect(sitemap).toMatch(/other-employer-\$\{c \+ 1\}/);
    const window = fnBody(reads, "getOtherEmployerSlugWindow");
    expect(window).toContain("rank > ? AND rank <= ?");
    expect(window).not.toMatch(/OFFSET/);
    expect(reads).toContain('const INDEX = "employer_other_index"');
    expect(reads).toContain('const OLD_INDEX = "seasonal_employer_index"');
    expect(source("app/sitemaps/[name]/route.ts")).toContain('parsed.kind === "other-employer"');
  });

  it("render from the same table, after the published and live-only lookups miss, and never ask for noindex", () => {
    const page = source("app/(site)/(public)/perm-employers/[slug]/page.tsx");
    const start = page.indexOf("const other = await otherEmployerRecord(slug);");
    expect(start).toBeGreaterThan(page.indexOf("const record = await liveEmployerRecord(slug);"));
    const branch = page.slice(start, page.indexOf("return otherEmployerMetadata(", start) + 60);
    expect(branch).toContain("if (!other) return redirectSpelling(slug);");
    const meta = fnBody(page.replace("function otherEmployerMetadata", "export async function otherEmployerMetadata"), "otherEmployerMetadata");
    expect(meta).toContain("return entityMetadata(");
    expect(meta).not.toMatch(/noindex:|index: false/);
  });

  it("send a spelling with no page of its own to the page it belongs to, and 404 the rest", () => {
    const page = source("app/(site)/(public)/perm-employers/[slug]/page.tsx");
    const body = page.slice(page.indexOf("async function redirectSpelling("), page.indexOf("async function redirectSpelling(") + 400);
    expect(body).toContain("await pageForSpelling(slug)");
    expect(body).toContain("permanentRedirect(`${BASE}/${to.page}`)");
    expect(body.indexOf("permanentRedirect(")).toBeLessThan(body.indexOf("notFound()"));
  });

  it("every program list on an employer page reads the employer's own spellings, not a name prefix", () => {
    // A name prefix put Intellectt's 8,219 LCAs on Intel's page (Oct 4 2026).
    const page = source("app/(site)/(public)/perm-employers/[slug]/page.tsx");
    const calls = [...page.matchAll(/search(?:Pwd|Lca|Seasonal)(?:Cases|Determinations|Disclosed)\(\{[^}]*\}/g)].map((m) => m[0]);
    expect(calls.length).toBeGreaterThanOrEqual(13);
    expect(calls.filter((c) => !/\bmatch\b/.test(c))).toEqual([]);
  });

  it("carry a social card resolved in the page's own order, so no listed page advertises a 404 image", () => {
    const og = source("app/(site)/(public)/perm-employers/[slug]/opengraph-image.tsx");
    const order = ["resolveEntity(", "liveEmployerRecord(", "otherEmployerRecord("].map((s) => og.indexOf(s));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("the nightly sweep rebuilds the table the sitemap and the page read", () => {
    const py = source("../scripts/build_employer_map.py");
    expect(py).toContain('INDEX = "employer_other_index"');
    const wf = readFileSync(join(ROOT, "..", "..", ".github", "workflows", "case-status-direct.yml"), "utf8");
    expect(wf).toContain("python3 scripts/build_employer_map.py");
    expect(wf).not.toContain("build_seasonal_employers.py");
    // After the live-only rebuild, whose employers keep their own spellings.
    expect(wf.indexOf("build_employer_map.py")).toBeGreaterThan(wf.indexOf("--live-recent-only"));
  });
});
