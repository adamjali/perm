/**
 * @vitest-environment node
 *
 * The filing-window figure renders whole on the server: the drawing, its accessible name and the
 * first reading are in the HTML before any script runs, so a reader without JavaScript (and a
 * crawler) gets the picture and its dates. The sweep, the scroll link and dragging start in the
 * browser.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import FilingWindowFigure from "../FilingWindowFigure";

describe("FilingWindowFigure on the server", () => {
  const html = renderToStaticMarkup(<FilingWindowFigure />);

  it("draws the bench with its window and names the drawing", () => {
    expect(html).toContain('role="img"');
    expect(html).toMatch(/<title id="filing-window-title">An illustration of the filing window as a measuring bench\./);
    expect(html).toContain('class="iso-solid fw-window"');
    expect((html.match(/class="iso-solid/g) ?? []).length).toBeGreaterThan(20);
  });

  it("starts at the widest window and states the dates in words", () => {
    expect(html).toContain("Last step Apr 1: file from May 1 to Aug 29, 2026.");
    expect(html).toContain("With a last step on April 1, 2026 the window runs from May 1, 2026 to August 29, 2026.");
    expect(html).toContain("a last step on July 30, 2026 leaves only August 29, 2026.");
  });

  it("is moved by dragging the drawing, with no slider or keys", () => {
    expect(html).not.toContain('type="range"');
    expect(html).not.toContain("tabindex");
    expect(html).toContain("Drag the carriage, or scroll, to move the last step.");
  });

  it("says it's an illustration on an example case, and hides nothing", () => {
    expect(html).toContain("An illustration, on an example case whose recruitment began March 2, 2026");
    expect(html).not.toMatch(/opacity:\s*0[;"]/);
  });
});
