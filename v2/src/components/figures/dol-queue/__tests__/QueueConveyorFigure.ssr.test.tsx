/**
 * @vitest-environment node
 *
 * The queue conveyor renders whole on the server: the drawing, its name, the first reading and a
 * caption carrying the estimate's dates in words, before any script runs.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import QueueConveyorFigure from "../QueueConveyorFigure";
import { buildQueueRun } from "../model";

const IN_LINE: [string, number][] = [
  ["2025-10", 116], ["2025-11", 343], ["2025-12", 1613], ["2026-01", 9707], ["2026-02", 4872], ["2026-03", 6625],
  ["2026-04", 7039], ["2026-05", 7865], ["2026-06", 10053], ["2026-07", 8837], ["2026-08", 8545], ["2026-09", 10035], ["2026-10", 6621],
];
const run = buildQueueRun({
  backlog: IN_LINE.map(([month, n]) => ({ month, total: n, pending: n, decided: 0, decidedPct: 0, analystReview: n })),
  pace: { pace: 541, fast: 650, slow: 450, weekdayMean: 700, weekendMean: 140, weekdaysUsed: 24, daysUsed: 35 },
  dolMonth: "2025-12",
  dolAsOf: "2026-10-05",
  sweepFinishedOn: "2026-10-21",
  today: "2026-10-21",
})!;

describe("QueueConveyorFigure on the server", () => {
  const html = renderToStaticMarkup(<QueueConveyorFigure run={run} census="2026-10-21" />);

  it("draws one tray a month, the picked one in lime, and names the drawing", () => {
    expect(html).toMatch(/<title id="dol-queue-title">An illustration of DOL&#x27;s PERM line as a roller conveyor\./);
    expect((html.match(/class="iso-solid dq-pick"/g) ?? []).length).toBe(2); // the tray and its stack
    expect(html).toContain(">Nov 2025<");
  });

  it("starts today and gives the estimate's dates in words", () => {
    expect(html).toContain("October 21, 2026: DOL is finishing November 2025&#x27;s last cases.");
    expect(html).toContain("DOL&#x27;s own published month was December 2025 on October 5, 2026.");
    expect(html).toContain("about 541 cases a day");
    expect(html).toContain(`so the line reaches it around`);
    expect(html).toContain("if DOL keeps that pace and works strictly in filing order");
  });

  it("can be paused, because it moves by itself (WCAG 2.2.2), and the control hides under reduced motion", () => {
    const button = html.match(/<button[^>]*>/)?.[0] ?? "";
    expect(button).toContain('aria-label="Pause the time-lapse"');
    expect(button).toContain("motion-reduce:hidden");
  });

  it("hides nothing", () => {
    expect(html).not.toMatch(/opacity:\s*0[;"]/);
  });
});
