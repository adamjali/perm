import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
// vitest hoists vi.mock above every import, so this closes over the mocked
// gate regardless of where it is written. Kept at the top for `import/first`.
import { TestimonialsSection } from "../TestimonialsSection";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  APP_RATING,
  MIN_REVIEWS_TO_ADVERTISE,
  shouldAdvertiseRating,
} from "@/lib/structuredData";

// Only `shouldAdvertiseRating` is swapped; APP_RATING and the threshold stay
// real, because two assertions in this file are ABOUT their live values.
const mockAdvertise = vi.fn(() => true);
vi.mock("@/lib/structuredData", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/structuredData")>();
  return { ...actual, shouldAdvertiseRating: () => mockAdvertise() };
});

beforeEach(() => {
  mockAdvertise.mockReturnValue(true);
});

/**
 * Everything that publishes the aggregate rating is behind ONE threshold.
 *
 * The gate shipped covering only our own rating line. A rendered-QA pass then
 * found the third-party Senja widget printing gold stars, an average and
 * "from 2 reviews" a few pixels below it - so the claim the gate existed to
 * withhold was still on the page, published by someone else. A gate that does
 * not cover its whole subject reads exactly like a pass.
 *
 * These assertions are source-level on purpose. The widget renders from a
 * remote script that no unit test can execute, so the only thing that can be
 * pinned is that its markup sits inside the conditional.
 */

const SECTION = join(
  process.cwd(),
  "src",
  "components",
  "home",
  "TestimonialsSection.tsx",
);

function source(): string {
  const src = readFileSync(SECTION, "utf8");
  // A test that cannot see its subject reports a clean pass.
  expect(src.length).toBeGreaterThan(1000);
  expect(src).toContain("senja-embed");
  return src;
}

describe("aggregate rating gate", () => {
  it("is currently AT OR ABOVE the advertising floor", () => {
    // WHICH BRANCH IS LIVE, pinned deliberately. This assertion was inverted
    // until 2026-08-28, when Adam lowered MIN_REVIEWS_TO_ADVERTISE from 10 to
    // 2 so the two real reviews would count. It failed loudly on that change,
    // which is exactly what it is for: the other assertions in this file
    // describe the ADVERTISING branch, and if nobody noticed the flip they
    // would be describing a branch that never runs.
    //
    // TWO THINGS TURN ON THIS BEING TRUE. The visible 5.0 line renders, and
    // the third-party Senja script LOADS on every homepage view - it sits
    // behind this same gate, which is the whole point of the gate, but it
    // does mean flipping this has a performance cost as well as an editorial
    // one.
    expect(Number(APP_RATING.count)).toBeGreaterThanOrEqual(MIN_REVIEWS_TO_ADVERTISE);
    expect(shouldAdvertiseRating()).toBe(true);
  });

  it("puts the Senja widget behind the same gate as our own line", () => {
    // ASSERTS ON THE RENDERED TREE, NOT ON POSITIONS IN THE SOURCE TEXT.
    //
    // Two source-level versions of this test were probed on 2026-08-31 and
    // BOTH passed against a component whose widget had been deliberately
    // un-gated:
    //
    //   indexOf("senja-embed")              matched a doc comment quoting
    //                                       Lighthouse's selector, 140 lines
    //                                       above the markup.
    //   lastIndexOf(gate, widgetPosition)   found the OTHER call to the same
    //                                       gate - the one wrapping our own
    //                                       visible rating line - which is
    //                                       still before the widget, so the
    //                                       ordering held with no gate on the
    //                                       widget at all.
    //
    // Any assertion about which conditional encloses which JSX is really a
    // parse, and indexOf is not a parser. Render it and look for the element.
    const html = renderToStaticMarkup(
      React.createElement(TestimonialsSection),
    );
    expect(html).toContain('class="senja-embed"');
  });

  it("withholds the widget entirely below the floor", () => {
    // The other half, and the one that actually proves the gate: with the
    // threshold unmet the mount point must not be in the tree at all.
    mockAdvertise.mockReturnValue(false);
    const html = renderToStaticMarkup(
      React.createElement(TestimonialsSection),
    );
    expect(html).not.toContain("senja-embed");
    // ...while the things that survive at every count still do.
    expect(html).toContain("senja.io/p/perm-tracker/r/");
    mockAdvertise.mockReturnValue(true);
  });

  it("gates the remote script too, not only the mount point", () => {
    // Loading the script while hiding its target would still reach out to a
    // third party on every homepage view for nothing.
    const src = source();
    const scriptAt = src.indexOf("widget.senja.io");
    const gateAt = src.lastIndexOf("shouldAdvertiseRating()", scriptAt);
    expect(gateAt).toBeGreaterThan(-1);
    expect(gateAt).toBeLessThan(scriptAt);
  });

  it("keeps the review CTA at every count", () => {
    // It is the thing that gets us past the floor, so it must not be gated.
    const src = source();
    const ctaAt = src.indexOf("Leave a Review");
    expect(ctaAt).toBeGreaterThan(-1);
    const after = src.slice(src.indexOf("senja-embed"), ctaAt);
    // The CTA sits after the widget's closing conditional, not inside it.
    expect(after).toContain(") : null}");
  });

  it("uses one exported threshold rather than a repeated literal", () => {
    const src = source();
    expect(src).toContain("shouldAdvertiseRating");
    // A hardcoded count comparison would be a second, driftable gate.
    expect(src).not.toMatch(/count\s*[><=]=?\s*\d+/);
  });
});
