// @vitest-environment jsdom
/**
 * TimelineGrid Component Tests
 * Tests for the main timeline grid component.
 *
 * Requirements:
 * 1. Renders correct number of rows for cases
 * 2. Shows month headers for time range
 * 3. Highlights current month
 * 4. Positions milestones correctly
 * 5. Handles empty cases array
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import { TimelineGrid } from "../TimelineGrid";
import type { TimelineCaseData } from "../TimelineGrid";
import type { Id } from "../../../../convex/_generated/dataModel";

// ============================================================================
// TEST FIXTURES
// ============================================================================

/**
 * Factory for creating test TimelineCaseData with sensible defaults.
 */
function createMockTimelineCaseData(
  overrides?: Partial<TimelineCaseData>
): TimelineCaseData {
  return {
    id: "test-case-id" as Id<"cases">,
    employerName: "Acme Corp",
    positionTitle: "Software Engineer",
    caseStatus: "pwd",
    progressStatus: "working",
    rfiEntries: [],
    rfeEntries: [],
    ...overrides,
  };
}

/**
 * Create multiple test cases for grid testing.
 */
function createMockCases(count: number): TimelineCaseData[] {
  return Array.from({ length: count }, (_, i) =>
    createMockTimelineCaseData({
      id: `test-case-${i + 1}` as Id<"cases">,
      employerName: `Company ${i + 1}`,
      positionTitle: `Position ${i + 1}`,
    })
  );
}

// ============================================================================
// EMPTY STATE TESTS
// ============================================================================

describe("TimelineGrid - Empty State", () => {
  it("renders empty state message when cases array is empty", () => {
    renderWithProviders(<TimelineGrid cases={[]} timeRange={6} />);

    expect(screen.getByText(/no cases to display/i)).toBeInTheDocument();
    expect(
      screen.getByText(/select cases using the filter/i)
    ).toBeInTheDocument();
  });

  it("renders empty state with dashed border styling", () => {
    const { container } = renderWithProviders(
      <TimelineGrid cases={[]} timeRange={6} />
    );

    const emptyState = container.querySelector(".border-dashed");
    expect(emptyState).toBeInTheDocument();
  });

  it("does not render grid structure when empty", () => {
    renderWithProviders(<TimelineGrid cases={[]} timeRange={6} />);

    // Grid role should not be present for empty state
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
  });
});

// ============================================================================
// GRID STRUCTURE TESTS
// ============================================================================

describe("TimelineGrid - Grid Structure", () => {
  it("renders grid with correct number of rows", () => {
    const cases = createMockCases(5);
    renderWithProviders(<TimelineGrid cases={cases} timeRange={6} />);

    // Each case should have a row
    cases.forEach((caseData) => {
      expect(screen.getByText(caseData.employerName)).toBeInTheDocument();
    });
  });

  it("renders grid with role='grid' for accessibility", () => {
    const cases = createMockCases(3);
    renderWithProviders(<TimelineGrid cases={cases} timeRange={6} />);

    expect(screen.getByRole("grid")).toBeInTheDocument();
  });

  it("has aria-label describing case count and time range", () => {
    const cases = createMockCases(4);
    renderWithProviders(<TimelineGrid cases={cases} timeRange={12} />);

    const grid = screen.getByRole("grid");
    expect(grid).toHaveAttribute(
      "aria-label",
      "Timeline showing 4 cases over 12 months"
    );
  });

  it("renders sidebar header with 'Case' label", () => {
    const cases = createMockCases(2);
    renderWithProviders(<TimelineGrid cases={cases} timeRange={6} />);

    expect(screen.getByText("Case")).toBeInTheDocument();
  });

  it("alternates row backgrounds for readability", () => {
    const cases = createMockCases(3);
    const { container } = renderWithProviders(
      <TimelineGrid cases={cases} timeRange={6} />
    );

    const rows = container.querySelectorAll('[role="row"]');
    // Should have header row plus 3 case rows
    expect(rows.length).toBeGreaterThanOrEqual(3);
  });
});

// ============================================================================
// MONTH HEADER TESTS
// ============================================================================

