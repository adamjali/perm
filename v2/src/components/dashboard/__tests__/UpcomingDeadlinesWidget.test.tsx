// @vitest-environment jsdom
/**
 * UpcomingDeadlinesWidget Component Tests (TDD)
 * Tests for upcoming deadlines in next 30 days.
 *
 * Component Requirements:
 * - Renders skeleton when data is loading
 * - Renders "Next 30 Days" heading with deadline count badge
 * - Renders deadline items (employer name, deadline label, days until)
 * - Renders "Calendar" link to /calendar
 * - Shows empty state when no deadlines
 * - Scrollable list (max-h-80 overflow-y-auto)
 *
 * Design: Neobrutalist with hard shadows, Forest Green accent
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import {
  createMockUpcomingDeadlines,
  createEmptyUpcomingDeadlines,
} from "../../../../test-utils/activity-fixtures";
import type { Id } from "../../../../convex/_generated/dataModel";

// Mock convex/react
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));

import { useQuery } from "convex/react";
import UpcomingDeadlinesWidget from "../UpcomingDeadlinesWidget";

describe("UpcomingDeadlinesWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // LOADING STATE TESTS
  // ============================================================================

  describe("loading state", () => {
    it("renders skeleton when data is loading", () => {
      vi.mocked(useQuery).mockReturnValue(undefined);
      const { container } = renderWithProviders(<UpcomingDeadlinesWidget />);

      // Should show skeleton elements
      const skeletons = container.querySelectorAll('[class*="skeleton"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it("renders header skeleton", () => {
      vi.mocked(useQuery).mockReturnValue(undefined);
      const { container } = renderWithProviders(<UpcomingDeadlinesWidget />);

      // Header skeleton for title
      const headerSkeleton = container.querySelector(".h-8");
      expect(headerSkeleton).toBeInTheDocument();
    });

    it("renders item skeletons", () => {
      vi.mocked(useQuery).mockReturnValue(undefined);
      const { container } = renderWithProviders(<UpcomingDeadlinesWidget />);

      // Multiple skeleton items for deadline list
      const itemSkeletons = container.querySelectorAll('[class*="h-"]');
      expect(itemSkeletons.length).toBeGreaterThan(2);
    });
  });

  // ============================================================================
  // WITH DATA TESTS
  // ============================================================================

  describe("with data", () => {
    const mockDeadlines = createMockUpcomingDeadlines(5);

    beforeEach(() => {
      vi.mocked(useQuery).mockReturnValue(mockDeadlines);
    });

    it("renders Next 30 Days heading", () => {
      renderWithProviders(<UpcomingDeadlinesWidget />);

      expect(
        screen.getByRole("heading", { name: /next 30 days/i })
      ).toBeInTheDocument();
    });

    it("renders deadline count badge", () => {
      renderWithProviders(<UpcomingDeadlinesWidget />);

      // Badge should show count of deadlines
      expect(screen.getByText("5")).toBeInTheDocument();
    });

    it("renders deadline items", () => {
      renderWithProviders(<UpcomingDeadlinesWidget />);

      // Check that deadline items are rendered (employer names from fixtures)
      const deadlineItems = screen.getAllByText(/Deadline Co/i);
      expect(deadlineItems.length).toBeGreaterThan(0);
    });

    it("renders deadline labels", () => {
      renderWithProviders(<UpcomingDeadlinesWidget />);

      // Should show deadline types (from fixtures)
      expect(screen.getByText(/PWD Expires/i)).toBeInTheDocument();
    });

    it("renders days until deadline", () => {
      const { container } = renderWithProviders(<UpcomingDeadlinesWidget />);

      // Should show days countdown (not the "Next 30 Days" heading)
      const countdownElements = container.querySelectorAll('[class*="font-bold"][class*="mono"]');
      expect(countdownElements.length).toBeGreaterThan(0);
      // At least one should contain "day" or "days"
      const hasCountdown = Array.from(countdownElements).some((el) =>
        el.textContent?.match(/\d+\s*day/i)
      );
      expect(hasCountdown).toBe(true);
    });

    it("renders Calendar button", () => {
      renderWithProviders(<UpcomingDeadlinesWidget />);

      const calendarButton = screen.getByRole("button", { name: /calendar/i });
      expect(calendarButton).toBeInTheDocument();
    });
  });

  // ============================================================================
  // EMPTY STATE TESTS
  // ============================================================================

  describe("empty state", () => {
    beforeEach(() => {
      vi.mocked(useQuery).mockReturnValue(createEmptyUpcomingDeadlines());
    });

    it("shows empty state message when no deadlines", () => {
      renderWithProviders(<UpcomingDeadlinesWidget />);

      expect(
        screen.getByText(/no deadlines in next 30 days/i)
      ).toBeInTheDocument();
    });

    it("shows encouraging message for empty state", () => {
      renderWithProviders(<UpcomingDeadlinesWidget />);

      expect(screen.getByText(/you're all caught up!/i)).toBeInTheDocument();
    });

    it("still renders heading when empty", () => {
      renderWithProviders(<UpcomingDeadlinesWidget />);

      expect(
        screen.getByRole("heading", { name: /next 30 days/i })
      ).toBeInTheDocument();
    });

    it("still renders Calendar button when empty", () => {
      renderWithProviders(<UpcomingDeadlinesWidget />);

      const calendarButton = screen.getByRole("button", { name: /calendar/i });
      expect(calendarButton).toBeInTheDocument();
    });
  });

  // ============================================================================
  // SCROLLABLE LIST TESTS
  // ============================================================================

  describe("scrollable list", () => {
    beforeEach(() => {
      // Create many deadlines to test scrolling
      const manyDeadlines = createMockUpcomingDeadlines(15);
      vi.mocked(useQuery).mockReturnValue(manyDeadlines);
    });

    it("has max height constraint for scrolling", () => {
      const { container } = renderWithProviders(<UpcomingDeadlinesWidget />);

      // Should have max-h-* class for scrollable container (max-h-80 or max-h-96)
      const scrollContainer = container.querySelector('[class*="max-h-"]');
      expect(scrollContainer).toBeInTheDocument();
    });

    it("has overflow-y-auto for vertical scrolling", () => {
      const { container } = renderWithProviders(<UpcomingDeadlinesWidget />);

      // Should have overflow-y-auto class
      const scrollContainer = container.querySelector(".overflow-y-auto");
      expect(scrollContainer).toBeInTheDocument();
    });

    it("displays all items in scrollable container (no artificial limit)", () => {
      renderWithProviders(<UpcomingDeadlinesWidget />);

      // All 15 items should be displayed (scrollable container handles overflow)
      const deadlineItems = screen.getAllByText(/Deadline Co/i);
      expect(deadlineItems.length).toBe(15);
    });
  });

  // ============================================================================
  // NEOBRUTALIST STYLING TESTS
  // ============================================================================

  describe("neobrutalist styling", () => {
    beforeEach(() => {
      vi.mocked(useQuery).mockReturnValue(createMockUpcomingDeadlines(3));
    });

    it("has hard shadow on container", () => {
      const { container } = renderWithProviders(<UpcomingDeadlinesWidget />);

      // Neobrutalist hard shadow
      const widget = container.querySelector(".shadow-hard");
      expect(widget).toBeInTheDocument();
    });

    it("has black border on container", () => {
      const { container } = renderWithProviders(<UpcomingDeadlinesWidget />);

      // Border should be 4px solid black (neobrutalist)
      const widget = container.querySelector('[class*="border-4"]');
      expect(widget).toBeInTheDocument();
    });

    it("has Forest Green accent on count badge", () => {
      const { container } = renderWithProviders(<UpcomingDeadlinesWidget />);

      // Badge should use primary color (Forest Green)
      const badge = container.querySelector(".bg-primary");
      expect(badge).toBeInTheDocument();
    });
  });

  // ============================================================================
  // URGENCY INDICATOR TESTS
  // ============================================================================

  describe("urgency indicators", () => {
    beforeEach(() => {
      // Mix of urgent/soon/normal deadlines
      // Note: createMockUpcomingDeadlines(1) returns daysUntil=30, so we override it
      const baseDeadline = createMockUpcomingDeadlines(1)[0];
      const urgentDeadline = {
        ...baseDeadline,
        caseId: "case_urgent" as Id<"cases">,
        daysUntil: 3, // ≤7 days = urgent
      };
      const soonDeadline = {
        ...baseDeadline,
        caseId: "case_soon" as Id<"cases">,
        daysUntil: 15,
      };
      const normalDeadline = {
        ...baseDeadline,
        caseId: "case_normal" as Id<"cases">,
        daysUntil: 28,
      };

      vi.mocked(useQuery).mockReturnValue([
        urgentDeadline,
        soonDeadline,
        normalDeadline,
      ]);
    });

    it("shows days until for each deadline", () => {
      renderWithProviders(<UpcomingDeadlinesWidget />);

      // Should show "X days" or "X day" for deadlines
      const daysText = screen.getAllByText(/day/i);
      expect(daysText.length).toBeGreaterThan(0);
    });

    it("displays urgent styling for imminent deadlines (≤7 days)", () => {
      const { container } = renderWithProviders(<UpcomingDeadlinesWidget />);

      // Urgent deadlines (≤7 days) should have red styling
      const urgentIndicator = container.querySelector('[class*="text-red"]');
      expect(urgentIndicator).toBeInTheDocument();
    });

    it("displays warning styling for 8-14 day deadlines", () => {
      // Create deadline with 10 days (warning range)
      const baseDeadline = createMockUpcomingDeadlines(1)[0];
      const warningDeadline = {
        ...baseDeadline,
        caseId: "case_warning" as Id<"cases">,
        daysUntil: 10, // 8-14 days = warning (orange)
      };

      vi.mocked(useQuery).mockReturnValue([warningDeadline]);
      const { container } = renderWithProviders(<UpcomingDeadlinesWidget />);

      // Warning deadlines should have orange styling
      const warningIndicator = container.querySelector('[class*="text-orange"]');
      expect(warningIndicator).toBeInTheDocument();
    });
  });

  // ============================================================================
  // ACCESSIBILITY TESTS
  // ============================================================================

  describe("accessibility", () => {
    beforeEach(() => {
      vi.mocked(useQuery).mockReturnValue(createMockUpcomingDeadlines(3));
    });

    it("has proper heading hierarchy", () => {
      renderWithProviders(<UpcomingDeadlinesWidget />);

      // Main heading should be h3 (dashboard context)
      const heading = screen.getByRole("heading", { name: /next 30 days/i });
      expect(heading.tagName).toBe("H3");
    });

    it("Calendar button is keyboard accessible", () => {
      renderWithProviders(<UpcomingDeadlinesWidget />);

      const button = screen.getByRole("button", { name: /calendar/i });
      expect(button).not.toBeDisabled();
    });

    it("has semantic list structure", () => {
      const { container } = renderWithProviders(<UpcomingDeadlinesWidget />);

      // Deadline items should be in a list
      const list = container.querySelector("ul");
      expect(list).toBeInTheDocument();
    });
  });
});
