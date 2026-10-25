/**
 * @vitest-environment node
 *
 * The card sorter renders whole on the server: the drawing, its name, the finished batch in the
 * stacks, the readout and every pocket's real total in the legend, before any script runs.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import CardSorterFigure from "../CardSorterFigure";
import { buildSorterRun } from "../model";

const run = buildSorterRun({
  statuses: [
    { status: "ANALYST REVIEW", count: 81690, isFinal: false },
    { status: "APPLICATION ON HOLD", count: 2880, isFinal: false },
    { status: "RFI ISSUED", count: 581, isFinal: false },
    { status: "NORD ISSUED", count: 97, isFinal: false },
    { status: "RECONSIDERATION APPEALS", count: 3564, isFinal: false },
  ],
  decided: 753,
  decidedOn: "2026-10-23",
})!;

describe("CardSorterFigure on the server", () => {
  const html = renderToStaticMarkup(<CardSorterFigure run={run} />);

  it("names the drawing and draws no card in flight", () => {
    expect(html).toMatch(/<title id="card-sorter-title">An illustration of the nightly check as a card sorter\./);
    // The pool's cards are parked hidden until the run starts.
    expect((html.match(/style="display:none"/g) ?? []).length).toBe(8);
  });

  it("opens on the finished batch and prints every pocket's total", () => {
    expect(html).toContain("100 cards sorted. 91 went to analyst review.");
    for (const n of ["81,690", "2,880", "581", "97", "3,564", "753"]) expect(html).toContain(`>${n}<`);
    expect(html).toContain("91 of every 100 cards.");
    expect(html).toContain("Under 1 in 100 cards.");
  });

  it("carries a pause button", () => {
    expect(html).toContain('aria-label="Pause the card sorter"');
  });
});
