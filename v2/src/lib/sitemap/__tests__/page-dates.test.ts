import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import PAGE_DATES from "../page-dates.json";

// The sitemap's lastmod for each page comes from page-dates.json, which
// scripts/page_dates.mjs writes from git at build time. These keep the file and
// the sitemap in step: a page the sitemap dates must be in the file, or it
// silently gets the fixed fallback forever.
const ROOT = path.resolve(__dirname, "../../../..");
const build = readFileSync(path.join(ROOT, "src/lib/sitemap/build.ts"), "utf8");
const dates = PAGE_DATES as Record<string, string>;

function routes(dir: string, out: Set<string> = new Set()): Set<string> {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) routes(p, out);
    else if (/^page\.(tsx|mdx)$/.test(name)) {
      const segs = path.relative(path.join(ROOT, "src/app"), dir).split(path.sep).filter((s) => s && !s.startsWith("(") && !s.startsWith("@"));
      out.add("/" + segs.join("/"));
    }
  }
  return out;
}

describe("sitemap page dates", () => {
  const asked = [...build.matchAll(/changed\("([^"]+)"\)/g)].map((m) => m[1]!);

  it("reads a date for a plausible number of pages", () => {
    expect(asked.length).toBeGreaterThan(70);
  });

  it("has a date for every page the sitemap asks about (run node scripts/page_dates.mjs)", () => {
    expect(asked.filter((r) => !(r in dates))).toEqual([]);
  });

  it("names only routes that exist", () => {
    const real = routes(path.join(ROOT, "src/app"));
    expect(Object.keys(dates).filter((r) => !real.has(r))).toEqual([]);
  });

  it("holds calendar days, none in the future", () => {
    const today = new Date().toISOString().slice(0, 10);
    for (const [route, day] of Object.entries(dates)) {
      expect(day, route).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(day <= today, `${route} ${day}`).toBe(true);
    }
  });

  it("no longer types a date for a page by hand", () => {
    expect(build).not.toMatch(/url: `\$\{base\}[^`]*`, lastModified: (dol \?\? )?"\d{4}/);
  });
});