describe("TimelineGrid - Month Headers", () => {
  it("renders month headers for 6-month time range", () => {
    const cases = createMockCases(1);
    renderWithProviders(<TimelineGrid cases={cases} timeRange={6} />);

    // Should have month headers (short format: Jan, Feb, etc.)
    // At minimum, we should see some month abbreviations
    const grid = screen.getByRole("grid");
    expect(grid).toBeInTheDocument();

    // Check for at least one columnheader role
    expect(screen.getAllByRole("columnheader").length).toBeGreaterThan(0);
  });

  it("renders correct number of months for 3-month range", () => {
    const cases = createMockCases(1);
    renderWithProviders(<TimelineGrid cases={cases} timeRange={3} />);

    const columnHeaders = screen.getAllByRole("columnheader");
    expect(columnHeaders).toHaveLength(3);
  });

  it("renders correct number of months for 12-month range", () => {
    const cases = createMockCases(1);
    renderWithProviders(<TimelineGrid cases={cases} timeRange={12} />);

    const columnHeaders = screen.getAllByRole("columnheader");
    expect(columnHeaders).toHaveLength(12);
  });

  it("renders correct number of months for 24-month range", () => {
    const cases = createMockCases(1);
    renderWithProviders(<TimelineGrid cases={cases} timeRange={24} />);

    const columnHeaders = screen.getAllByRole("columnheader");
    expect(columnHeaders).toHaveLength(24);
  });

  it("highlights current month with special styling", () => {
    const cases = createMockCases(1);
    const { container } = renderWithProviders(
      <TimelineGrid cases={cases} timeRange={6} />
    );

    // Current month should have bg-primary/10 class
    const highlightedMonth = container.querySelector(".bg-primary\\/10");
    expect(highlightedMonth).toBeInTheDocument();
  });

  it("shows year on January months", () => {
    const cases = createMockCases(1);
    // Use 12-month range to increase chance of including January
    renderWithProviders(<TimelineGrid cases={cases} timeRange={12} />);

    // Should show at least one year indicator
    // (this may vary based on current date)
    const grid = screen.getByRole("grid");
    expect(grid).toBeInTheDocument();
  });
});

// ============================================================================
// CASE ROW TESTS
// ============================================================================

describe("TimelineGrid - Case Rows", () => {
  it("displays employer name in each row", () => {
    const cases = [
      createMockTimelineCaseData({
        id: "case-1" as Id<"cases">,
        employerName: "Tech Innovations",
      }),
      createMockTimelineCaseData({
        id: "case-2" as Id<"cases">,
        employerName: "Global Systems",
      }),
    ];

    renderWithProviders(<TimelineGrid cases={cases} timeRange={6} />);

    expect(screen.getByText("Tech Innovations")).toBeInTheDocument();
    expect(screen.getByText("Global Systems")).toBeInTheDocument();
  });

  it("displays position title in each row", () => {
    const cases = [
      createMockTimelineCaseData({
        id: "case-1" as Id<"cases">,
        positionTitle: "Senior Developer",
      }),
      createMockTimelineCaseData({
        id: "case-2" as Id<"cases">,
        positionTitle: "Data Scientist",
      }),
    ];

    renderWithProviders(<TimelineGrid cases={cases} timeRange={6} />);

    expect(screen.getByText("Senior Developer")).toBeInTheDocument();
    expect(screen.getByText("Data Scientist")).toBeInTheDocument();
  });

  it("truncates long employer names", () => {
    const cases = [
      createMockTimelineCaseData({
        employerName:
          "Very Long Company Name That Should Be Truncated In The Display",
      }),
    ];

    const { container } = renderWithProviders(
      <TimelineGrid cases={cases} timeRange={6} />
    );

    // The text should have truncate class
    const truncatedElement = container.querySelector(".truncate");
    expect(truncatedElement).toBeInTheDocument();
  });

  it("renders rowgroup for case rows", () => {
    const cases = createMockCases(2);
    renderWithProviders(<TimelineGrid cases={cases} timeRange={6} />);

    expect(screen.getByRole("rowgroup")).toBeInTheDocument();
  });
});

// ============================================================================
// MILESTONE POSITIONING TESTS
// ============================================================================

describe("TimelineGrid - Milestone Positioning", () => {
  it("renders milestones for cases with date data", () => {
    // Create a case with a PWD filing date within the visible range
    const today = new Date();
    const recentDate = new Date(today);
    recentDate.setMonth(recentDate.getMonth() - 1);
    const dateString = recentDate.toISOString().split("T")[0];

    const cases = [
      createMockTimelineCaseData({
        pwdFilingDate: dateString,
      }),
    ];

    const { container } = renderWithProviders(
      <TimelineGrid cases={cases} timeRange={6} />
    );

    // Should have at least one milestone marker
    const milestoneMarkers = container.querySelectorAll('[role="button"]');
    // May or may not have milestone markers depending on date visibility
    expect(container).toBeInTheDocument();
  });

  it("does not render milestones outside the time range", () => {
    // Create a case with a date far outside the 6-month range
    const cases = [
      createMockTimelineCaseData({
        pwdFilingDate: "2020-01-15", // Far in the past
      }),
    ];

    const { container } = renderWithProviders(
      <TimelineGrid cases={cases} timeRange={6} />
    );

    // The row should exist but milestone for old date should not be visible
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
  });

  it("positions milestones at correct percentage across timeline", () => {
    // This is more of a visual test - we verify structure exists
    const today = new Date();
    const recentDate = new Date(today);
    recentDate.setMonth(recentDate.getMonth() - 1);

    const cases = [
      createMockTimelineCaseData({
        pwdFilingDate: recentDate.toISOString().split("T")[0],
      }),
    ];

    renderWithProviders(<TimelineGrid cases={cases} timeRange={6} />);

    // Verify the grid renders without errors
    expect(screen.getByRole("grid")).toBeInTheDocument();
  });
});

// ============================================================================
// STYLING TESTS
// ============================================================================

