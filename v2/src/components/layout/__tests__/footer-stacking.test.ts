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

describe("header, footer and dialog stacking", () => {
  const footerSource = read("src/components/layout/Footer.tsx");
  const headerSource = read("src/components/layout/SiteHeader.tsx");
  const dialogSource = read("src/components/ui/dialog.tsx");

  const footerClasses = [...footerSource.matchAll(/<footer className="([^"]*)"/g)].map((m) => m[1] ?? "");
  const headerClasses = headerSource.match(/"(fixed inset-x-0 top-0 z-\[?\d+\]?[^"]*)"/)?.[1] ?? "";
  const dialogClasses = dialogSource.match(/"([^"]*fixed top-\[50%\][^"]*)"/)?.[1] ?? "";

  it("finds every class string it is about to compare", () => {
    // Without this a regex miss would compare nothing and pass vacuously.
    expect(footerClasses.length, "footer classes").toBeGreaterThan(0);
    expect(zIndexIn(headerClasses), "header z-index").not.toBeNull();
    expect(zIndexIn(dialogClasses), "dialog z-index").not.toBeNull();
  });

  it("leaves the footer out of the stacking order, so it can never cover the header", () => {
    // It once shared the header's z-50 and, last in the DOM, won the tie and
    // ate the header menu's clicks. With no z-index and no positioning it
    // paints in normal flow, under anything fixed.
    for (const c of footerClasses) {
      expect(zIndexIn(c), c).toBeNull();
      expect(c).not.toMatch(/(?:^|\s)(?:relative|absolute|fixed|sticky)(?:\s|$)/);
    }
  });

  it("keeps a dialog above the header", () => {
    expect(zIndexIn(dialogClasses)!).toBeGreaterThan(zIndexIn(headerClasses)!);
  });
});
