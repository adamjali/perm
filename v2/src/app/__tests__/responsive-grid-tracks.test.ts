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
 * Scoped to files that render a FORM CONTROL of any kind, because that is
 * where the content contribution is set by the browser rather than by us: a
 * control's intrinsic width comes from the UA stylesheet, its own padding and
 * a system font, none of which this codebase picks. Text is not in scope — it
 * wraps, so its min-content is a word and it cannot blow out a track.
 *
 * That boundary was drawn too tight at first. Scoping to `<DateInput>` alone
 * left fourteen grids unfixed, including ToolPageFooter, which sits on every
 * calculator page directly beneath the card the date fields are in, and
 * I140QueueEstimator, whose `<select>` has an intrinsic width of its own.
 *
 * Two utilities are required, and they do different jobs:
 *   `grid-cols-1`     floors the TRACK  — repeat(1, minmax(0, 1fr))
 *   `[&>*]:min-w-0`   floors the ITEMS  — a grid item's own `min-width: auto`
 *                     still resolves to a content-based minimum inside a
 *                     floored track, so the track alone is not enough.
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
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith(".tsx")) out.push(full);
  }
  return out;
}

describe("responsive grids define a mobile track", () => {
  const files = walk(ROOT).filter(
    (f) => !/\.test\.tsx$|__tests__|\.stories\./.test(f),
  );

  const CONTROL = /<(?:input|select|textarea|DateInput|SelectInput|Input|Textarea)\b/;
  const withControl = files.filter((f) => {
    return CONTROL.test(readFileSync(f, "utf8"));
  });

  it("scans a plausible number of files", () => {
    // A gate that cannot see its subject reads exactly like a pass. The first
    // version of this check matched `sm:grid-cols-2` as if it defined the
    // mobile track and reported every one of these files clean.
    expect(files.length).toBeGreaterThan(100);
    expect(withControl.length).toBeGreaterThan(20);
  });

  it("gives every grid around a form control an explicit column track", () => {
    const offenders: string[] = [];
    for (const file of withControl) {
      const source = readFileSync(file, "utf8");
      for (const m of source.matchAll(CLASS_ATTR)) {
        const classes = m[1] ?? m[2] ?? "";
        if (!IS_GRID.test(classes)) continue;
        const line = source.slice(0, m.index).split("\n").length;
        if (!UNPREFIXED_COLS.test(classes)) {
          offenders.push(`${file}:${line} no mobile track — "${classes.slice(0, 50)}"`);
        }
        if (!classes.includes("[&>*]:min-w-0")) {
          offenders.push(`${file}:${line} items unfloored — "${classes.slice(0, 50)}"`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
