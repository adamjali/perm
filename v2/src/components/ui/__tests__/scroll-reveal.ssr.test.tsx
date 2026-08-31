/**
 * @vitest-environment node
 *
 * ScrollReveal must not hide its children in the server markup.
 *
 * Runs in the `ssr` project (real node, real Motion, no setup file) because
 * the happy-dom projects mock `motion/react` outright and would pass against
 * a component that hides everything. See vitest.config.ts.
 *
 * WHAT THIS CAUGHT. `initial="hidden"` is serialized as an inline style by
 * Motion during SSR, and `animate` also resolved to "hidden" because
 * `isInView` is false on the server - so every ScrollReveal shipped its
 * children invisible until hydration. Correct below the fold, wrong above it:
 * `/for-attorneys` wrapped its own `<h1>` in one, so the page's largest
 * element waited on the whole JS bundle and never appeared at all with JS
 * disabled. Found by scripts/audit_ssr_visibility.py against production,
 * which reported 149 of 150 pages clean and named that one.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ScrollReveal } from "../scroll-reveal";

const HIDDEN = /opacity:\s*0(?![.\d])/;

describe("ScrollReveal server markup", () => {
  it("renders a single child visible", () => {
    const html = renderToStaticMarkup(
      <ScrollReveal direction="up">
        <h1>Built for immigration attorneys</h1>
      </ScrollReveal>,
    );
    // Control first: prove the subject rendered before judging it.
    expect(html).toContain("Built for immigration attorneys");
    expect(html).not.toMatch(HIDDEN);
  });

  it("renders staggered children visible", () => {
    // The stagger path wraps each child in its own motion.div, so it has a
    // second place the hidden variant can leak through.
    const html = renderToStaticMarkup(
      <ScrollReveal direction="up" stagger>
        <p>first</p>
        <p>second</p>
        <p>third</p>
      </ScrollReveal>,
    );
    expect(html).toContain("first");
    expect(html).toContain("third");
    expect(html).not.toMatch(HIDDEN);
  });

  it("keeps children visible for every direction", () => {
    for (const direction of ["up", "down", "left", "right"] as const) {
      const html = renderToStaticMarkup(
        <ScrollReveal direction={direction}>
          <span>{`content-${direction}`}</span>
        </ScrollReveal>,
      );
      expect(html, direction).toContain(`content-${direction}`);
      expect(html, direction).not.toMatch(HIDDEN);
    }
  });

  it("renders a non-div element type visible too", () => {
    const html = renderToStaticMarkup(
      <ScrollReveal as="section">
        <h2>a section</h2>
      </ScrollReveal>,
    );
    expect(html).toContain("<section");
    expect(html).toContain("a section");
    expect(html).not.toMatch(HIDDEN);
  });
});
