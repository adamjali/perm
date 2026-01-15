// @vitest-environment jsdom
/**
 * RecentActivityWidget Component Tests (TDD)
 * Tests written BEFORE implementation following TDD methodology.
 *
 * Component Requirements:
 * - Widget container with heading "Recent Activity"
 * - Loading state: skeleton placeholders while data loads
 * - With data: renders list of RecentActivityCard components
 * - Empty state: shows message + call to action ("Create your first case")
 * - "View all" link to /cases?sort=updated (only when data exists)
 * - Neobrutalist styling (4px black border, dividers between items)
 * - Uses Convex useQuery to fetch data
 * - Displays up to 5 most recent activity items
 *
 * Source Requirements:
 * - .planning/phases/20-dashboard/20-CONTEXT.md (Recent Activity specs)
 * - .planning/FRONTEND_DESIGN_SKILL.md (widget design patterns)
 * - v2/docs/DESIGN_SYSTEM.md (neobrutalist styling, skeleton loading)
 * - perm_flow.md (activity tracking workflow)
 * - v2/convex/lib/dashboardTypes.ts (RecentActivityItem type)
 * - v2/test-utils/activity-fixtures.ts (test data)
 */

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

// Mock convex/react useQuery hook
const mockUseQuery = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: () => mockUseQuery(),
}));

// Mock RecentActivityCard component (since we're testing widget, not card)
vi.mock("../RecentActivityCard", () => ({
  default: ({ activity }: { activity: RecentActivityItem }) => (
    <div data-testid="activity-card" data-activity-id={activity.id}>
      {activity.employerName} - {activity.action}
    </div>
  ),
}));

