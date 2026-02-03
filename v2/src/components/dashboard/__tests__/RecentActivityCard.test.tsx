// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import RecentActivityCard from "../RecentActivityCard";
import {
  createMockActivityItem,
  ACTIVITY_ACTIONS,
  hoursAgo,
  minutesAgo,
  daysAgo,
} from "../../../../test-utils/activity-fixtures";

vi.mock("date-fns", () => ({
  formatDistanceToNow: vi.fn((timestamp: number) => {
    const diff = Date.now() - timestamp;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  }),
}));

describe("RecentActivityCard", () => {
  it("renders employer, position, action, case number, and links to case", () => {
    const activity = createMockActivityItem({
      employerName: "Tech Corp Inc",
      positionTitle: "Software Engineer",
      action: ACTIVITY_ACTIONS.pwdFiled,
      caseNumber: "CASE-2024-001",
      id: "case_test123" as any,
      timestamp: hoursAgo(2),
    });
    const { container } = renderWithProviders(<RecentActivityCard activity={activity} />);

    expect(screen.getByText("Tech Corp Inc")).toBeInTheDocument();
    expect(screen.getByText("Software Engineer")).toBeInTheDocument();
    expect(screen.getByText("PWD filed")).toBeInTheDocument();
    expect(screen.getByText("CASE-2024-001")).toBeInTheDocument();
    expect(container.querySelector('a[href="/cases/case_test123"]')).toBeInTheDocument();
  });

  it("renders em dash when case number is missing", () => {
    renderWithProviders(<RecentActivityCard activity={createMockActivityItem({ caseNumber: undefined })} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it.each([
    ["pwd"],
    ["recruitment"],
    ["eta9089"],
    ["i140"],
    ["closed"],
  ] as const)("renders status badge for %s", (status) => {
    const { container } = renderWithProviders(
      <RecentActivityCard activity={createMockActivityItem({ caseStatus: status })} />
    );
    expect(container.querySelector(`[data-status="${status}"]`)).toBeInTheDocument();
  });

  it.each([
    ["5m ago", minutesAgo(5)],
    ["2h ago", hoursAgo(2)],
    ["3d ago", daysAgo(3)],
  ])("displays relative time %s", (expected, timestamp) => {
    renderWithProviders(<RecentActivityCard activity={createMockActivityItem({ timestamp })} />);
    expect(screen.getByText(new RegExp(expected))).toBeInTheDocument();
  });

  it("has accessible link with name", () => {
    renderWithProviders(
      <RecentActivityCard activity={createMockActivityItem({ employerName: "Acme Corp" })} />
    );
    const link = screen.getByRole("link");
    expect(link).toHaveAccessibleName();
    expect(link.textContent).toContain("Acme Corp");
  });
});
