import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import {
  RankedRateViews,
  RateTable,
  RateViews,
  wilsonInterval,
  type RateRow,
} from "../RateBars";

/**
 * Three subjects, all about honesty rather than layout.
 *
 * The interval maths, because a rate printed without one invites the reader to
 * treat 25% over four cases as a finding. The floor, because ranking hundreds
 * of groups by a rate puts the thinnest ones on top by construction. And the
 * controls themselves, because a floor select that renders and does not filter
 * is worse than none: it tells the reader a decision was applied when it was
 * not.
 */

const SMALL: RateRow[] = [
  { label: "Part time", rate: 54.31, decided: 383, denied: 208 },
  { label: "Ownership", rate: 25.74, decided: 338, denied: 87 },
  { label: "Layoff", rate: 0.59, decided: 9519, denied: 56 },
];

/** One thin group with a scary rate, one large group with a real one. */
const RANKED: RateRow[] = [
  { label: "Tiny Trade", rate: 25, decided: 4, denied: 1, group: "Production" },
  { label: "Thin Job", rate: 12, decided: 50, denied: 6, group: "Production" },
  { label: "Software Developers", rate: 1.2, decided: 57000, denied: 684, group: "Computer" },
  { label: "Accountants", rate: 3.4, decided: 3000, denied: 102, group: "Business" },
  { label: "Mid Job", rate: 5.0, decided: 500, denied: 25, group: "Business" },
];

describe("wilsonInterval", () => {
  it("matches the Wilson score interval to four decimals", () => {
    expect(wilsonInterval(3, 100)).toEqual({
      lo: expect.closeTo(1.0254, 3),
      hi: expect.closeTo(8.4521, 3),
    });
    expect(wilsonInterval(208, 383)).toEqual({
      lo: expect.closeTo(49.301, 3),
      hi: expect.closeTo(59.2296, 3),
    });
  });

  it("never returns a negative floor, which is the whole reason it is not the normal approximation", () => {
    // 0 of 50 under the normal approximation is 0 plus or minus 0, and under a
    // careless variant it is negative. Wilson gives a real upper bound.
    const ci = wilsonInterval(0, 50)!;
    expect(ci.lo).toBe(0);
    expect(ci.hi).toBeCloseTo(7.135, 3);
  });

  it("shows a four-case group for what it is: an interval spanning most of the range", () => {
    const ci = wilsonInterval(1, 4)!;
    expect(ci.hi - ci.lo).toBeGreaterThan(60);
  });

  it("returns null rather than a number when there is nothing to bound", () => {
    expect(wilsonInterval(0, 0)).toBeNull();
    expect(wilsonInterval(1, Number.NaN)).toBeNull();
  });
});

describe("RateTable", () => {
  it("prints the interval beside every rate", () => {
    render(<RateTable rows={SMALL} baseline={2.57} caption="Test" />);
    expect(screen.getByText("49.30–59.23%")).toBeInTheDocument();
  });

  it("re-orders the rows when a column heading is pressed", () => {
    render(<RateTable rows={SMALL} baseline={2.57} caption="Test" />);
    const firstRowLabel = () =>
      within(screen.getAllByRole("row")[1]!).getAllByRole("cell")[0]!.textContent;

    // Default is denial rate, descending.
    expect(firstRowLabel()).toContain("Part time");

    fireEvent.click(screen.getByRole("button", { name: /Decided/ }));
    expect(firstRowLabel()).toContain("Layoff");

    fireEvent.click(screen.getByRole("button", { name: /Decided/ }));
    expect(firstRowLabel()).toContain("Ownership");
  });

  it("declares its sort direction to assistive technology", () => {
    render(<RateTable rows={SMALL} baseline={2.57} caption="Test" />);
    const rateHeader = screen.getByRole("columnheader", { name: /Denial rate/ });
    expect(rateHeader).toHaveAttribute("aria-sort", "descending");
    fireEvent.click(within(rateHeader).getByRole("button"));
    expect(rateHeader).toHaveAttribute("aria-sort", "ascending");
  });
});

describe("RateViews", () => {
  it("carries the same rows in both the chart and the table", () => {
    render(
      <RateViews
        label="Flags"
        rows={SMALL}
        baseline={2.57}
        caption="Test"
      />,
    );
    // The bar row and the table row both name it, from one set of props.
    expect(screen.getAllByText("Part time").length).toBeGreaterThanOrEqual(2);
  });
});

