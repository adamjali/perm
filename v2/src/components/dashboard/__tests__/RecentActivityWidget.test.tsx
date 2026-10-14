// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import RecentActivityWidget from "../RecentActivityWidget";
import {
  createEmptyActivityList,
  activityScenarios,
} from "../../../../test-utils/activity-fixtures";
import type { RecentActivityItem } from "@convex/lib/dashboardTypes";

const mockUseQuery = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: () => mockUseQuery(),
}));

vi.mock("../RecentActivityCard", () => ({
  default: ({ activity }: { activity: RecentActivityItem }) => (
    <div data-testid="activity-card" data-activity-id={activity.id}>
      {activity.employerName} - {activity.action}
    </div>
  ),
}));

describe("RecentActivityWidget", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders skeleton during loading", () => {
    mockUseQuery.mockReturnValue(undefined);
    const { container } = renderWithProviders(<RecentActivityWidget />);

    expect(container.querySelectorAll('[class*="skeleton"]').length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "All cases" })).not.toBeInTheDocument();
  });

  describe("with data", () => {
    it("renders the heading, a row per change and a link to all cases", () => {
      mockUseQuery.mockReturnValue(activityScenarios.typical);
      const { container } = renderWithProviders(<RecentActivityWidget />);

      expect(screen.getByRole("heading", { name: "Recent changes" })).toBeInTheDocument();
      expect(container.querySelectorAll('[data-testid="activity-card"]')).toHaveLength(activityScenarios.typical.length);
      expect(screen.getByRole("link", { name: "All cases" })).toHaveAttribute("href", "/cases?sort=updated");
    });

    it("keeps the server's order, newest first", () => {
      mockUseQuery.mockReturnValue(activityScenarios.mixedStages);
      const { container } = renderWithProviders(<RecentActivityWidget />);

      const cards = container.querySelectorAll('[data-testid="activity-card"]');
      expect(cards[0]?.getAttribute("data-activity-id")).toBe("case_001");
    });
  });

  describe("empty state", () => {
    it("says there are no changes yet and offers no link", () => {
      mockUseQuery.mockReturnValue(createEmptyActivityList());
      renderWithProviders(<RecentActivityWidget />);

      expect(screen.getByText("No changes yet")).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "All cases" })).not.toBeInTheDocument();
    });
  });

  it("handles null data as loading state", () => {
    mockUseQuery.mockReturnValue(null);
    const { container } = renderWithProviders(<RecentActivityWidget />);
    expect(container.querySelector('[class*="skeleton"]')).toBeInTheDocument();
  });
});
