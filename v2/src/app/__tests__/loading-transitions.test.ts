import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { PRELOADER_BOOT, PRELOADER_CSS } from "@/components/home/Preloader";

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

describe("home curtain", () => {
  const layout = readFileSync(join(APP, "layout.tsx"), "utf8");

  it("renders its panel as the first child of <body>", () => {
    // Server markup at the top of <body> paints in the same frame as the
    // header it covers. Injected at DOMContentLoaded, it left a blank cover
    // on screen until the whole document had parsed.
    // The element, not the word: comments in <head> mention "<body>" too.
    const open = layout.search(/<body\s+className=/);
    expect(open).toBeGreaterThan(-1);
    const body = layout.slice(open);
    const afterOpen = body.slice(body.indexOf("}\n        >") + 1);
    const firstElement = afterOpen
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .match(/<[A-Za-z][\w.]*/)?.[0];
    expect(firstElement).toBe("<Preloader");
  });

  it("hides the panel unless the boot script arms it", () => {
    expect(PRELOADER_CSS).toMatch(/\.pre\{display:none\}/);
    expect(PRELOADER_CSS).toContain('html[data-pre="on"] .pre,html[data-pre="leaving"] .pre{display:flex}');
  });

  it("slides the panel over the PAGE, with no second cover behind it", () => {
    // The old exit slid the logo away over a body::before cover that stayed
    // until the slide ended, so the page snapped in afterwards.
    expect(PRELOADER_CSS).not.toContain("body::before");
    expect(PRELOADER_CSS).toMatch(/html\[data-pre="leaving"\] \.pre\{transform:translateY\(-101%\)/);
    expect(PRELOADER_BOOT).toContain("h.setAttribute('data-pre','leaving')");
  });

  it("lifts at DOMContentLoaded, not window load, and never touches React's node", () => {
    expect(PRELOADER_BOOT).toContain("'DOMContentLoaded'");
    expect(PRELOADER_BOOT).not.toMatch(/addEventListener\('load'/);
    expect(PRELOADER_BOOT).not.toMatch(/createElement\('div'\)|removeChild|classList\.add/);
  });

  it("has no client-navigation curtain", () => {
    // A soft navigation home is a prefetched page that renders at once; the
    // curtain there blanked the whole screen, header included, for 820ms.
    expect(layout).not.toContain("HomeCurtainNav");
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
