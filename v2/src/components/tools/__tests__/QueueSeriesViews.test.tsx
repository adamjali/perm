import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import { DecisionsByMonth, QueueHistoryChart } from "../QueueHistoryChart";
import { PwdBacklogChart } from "../PwdBacklogChart";

/**
 * The processing-times page's three series, tested on the two things that can
 * silently be wrong: whether a control re-scopes anything, and whether a
 * figure changes meaning when the window does.
 *
 * The second one is the subtle failure. "Moved 2 months" against the reading
 * before it is a fact about the queue; recomputed against whatever happens to
 * be the first row on screen, it becomes a fact about the control, and it
 * would read identically.
 */

const READINGS = [
  { asOf: "2026-01-05", frontierMonth: "2024-08" },
  { asOf: "2026-02-02", frontierMonth: "2024-09" },
  { asOf: "2026-03-02", frontierMonth: "2024-11" },
  { asOf: "2026-04-06", frontierMonth: "2024-12" },
  { asOf: "2026-05-04", frontierMonth: "2025-02" },
  { asOf: "2026-06-01", frontierMonth: "2025-02" },
  { asOf: "2026-07-06", frontierMonth: "2025-04" },
  { asOf: "2026-08-03", frontierMonth: "2025-05" },
];

const openTable = (label = "Table") =>
  fireEvent.click(screen.getByRole("button", { name: label }));

/**
 * Scope every table assertion to the table. The chart carries the same month
 * names and the same dates in its axis and its bar rows, so an unscoped query
 * either finds two matches or, worse, finds the chart's copy and passes while
 * the table is wrong.
 */
const table = () => within(screen.getByRole("table"));

