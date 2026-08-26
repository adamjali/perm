import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { QueueMonthChart } from "../QueueMonthChart";
import { findVolumeAnomalies, type MonthQueue } from "@/lib/queueAhead";

/**
 * The chart's job is to let someone locate themselves in a queue, so what is
 * pinned here is: every month gets a row, the reader's own month is
 * distinguishable, and a collapsed month is labelled rather than left looking
 * like a rendering fault.
 */

function month(filingMonth: string, total: number, decided: number): MonthQueue {
  return {
    filingMonth,
    total,
    pending: total - decided,
    decided,
    decidedPct: total > 0 ? (decided / total) * 100 : null,
  };
}

const SERIES: MonthQueue[] = [
  month("2025-06", 14_000, 14_000),
  month("2025-07", 13_500, 13_400),
  month("2025-08", 14_200, 9_000),
  month("2025-09", 13_800, 4_000),
  month("2025-10", 1_616, 300),
  month("2025-11", 14_100, 0),
  month("2025-12", 13_900, 0),
];

describe("QueueMonthChart", () => {
  it("renders one row per filing month", () => {
    render(<QueueMonthChart months={SERIES} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(SERIES.length);
  });

  it("states each month's progress and pending count for a screen reader", () => {
    render(<QueueMonthChart months={SERIES} selectedMonth="2025-09" />);
    // August: 9,000 of 14,200 decided (63%), 5,200 still pending.
    expect(
      screen.getByLabelText("August 2025: 63% decided, 5,200 still pending"),
    ).toBeInTheDocument();
  });

  it("draws a finished month full and an untouched month empty", () => {
    const { container } = render(<QueueMonthChart months={SERIES} />);
    const bars = container.querySelectorAll("li > span > span");
    expect(bars[0]).toHaveStyle({ width: "100%" });          // 2025-06, done
    expect(bars[bars.length - 1]).toHaveStyle({ width: "0%" }); // 2025-12, not reached
  });

  it("labels the collapsed month and says what it holds", () => {
    render(
      <QueueMonthChart months={SERIES} anomalies={findVolumeAnomalies(SERIES)} />,
    );
    expect(screen.getByText(/One month is marked/)).toBeInTheDocument();
    // Named twice on purpose: once on its own row, once in the note that
    // explains it. A marker with no named month is the thing that reads as a
    // rendering fault.
    expect(screen.getAllByText("October 2025")).toHaveLength(2);
    expect(screen.getByTitle(/Far fewer cases were filed/)).toBeInTheDocument();
    expect(screen.getByText(/1,616 against a neighbouring average of 13,950/))
      .toBeInTheDocument();
    // The cliff is described as real data, not apologised for as a gap.
    expect(
      screen.getByText(/what the records contain, not a gap in them/),
    ).toBeInTheDocument();
  });

  it("says nothing about anomalies when there are none", () => {
    render(<QueueMonthChart months={SERIES} />);
    expect(screen.queryByText(/is marked/)).not.toBeInTheDocument();
  });

  it("points at the source page rather than rendering an empty frame", () => {
    render(<QueueMonthChart months={[]} />);
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /processing times page/ })).toHaveAttribute(
      "href",
      "/perm-processing-times",
    );
  });

  it("names all three positions in the legend", () => {
    render(<QueueMonthChart months={SERIES} selectedMonth="2025-09" />);
    for (const t of ["Ahead of yours", "Your month", "Filed after yours"]) {
      expect(screen.getByText(t)).toBeInTheDocument();
    }
  });
});
