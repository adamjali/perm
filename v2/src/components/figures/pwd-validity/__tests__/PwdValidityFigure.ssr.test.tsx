/**
 * @vitest-environment node
 *
 * The wage-validity figure renders whole on the server: the drawing, its name, the first reading
 * and a caption with the three outcomes in words, before any script runs.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import PwdValidityFigure from "../PwdValidityFigure";

describe("PwdValidityFigure on the server", () => {
  const html = renderToStaticMarkup(<PwdValidityFigure />);

  it("draws the bench with its lime validity band and names the drawing", () => {
    expect(html).toContain('role="img"');
    expect(html).toMatch(/<title id="pwd-validity-title">An illustration of a prevailing wage determination&#x27;s validity as a bench\./);
    expect(html).toContain('class="iso-solid iso-accent"');
    expect(html).toContain(">Apr 15<");
    expect(html).toContain(">Jul 14<");
  });

  it("starts inside the validity and states the three outcomes in words", () => {
    expect(html).toContain("First step Jun 1, inside the validity: file by Nov 28, 2026, after it expires.");
    expect(html).toContain("a first step on June 1, 2026 means filing by November 28, 2026, after the determination has expired.");
    expect(html).toContain("such as March 26, 2026, means filing by July 14, 2026.");
    expect(html).toContain("A first step after July 14, 2026 can&#x27;t use this determination.");
  });

  it("can be paused, and is moved by dragging with no slider or keys", () => {
    const button = html.match(/<button[^>]*>/)?.[0] ?? "";
    expect(button).toContain('aria-label="Pause the sweep"');
    expect(button).toContain("motion-reduce:hidden");
    expect(html).not.toContain('type="range"');
    expect(html).not.toContain("tabindex");
  });

  it("hides nothing", () => {
    expect(html).not.toMatch(/opacity:\s*0[;"]/);
  });
});
