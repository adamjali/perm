import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import { FrontierProgressChart, type FrontierPoint } from "../FrontierProgressChart";

/**
 * The reconstructed queue-advance series, in both readings.
 *
 * The figure the chart cannot show is the decision count behind each point. A
 * month whose median sits on 8,890 decisions and one sitting on 19,787 are
 * not equally solid, and the line draws them at identical weight, so the table
 * carries the count and the chart does not pretend to.
 */

const HISTORY: FrontierPoint[] = [
  { decisionMonth: "2025-09", medianFilingMonth: "2024-06", decisions: 14239 },
  { decisionMonth: "2025-11", medianFilingMonth: "2024-07", decisions: 8890 },
  { decisionMonth: "2025-12", medianFilingMonth: "2024-07", decisions: 9198 },
  { decisionMonth: "2026-01", medianFilingMonth: "2024-08", decisions: 12842 },
  { decisionMonth: "2026-02", medianFilingMonth: "2024-09", decisions: 14327 },
  { decisionMonth: "2026-03", medianFilingMonth: "2024-11", decisions: 14671 },
  { decisionMonth: "2026-04", medianFilingMonth: "2024-12", decisions: 15003 },
  { decisionMonth: "2026-05", medianFilingMonth: "2025-02", decisions: 17811 },
  { decisionMonth: "2026-06", medianFilingMonth: "2025-05", decisions: 19787 },
];

const table = () => within(screen.getByRole("table"));

describe("FrontierProgressChart", () => {
  it("draws the line and keeps the same series as rows in the document", () => {
    render(<FrontierProgressChart history={HISTORY} filingMonth="2025-08" />);
    expect(screen.getByRole("img", { name: /advanced from/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Table" }));
    expect(table().getByText("19,787")).toBeInTheDocument();
  });

  it("states how much queue moved in how much calendar, both measured", () => {
    render(<FrontierProgressChart history={HISTORY} filingMonth="2025-08" />);
    // Jun 2024 to May 2025 is 11 months of queue, across 9 months of calendar.
    expect(screen.getByText(/11 months of queue in 9 months of calendar/)).toBeInTheDocument();
  });

  it("re-scopes to a window and recomputes the span with it", () => {
    render(<FrontierProgressChart history={HISTORY} filingMonth="2025-08" />);
    fireEvent.change(screen.getByRole("combobox", { name: /Window/ }), {
      target: { value: "6" },
    });
    expect(screen.getByText(/January 2026 to June 2026/)).toBeInTheDocument();
    expect(screen.getByText(/9 months of queue in 5 months of calendar/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Table" }));
    expect(table().queryByText("September 2025")).not.toBeInTheDocument();
    expect(table().getByText("June 2026")).toBeInTheDocument();
  });

  it("measures each month's advance against the record, not the window", () => {
    render(<FrontierProgressChart history={HISTORY} filingMonth="2025-08" />);
    fireEvent.change(screen.getByRole("combobox", { name: /Window/ }), {
      target: { value: "6" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Table" }));
    // January 2026 is the oldest row on screen and still shows the month it
    // gained on December 2025, which is off screen.
    const row = table().getByText("January 2026").closest("tr")!;
    expect(within(row).getByText("+1 month")).toBeInTheDocument();
  });

  it("records a month where the queue did not advance as exactly that", () => {
    render(<FrontierProgressChart history={HISTORY} filingMonth="2025-08" />);
    fireEvent.click(screen.getByRole("button", { name: "Table" }));
    const row = table().getByText("December 2025").closest("tr")!;
    expect(within(row).getByText("no change")).toBeInTheDocument();
  });

  it("renders nothing rather than an empty frame on a single point", () => {
    const { container } = render(
      <FrontierProgressChart history={[HISTORY[0]!]} filingMonth="2025-08" />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
