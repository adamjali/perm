import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The site's two full-width bands must not tie on z-index.
 *
 * `(site)/layout.tsx` renders the header, then `{children}`, then the footer.
 * The footer is therefore the LAST element in DOM order, so at an equal
 * z-index it wins every overlap. It shipped at `z-50` against a header that is
 * `fixed z-50`, and the result was that the footer painted over the header and
 * ate its clicks: measured on production with the Learn menu open across the
 * footer, `elementFromPoint` 40px inside the overlap returned the footer, not
 * the menu link. The menu was rendering all six items at full height the whole
 * time, so it read as "the dropdown is cut off" rather than as a stacking bug.
 *
 * The same tie beat the back-to-top button and the mobile data drawer. Raising
 * each of those above the footer treats a symptom; this asserts the ordering
 * that makes all three correct at once.
 *
 * Read from source rather than rendered, because header and footer are never
 * mounted together in a unit test, and because this has to fail in BOTH
 * directions: raising the footer or lowering the header.
 */

const ROOT = join(__dirname, "..", "..", "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

/** Reads a Tailwind z-index off a class string: `z-50` or `z-[60]`. */
function zIndexIn(classes: string): number | null {
  const arbitrary = classes.match(/(?:^|\s)z-\[(\d+)\]/);
  if (arbitrary?.[1]) return Number(arbitrary[1]);
  const scale = classes.match(/(?:^|\s)z-(\d+)(?:\s|$)/);
  return scale?.[1] ? Number(scale[1]) : null;
}

describe("header and footer stacking", () => {
  const footerSource = read("src/components/layout/Footer.tsx");
  const headerSource = read("src/components/layout/AuthHeader.tsx");
  const ambientSource = read("src/components/home/AmbientMurmuration.tsx");

  const footerClasses = footerSource.match(/<footer className="([^"]*)"/)?.[1] ?? "";
  // The header's own class list is built with cn(); the layer lives in the
  // first string literal, which carries `fixed inset-x-0 z-50`.
  const headerClasses = headerSource.match(/"(fixed inset-x-0 z-\[?\d+\]?[^"]*)"/)?.[1] ?? "";
  const ambientClasses = ambientSource.match(/className="(pointer-events-none fixed inset-0[^"]*)"/)?.[1] ?? "";

  it("finds every class string it is about to compare", () => {
    // Without this a regex miss would compare `null`s and pass vacuously,
    // which is the usual way a gate of this shape reports green over a defect.
    expect(footerClasses, "footer classes").not.toBe("");
    expect(headerClasses, "header classes").not.toBe("");
    expect(ambientClasses, "ambient canvas classes").not.toBe("");
    expect(zIndexIn(footerClasses), "footer z-index").not.toBeNull();
    expect(zIndexIn(headerClasses), "header z-index").not.toBeNull();
    expect(zIndexIn(ambientClasses), "ambient z-index").not.toBeNull();
  });

  it("keeps the header strictly above the footer", () => {
    // Strictly greater, not >=. Equal IS the bug: DOM order breaks the tie and
    // the footer is last.
    expect(zIndexIn(headerClasses)!).toBeGreaterThan(zIndexIn(footerClasses)!);
  });

  it("keeps the footer above the ambient canvas it has to cover", () => {
    // The footer is opaque black over a full-viewport `fixed inset-0 z-0`
    // canvas. Demoting it too far would let the murmuration show through.
    expect(zIndexIn(footerClasses)!).toBeGreaterThan(zIndexIn(ambientClasses)!);
  });

  it("keeps the mobile data drawer above the footer", () => {
    // An open drawer scrolled to the bottom of a page must paint over the
    // footer, not under it.
    const rail = read("src/components/tools/DataRail.tsx");
    const drawer = rail.match(/"(fixed bottom-0 left-0 z-\[?\d+\]?[^"]*)"/)?.[1] ?? "";
    expect(drawer, "mobile drawer classes").not.toBe("");
    expect(zIndexIn(drawer), "drawer z-index").not.toBeNull();
    expect(zIndexIn(drawer)!).toBeGreaterThan(zIndexIn(footerClasses)!);
  });
});
