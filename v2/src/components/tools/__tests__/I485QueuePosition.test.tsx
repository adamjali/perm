import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { I485QueuePosition } from "../I485QueuePosition";
import { CELLS } from "@/lib/i485/__tests__/cells.fixture";

/**
 * The page's whole argument is that the answer is a RANGE, so these pin the
 * three states that argument produces and the one it refuses to produce.
 *
 * Fixture is the real 2026-08-05 release for the pairs involved, so the
 * figures asserted below are USCIS's own.
 */

const OPTIONS = [
  { country: "China", categories: ["EB1", "EW3"] },
  { country: "India", categories: ["EB1", "EB2", "EB3"] },
  { country: "Mexico", categories: ["EB5R"] },
  { country: "Philippines", categories: ["CRW"] },
  { country: "Rest of the World", categories: ["EB2"] },
];

const TREND = [
  { asOf: "2026-07-06", total: 264158 },
  { asOf: "2026-08-05", total: 263975 },
];

function renderTool(props: Partial<React.ComponentProps<typeof I485QueuePosition>> = {}) {
  return render(
    <I485QueuePosition
      cells={CELLS}
      options={OPTIONS}
      asOf="2026-08-05"
      trend={TREND}
      {...props}
    />,
  );
}

function select(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("I485QueuePosition", () => {
  it("opens on a real answer, presented as two figures of equal weight", () => {
    // India EB2 at 2013-01. Never one number with a footnote: the floor and
    // the ceiling are both true and neither is the answer on its own.
    renderTool();
    expect(screen.getByText(/at least/i)).toBeInTheDocument();
    expect(screen.getByText(/at most/i)).toBeInTheDocument();
    const low = screen.getByText(/at least/i).parentElement?.textContent ?? "";
    const high = screen.getByText(/at most/i).parentElement?.textContent ?? "";
    expect(low).not.toBe(high);
  });

  it("states the suppressed-cell count and what it means", () => {
    renderTool();
    select(/priority date year/i, "2012");
    select(/priority date month/i, "6");
    // 184 counted + 49 withheld cells = 233 to 674, straight from the release.
    expect(screen.getByText("233")).toBeInTheDocument();
    expect(screen.getByText("674")).toBeInTheDocument();
    expect(screen.getByText("184")).toBeInTheDocument();
    expect(screen.getByText("49")).toBeInTheDocument();
    expect(screen.getByText(/between 1 and 10 applications/i)).toBeInTheDocument();
  });

  it("gives one figure, not a range of one value, where nothing was suppressed", () => {
    // India EB1 has no withheld cell anywhere, so "at least X, at most X"
    // would be an absurd way to report an exact count.
    renderTool();
    select(/preference category/i, "EB1");
    select(/priority date year/i, "2023");
    select(/priority date month/i, "1");
    expect(screen.queryByText(/at least/i)).not.toBeInTheDocument();
    expect(screen.getByText(/^ahead of you$/i)).toBeInTheDocument();
    expect(screen.getByText(/suppressed no cell in this span/i)).toBeInTheDocument();
  });

  it("withholds a position entirely when the date is past everything published", () => {
    // India EB2's last published cell is 2015-01. At 2019 there is no
    // position inside the queue, and inventing one from the category total
    // is exactly what this refuses to do.
    renderTool();
    select(/priority date year/i, "2019");
    expect(screen.getByText(/every published application is ahead of you/i)).toBeInTheDocument();
    expect(screen.queryByText(/at least/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/at most/i)).not.toBeInTheDocument();
    expect(screen.getByText(/January 2015/)).toBeInTheDocument();
  });

  it("catches a date inside the last published YEAR but past its last month", () => {
    // The case the read layer's year-level `outsideCoverage` misses. 33 of
    // the 47 pairs stop before December, so this is the common shape.
    renderTool();
    select(/priority date year/i, "2015");
    select(/priority date month/i, "6");
    expect(screen.getByText(/every published application is ahead of you/i)).toBeInTheDocument();
  });

  it("says nobody is necessarily behind you, rather than implying it", () => {
    renderTool();
    select(/priority date year/i, "2019");
    expect(screen.getByText(/doesn’t mean nobody is behind you/i)).toBeInTheDocument();
  });

  it("never prints a bare zero for a category USCIS publishes as all-suppressed", () => {
    // Mexico EB5R has 0 counted and 21 withheld cells. "0 pending" would be
    // false about a category holding between 21 and 210 applications.
    renderTool();
    select(/country of chargeability/i, "Mexico");
    const band = screen.getByText(/the whole category/i).parentElement;
    expect(band?.textContent).toContain("21 to 210");
    expect(screen.getByText(/USCIS withheld every cell in this category/i)).toBeInTheDocument();
  });

  it("keeps the category selection valid when the country changes", () => {
    // Mexico publishes no EB2 in this fixture, so the selection has to fall
    // back rather than compute against a pair that does not exist.
    renderTool();
    select(/preference category/i, "EB2");
    select(/country of chargeability/i, "Mexico");
    const categorySelect = screen.getByLabelText(/preference category/i) as HTMLSelectElement;
    expect(categorySelect.value).toBe("EB5R");
    expect(screen.queryByText(/being fetched/i)).not.toBeInTheDocument();
  });

  it("labels the release-by-release figures as a floor, not a total", () => {
    renderTool();
    expect(screen.getByText(/counted cells only, so\s+each figure is a floor/i)).toBeInTheDocument();
    expect(screen.getByText(/fell by 183 between these two releases/i)).toBeInTheDocument();
  });

  it("renders an empty state pointing at USCIS when the release has not landed", () => {
    // Deploy skew: a frontend live ahead of its data.
    renderTool({ cells: {}, options: [], trend: [] });
    expect(screen.getByText(/being fetched/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /USCIS publishes it directly/i })).toHaveAttribute(
      "href",
      expect.stringContaining("uscis.gov"),
    );
  });

  it("describes the bar in text for anyone not reading the drawing", () => {
    renderTool();
    const bar = screen.getByRole("img");
    expect(bar).toHaveAttribute("aria-label", expect.stringContaining("cells were withheld by USCIS"));
  });
});
