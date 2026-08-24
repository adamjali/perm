import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * A responsive grid defines its MOBILE track, not just its desktop one.
 *
 * `class="grid gap-4 md:grid-cols-3"` looks complete and is not. Above the
 * breakpoint the track is `repeat(3, minmax(0, 1fr))`, which cannot exceed its
 * container. BELOW it there is no `grid-template-columns` at all, so items land
 * in an IMPLICIT column sized by `grid-auto-columns: auto` — a content-sized
 * track. A wide enough child then pushes the track past the container and the
 * whole card overflows, on phones only.
 *
 * This is a phone-only defect for two reasons that both hide it: desktop is
 * above the breakpoint, and a narrow desktop window still renders in Blink,
 * where a date input's content contribution is small. On WebKit it is not.
 *
 * The fix is an explicit `grid-cols-1`, which Tailwind emits as
 * `repeat(1, minmax(0, 1fr))`. The `minmax(0, …)` is the whole point: it floors
 * the track at zero so it can always shrink to its container.
 *
 * Scoped to components that render a date control, because that is where the
 * content contribution is set by the browser rather than by us — WebKit's UA
 * stylesheet makes temporal inputs `display: inline-flex` with its own padding
 * and font, so their intrinsic width is not something this codebase controls.
 */

const ROOT = "src";

/**
 * An UNPREFIXED `grid-cols-*`. A `md:`/`sm:`/`lg:` one does not count: it is
 * exactly the thing that leaves mobile undefined.
 */
const UNPREFIXED_COLS = /(?:^|\s)grid-cols-\[?[\w(),.\s%-]+\]?/;
/** A bare `grid` display token, not `inline-grid` and not `grid-flow-*`. */
const IS_GRID = /(?:^|\s)grid(?:\s|$)/;
/** `class="…"` and the first string argument of `cn("…", …)`. */
const CLASS_ATTR = /className=(?:"([^"]*)"|\{cn\(\s*"([^"]*)")/g;

function walk(dir: string, out: string[] = []): string[] {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- seeded from the literal ROOT
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = join(dir, entry);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- same
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith(".tsx")) out.push(full);
  }
  return out;
}

describe("responsive grids define a mobile track", () => {
  const files = walk(ROOT).filter(
    (f) => !/\.test\.tsx$|__tests__|\.stories\./.test(f),
  );

  const withDateControl = files.filter((f) => {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- walk() only yields ROOT paths
    const source = readFileSync(f, "utf8");
    return /<DateInput\b/.test(source) || /type="date"/.test(source);
  });

  it("scans a plausible number of files", () => {
    // A gate that cannot see its subject reads exactly like a pass. The first
    // version of this check matched `sm:grid-cols-2` as if it defined the
    // mobile track and reported every one of these files clean.
    expect(files.length).toBeGreaterThan(100);
    expect(withDateControl.length).toBeGreaterThan(5);
  });

  it("gives every grid around a date control an explicit column track", () => {
    const offenders: string[] = [];
    for (const file of withDateControl) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- from withDateControl
      const source = readFileSync(file, "utf8");
      for (const m of source.matchAll(CLASS_ATTR)) {
        const classes = m[1] ?? m[2] ?? "";
        if (!IS_GRID.test(classes)) continue;
        if (UNPREFIXED_COLS.test(classes)) continue;
        const line = source.slice(0, m.index).split("\n").length;
        offenders.push(`${file}:${line} — "${classes.slice(0, 60)}"`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
