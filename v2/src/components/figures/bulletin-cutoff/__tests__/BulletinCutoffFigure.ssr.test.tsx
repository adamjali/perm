/**
 * @vitest-environment node
 *
 * The bulletin drawing renders whole on the server: the drawing, its name, the first bulletin's
 * reading and a caption telling what the line did in words, before any script runs.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { BulletinMonth } from "@/lib/perm";
import BulletinCutoffFigure from "../BulletinCutoffFigure";
import { buildBulletinRun } from "../model";

const ROWS: [string, string][] = [
  ["2024-11", "15JUL12"], ["2024-12", "01AUG12"], ["2025-01", "01OCT12"], ["2025-02", "15OCT12"],
  ["2025-03", "01DEC12"], ["2025-04", "01JAN13"], ["2025-05", "01JAN13"], ["2025-06", "01JAN13"],
  ["2025-07", "01JAN13"], ["2025-08", "01JAN13"], ["2025-09", "01JAN13"], ["2025-10", "01APR13"],
  ["2025-11", "01APR13"], ["2025-12", "15MAY13"], ["2026-01", "15JUL13"], ["2026-02", "15JUL13"],
  ["2026-03", "15SEP13"], ["2026-04", "15JUL14"], ["2026-05", "15JUL14"], ["2026-06", "01SEP13"],
  ["2026-07", "U"], ["2026-08", "U"], ["2026-09", "U"], ["2026-10", "01NOV13"],
];
const bulletins: BulletinMonth[] = ROWS.map(([m, c]) => ({ bulletinMonth: m, finalAction: { EB2: { india: c } }, datesForFiling: {} }));
const run = buildBulletinRun({ bulletins })!;

describe("BulletinCutoffFigure on the server", () => {
  const html = renderToStaticMarkup(<BulletinCutoffFigure run={run} />);

  it("draws the rail, the gate and the lime example date, and names the drawing", () => {
    expect(html).toMatch(/<title id="bulletin-cutoff-title">An illustration of a visa bulletin cutoff as a gate on a rail of priority dates\./);
    expect(html).toContain('role="img"');
    expect(html).toContain('class="iso-accent"');
    expect(html).toContain(">2013<");
    expect(html).toContain(">EB-2 India<");
  });

  it("starts at the first bulletin and tells the line's story in words", () => {
    expect(html).toContain("November 2024 bulletin: cutoff Jul 15, 2012. Feb 1, 2014 waits.");
    expect(html).toContain("The lime block is an example priority date, February 1, 2014.");
    expect(html).toContain("In June 2026 the cutoff went back to September 1, 2013");
    expect(html).toContain("From July to September 2026 the line was Unavailable.");
    expect(html).toContain('href="/visa-bulletin/categories/eb2-india"');
  });

  it("can be paused, because it moves by itself (WCAG 2.2.2), and the control hides under reduced motion", () => {
    const button = html.match(/<button[^>]*>/)?.[0] ?? "";
    expect(button).toContain('aria-label="Pause the bulletins"');
    expect(button).toContain("motion-reduce:hidden");
  });

  it("hides nothing but the gate's second copy, which waits on the far side of the block", () => {
    expect(html).not.toMatch(/opacity:\s*0[;"]/);
    expect((html.match(/display:\s*none/g) ?? []).length).toBe(1);
    expect(html).not.toContain('type="range"');
    expect(html).not.toContain("tabindex");
  });
});
