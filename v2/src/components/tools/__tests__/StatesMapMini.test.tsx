import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StatesMapMini } from "../StatesMapMini";
import { US_STATES } from "@/lib/usStatesGeometry";

/**
 * The data hub's "By state" picture: the real Census outlines of the lower 48
 * (and DC), Florida filled lime, coarsened small enough to sit in a tile.
 */
describe("StatesMapMini", () => {
  const html = renderToStaticMarkup(<StatesMapMini />);
  const paths = html.match(/<path /g) ?? [];

  it("draws every state but the two insets", () => {
    const expected = US_STATES.filter((s) => s.abbr !== "AK" && s.abbr !== "HI").length;
    expect(expected).toBe(49);
    expect(paths.length).toBe(expected);
  });

  it("fills Florida and only Florida", () => {
    const filled = html.match(/fill="var\(--primary\)"/g) ?? [];
    expect(filled.length).toBe(1);
    const fl = US_STATES.find((s) => s.abbr === "FL");
    expect(fl).toBeDefined();
    // Florida's path starts where its coarsened first point lands.
    const first = /^M(-?[\d.]+) (-?[\d.]+)/.exec(fl!.d);
    expect(first).not.toBeNull();
    const start = `M${Math.round(Number(first![1]))} ${Math.round(Number(first![2]))}`;
    expect(html).toMatch(new RegExp(`d="${start}[^"]*" fill="var\\(--primary\\)"`));
  });

  it("stays a thumbnail's weight", () => {
    // The full geometry is about 30 KB; the coarsened outline must be well under it.
    expect(html.length).toBeLessThan(20_000);
    expect(html).toContain('aria-hidden="true"');
  });
});
