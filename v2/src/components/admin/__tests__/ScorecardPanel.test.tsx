import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

import type { Cell } from "@/lib/scorecard/score";

/**
 * The admin scorecard opens with plain verdicts, not a table: "8" and "4"
 * under two headings had read as Rival A beating us, with nothing to say
 * whether the split could be luck (Oct 7 2026).
 */

const cell = (over: Partial<Cell>): Cell => ({
  recorded: 200,
  graded: 13,
  typicalMissDays: 6,
  biasDays: -6,
  inBandShare: null,
  within14Share: 0.8,
  settled: 0,
  settledHitShare: null,
  overdue: 6,
  overdueDays: 5,
  missAtLeastDays: 6,
  biasAtLeastDays: -6,
  ...over,
});
const horizons = { "0-30": cell({}), "31-90": cell({ graded: 0 }), "91-180": cell({ graded: 0 }), "181+": cell({ graded: 0 }) };

// A doc as it was before readings were stored: the panel derives them.
const doc = {
  perm: {
    computedOn: "2026-10-07",
    since: "2026-09-26",
    bySource: {
      ours: { all: cell({}), byModel: {}, byHorizon: horizons },
      "rival-a": { all: cell({ typicalMissDays: 1, missAtLeastDays: 2, biasDays: 0, biasAtLeastDays: 1, overdue: 24 }), byModel: {}, byHorizon: horizons },
    },
  },
  headToHead: {
    "rival-a": {
      shared: 203, decided: 13, oursTypicalDays: 6, rivalTypicalDays: 1,
      oursCloser: 4, rivalCloser: 8, ties: 1, settledWhileWaiting: 0,
    },
  },
};

vi.mock("convex/react", () => ({
  useAction: () => async () => ({ json: JSON.stringify(doc), computedAt: Date.parse("2026-10-07T16:00:00Z") }),
}));

const { ScorecardPanel } = await import("../ScorecardPanel");

describe("ScorecardPanel", () => {
  it("leads with who's closer, in words, with a square per judged case", async () => {
    render(<ScorecardPanel />);
    expect(await screen.findByText("Rival A leads so far, not clearly yet")).toBeTruthy();
    expect(screen.getByText(/8 to 4 could still be luck/)).toBeTruthy();
    const strip = screen.getByRole("img", { name: "We were closer on 4, Rival A on 8, 1 tied." });
    expect(strip.children).toHaveLength(13);
  });

  it("grades each source on the printed scale", async () => {
    render(<ScorecardPanel />);
    await screen.findByText("Grades so far");
    const rows = screen.getAllByRole("row");
    const us = rows.find((r) => r.textContent?.startsWith("Us"));
    const a = rows.find((r) => r.textContent?.startsWith("Rival A"));
    const grade = (r: HTMLElement | undefined) => within(r!).getAllByRole("cell")[0]!.textContent?.trim();
    expect(grade(us)).toBe("B");
    expect(us?.textContent).toContain("6 days late");
    expect(grade(a)).toBe("A");
  });
});
