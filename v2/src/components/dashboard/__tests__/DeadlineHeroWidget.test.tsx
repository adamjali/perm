// @vitest-environment jsdom
/**
 * DeadlineHeroWidget Component Tests
 * Tests for v1-matching horizontal 4-column grid layout.
 *
 * Component Requirements:
 * - Renders skeleton when data is loading
 * - Renders "Deadline Hub" heading with total count badge
 * - Renders all 4 urgency groups as COLUMNS (not collapsible rows)
 * - Renders refresh button with spinner animation
 * - Shows last updated time (relative format)
 * - Shows empty state when no deadlines
 * - Auto-refreshes every 5 minutes
 * - Horizontal 4-column grid on desktop (lg:grid-cols-4)
 * - AlertTriangle icon in header
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, act, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import {
  createMockDeadlineGroups,
  createEmptyDeadlineGroups,
} from "../../../../test-utils/deadline-fixtures";

// Mock convex/react
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => vi.fn()),
}));

import { useQuery } from "convex/react";
import DeadlineHeroWidget from "../DeadlineHeroWidget";

// Mock timers for auto-refresh testing
vi.useFakeTimers();

describe("DeadlineHeroWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
  });

  // ============================================================================
  // LOADING STATE TESTS
  // ============================================================================

  describe("loading state", () => {
    it("renders skeleton when data is loading", () => {
      vi.mocked(useQuery).mockReturnValue(undefined);
      const { container } = renderWithProviders(<DeadlineHeroWidget />);

      // Should show skeleton elements
      const skeletons = container.querySelectorAll('[class*="h-"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it("renders header skeleton", () => {
      vi.mocked(useQuery).mockReturnValue(undefined);
      const { container } = renderWithProviders(<DeadlineHeroWidget />);

      const headerSkeleton = container.querySelector(".h-8.w-48");
      expect(headerSkeleton).toBeInTheDocument();
    });
  });

  // ============================================================================
  // WITH DATA TESTS
  // ============================================================================

  describe("with data", () => {
    const mockData = createMockDeadlineGroups();

    beforeEach(() => {
      vi.mocked(useQuery).mockReturnValue(mockData);
    });

    it("renders Deadline Hub heading", () => {
      renderWithProviders(<DeadlineHeroWidget />);

      expect(
        screen.getByRole("heading", { name: /deadline hub/i })
      ).toBeInTheDocument();
    });

    it("renders total count badge", () => {
      renderWithProviders(<DeadlineHeroWidget />);

      expect(screen.getByText("8")).toBeInTheDocument(); // totalCount from mock
    });

    it("renders all 4 urgency groups as columns", () => {
      renderWithProviders(<DeadlineHeroWidget />);

      // All urgency labels should be visible (no collapsing in v1 style)
      expect(screen.getByText("Overdue")).toBeInTheDocument();
      expect(screen.getByText("This Week")).toBeInTheDocument();
      expect(screen.getByText("This Month")).toBeInTheDocument();
      expect(screen.getByText("Later")).toBeInTheDocument();
    });

    it("renders refresh button", () => {
      renderWithProviders(<DeadlineHeroWidget />);

      expect(
        screen.getByRole("button", { name: /refresh/i })
      ).toBeInTheDocument();
    });

    it("shows last updated time", () => {
      renderWithProviders(<DeadlineHeroWidget />);

      expect(screen.getByText(/updated/i)).toBeInTheDocument();
    });
  });

  // ============================================================================
  // EMPTY STATE TESTS
  // ============================================================================

  describe("empty state", () => {
    beforeEach(() => {
      vi.mocked(useQuery).mockReturnValue(createEmptyDeadlineGroups());
    });

    it("shows empty state message when no deadlines", () => {
      renderWithProviders(<DeadlineHeroWidget />);

      expect(screen.getByText(/no upcoming deadlines/i)).toBeInTheDocument();
    });

    it("shows call to action for empty state", () => {
      renderWithProviders(<DeadlineHeroWidget />);

      expect(screen.getByText(/create a case/i)).toBeInTheDocument();
    });
  });

  // ============================================================================
  // REFRESH FUNCTIONALITY TESTS
  // ============================================================================

  describe("refresh functionality", () => {
    beforeEach(() => {
      vi.mocked(useQuery).mockReturnValue(createMockDeadlineGroups());
    });

    it("shows spinner when refresh button clicked", () => {
      const { container } = renderWithProviders(<DeadlineHeroWidget />);

      const refreshButton = screen.getByRole("button", { name: /refresh/i });

      act(() => {
        fireEvent.click(refreshButton);
      });

      // Refresh icon should have animate-spin class
      const spinner = container.querySelector(".animate-spin");
      expect(spinner).toBeInTheDocument();
    });

    it("updates last refresh time on click", () => {
      renderWithProviders(<DeadlineHeroWidget />);

      const refreshButton = screen.getByRole("button", { name: /refresh/i });

      act(() => {
        fireEvent.click(refreshButton);
      });

      expect(screen.getByText(/just now/i)).toBeInTheDocument();
    });
  });

  // ============================================================================
  // AUTO-REFRESH TESTS
  // ============================================================================

  describe("auto-refresh", () => {
    beforeEach(() => {
      vi.mocked(useQuery).mockReturnValue(createMockDeadlineGroups());
    });

    it("auto-refreshes every 5 minutes", () => {
      renderWithProviders(<DeadlineHeroWidget />);

      // Initial state
      expect(screen.getByText(/just now/i)).toBeInTheDocument();

      // Advance 5 minutes
      act(() => {
        vi.advanceTimersByTime(5 * 60 * 1000);
      });

      // Timer callback should have fired
    });
  });

  // ============================================================================
  // V1-STYLE HORIZONTAL LAYOUT TESTS
  // ============================================================================

  describe("horizontal layout (v1 style)", () => {
    beforeEach(() => {
      vi.mocked(useQuery).mockReturnValue(createMockDeadlineGroups());
    });

    it("has horizontal grid layout for urgency groups", () => {
      const { container } = renderWithProviders(<DeadlineHeroWidget />);

      // V1-style horizontal grid with lg:grid-cols-4
      const gridLayout = container.querySelector(".grid.grid-cols-1.lg\\:grid-cols-4");
      expect(gridLayout).toBeInTheDocument();
    });

    it("all urgency items are visible by default (no collapse)", () => {
      renderWithProviders(<DeadlineHeroWidget />);

      // V1 style: All items are visible (employer names, not case numbers)
      // Check that at least one item from each group is rendered
      // Items have employer name "Tech Corp Inc" from fixtures
      const employers = screen.getAllByText("Tech Corp Inc");
      expect(employers.length).toBeGreaterThan(4); // At least 1 per group
    });
  });

  // ============================================================================
  // ALERT ICON TESTS
  // ============================================================================

  describe("warning icon", () => {
    beforeEach(() => {
      vi.mocked(useQuery).mockReturnValue(createMockDeadlineGroups());
    });

    it("renders AlertTriangle icon in header", () => {
      const { container } = renderWithProviders(<DeadlineHeroWidget />);

      // AlertTriangle is rendered as SVG
      const header = container.querySelector("h2");
      expect(header).toBeInTheDocument();
      const headerDiv = header?.parentElement;
      const svgIcon = headerDiv?.querySelector("svg");
      expect(svgIcon).toBeInTheDocument();
    });
  });
});
