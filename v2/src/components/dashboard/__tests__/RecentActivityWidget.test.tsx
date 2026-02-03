// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import RecentActivityWidget from "../RecentActivityWidget";
import {
  createMockActivityList,
  createEmptyActivityList,
  activityScenarios,
} from "../../../../test-utils/activity-fixtures";
import type { RecentActivityItem } from "../../../../convex/lib/dashboardTypes";

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
    expect(screen.queryByText("View all")).not.toBeInTheDocument();
  });

  describe("with data", () => {
    it("renders heading, activity cards, and View All button", () => {
      mockUseQuery.mockReturnValue(activityScenarios.typical);
      const { container } = renderWithProviders(<RecentActivityWidget />);

      expect(screen.getByText("Recent Activity")).toBeInTheDocument();
      expect(container.querySelectorAll('[data-testid="activity-card"]').length).toBeGreaterThan(0);
      expect(screen.getByRole("button", { name: /view all/i })).toBeInTheDocument();
    });

    it("truncates to 4 items and shows +N more overflow link", () => {
      mockUseQuery.mockReturnValue(createMockActivityList(10));
      const { container } = renderWithProviders(<RecentActivityWidget />);

      expect(container.querySelectorAll('[data-testid="activity-card"]').length).toBe(4);
      const overflow = screen.getByText(/\+6 more/i);
      expect(overflow.closest("a")).toHaveAttribute("href", "/cases?sort=updated");
    });

    it("shows no overflow when items <= 4", () => {
      mockUseQuery.mockReturnValue(createMockActivityList(4));
      const { container } = renderWithProviders(<RecentActivityWidget />);

      expect(container.querySelectorAll('[data-testid="activity-card"]').length).toBe(4);
      expect(screen.queryByText(/more/i)).not.toBeInTheDocument();
    });

    it("displays most recent activities first", () => {
      mockUseQuery.mockReturnValue(activityScenarios.mixedStages);
      const { container } = renderWithProviders(<RecentActivityWidget />);

      const cards = container.querySelectorAll('[data-testid="activity-card"]');
      expect(cards[0]?.getAttribute("data-activity-id")).toBe("case_001");
    });
  });

  describe("empty state", () => {
    it("shows empty message, CTA, and no View All", () => {
      mockUseQuery.mockReturnValue(createEmptyActivityList());
      renderWithProviders(<RecentActivityWidget />);

      expect(screen.getByText(/No recent activity/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Create your first case/i) ||
        screen.getByText(/Get started/i) ||
        screen.getByText(/Add a case/i)
      ).toBeInTheDocument();
      expect(screen.queryByText("View all")).not.toBeInTheDocument();
    });
  });

  it("handles null data as loading state", () => {
    mockUseQuery.mockReturnValue(null);
    const { container } = renderWithProviders(<RecentActivityWidget />);
    expect(container.querySelector('[class*="skeleton"]')).toBeInTheDocument();
  });
});
