/**
 * @vitest-environment node
 *
 * The two-clocks figure renders whole on the server: the drawing, its name, the first reading and
 * a caption with both dates in words, before any script runs.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import I140ClocksFigure from "../I140ClocksFigure";

describe("I140ClocksFigure on the server", () => {
  const html = renderToStaticMarkup(<I140ClocksFigure />);

  it("draws both lanes and names the drawing", () => {
    expect(html).toContain('role="img"');
    expect(html).toMatch(/<title id="i140-clocks-title">An illustration of two 180-day clocks as lanes on a bench\./);
    expect(html).toContain(">I-140<");
    expect(html).toContain(">I-485<");
    expect(html).not.toContain("iso-accent"); // on October 1 neither clock has run
  });

  it("starts on the guide's October 1 and gives both dates in words", () => {
    expect(html).toContain("Leave on Oct 1: a withdrawal would revoke the I-140, and the I-485 can&#x27;t move yet.");
    expect(html).toContain("From October 17, 2026, an employer&#x27;s withdrawal no longer revokes the I-140.");
    expect(html).toContain("From October 31, 2026, the I-485 can move to a new job in the same or a similar occupation");
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
