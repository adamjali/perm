// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import { createMockActivityItem } from "../../../../test-utils/activity-fixtures";
import RecentActivityCard from "../RecentActivityCard";

describe("RecentActivityCard", () => {
  it("names the case, what changed, the role and the stage, and links to the case", () => {
    const a = createMockActivityItem({ action: "PWD filed", positionTitle: "Data Engineer", caseStatus: "pwd" });
    renderWithProviders(<RecentActivityCard activity={a} />);
    expect(screen.getByText(a.employerName)).toBeInTheDocument();
    expect(screen.getByText("PWD filed · Data Engineer · PWD")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", `/cases/${a.id}`);
    expect(screen.getByTestId("activity-timestamp")).toBeInTheDocument();
  });
});
