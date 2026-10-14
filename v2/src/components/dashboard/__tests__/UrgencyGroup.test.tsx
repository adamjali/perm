// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import { createManyDeadlinesGroup } from "../../../../test-utils/deadline-fixtures";
import UrgencyGroup from "../UrgencyGroup";

describe("UrgencyGroup", () => {
  it("heads the group with its name and count", () => {
    renderWithProviders(<UrgencyGroup title="This week" urgency="thisWeek" items={createManyDeadlinesGroup(2, "thisWeek")} />);
    const heading = screen.getByRole("heading", { level: 3 });
    expect(heading).toHaveTextContent("This week");
    expect(heading).toHaveTextContent("2");
  });

  it("says nothing is due when empty", () => {
    renderWithProviders(<UrgencyGroup title="Overdue" urgency="overdue" items={[]} />);
    expect(screen.getByText("Nothing due")).toBeInTheDocument();
  });

  it("shows the first five, then the rest on request", () => {
    renderWithProviders(<UrgencyGroup title="Later" urgency="later" items={createManyDeadlinesGroup(8, "later")} />);
    expect(screen.getAllByRole("link")).toHaveLength(5);
    fireEvent.click(screen.getByRole("button", { name: "Show 3 more" }));
    expect(screen.getAllByRole("link")).toHaveLength(8);
    expect(screen.getByRole("button", { name: "Show fewer" })).toBeInTheDocument();
  });
});
