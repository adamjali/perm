/**
 * @vitest-environment node
 *
 * The wage-queue conveyor renders whole on the server: the drawing, its name, the first reading
 * and a caption carrying the lookup's dates in words, before any script runs.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import PwdQueueConveyorFigure from "../PwdQueueConveyorFigure";
import { buildPwdQueueRun } from "../model";

const run = buildPwdQueueRun({
  queue: {
    asOf: "2026-10-21",
    byDay: [
      ["2026-04-16", 4], ["2026-05-07", 17], ["2026-06-04", 62], ["2026-07-15", 9078],
      ["2026-08-17", 15022], ["2026-09-01", 600], ["2026-09-15", 13839], ["2026-10-15", 8797],
    ],
    pace: { perWorkday: 750, fast: 800, slow: 700, workdaysUsed: 19 },
  },
  dolMonth: "2026-06",
  dolAsOf: "2026-09-30",
  today: "2026-10-21",
})!;

describe("PwdQueueConveyorFigure on the server", () => {
  const html = renderToStaticMarkup(<PwdQueueConveyorFigure run={run} />);

  it("draws one tray a month, the picked one in lime, and names the drawing", () => {
    expect(html).toMatch(/<title id="pwd-queue-title">An illustration of DOL&#x27;s PERM wage-request line as a roller conveyor\./);
    expect((html.match(/class="iso-solid dq-pick"/g) ?? []).length).toBe(2); // the tray and its stack
    expect(html).toContain(">May 2026<");
  });

  it("starts at the count and gives the lookup's dates in words", () => {
    expect(html).toContain("October 20, 2026, as DOL left it: DOL is finishing May 2026&#x27;s last requests.");
    expect(html).toContain("DOL&#x27;s own published month was June 2026 on September 30, 2026.");
    expect(html).toContain("about 750 requests a working day");
    expect(html).toContain("Weekends and federal holidays don&#x27;t count, because DOL doesn&#x27;t work them.");
    expect(html).toContain("so the line reaches it around");
    expect(html).toContain("Those are the dates the wage-request lookup gives, if DOL keeps that pace.");
  });

  it("can be paused, and is moved by dragging with no slider or keys", () => {
    const button = html.match(/<button[^>]*>/)?.[0] ?? "";
    expect(button).toContain('aria-label="Pause the time-lapse"');
    expect(button).toContain("motion-reduce:hidden");
    expect(html).not.toContain('type="range"');
    expect(html).not.toContain("tabindex");
  });

  it("hides nothing", () => {
    expect(html).not.toMatch(/opacity:\s*0[;"]/);
  });
});