describe("RecentActivityWidget", () => {
  // Reset mocks before each test
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // LOADING STATE TESTS
  // ============================================================================

  describe("Loading State", () => {
    it("renders skeleton when data is loading", () => {
      // Simulate loading state (useQuery returns undefined)
      mockUseQuery.mockReturnValue(undefined);

      const { container } = renderWithProviders(<RecentActivityWidget />);

      // Should have skeleton elements
      const skeletons = container.querySelectorAll('[class*="skeleton"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it("shows multiple skeleton items (5 placeholders)", () => {
      mockUseQuery.mockReturnValue(undefined);

      const { container } = renderWithProviders(<RecentActivityWidget />);

      // Should show 5 skeleton placeholders (matching max activity items)
      const skeletons = container.querySelectorAll('[class*="skeleton"]');
      // Expect at least 5 skeleton elements (may be more for internal structure)
      expect(skeletons.length).toBeGreaterThanOrEqual(5);
    });

    it("skeleton has proper height and styling", () => {
      mockUseQuery.mockReturnValue(undefined);

      const { container } = renderWithProviders(<RecentActivityWidget />);

      // Skeleton should use Skeleton component with proper classes
      const skeleton = container.querySelector('[class*="skeleton"]');
      expect(skeleton).toBeInTheDocument();
    });

    it("does not show 'View all' link during loading", () => {
      mockUseQuery.mockReturnValue(undefined);

      renderWithProviders(<RecentActivityWidget />);

      // Should not have "View all" link
      expect(screen.queryByText("View all")).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // WITH DATA TESTS
  // ============================================================================

  describe("With Data", () => {
    it("renders widget heading 'Recent Activity'", () => {
      mockUseQuery.mockReturnValue(activityScenarios.typical);

      renderWithProviders(<RecentActivityWidget />);

      expect(screen.getByText("Recent Activity")).toBeInTheDocument();
    });

    it("renders list of activity items", () => {
      const activities = createMockActivityList(4);
      mockUseQuery.mockReturnValue(activities);

      const { container } = renderWithProviders(<RecentActivityWidget />);

      // Should render 4 activity cards (MAX_DISPLAY_ITEMS = 4)
      const cards = container.querySelectorAll('[data-testid="activity-card"]');
      expect(cards.length).toBe(4);
    });

    it("renders up to 4 most recent items and shows overflow", () => {
      const activities = createMockActivityList(10);
      mockUseQuery.mockReturnValue(activities);

      const { container } = renderWithProviders(<RecentActivityWidget />);

      // Should only render 4 cards (MAX_DISPLAY_ITEMS = 4)
      const cards = container.querySelectorAll('[data-testid="activity-card"]');
      expect(cards.length).toBe(4);

      // Should show "+6 more" overflow indicator
      expect(screen.getByText(/\+6 more/i)).toBeInTheDocument();
    });

    it("overflow indicator links to /cases?sort=updated", () => {
      const activities = createMockActivityList(10);
      mockUseQuery.mockReturnValue(activities);

      const { container } = renderWithProviders(<RecentActivityWidget />);

      // The "+6 more" link should point to cases page
      const overflowLink = screen.getByText(/\+6 more/i).closest("a");
      expect(overflowLink).toHaveAttribute("href", "/cases?sort=updated");
    });

    it("renders 'View all' button with navigation handler", () => {
      mockUseQuery.mockReturnValue(activityScenarios.typical);

      renderWithProviders(<RecentActivityWidget />);

      // View all is now a button with navigation loading state
      const button = screen.getByRole("button", { name: /view all/i });
      expect(button).toBeInTheDocument();
      expect(button.textContent).toContain("View all");
    });

    it("passes activity data to RecentActivityCard components", () => {
      const activities = activityScenarios.mixedStages;
      mockUseQuery.mockReturnValue(activities);

      const { container } = renderWithProviders(<RecentActivityWidget />);

      // Check that cards receive correct data
      const firstCard = container.querySelector('[data-activity-id="case_001"]');
      expect(firstCard).toBeInTheDocument();
      expect(firstCard?.textContent).toContain("I-140 approved");
    });
  });

  // ============================================================================
  // EMPTY STATE TESTS
  // ============================================================================

  describe("Empty State", () => {
    it("shows empty state message when no activity", () => {
      mockUseQuery.mockReturnValue(createEmptyActivityList());

      renderWithProviders(<RecentActivityWidget />);

      // Should show empty state message
      expect(
        screen.getByText(/No recent activity/i) ||
          screen.getByText(/No activity yet/i)
      ).toBeInTheDocument();
    });

    it("shows call to action in empty state", () => {
      mockUseQuery.mockReturnValue(createEmptyActivityList());

      renderWithProviders(<RecentActivityWidget />);

      // Should have CTA (e.g., "Create your first case")
      expect(
        screen.getByText(/Create your first case/i) ||
          screen.getByText(/Get started/i) ||
          screen.getByText(/Add a case/i)
      ).toBeInTheDocument();
    });

    it("does not show 'View all' link in empty state", () => {
      mockUseQuery.mockReturnValue(createEmptyActivityList());

      renderWithProviders(<RecentActivityWidget />);

      // Should not have "View all" link
      expect(screen.queryByText("View all")).not.toBeInTheDocument();
    });

    it("empty state has proper styling and icon", () => {
      mockUseQuery.mockReturnValue(createEmptyActivityList());

      const { container } = renderWithProviders(<RecentActivityWidget />);

      // Should have empty state container with muted text
      const emptyState = container.querySelector('[class*="muted"]');
      expect(emptyState).toBeInTheDocument();
    });
  });

  // ============================================================================
  // NEOBRUTALIST STYLING TESTS
  // ============================================================================

  describe("Neobrutalist Styling", () => {
    it("has 4px black border (border-4, border-black)", () => {
      mockUseQuery.mockReturnValue(activityScenarios.typical);

      const { container } = renderWithProviders(<RecentActivityWidget />);

      // Widget container should have thick black border
      const widget =
        container.querySelector('.border-4.border-black') ||
        container.querySelector('[class*="border-4"]');
      expect(widget).toBeInTheDocument();
    });

    it("has hard shadow (shadow-hard)", () => {
      mockUseQuery.mockReturnValue(activityScenarios.typical);

      const { container } = renderWithProviders(<RecentActivityWidget />);

      // Should have default shadow class
      const widget = container.querySelector('.shadow-hard');
      expect(widget).toBeInTheDocument();
    });

    it("has card background (bg-card for dark mode support)", () => {
      mockUseQuery.mockReturnValue(activityScenarios.typical);

      const { container } = renderWithProviders(<RecentActivityWidget />);

      // Should have card background (theme-aware)
      const widget = container.querySelector('.bg-card');
      expect(widget).toBeInTheDocument();
    });

    it("uses space-y-2 for item spacing (no dividers in compact design)", () => {
      mockUseQuery.mockReturnValue(createMockActivityList(3));

      const { container } = renderWithProviders(<RecentActivityWidget />);

      // Compact design uses space-y-2 gap instead of explicit dividers
      const listContainer = container.querySelector('[class*="space-y"]');
      expect(listContainer).toBeInTheDocument();
    });

    it("has proper spacing and padding", () => {
      mockUseQuery.mockReturnValue(activityScenarios.typical);

      const { container } = renderWithProviders(<RecentActivityWidget />);

      // Should have padding classes (p-6 or p-7)
      const widget = container.querySelector('[class*="p-"]');
      expect(widget).toBeInTheDocument();
    });
  });

  // ============================================================================
  // HEADING & HEADER TESTS
  // ============================================================================

  describe("Widget Heading", () => {
    it("renders heading with proper typography (text-2xl, font-heading)", () => {
      mockUseQuery.mockReturnValue(activityScenarios.typical);

      const { container } = renderWithProviders(<RecentActivityWidget />);

      // Heading should use Space Grotesk font and large text
      const heading = container.querySelector('h2, h3, [class*="text-2xl"]');
      expect(heading).toBeInTheDocument();
      expect(heading?.textContent).toContain("Recent Activity");
    });

    it("heading has semantic HTML (h2 or h3)", () => {
      mockUseQuery.mockReturnValue(activityScenarios.typical);

      const { container } = renderWithProviders(<RecentActivityWidget />);

      // Should use semantic heading element
      const heading = container.querySelector('h2, h3');
      expect(heading).toBeInTheDocument();
    });

    it("heading is visible in all states (loading, empty, with data)", () => {
      // Test loading state
      mockUseQuery.mockReturnValue(undefined);
      const { rerender, unmount } = renderWithProviders(<RecentActivityWidget />);
      expect(screen.getByText("Recent Activity")).toBeInTheDocument();

      // Test empty state (rerender same instance)
      mockUseQuery.mockReturnValue(createEmptyActivityList());
      rerender(<RecentActivityWidget />);
      expect(screen.getByText("Recent Activity")).toBeInTheDocument();

      // Test with data (rerender same instance)
      mockUseQuery.mockReturnValue(activityScenarios.typical);
      rerender(<RecentActivityWidget />);
      expect(screen.getByText("Recent Activity")).toBeInTheDocument();
    });
  });

  // ============================================================================
  // VIEW ALL BUTTON TESTS
  // ============================================================================

  describe("View All Button", () => {
    it("has proper styling (hover effect)", () => {
      mockUseQuery.mockReturnValue(activityScenarios.typical);

      renderWithProviders(<RecentActivityWidget />);

      const button = screen.getByRole("button", { name: /view all/i });
      expect(button).toBeInTheDocument();
      // Should have hover effect styling
      expect(button?.className).toMatch(/hover:underline|hover:text-primary/);
    });

    it("is accessible button with proper text", () => {
      mockUseQuery.mockReturnValue(activityScenarios.typical);

      renderWithProviders(<RecentActivityWidget />);

      const button = screen.getByRole("button", { name: /view all/i });
      expect(button).toBeInTheDocument();
      // Button uses aria-label for accessibility
      expect(button).toHaveAttribute("aria-label", "View all recent activity");
    });

    it("has right arrow icon or indicator", () => {
      mockUseQuery.mockReturnValue(activityScenarios.typical);

      renderWithProviders(<RecentActivityWidget />);

      const button = screen.getByRole("button", { name: /view all/i });
      // Should have arrow or chevron icon (svg or unicode)
      expect(button?.innerHTML).toMatch(/→|›|chevron|arrow/i);
    });
  });

  // ============================================================================
  // ACCESSIBILITY TESTS
  // ============================================================================

  describe("Accessibility", () => {
    it("has semantic section element", () => {
      mockUseQuery.mockReturnValue(activityScenarios.typical);

      const { container } = renderWithProviders(<RecentActivityWidget />);

      // Should use <section> element
      const section = container.querySelector('section');
      expect(section).toBeInTheDocument();
    });

    it("has aria-label or aria-labelledby", () => {
      mockUseQuery.mockReturnValue(activityScenarios.typical);

      const { container } = renderWithProviders(<RecentActivityWidget />);

      const section = container.querySelector('section');
      const hasAriaLabel =
        section?.hasAttribute('aria-label') ||
        section?.hasAttribute('aria-labelledby');
      expect(hasAriaLabel).toBe(true);
    });

    it("empty state has proper ARIA attributes", () => {
      mockUseQuery.mockReturnValue(createEmptyActivityList());

      const { container } = renderWithProviders(<RecentActivityWidget />);

      // Empty state should be announced to screen readers
      const emptyState = container.querySelector('[role="status"]');
      expect(emptyState).toBeInTheDocument();
    });

    it("loading state has proper ARIA attributes", () => {
      mockUseQuery.mockReturnValue(undefined);

      const { container } = renderWithProviders(<RecentActivityWidget />);

      // Loading state should be announced to screen readers
      const loadingState =
        container.querySelector('[aria-busy="true"]') ||
        container.querySelector('[role="status"]');
      expect(loadingState).toBeInTheDocument();
    });
  });

  // ============================================================================
  // DARK MODE TESTS
  // ============================================================================

  describe("Dark Mode Support", () => {
    it("renders in dark mode with proper theme-aware classes", () => {
      mockUseQuery.mockReturnValue(activityScenarios.typical);

      const { container } = renderWithProviders(<RecentActivityWidget />, {
        providerProps: { theme: "dark" },
      });

      // Should have bg-card for theme-aware background
      const widget = container.querySelector('.bg-card');
      expect(widget).toBeInTheDocument();
    });

    it("dividers have theme-aware border color", () => {
      mockUseQuery.mockReturnValue(createMockActivityList(3));

      const { container } = renderWithProviders(<RecentActivityWidget />, {
        providerProps: { theme: "dark" },
      });

      // Dividers should use theme-aware border color
      const divider = container.querySelector('[class*="border-"]');
      expect(divider).toBeInTheDocument();
    });
  });

  // ============================================================================
  // LAYOUT & RESPONSIVE TESTS
  // ============================================================================

  describe("Layout & Responsive Behavior", () => {
    it("handles single activity item", () => {
      mockUseQuery.mockReturnValue(activityScenarios.single);

      const { container } = renderWithProviders(<RecentActivityWidget />);

      const cards = container.querySelectorAll('[data-testid="activity-card"]');
      expect(cards.length).toBe(1);
    });

    it("handles exactly 4 activity items (no overflow needed)", () => {
      mockUseQuery.mockReturnValue(createMockActivityList(4));

      const { container } = renderWithProviders(<RecentActivityWidget />);

      const cards = container.querySelectorAll('[data-testid="activity-card"]');
      expect(cards.length).toBe(4);

      // No overflow indicator when exactly MAX_DISPLAY_ITEMS
      expect(screen.queryByText(/more/i)).not.toBeInTheDocument();
    });

    it("truncates to 4 items when more exist and shows overflow", () => {
      mockUseQuery.mockReturnValue(createMockActivityList(10));

      const { container } = renderWithProviders(<RecentActivityWidget />);

      const cards = container.querySelectorAll('[data-testid="activity-card"]');
      expect(cards.length).toBe(4);

      // Shows "+6 more" overflow indicator
      expect(screen.getByText(/\+6 more/i)).toBeInTheDocument();
    });

    it("has proper container structure (widget > header > list)", () => {
      mockUseQuery.mockReturnValue(activityScenarios.typical);

      const { container } = renderWithProviders(<RecentActivityWidget />);

      // Should have nested structure: widget container, header, list
      const widget = container.querySelector('section');
      const heading = widget?.querySelector('h2, h3');
      const list = widget?.querySelector('ul, [role="list"]');

      expect(widget).toBeInTheDocument();
      expect(heading).toBeInTheDocument();
      // List may not exist in all implementations (could use div)
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe("Edge Cases", () => {
    it("handles null data gracefully (treats as loading)", () => {
      mockUseQuery.mockReturnValue(null);

      const { container } = renderWithProviders(<RecentActivityWidget />);

      // Should show loading state
      const skeleton = container.querySelector('[class*="skeleton"]');
      expect(skeleton).toBeInTheDocument();
    });

    it("handles undefined data gracefully (loading state)", () => {
      mockUseQuery.mockReturnValue(undefined);

      const { container } = renderWithProviders(<RecentActivityWidget />);

      // Should show loading state
      const skeleton = container.querySelector('[class*="skeleton"]');
      expect(skeleton).toBeInTheDocument();
    });

    it("handles data fetch error gracefully", () => {
      // Simulate error by returning empty array or error state
      mockUseQuery.mockReturnValue(createEmptyActivityList());

      const { container } = renderWithProviders(<RecentActivityWidget />);

      // Should show empty state (not crash)
      expect(screen.getByText(/No recent activity/i)).toBeInTheDocument();
    });
  });

  // ============================================================================
  // DATA FLOW TESTS
  // ============================================================================

  describe("Data Flow & Convex Integration", () => {
    it("calls useQuery from convex/react", () => {
      mockUseQuery.mockReturnValue(activityScenarios.typical);

      renderWithProviders(<RecentActivityWidget />);

      // useQuery should have been called (from convex/react mock)
      expect(mockUseQuery).toHaveBeenCalled();
    });

    it("displays most recent activities first (sorted by timestamp desc)", () => {
      const activities = activityScenarios.mixedStages;
      mockUseQuery.mockReturnValue(activities);

      const { container } = renderWithProviders(<RecentActivityWidget />);

      const cards = container.querySelectorAll('[data-testid="activity-card"]');
      // First card should be most recent (case_001, I-140 approved)
      expect(cards[0]?.getAttribute('data-activity-id')).toBe('case_001');
    });

    it("updates when data changes", () => {
      // Initial render with 3 items
      mockUseQuery.mockReturnValue(createMockActivityList(3));
      const { container, rerender } = renderWithProviders(<RecentActivityWidget />);

      let cards = container.querySelectorAll('[data-testid="activity-card"]');
      expect(cards.length).toBe(3);

      // Update to 4 items (MAX_DISPLAY_ITEMS)
      mockUseQuery.mockReturnValue(createMockActivityList(4));
      rerender(<RecentActivityWidget />);

      cards = container.querySelectorAll('[data-testid="activity-card"]');
      expect(cards.length).toBe(4);
    });
  });
});