describe("RankedRateViews", () => {
  const setup = () =>
    render(
      <RankedRateViews
        label="Occupations"
        rows={RANKED}
        baseline={2.57}
        noun="occupations"
        unitLabel="Occupation"
        facetLabel="Job family"
        searchPlaceholder="Search…"
        csvFilename="test.csv"
      />,
    );

  /**
   * The table is `hidden` while the chart is showing, so `getByRole` cannot
   * see it and a bare `queryByText` would happily match a row inside the
   * hidden panel. Every table assertion switches to the table view first and
   * then scopes to the table itself.
   */
  const openTable = () =>
    fireEvent.click(screen.getByRole("button", { name: /^All \d+$/ }));

  const chartTab = () => screen.getByRole("button", { name: /^(Chart|Top \d+)$/ });

  const table = () => within(screen.getByRole("table"));

  it("keeps the four-case group out of the ranking at the default floor", () => {
    setup();
    openTable();
    expect(table().queryByText("Tiny Trade")).not.toBeInTheDocument();
    expect(table().getByText("Software Developers")).toBeInTheDocument();
  });

  it("says how many groups the floor removed rather than dropping them silently", () => {
    setup();
    expect(screen.getByText(/3 occupations clear this floor/)).toBeInTheDocument();
    expect(screen.getByText(/2 below it, not ranked/)).toBeInTheDocument();
  });

  it("brings the thin groups back when the floor is lowered, which is the control doing its job", () => {
    setup();
    openTable();
    expect(table().queryByText("Thin Job")).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: /Min cases/ }), {
      target: { value: "25" },
    });
    expect(table().getByText("Thin Job")).toBeInTheDocument();
    expect(screen.getByText(/4 occupations clear this floor/)).toBeInTheDocument();
    // Four decided cases is under every floor offered, so it never ranks.
    expect(table().queryByText("Tiny Trade")).not.toBeInTheDocument();
  });

  it("raising the floor drops a group that cleared the lower one", () => {
    setup();
    openTable();
    // 500 decided clears the default floor of 100.
    expect(table().getByText("Mid Job")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: /Min cases/ }), {
      target: { value: "1000" },
    });
    expect(table().queryByText("Mid Job")).not.toBeInTheDocument();
    expect(screen.getByText(/2 occupations clear this floor/)).toBeInTheDocument();
    expect(screen.getByText(/3 below it, not ranked/)).toBeInTheDocument();
  });

  it("filters the table by job family", () => {
    setup();
    openTable();
    fireEvent.change(screen.getByRole("combobox", { name: /Job family/ }), {
      target: { value: "Computer" },
    });
    expect(table().getByText("Software Developers")).toBeInTheDocument();
    expect(table().queryByText("Accountants")).not.toBeInTheDocument();
  });

  it("searches the table", () => {
    setup();
    openTable();
    fireEvent.change(screen.getByPlaceholderText("Search…"), {
      target: { value: "account" },
    });
    expect(table().getByText("Accountants")).toBeInTheDocument();
    expect(table().queryByText("Software Developers")).not.toBeInTheDocument();
  });

  it("keeps the chart and the table on the same floor, so the two views cannot disagree", () => {
    setup();
    fireEvent.change(screen.getByRole("combobox", { name: /Min cases/ }), {
      target: { value: "25" },
    });
    // Four groups clear a floor of 25 and the chart shows twelve, so it is
    // showing all of them and says so rather than claiming a top slice.
    expect(
      screen.getByText(/All 4 occupations with at least 25 decided cases/),
    ).toBeInTheDocument();
    expect(chartTab()).toHaveTextContent("Chart");
    openTable();
    expect(table().getByText("Thin Job")).toBeInTheDocument();
  });

  it("labels the chart as a top slice only when it is one", () => {
    setup();
    render(
      <RankedRateViews
        label="Occupations"
        rows={RANKED}
        baseline={2.57}
        noun="occupations"
        unitLabel="Occupation"
        searchPlaceholder="Search…"
        csvFilename="test.csv"
        chartLimit={2}
        defaultFloor={25}
      />,
    );
    expect(screen.getByRole("button", { name: "Top 2" })).toBeInTheDocument();
    expect(screen.getByText(/The 2 highest denial rates among the 4/)).toBeInTheDocument();
  });
});
