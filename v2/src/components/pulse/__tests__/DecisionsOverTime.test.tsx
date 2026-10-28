import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ActivityDay } from "@/lib/activityStats";

import { DecisionsOverTime } from "../DecisionsOverTime";

// Every day from Mon Apr 13 to Wed Oct 28 2026, 100 decisions each.
const DAYS: ActivityDay[] = [];
for (let t = Date.UTC(2026, 3, 13); t <= Date.UTC(2026, 9, 28); t += 86_400_000) {
  DAYS.push({ date: new Date(t).toISOString().slice(0, 10), total: 100, certified: 80, denied: 15, withdrawn: 5 });
}
const columns = () => screen.getByRole("table").querySelectorAll("tbody tr");

describe("DecisionsOverTime", () => {
  it("opens on the last 30 days, a column a day", () => {
    // Act
    render(<DecisionsOverTime days={DAYS} />);
    // Assert
    expect(screen.getByRole("button", { name: "30 days" })).toHaveAttribute("aria-pressed", "true");
    expect(columns()).toHaveLength(30);
  });

  it("switches to a column a week for 180 days", () => {
    // Arrange
    render(<DecisionsOverTime days={DAYS} />);
    // Act
    fireEvent.click(screen.getByRole("button", { name: "180 days" }));
    // Assert
    expect(screen.getByRole("button", { name: "180 days" })).toHaveAttribute("aria-pressed", "true");
    expect(columns().length).toBeGreaterThanOrEqual(25);
    expect(columns().length).toBeLessThanOrEqual(27);
    expect(screen.getAllByText(/Week of/).length).toBeGreaterThan(0);
  });

  it("offers no switch when it shows one span", () => {
    // Act
    render(<DecisionsOverTime days={DAYS} spans={[30]} />);
    // Assert
    expect(screen.queryByRole("group", { name: "How far back" })).not.toBeInTheDocument();
  });
});
