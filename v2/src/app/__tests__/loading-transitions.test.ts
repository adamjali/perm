import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

/**
 * The loading-transition rules from the Sep 30 2026 pass. Each was a visible
 * defect first: a page arrived as two or three different pictures in a row
 * (a route skeleton, then the page's own skeleton, then content fading in),
 * or the home curtain slid its logo away over a blank screen.
 *
 * Source checks, because the defects live in how files are wired together,
 * which a rendered unit test cannot see.
 */

const APP = resolve(__dirname, "..");
const SRC = resolve(APP, "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (name === "node_modules" || name === "__tests__") continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const loadingFiles = walk(APP).filter((p) => p.endsWith("/loading.tsx"));

describe("nothing stands between the visitor and the page", () => {
  const layout = readFileSync(join(APP, "layout.tsx"), "utf8");
  const siteLayout = readFileSync(join(APP, "(site)", "layout.tsx"), "utf8");
  const publicLayout = readFileSync(join(APP, "(site)", "(public)", "layout.tsx"), "utf8");
  const appLayout = readFileSync(join(APP, "(authenticated)", "layout.tsx"), "utf8");

  it("has no curtain over the homepage (Oct 14 2026: the page loads straight in)", () => {
    // The curtain covered the first paint with a logo panel and slid away; a
    // page that renders on the server needs no cover.
    expect(layout).not.toMatch(/Preloader|PRELOADER_|data-pre/);
    expect(layout).not.toContain("HomeCurtainNav");
  });

  it("draws no texture, particles or progress bar behind or over the page", () => {
    for (const src of [layout, siteLayout, publicLayout, appLayout]) {
      expect(src).not.toMatch(/grain-overlay|bg-dots|AmbientMurmuration|ScrollProgress|ScrollToTop/);
    }
  });
});

describe("loading.tsx files", () => {
  it("found the loading files to check", () => {
    expect(loadingFiles.length).toBeGreaterThanOrEqual(8);
  });

  it.each(loadingFiles.map((p) => [relative(APP, p), p]))(
    "%s renders the page's own loading component, not a picture of its own",
    (_name, file) => {
      // A loading.tsx that draws its own skeleton drifts from the one the page
      // renders while its data loads, and the reader sees both in a row.
      // Delegating makes them one picture by construction.
      const src = readFileSync(file, "utf8");
      expect(src).not.toMatch(/<Skeleton\b/);
    },
  );

  it("has no group-level loading boundary above the signed-in pages", () => {
    // It showed a generic skeleton before each page's own on the way in.
    expect(loadingFiles.map((p) => relative(APP, p))).not.toContain("(authenticated)/loading.tsx");
  });

  it("has no loading boundary on prerendered public pages", () => {
    // Static pages prefetch whole; a skeleton only appeared on a click that
    // had not prefetched yet, and never matched the page.
    const publicLoading = loadingFiles
      .map((p) => relative(APP, p))
      .filter((p) => p.startsWith("(site)/"));
    expect(publicLoading).toEqual(["(site)/(public)/perm-case-status/loading.tsx"]);
  });
});

describe("no staggered entrance on loading states", () => {
  // tw-animate's `animate-in` does not hold its first frame through an
  // `animationDelay`, so each delayed block showed, vanished, then faded back.
  const dirs = [join(APP, "(authenticated)"), join(SRC, "components/dashboard"), join(SRC, "components/forms"), join(SRC, "components/admin")];
  const files = dirs.flatMap((d) => walk(d)).filter((p) => p.endsWith(".tsx"));

  it.each(files.map((p) => [relative(SRC, p), p]))("%s", (_name, file) => {
    const src = readFileSync(file, "utf8");
    const staggered = /animate-(?:in|slide-up|fade-in)[^"]*"[^>]*animationDelay/s.test(src);
    expect(staggered).toBe(false);
  });
});
