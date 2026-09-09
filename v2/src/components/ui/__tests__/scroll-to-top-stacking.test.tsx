import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The back-to-top button has to paint ABOVE the footer.
 *
 * It shipped at `z-50` while the footer is `relative z-50`, and at an equal
 * z-index the later element in DOM order wins. `(site)/layout.tsx` renders
 * `{children}` (which carries the button) and then `<Footer>`, so the footer
 * covered the button at the bottom of every long page: precisely where a
 * back-to-top control is reached for. Measured in a browser at the old value,
 * `document.elementFromPoint` at the button's own centre returned the
 * footer's inner div, so it was not merely hidden, it was unclickable.
 *
 * This reads both source files rather than rendering, because the defect is a
 * relationship between two components that are never mounted together in a
 * unit test, and because it must fail in BOTH directions: lowering the button
 * or raising the footer breaks the same invariant.
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

describe("back-to-top stacks above the footer", () => {
  const buttonSource = read("src/components/ui/scroll-to-top.tsx");
  const footerSource = read("src/components/layout/Footer.tsx");

  const buttonClasses =
    buttonSource.match(/className="(fixed bottom-[^"]*)"/)?.[1] ?? "";
  const footerClasses =
    footerSource.match(/<footer className="([^"]*)"/)?.[1] ?? "";

  it("finds the two class strings it is about to compare", () => {
    // Without this the regexes could silently miss and every assertion below
    // would pass vacuously against `null`, which is the usual way a gate of
    // this shape reports green over a real defect.
    expect(buttonClasses, "back-to-top button classes").not.toBe("");
    expect(footerClasses, "footer element classes").not.toBe("");
    expect(buttonClasses).toContain("fixed");
    expect(buttonClasses).toMatch(/bottom-/);
  });

  it("gives both elements an explicit z-index", () => {
    expect(zIndexIn(buttonClasses), "button z-index").not.toBeNull();
    expect(zIndexIn(footerClasses), "footer z-index").not.toBeNull();
  });

  it("puts the button strictly above the footer", () => {
    const button = zIndexIn(buttonClasses)!;
    const footer = zIndexIn(footerClasses)!;
    // Strictly greater, not >=. Equal is the bug: DOM order decides it, and
    // the footer is rendered after the button.
    expect(button).toBeGreaterThan(footer);
  });

  it("keeps the button below the search palette, which is a modal", () => {
    // A floating control that outranks an open modal is the opposite defect.
    const button = zIndexIn(buttonClasses)!;
    const palette = read("src/components/search/SearchPalette.tsx");
    const paletteZ = zIndexIn(palette.match(/z-\[\d+\][^"]*/)?.[0] ?? "");
    expect(paletteZ, "search palette z-index").not.toBeNull();
    expect(button).toBeLessThan(paletteZ!);
  });
});
