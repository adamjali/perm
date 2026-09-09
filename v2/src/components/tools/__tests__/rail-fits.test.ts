import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { SECTIONS, GROUPS } from "../dataSections";

/**
 * The desktop rail must fit under the header with its LARGEST group open.
 *
 * Nothing in the rail is ever clipped - it has no `overflow`, on purpose,
 * because a scroll box would cut off the tab that protrudes past the spine.
 * When it does not fit it drops `sticky` and scrolls with the page, so the
 * failure mode is not truncation, it is a sidebar whose bottom sits below the
 * fold, which reads as truncation to everyone who sees it. Adam has now
 * reported that twice.
 *
 * THIS EXISTS BECAUSE THE DENSITY WAS TUNED AGAINST FACTS THAT EXPIRED. The
 * 2026-09-08 pass sized the rows for "a seven-item group (Employers and
 * wages)" on an 812px window. `/layoffs` and `/perm-employers/compare` landed
 * the next day and took that group to eight, and nothing failed - the rail
 * just quietly grew past the fold again. A page added to a group is a routine
 * edit that nobody would think to check the sidebar's height for, so the check
 * belongs in a test rather than in a reviewer's head.
 *
 * The row heights are READ FROM `globals.css` rather than restated here, so
 * the test cannot drift from the rule it is reasoning about. The fixed
 * overhead is measured, and named, below.
 */

const ROOT = join(__dirname, "..", "..", "..", "..");
const css = readFileSync(join(ROOT, "src/app/globals.css"), "utf8");

/** Pulls a `min-height` in rem off a rule inside the `lg` rail block. */
function railMinHeightPx(selector: string): number | null {
  // There is more than one `@media (min-width: 64rem)` block in the sheet, so
  // find the one that actually declares this selector rather than the first
  // one that matches the media query. A first-block-wins version of this
  // returned null and the guard below caught it, which is what that guard is
  // for.
  const blocks = [...css.matchAll(/@media \(min-width: 64rem\) \{([\s\S]*?)\n\s*\}/g)]
    .map((m) => m[1] ?? "");
  const escaped = selector.replace(".", "\\.");
  for (const block of blocks) {
    const rule = block.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1];
    const rem = rule?.match(/min-height:\s*([\d.]+)rem/)?.[1];
    if (rem) return Number(rem) * 16;
  }
  return null;
}

/**
 * Everything in the rail that is not a group header or a leaf, measured in a
 * browser on 2026-09-09 at `lg`: the collapse button and its margin (40), the
 * Overview row (32), the nav's own vertical padding (8), and the "Track a
 * case" block with its desktop padding and its sentence hidden (~89).
 */
const FIXED_OVERHEAD_PX = 169;

/**
 * The budget. A 1440x900 display gives a maximised browser roughly 800px of
 * viewport, and the header is 71px at most widths and 99px where the nav
 * wraps, so ~700px is the space a common desktop actually has under the
 * header. Measured worst case at the time of writing: 649px.
 */
const BUDGET_PX = 700;

describe("the desktop data rail fits under the header", () => {
  const leafPx = railMinHeightPx(".rail-row");
  const headerPx = railMinHeightPx(".rail-tab");

  it("reads both row heights out of globals.css", () => {
    // Without this the arithmetic below would run on `null` and pass
    // vacuously, which is how a gate of this shape usually reports green.
    expect(leafPx, ".rail-row min-height at lg").not.toBeNull();
    expect(headerPx, ".rail-tab min-height at lg").not.toBeNull();
  });

  it("fits with its largest group open", () => {
    const groups = GROUPS.filter((g) => SECTIONS.some((s) => s.group === g));
    const sizes = groups.map((g) => ({
      group: g,
      n: SECTIONS.filter((s) => s.group === g).length,
    }));
    const largest = sizes.reduce((a, b) => (b.n > a.n ? b : a));

    // Every group shows its header; exactly one is open at a time (the rail's
    // `open` state is a single value, not a set), so the worst case is the
    // biggest group's children plus every header.
    const height =
      FIXED_OVERHEAD_PX + groups.length * headerPx! + largest.n * leafPx!;

    expect(
      height,
      `worst case is "${largest.group}" with ${largest.n} entries: ` +
        `${FIXED_OVERHEAD_PX} + ${groups.length}x${headerPx} + ${largest.n}x${leafPx} = ${height}px ` +
        `against a ${BUDGET_PX}px budget. Adding a page to a group costs ${leafPx}px; ` +
        `if this is a page that has to exist, take the height back in globals.css ` +
        `(the lg rail block) or move an entry to a smaller group.`,
    ).toBeLessThanOrEqual(BUDGET_PX);
  });
});
