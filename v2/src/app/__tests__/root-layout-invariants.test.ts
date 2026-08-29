import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Two root-layout invariants, both learned from a real regression.
 *
 * 1. `data-scroll-behavior="smooth"` on <html>. Next 15 forced scroll-behavior
 *    to `auto` during client-side navigation; Next 16 stopped, and requires you
 *    to opt back in with this attribute. Without it, `html { scroll-behavior:
 *    smooth }` in globals.css animates a scroll on every navigation AFTER the
 *    content has already swapped — read as "navigation takes forever". A source
 *    test, not a rendered one, because the attribute is authored in the layout
 *    and a rendered check would need the whole app tree.
 *
 * 2. No @vercel/analytics or @vercel/speed-insights. Both were removed as fully
 *    redundant with PostHog (autocapture + capture_performance.web_vitals) and
 *    as extra edge-request beacons on a Hobby plan that pauses at its cap. This
 *    guards the deletion: re-adding either is a silent regression of both cost
 *    and duplication.
 */
const layout = readFileSync(
  resolve(__dirname, "../layout.tsx"),
  "utf8",
);

describe("root layout invariants", () => {
  it('opts <html> back into instant scroll for Next 16 navigation', () => {
    const html = layout.match(/<html[^>]*>/)?.[0] ?? "";
    expect(html).toContain('data-scroll-behavior="smooth"');
  });

  it("does not mount Vercel Analytics or Speed Insights", () => {
    expect(layout).not.toContain("@vercel/analytics");
    expect(layout).not.toContain("@vercel/speed-insights");
    expect(layout).not.toMatch(/<SpeedInsights\b/);
    expect(layout).not.toMatch(/<Analytics\b/);
  });
});
