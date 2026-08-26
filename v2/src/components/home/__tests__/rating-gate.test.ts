import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  APP_RATING,
  MIN_REVIEWS_TO_ADVERTISE,
  shouldAdvertiseRating,
} from "@/lib/structuredData";

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
  it("is currently below the advertising floor", () => {
    // If this flips, the rest of the suite is asserting the wrong branch and
    // the failure message should say so rather than looking mysterious.
    expect(Number(APP_RATING.count)).toBeLessThan(MIN_REVIEWS_TO_ADVERTISE);
    expect(shouldAdvertiseRating()).toBe(false);
  });

  it("puts the Senja widget behind the same gate as our own line", () => {
    const src = source();
    const gateAt = src.indexOf("shouldAdvertiseRating()", src.indexOf("senja-embed") - 2000);
    const widgetAt = src.indexOf("senja-embed");
    expect(gateAt).toBeGreaterThan(-1);
    expect(gateAt).toBeLessThan(widgetAt);
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
