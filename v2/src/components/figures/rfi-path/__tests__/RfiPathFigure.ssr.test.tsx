/**
 * @vitest-environment node
 *
 * The RFI railway renders whole on the server: the drawing, its name, the first reading and a
 * caption carrying the measured figures and the case page's dates in words, before any script runs.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import RfiPathFigure from "../RfiPathFigure";
import { buildRfiRun } from "../model";

const run = buildRfiRun({
  clock: {
    leaveDays: { p25: 31, p50: 31, p75: 31 },
    afterLeaveDays: { p25: 1, p50: 3, p75: 9, p90: null },
    slowEndDays: 14,
    slowEndFrom: "an immigration attorney's estimate",
    watched: 1246,
    afterLeaveWatched: 610,
    watchedFrom: "2026-08-27",
    test: null,
  },
  path: {
    since: "2026-08-28",
    entered: 1244,
    inRfi: 623,
    repliedWaiting: 93,
    decided: { certified: 487, denied: 11, withdrawn: 30, other: 0 },
    afterReply: { certified: 479, denied: 11, withdrawn: 4, other: 0 },
  },
  today: "2026-10-21",
})!;

describe("RfiPathFigure on the server", () => {
  const html = renderToStaticMarkup(<RfiPathFigure run={run} />).replace(/&#x27;/g, "'");

  it("draws the track with the case file in lime and names the drawing", () => {
    expect(html).toContain('role="img"');
    expect(html).toMatch(/<title id="rfi-path-title">An illustration of a PERM RFI as a model railway\./);
    expect((html.match(/class="iso-solid iso-accent"/g) ?? []).length).toBe(2); // the file and its tab
    expect((html.match(/class="iso-solid/g) ?? []).length).toBeGreaterThan(40);
  });

  it("starts before the RFI and gives the measured figures and the case page's dates in words", () => {
    expect(html).toContain("October 15, 2026: the case is in analyst review, in filing order.");
    expect(html).toContain("DOL gives the employer 30 days, to November 20, 2026.");
    expect(html).toContain("Our sweep has watched 1,246 RFIs from their first day since August 27, 2026.");
    expect(html).toContain("Half had left RFI status by day 31: DOL moves the case when its 30 days run out");
    expect(html).toContain("half were decided within 3 days of going back to review, and 3 in 4 within 9, over 610 decided cases.");
    expect(html).toContain("around November 24, 2026, between November 22, 2026 and December 5, 2026.");
    expect(html).toContain("The late end allows 14 days after the case leaves RFI.");
    expect(html).toContain("Of the 494 RFIs decided after a reply so far, 479 were certified.");
  });

  it("can be paused, because it moves by itself (WCAG 2.2.2), and the control hides under reduced motion", () => {
    const button = html.match(/<button[^>]*>/)?.[0] ?? "";
    expect(button).toContain('aria-label="Pause the time-lapse"');
    expect(button).toContain("motion-reduce:hidden");
  });

  it("is moved by dragging the drawing, with no slider or keys, and hides nothing", () => {
    expect(html).not.toContain('type="range"');
    expect(html).not.toContain("tabindex");
    expect(html).toContain("Drag along the track, or scroll, to move through the days.");
    expect(html).not.toMatch(/opacity:\s*0[;"]/);
  });
});
