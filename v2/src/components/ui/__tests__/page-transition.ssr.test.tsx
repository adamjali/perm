/**
 * @vitest-environment node
 *
 * NODE, NOT JSDOM, AND THAT IS THE WHOLE TEST.
 *
 * Motion branches on whether a DOM exists. Under jsdom `window` is defined,
 * so it takes the CLIENT path and applies `initial` through the DOM after
 * mount instead of serializing it - `renderToStaticMarkup` returns a bare
 * `<div>hi</div>` and the assertions below pass against the BROKEN component.
 * Probed exactly that way on 2026-08-31: reverting the fix left all four
 * green, which is the "verification that cannot see its subject" failure.
 *
 * In a real server render there is no window, Motion emits
 * `style="opacity:0;transform:translateY(8px)"`, and these go red.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * The SSR'd markup must be VISIBLE without JavaScript.
 *
 * Motion serializes `initial` as an inline style during server rendering, so
 * `initial={{ opacity: 0 }}` on a wrapper around `{children}` ships every
 * public page's content hidden until hydration. Measured live 2026-08-31:
 * 266KB of a 296KB page sat inside `<div style="opacity:0;transform:
 * translateY(8px)">`, on all ~298 URLs, with PageSpeed reporting TTFB 20ms
 * and LCP element render delay 2,470ms.
 *
 * These assert against `renderToStaticMarkup` on purpose - that IS the server
 * path, and it is the only place the defect exists. A jsdom render would run
 * the mount effect and animate to opacity 1 immediately, reporting a pass
 * against the broken version.
 */

const mockPathname = vi.fn(() => "/perm-queue");
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

const mockReducedMotion = vi.fn(() => false);
vi.mock("@/lib/animations", () => ({
  useReducedMotion: () => mockReducedMotion(),
}));

beforeEach(() => {
  mockPathname.mockReturnValue("/perm-queue");
  mockReducedMotion.mockReturnValue(false);
});

describe("PageTransition server markup", () => {
  it("does not hide its children with an inline opacity", async () => {
    const { PageTransition } = await import("../page-transition");
    const html = renderToStaticMarkup(
      <PageTransition>
        <p>queue content</p>
      </PageTransition>,
    );

    expect(html).toContain("queue content");
    expect(html).not.toMatch(/opacity:\s*0(?![.\d])/);
  });

  it("does not offset its children with an inline transform", async () => {
    const { PageTransition } = await import("../page-transition");
    const html = renderToStaticMarkup(
      <PageTransition>
        <p>queue content</p>
      </PageTransition>,
    );

    expect(html).not.toContain("translateY(8px)");
  });

  it("still renders children under reduced motion", async () => {
    mockReducedMotion.mockReturnValue(true);
    const { PageTransition } = await import("../page-transition");
    const html = renderToStaticMarkup(
      <PageTransition>
        <p>queue content</p>
      </PageTransition>,
    );

    expect(html).toContain("queue content");
    expect(html).not.toMatch(/opacity:\s*0(?![.\d])/);
  });

  it("renders the children of whatever route it wraps", async () => {
    // A guard against "fixing" this by dropping children on the server.
    mockPathname.mockReturnValue("/perm-wages");
    const { PageTransition } = await import("../page-transition");
    const html = renderToStaticMarkup(
      <PageTransition>
        <section data-testid="wages">wage bands</section>
      </PageTransition>,
    );

    expect(html).toContain("wage bands");
    expect(html).toContain('data-testid="wages"');
  });
});
