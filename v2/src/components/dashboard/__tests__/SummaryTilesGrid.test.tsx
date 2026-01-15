// @vitest-environment jsdom
/**
 * SummaryTilesGrid Component Tests (TDD)
 * Tests written BEFORE implementation following TDD methodology.
 *
 * Component Requirements:
 * - Renders "Case Summary" heading
 * - Shows skeleton loading state with 6 skeleton tiles (h-36)
 * - Renders tiles for each status (PWD, Recruitment, ETA 9089, I-140)
 * - Renders Complete tile separately
 * - Renders Closed tile
 * - Passes correct href to each tile (/cases?status=pwd, etc.)
 * - Responsive grid (grid-cols-2, md:grid-cols-3)
 *
 * Source Requirements:
 * - .planning/phases/20-dashboard/20-CONTEXT.md (Summary Tiles specs)
 * - perm_flow.md (case statuses, subtext requirements)
 * - v2/test-utils/ui-fixtures.ts (createMockDashboardSummary)
 * - v2/docs/DESIGN_SYSTEM.md (skeleton component)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import {
  createMockDashboardSummary,
  dashboardScenarios,
} from "../../../../test-utils/ui-fixtures";
import SummaryTilesGrid from "../SummaryTilesGrid";

// Mock Convex useQuery hook
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));

import { useQuery } from "convex/react";

describe("SummaryTilesGrid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // LOADING STATE TESTS
  // ============================================================================

  describe("Loading State", () => {
    it("renders skeleton when data is loading", () => {
      // Mock useQuery to return undefined (loading state)
      vi.mocked(useQuery).mockReturnValue(undefined);

      const { container } = renderWithProviders(<SummaryTilesGrid />);

      // Should render skeleton tiles with h-36 class
      const skeletonTiles = container.querySelectorAll(".h-36");
      expect(skeletonTiles.length).toBeGreaterThanOrEqual(6);
    });

    it("renders 6 skeleton tiles with h-36 class", () => {
      vi.mocked(useQuery).mockReturnValue(undefined);

      const { container } = renderWithProviders(<SummaryTilesGrid />);

      // Should have 6 skeleton tiles with h-36 height
      const skeletonTiles = container.querySelectorAll(".h-36");
      expect(skeletonTiles.length).toBeGreaterThanOrEqual(6);
    });

    it("renders section title skeleton (h-8 w-40)", () => {
      vi.mocked(useQuery).mockReturnValue(undefined);

      const { container } = renderWithProviders(<SummaryTilesGrid />);

      // Should have title skeleton with h-8 and w-40
      const titleSkeleton = container.querySelector(".h-8.w-40");
      expect(titleSkeleton).toBeInTheDocument();
    });

    it("does not render Case Summary heading when loading", () => {
      vi.mocked(useQuery).mockReturnValue(undefined);

      renderWithProviders(<SummaryTilesGrid />);

      // Heading should not appear during loading
      expect(screen.queryByText("Case Summary")).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // WITH DATA TESTS
  // ============================================================================

  describe("With Data", () => {
    const mockData = createMockDashboardSummary();

    beforeEach(() => {
      vi.mocked(useQuery).mockReturnValue(mockData);
    });

    it('renders "Case Summary" heading', () => {
      renderWithProviders(<SummaryTilesGrid />);

      expect(screen.getByText("Case Summary")).toBeInTheDocument();
    });

    it("renders PWD tile with correct data", () => {
      renderWithProviders(<SummaryTilesGrid />);

      expect(screen.getByText("PWD")).toBeInTheDocument();
      // Count may appear in multiple places (corner label and main display)
      expect(screen.getAllByText(mockData.pwd.count.toString()).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(mockData.pwd.subtext)).toBeInTheDocument();
    });

    it("renders Recruitment tile with correct data", () => {
      renderWithProviders(<SummaryTilesGrid />);

      expect(screen.getByText("Recruitment")).toBeInTheDocument();
      // Count may appear in multiple places (corner label and main display)
      expect(screen.getAllByText(mockData.recruitment.count.toString()).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(mockData.recruitment.subtext)).toBeInTheDocument();
    });

    it("renders ETA 9089 tile with correct data", () => {
      renderWithProviders(<SummaryTilesGrid />);

      expect(screen.getByText("ETA 9089")).toBeInTheDocument();
      // Count may appear in multiple places (corner label and main display)
      expect(screen.getAllByText(mockData.eta9089.count.toString()).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(mockData.eta9089.subtext)).toBeInTheDocument();
    });

    it("renders I-140 tile with correct data", () => {
      renderWithProviders(<SummaryTilesGrid />);

      expect(screen.getByText("I-140")).toBeInTheDocument();
      // Count may appear in multiple places (corner label and main display)
      expect(screen.getAllByText(mockData.i140.count.toString()).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(mockData.i140.subtext)).toBeInTheDocument();
    });

    it("renders Complete tile separately", () => {
      renderWithProviders(<SummaryTilesGrid />);

      expect(screen.getByText("Complete")).toBeInTheDocument();
      // Count may appear in multiple places (corner label and main display)
      expect(screen.getAllByText(mockData.complete.count.toString()).length).toBeGreaterThanOrEqual(1);
    });

    it("renders Closed tile", () => {
      renderWithProviders(<SummaryTilesGrid />);

      expect(screen.getByText("Closed")).toBeInTheDocument();
      // Count may appear in multiple places (corner label and main display)
      expect(screen.getAllByText(mockData.closed.count.toString()).length).toBeGreaterThanOrEqual(1);
    });

    it("does not render skeleton when data is loaded", () => {
      const { container } = renderWithProviders(<SummaryTilesGrid />);

      // Should not have skeleton elements
      const skeletons = container.querySelectorAll(".skeleton");
      expect(skeletons.length).toBe(0);
    });
  });

  // ============================================================================
  // HREF TESTS
  // ============================================================================

  describe("Tile Links", () => {
    beforeEach(() => {
      vi.mocked(useQuery).mockReturnValue(createMockDashboardSummary());
    });

    it("passes /cases?status=pwd href to PWD tile", () => {
      const { container } = renderWithProviders(<SummaryTilesGrid />);

      const link = container.querySelector('a[href="/cases?status=pwd"]');
      expect(link).toBeInTheDocument();
    });

    it("passes /cases?status=recruitment href to Recruitment tile", () => {
      const { container } = renderWithProviders(<SummaryTilesGrid />);

      const link = container.querySelector('a[href="/cases?status=recruitment"]');
      expect(link).toBeInTheDocument();
    });

    it("passes /cases?status=eta9089 href to ETA 9089 tile", () => {
      const { container } = renderWithProviders(<SummaryTilesGrid />);

      const link = container.querySelector('a[href="/cases?status=eta9089"]');
      expect(link).toBeInTheDocument();
    });

    it("passes /cases?status=i140 href to I-140 tile", () => {
      const { container } = renderWithProviders(<SummaryTilesGrid />);

      const link = container.querySelector('a[href="/cases?status=i140"]');
      expect(link).toBeInTheDocument();
    });

    it("passes /cases?status=i140&progress=approved href to Complete tile", () => {
      const { container } = renderWithProviders(<SummaryTilesGrid />);

      // Complete = I-140 approved, so links to filtered I-140 cases
      // Use data-status attribute on wrapper div to find the Complete tile, then verify href on child anchor
      const completeTileWrapper = container.querySelector('[data-status="complete"]');
      expect(completeTileWrapper).toBeInTheDocument();
      const completeTileLink = completeTileWrapper?.querySelector('a');
      expect(completeTileLink).toBeInTheDocument();
      expect(completeTileLink).toHaveAttribute("href", "/cases?status=i140&progress=approved");
    });

    it("passes /cases?status=closed href to Closed tile", () => {
      const { container } = renderWithProviders(<SummaryTilesGrid />);

      const link = container.querySelector('a[href="/cases?status=closed"]');
      expect(link).toBeInTheDocument();
    });
  });

  // ============================================================================
  // RESPONSIVE GRID TESTS
  // ============================================================================

  describe("Responsive Grid", () => {
    beforeEach(() => {
      vi.mocked(useQuery).mockReturnValue(createMockDashboardSummary());
    });

    it("has responsive column classes (grid-cols-2, md:grid-cols-3)", () => {
      const { container } = renderWithProviders(<SummaryTilesGrid />);

      // Grid should have responsive column classes (3 cols max for wider tiles)
      const grid = container.querySelector(
        '[class*="grid-cols-2"][class*="md:grid-cols-3"]'
      );
      expect(grid).toBeInTheDocument();
    });

    it("has grid display class", () => {
      const { container } = renderWithProviders(<SummaryTilesGrid />);

      // Container should use grid layout
      const grid = container.querySelector('.grid');
      expect(grid).toBeInTheDocument();
    });

    it("has gap spacing between tiles", () => {
      const { container } = renderWithProviders(<SummaryTilesGrid />);

      // Grid should have gap class (gap-4, gap-6, etc.)
      const grid = container.querySelector('[class*="gap-"]');
      expect(grid).toBeInTheDocument();
    });
  });

  // ============================================================================
  // DATA SCENARIOS TESTS
  // ============================================================================

  describe("Data Scenarios", () => {
    it("handles empty dashboard (new user)", () => {
      vi.mocked(useQuery).mockReturnValue(dashboardScenarios.empty);

      renderWithProviders(<SummaryTilesGrid />);

      // All tiles should show 0 count
      expect(screen.getByText("PWD")).toBeInTheDocument();
      expect(screen.getAllByText("0").length).toBeGreaterThan(0);
    });

    it("handles minimal dashboard (1 case)", () => {
      vi.mocked(useQuery).mockReturnValue(dashboardScenarios.minimal);

      renderWithProviders(<SummaryTilesGrid />);

      expect(screen.getByText("PWD")).toBeInTheDocument();
      // Count may appear in multiple places (corner label and main display)
      expect(screen.getAllByText("1").length).toBeGreaterThanOrEqual(1);
    });

    it("handles high-volume dashboard (100+ cases)", () => {
      vi.mocked(useQuery).mockReturnValue(dashboardScenarios.highVolume);

      renderWithProviders(<SummaryTilesGrid />);

      // Should display large numbers correctly (count may appear multiple times)
      expect(screen.getAllByText("25").length).toBeGreaterThanOrEqual(1); // PWD
      expect(screen.getAllByText("40").length).toBeGreaterThanOrEqual(1); // Recruitment
      expect(screen.getAllByText("150").length).toBeGreaterThanOrEqual(1); // Complete
    });

    it("renders empty subtexts for Complete and Closed", () => {
      vi.mocked(useQuery).mockReturnValue(createMockDashboardSummary({
        complete: { count: 10, subtext: "" },
        closed: { count: 5, subtext: "" },
      }));

      renderWithProviders(<SummaryTilesGrid />);

      // Complete and Closed should not have subtext
      expect(screen.getByText("Complete")).toBeInTheDocument();
      expect(screen.getByText("Closed")).toBeInTheDocument();
      // Count may appear in multiple places (corner label and main display)
      expect(screen.getAllByText("10").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("5").length).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================================================================
  // SUBTEXT VALIDATION TESTS (perm_flow.md requirements)
  // ============================================================================

  describe("Subtext Requirements (perm_flow.md)", () => {
    it("PWD subtext follows format: 'X working, Y filed'", () => {
      vi.mocked(useQuery).mockReturnValue(
        createMockDashboardSummary({
          pwd: { count: 7, subtext: "4 working, 3 filed" },
        })
      );

      renderWithProviders(<SummaryTilesGrid />);

      expect(screen.getByText("4 working, 3 filed")).toBeInTheDocument();
    });

    it("Recruitment subtext follows format: 'X ready to start, Y in progress'", () => {
      vi.mocked(useQuery).mockReturnValue(
        createMockDashboardSummary({
          recruitment: { count: 10, subtext: "5 ready to start, 5 in progress" },
        })
      );

      renderWithProviders(<SummaryTilesGrid />);

      expect(screen.getByText("5 ready to start, 5 in progress")).toBeInTheDocument();
    });

    it("ETA 9089 subtext follows format: 'X prep, Y RFI, Z filed'", () => {
      vi.mocked(useQuery).mockReturnValue(
        createMockDashboardSummary({
          eta9089: { count: 8, subtext: "3 prep, 2 RFI, 3 filed" },
        })
      );

      renderWithProviders(<SummaryTilesGrid />);

      expect(screen.getByText("3 prep, 2 RFI, 3 filed")).toBeInTheDocument();
    });

    it("I-140 subtext follows format: 'X prep, Y RFE, Z filed'", () => {
      vi.mocked(useQuery).mockReturnValue(
        createMockDashboardSummary({
          i140: { count: 6, subtext: "2 prep, 1 RFE, 3 filed" },
        })
      );

      renderWithProviders(<SummaryTilesGrid />);

      expect(screen.getByText("2 prep, 1 RFE, 3 filed")).toBeInTheDocument();
    });
  });

  // ============================================================================
  // ACCESSIBILITY TESTS
  // ============================================================================

  describe("Accessibility", () => {
    beforeEach(() => {
      vi.mocked(useQuery).mockReturnValue(createMockDashboardSummary());
    });

    it("has semantic heading for section", () => {
      renderWithProviders(<SummaryTilesGrid />);

      // "Case Summary" should be a heading (h2 or h3)
      const heading = screen.getByRole("heading", { name: "Case Summary" });
      expect(heading).toBeInTheDocument();
    });

    it("all tiles are accessible links", () => {
      renderWithProviders(<SummaryTilesGrid />);

      // All 6 tiles plus 1 total badge = 7 links
      const links = screen.getAllByRole("link");
      expect(links.length).toBe(7); // Total badge + PWD, Recruitment, ETA 9089, I-140, Complete, Closed
    });

    it("links have accessible names", () => {
      renderWithProviders(<SummaryTilesGrid />);

      const links = screen.getAllByRole("link");
      links.forEach((link) => {
        expect(link).toHaveAccessibleName();
      });
    });
  });

  // ============================================================================
  // LAYOUT TESTS
  // ============================================================================

  describe("Layout", () => {
    beforeEach(() => {
      vi.mocked(useQuery).mockReturnValue(createMockDashboardSummary());
    });

    it("renders tiles in correct order (PWD, Recruitment, ETA 9089, I-140, Complete, Closed)", () => {
      const { container } = renderWithProviders(<SummaryTilesGrid />);

      // Get all link labels (first link is Total badge, tiles start at index 1)
      const labels = Array.from(container.querySelectorAll('a')).map(
        (link) => link.textContent
      );

      // First link is the Total badge, tiles are in positions 1-6
      expect(labels[0]).toContain("Total"); // Total badge
      expect(labels[1]).toContain("PWD");
      expect(labels[2]).toContain("Recruitment");
      expect(labels[3]).toContain("ETA 9089");
      expect(labels[4]).toContain("I-140");
      expect(labels[5]).toContain("Complete");
      expect(labels[6]).toContain("Closed");
    });

    it("has consistent spacing between heading and grid", () => {
      const { container } = renderWithProviders(<SummaryTilesGrid />);

      // Container should have margin/padding classes
      const section = container.querySelector('[class*="space-y"]') ||
                     container.querySelector('[class*="gap-"]');
      expect(section).toBeInTheDocument();
    });
  });

  // ============================================================================
  // ERROR HANDLING TESTS
  // ============================================================================

  describe("Error Handling", () => {
    it("handles missing subtext gracefully", () => {
      vi.mocked(useQuery).mockReturnValue(
        createMockDashboardSummary({
          pwd: { count: 5, subtext: "" },
        })
      );

      renderWithProviders(<SummaryTilesGrid />);

      // Should render without errors
      expect(screen.getByText("PWD")).toBeInTheDocument();
      // Count may appear in multiple places (corner label and main display)
      expect(screen.getAllByText("5").length).toBeGreaterThanOrEqual(1);
    });

    // Note: Convex queries never return null - they return undefined while loading
    // and throw on error. Error handling should be done at a higher level via
    // error boundaries. The previous null-check test was removed as dead code.

    it("shows loading skeleton when query returns undefined", () => {
      vi.mocked(useQuery).mockReturnValue(undefined as unknown as ReturnType<typeof createMockDashboardSummary>);

      const { container } = renderWithProviders(<SummaryTilesGrid />);

      // undefined means still loading - should show skeleton
      const skeletonTiles = container.querySelectorAll(".h-36");
      expect(skeletonTiles.length).toBeGreaterThanOrEqual(6);
    });
  });
});