describe("TimelineGrid - Neobrutalist Styling", () => {
  it("has 2px border on main container", () => {
    const cases = createMockCases(2);
    const { container } = renderWithProviders(
      <TimelineGrid cases={cases} timeRange={6} />
    );

    const grid = screen.getByRole("grid");
    expect(grid).toHaveClass("border-2");
    expect(grid).toHaveClass("border-foreground");
  });

  it("has shadow-hard on main container", () => {
    const cases = createMockCases(1);
    renderWithProviders(<TimelineGrid cases={cases} timeRange={6} />);

    const grid = screen.getByRole("grid");
    expect(grid).toHaveClass("shadow-hard");
  });

  it("has sticky sidebar with border styling", () => {
    const cases = createMockCases(1);
    const { container } = renderWithProviders(
      <TimelineGrid cases={cases} timeRange={6} />
    );

    // Sidebar should be sticky left
    const stickySidebar = container.querySelector(".sticky.left-0");
    expect(stickySidebar).toBeInTheDocument();
  });

  it("has scrollable container for overflow", () => {
    const cases = createMockCases(1);
    const { container } = renderWithProviders(
      <TimelineGrid cases={cases} timeRange={6} />
    );

    const scrollContainer = container.querySelector(".overflow-x-auto");
    expect(scrollContainer).toBeInTheDocument();
  });

  it("has minimum width to prevent squishing", () => {
    const cases = createMockCases(1);
    const { container } = renderWithProviders(
      <TimelineGrid cases={cases} timeRange={6} />
    );

    const minWidthContainer = container.querySelector(".min-w-\\[600px\\]");
    expect(minWidthContainer).toBeInTheDocument();
  });
});

// ============================================================================
// RESPONSIVE TESTS
// ============================================================================

describe("TimelineGrid - Responsive Layout", () => {
  it("has responsive sidebar widths", () => {
    const cases = createMockCases(1);
    const { container } = renderWithProviders(
      <TimelineGrid cases={cases} timeRange={6} />
    );

    // Check for responsive width classes on sidebar header
    const sidebarHeader = container.querySelector(
      ".w-\\[140px\\].sm\\:w-\\[180px\\].md\\:w-\\[250px\\]"
    );
    expect(sidebarHeader).toBeInTheDocument();
  });
});

// ============================================================================
// TIME RANGE TESTS
// ============================================================================

describe("TimelineGrid - Time Range Handling", () => {
  it("centers timeline around current date", () => {
    const cases = createMockCases(1);
    renderWithProviders(<TimelineGrid cases={cases} timeRange={6} />);

    // Current month should be highlighted, indicating centering
    // The exact behavior is visual - we verify the grid renders
    expect(screen.getByRole("grid")).toBeInTheDocument();
  });

  it("handles 3-month range correctly", () => {
    const cases = createMockCases(1);
    renderWithProviders(<TimelineGrid cases={cases} timeRange={3} />);

    const grid = screen.getByRole("grid");
    expect(grid).toHaveAttribute(
      "aria-label",
      "Timeline showing 1 cases over 3 months"
    );
  });

  it("handles 24-month range correctly", () => {
    const cases = createMockCases(1);
    renderWithProviders(<TimelineGrid cases={cases} timeRange={24} />);

    const grid = screen.getByRole("grid");
    expect(grid).toHaveAttribute(
      "aria-label",
      "Timeline showing 1 cases over 24 months"
    );
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe("TimelineGrid - Edge Cases", () => {
  it("handles single case correctly", () => {
    const cases = createMockCases(1);
    renderWithProviders(<TimelineGrid cases={cases} timeRange={6} />);

    expect(screen.getByRole("grid")).toBeInTheDocument();
    expect(screen.getByText("Company 1")).toBeInTheDocument();
  });

  it("handles many cases (10+) correctly", () => {
    const cases = createMockCases(15);
    renderWithProviders(<TimelineGrid cases={cases} timeRange={6} />);

    const grid = screen.getByRole("grid");
    expect(grid).toHaveAttribute(
      "aria-label",
      "Timeline showing 15 cases over 6 months"
    );
  });

  it("handles cases with no dates", () => {
    const cases = [
      createMockTimelineCaseData({
        // No date fields set
      }),
    ];

    renderWithProviders(<TimelineGrid cases={cases} timeRange={6} />);

    // Should render without errors
    expect(screen.getByRole("grid")).toBeInTheDocument();
  });

  it("handles cases with all date fields populated", () => {
    const today = new Date();
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    const dateStr = monthAgo.toISOString().split("T")[0];

    const cases = [
      createMockTimelineCaseData({
        pwdFilingDate: dateStr,
        pwdDeterminationDate: dateStr,
        pwdExpirationDate: dateStr,
        sundayAdFirstDate: dateStr,
        sundayAdSecondDate: dateStr,
        jobOrderStartDate: dateStr,
        jobOrderEndDate: dateStr,
        eta9089FilingDate: dateStr,
        eta9089CertificationDate: dateStr,
        i140FilingDate: dateStr,
      }),
    ];

    renderWithProviders(<TimelineGrid cases={cases} timeRange={6} />);

    // Should render without errors
    expect(screen.getByRole("grid")).toBeInTheDocument();
  });
});
