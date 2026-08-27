import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import { I140Trends } from "../I140Trends";
import type { TrendRow } from "@/lib/i140Trends";

/**
 * The preference rate is a blend, and the blend is the least useful number on
 * the page.
 *
 * `src/lib/i140Trends.ts` already carries the finding in its own field note:
 * over six quarters E-21 denies 2.53% and NIW denies 47.26%, "the single
 * largest difference in this dataset". The page kept them apart, which was
 * the stated requirement, and apart turned out to mean two entries in one
 * dropdown. Reading the difference took two selections and a memory of the
 * first, so a reader who did not already know to look never found it.
 *
 * These pin that the split is on the page without being asked for, and that
 * it stays a pair of measured rates over named populations rather than
 * turning into a score.
 */

function row(over: Partial<TrendRow> & Pick<TrendRow, "category">): TrendRow {
  return {
    fiscalYear: 2026,
    quarter: 1,
    categoryLabel: over.category,
    received: 100,
    approved: 90,
    denied: 10,
    pending: 5,
    ...over,
  };
}

/** EB-2 reconciled to its two children, in the real proportions. */
const ROWS: TrendRow[] = [
  row({ category: "EB2", categoryLabel: "Advanced degree", approved: 104481, denied: 24412 }),
  row({ category: "E21", categoryLabel: "Advanced degree", approved: 79539, denied: 2063 }),
  row({ category: "NIW", categoryLabel: "National Interest Waiver", approved: 24942, denied: 22349 }),
];

describe("I140Trends: the subtype split", () => {
  it("shows both subtype rates without the reader switching category", () => {
    render(<I140Trends rows={ROWS} />);
    const panel = screen.getByText(/what the EB2 rate is an average of/i).closest("section")!;
    // 2,063 of 81,602 decided, and 22,349 of 47,291.
    expect(within(panel).getByText("2.53%")).toBeInTheDocument();
    expect(within(panel).getByText("47.26%")).toBeInTheDocument();
  });

  it("shows the populations each rate is over", () => {
    render(<I140Trends rows={ROWS} />);
    const panel = screen.getByText(/what the EB2 rate is an average of/i).closest("section")!;
    // A rate is only honest next to the count it is over.
    expect(within(panel).getByText(/NIW 47,291, E21 81,602/)).toBeInTheDocument();
    // And it is a rate over past petitions, never odds for one.
    expect(
      within(panel).getByText(/rates over past petitions, not odds for a particular one/i),
    ).toBeInTheDocument();
  });

  it("does not restate the multiple the page lead already gives", () => {
    // ONE FACT, ONE NUMBER. The page's own lead section computes the same
    // ratio from the same rows and rounds it with toFixed(0), so it printed
    // "about 19 times" while this printed "18.7 times". Two numbers for one
    // fact on one page is worse than the duplication that produced them.
    // The lead makes the argument; this measures the decomposition, which is
    // the half that generalises to EB-1 and EB-3.
    const { container } = render(<I140Trends rows={ROWS} />);
    const panel = screen.getByText(/what the EB2 rate is an average of/i).closest("section")!;
    expect(panel.textContent).not.toMatch(/times as often/i);
    // The control: the page lead's phrasing is not in this component at all,
    // so a future edit cannot reintroduce the clash unnoticed.
    expect(container.textContent).not.toMatch(/a difference of about/i);
  });

  it("names the blend as a blend rather than presenting it as a rate", () => {
    render(<I140Trends rows={ROWS} />);
    const panel = screen.getByText(/what the EB2 rate is an average of/i).closest("section")!;
    expect(within(panel).getByText(/18\.94% is the blend/)).toBeInTheDocument();
    expect(within(panel).getByText(/Nobody files under EB2/)).toBeInTheDocument();
  });

  it("says nothing at all when a subtype is selected", () => {
    // A subtype has no children, so there is no blend to break apart.
    render(<I140Trends rows={ROWS} />);
    fireEvent.change(screen.getByLabelText(/category/i), { target: { value: "NIW" } });
    expect(screen.queryByText(/is an average of/i)).not.toBeInTheDocument();
  });

  it("says nothing when the archive holds only one subtype", () => {
    // One child is not a comparison, and drawing a lone bar at 100% of its own
    // maximum would read as a finding rather than as a single number.
    render(
      <I140Trends
        rows={[
          row({ category: "EB2", approved: 79539, denied: 2063 }),
          row({ category: "E21", approved: 79539, denied: 2063 }),
        ]}
      />,
    );
    expect(screen.queryByText(/is an average of/i)).not.toBeInTheDocument();
  });

  it("works for a preference other than EB-2", () => {
    render(
      <I140Trends
        rows={[
          row({ category: "EB1", approved: 41083, denied: 11771 }),
          row({ category: "E11", categoryLabel: "Extraordinary ability", approved: 16357, denied: 10972 }),
          row({ category: "E12", categoryLabel: "Outstanding professor", approved: 8018, denied: 291 }),
          row({ category: "E13", categoryLabel: "Multinational manager", approved: 16708, denied: 508 }),
        ]}
      />,
    );
    fireEvent.change(screen.getByLabelText(/category/i), { target: { value: "EB1" } });
    const panel = screen.getByText(/what the EB1 rate is an average of/i).closest("section")!;
    expect(within(panel).getByText("40.15%")).toBeInTheDocument();
    expect(within(panel).getByText("2.95%")).toBeInTheDocument();
  });
});