describe("QueueHistoryChart", () => {
  it("offers only the windows the record can actually fill", () => {
    render(<QueueHistoryChart points={READINGS} />);
    const select = screen.getByRole("combobox", { name: /Readings/ });
    expect(within(select).getByRole("option", { name: "Last 6" })).toBeInTheDocument();
    expect(within(select).getByRole("option", { name: "All 8" })).toBeInTheDocument();
    // Eight readings cannot fill a twelve- or twenty-six-reading window, and a
    // control that returns the same chart is worse than no control.
    expect(within(select).queryByRole("option", { name: "Last 12" })).not.toBeInTheDocument();
    expect(within(select).queryByRole("option", { name: "Last 26" })).not.toBeInTheDocument();
  });

  it("re-scopes to the chosen window, and says which dates it now spans", () => {
    render(<QueueHistoryChart points={READINGS} />);
    expect(screen.getByText(/2026-01-05 to 2026-08-03/)).toBeInTheDocument();
    expect(screen.getByText(/advanced 9 months across it/)).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: /Readings/ }), {
      target: { value: "6" },
    });
    expect(screen.getByText(/2026-03-02 to 2026-08-03/)).toBeInTheDocument();
    expect(screen.getByText(/advanced 6 months across it/)).toBeInTheDocument();
  });

  it("drops the rows outside the window from the table too", () => {
    render(<QueueHistoryChart points={READINGS} />);
    openTable();
    expect(table().getByText("2026-01-05")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: /Readings/ }), {
      target: { value: "6" },
    });
    expect(table().queryByText("2026-01-05")).not.toBeInTheDocument();
    expect(table().getByText("2026-08-03")).toBeInTheDocument();
  });

  it("measures movement against the whole record, never against the window", () => {
    render(<QueueHistoryChart points={READINGS} />);
    fireEvent.change(screen.getByRole("combobox", { name: /Readings/ }), {
      target: { value: "6" },
    });
    openTable();
    // 2026-03-02 is now the oldest row on screen. Its move is still the two
    // months it gained on 2026-02-02, which is off screen.
    const row = table().getByText("2026-03-02").closest("tr")!;
    expect(within(row).getByText("+2 months")).toBeInTheDocument();
  });

  it("records a week where the queue did not move as exactly that", () => {
    render(<QueueHistoryChart points={READINGS} />);
    openTable();
    const row = table().getByText("2026-06-01").closest("tr")!;
    expect(within(row).getByText("no change")).toBeInTheDocument();
  });

  it("drops the middle x label when it would collide with the edge one", () => {
    // The real failing case, from the live page: three readings where two are
    // a day apart. The middle tick is chosen by INDEX and drawn by DATE, so
    // with unevenly spaced readings it lands at 87.5% of the span, 40 units
    // from a right-hand label anchored to the frame. The page rendered
    // "2026-08-2023-08-28" - two different dates overprinted.
    const CLUSTERED = [
      { asOf: "2026-08-20", frontierMonth: "2025-09" },
      { asOf: "2026-08-27", frontierMonth: "2025-10" },
      { asOf: "2026-08-28", frontierMonth: "2025-11" },
    ];
    const { container } = render(<QueueHistoryChart points={CLUSTERED} />);
    const labels = [...container.querySelectorAll("svg text")]
      .map((t) => t.textContent ?? "")
      .filter((t) => /^\d{4}-\d{2}-\d{2}$/.test(t));

    // Both ends must still be labelled - dropping a tick must not cost the
    // reader the span the chart covers.
    expect(labels).toContain("2026-08-20");
    expect(labels).toContain("2026-08-28");
    // ...and the crowded middle one is gone rather than overprinted.
    expect(labels).not.toContain("2026-08-27");
  });

  it("keeps the middle x label when the readings are spread out", () => {
    // The guard must not simply delete the middle tick always: a well-spaced
    // series should still get three, or it has traded one defect for another.
    const SPREAD = [
      { asOf: "2026-05-01", frontierMonth: "2025-06" },
      { asOf: "2026-06-15", frontierMonth: "2025-08" },
      { asOf: "2026-08-28", frontierMonth: "2025-11" },
    ];
    const { container } = render(<QueueHistoryChart points={SPREAD} />);
    const labels = [...container.querySelectorAll("svg text")]
      .map((t) => t.textContent ?? "")
      .filter((t) => /^\d{4}-\d{2}-\d{2}$/.test(t));
    expect(labels).toContain("2026-06-15");
  });

  it("renders nothing rather than an empty frame on a single reading", () => {
    const { container } = render(<QueueHistoryChart points={[READINGS[0]!]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

const DECISIONS = [
  { month: "2025-06", decisions: 15255 },
  { month: "2025-07", decisions: 14998 },
  { month: "2025-08", decisions: 16699 },
  { month: "2025-09", decisions: 14239 },
  { month: "2025-10", decisions: 21 },
  { month: "2025-11", decisions: 8890 },
  { month: "2025-12", decisions: 9198 },
  { month: "2026-01", decisions: 12842 },
];

describe("DecisionsByMonth", () => {
  it("names the month that collapses, and stops there", () => {
    render(<DecisionsByMonth points={DECISIONS} />);
    expect(screen.getByText(/October 2025 carries 21/)).toBeInTheDocument();
    expect(screen.getByText(/the files do(n.t| not) say why/)).toBeInTheDocument();
  });

  it("does not invent an outlier when the record has none", () => {
    render(<DecisionsByMonth points={DECISIONS.filter((d) => d.decisions > 1000)} />);
    expect(screen.queryByText(/the files do(n.t| not) say why/)).not.toBeInTheDocument();
  });

  it("re-scopes both the bars and the table to the window", () => {
    render(<DecisionsByMonth points={DECISIONS} />);
    expect(screen.getByText(/8 months, 92,142 decisions/)).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: /Window/ }), {
      target: { value: "6" },
    });
    expect(screen.getByText(/6 months, 61,889 decisions/)).toBeInTheDocument();

    openTable();
    expect(table().queryByText("June 2025")).not.toBeInTheDocument();
    expect(table().getByText("January 2026")).toBeInTheDocument();
  });

  it("carries the month-on-month change in the table, which the bars cannot show", () => {
    render(<DecisionsByMonth points={DECISIONS} />);
    openTable();
    const row = table().getByText("November 2025").closest("tr")!;
    expect(within(row).getByText("+8,869")).toBeInTheDocument();
  });
});

const BACKLOG = [
  { receiptMonth: "2025-12", remainingRequests: 11 },
  { receiptMonth: "2026-01", remainingRequests: 63 },
  { receiptMonth: "2026-02", remainingRequests: 106 },
  { receiptMonth: "2026-03", remainingRequests: 627 },
  { receiptMonth: "2026-04", remainingRequests: 14386 },
];

describe("PwdBacklogChart", () => {
  it("offers no scope control when there is no case to scope around", () => {
    render(<PwdBacklogChart backlog={BACKLOG} />);
    expect(screen.queryByRole("combobox", { name: /Show/ })).not.toBeInTheDocument();
  });

  it("runs the pile total forward, which is the figure that answers what is ahead", () => {
    render(<PwdBacklogChart backlog={BACKLOG} />);
    openTable();
    const row = table().getByText("March 2026").closest("tr")!;
    // 11 + 63 + 106 + 627
    expect(within(row).getByText("807")).toBeInTheDocument();
    // The pile total, in the footer. April's running total is the same number,
    // which is the arithmetic working rather than a duplicate.
    const foot = table().getByText("Whole pile").closest("tr")!;
    expect(within(foot).getByText("15,193")).toBeInTheDocument();
  });

  it("filters the pile to what sits ahead of a given month", () => {
    render(<PwdBacklogChart backlog={BACKLOG} selectedMonth="2026-03" />);
    expect(screen.getByText(/15,193 of 15,193 pending requests/)).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: /Show/ }), {
      target: { value: "ahead" },
    });
    expect(screen.getByText(/180 of 15,193 pending requests/)).toBeInTheDocument();
    openTable();
    expect(table().queryByText("April 2026")).not.toBeInTheDocument();
    expect(table().getByText("January 2026")).toBeInTheDocument();
  });

  it("keeps 'this month and older' meaning the same when the view is narrowed", () => {
    render(<PwdBacklogChart backlog={BACKLOG} selectedMonth="2026-03" />);
    fireEvent.change(screen.getByRole("combobox", { name: /Show/ }), {
      target: { value: "from" },
    });
    openTable();
    // March is now the first row shown; its running total is still measured
    // from the oldest month in the whole pile, not from the top of the view.
    const row = table().getByText("March 2026").closest("tr")!;
    expect(within(row).getByText("807")).toBeInTheDocument();
  });
});
