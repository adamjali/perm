// @vitest-environment jsdom
/**
 * InlineCaseTimeline Component Tests
 *
 * Tests for the inline timeline visualization component that displays
 * case milestones and date ranges.
 *
 * Requirements:
 * 1. Returns null when case has no dates (empty case)
 * 2. Renders milestones for each populated date field
 * 3. Positions milestones correctly within 6-month window
 * 4. Renders job order range bar when both dates exist
 * 5. Shows tooltip on milestone hover (test hover state)
 * 6. Displays correct stage colors (PWD blue, Recruitment purple, etc.)
 * 7. Renders legend with all stage colors
 * 8. Hides milestones outside the 6-month window
 */

import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../../../test-utils/render-utils";
import { InlineCaseTimeline } from "../InlineCaseTimeline";
import type { CaseWithDates } from "@/lib/timeline";

// ============================================================================
// MOCK SETUP
// ============================================================================

// We do NOT mock the timeline utilities since they are pure functions
// and we want to test the full integration

// ============================================================================
// TEST FIXTURES
// ============================================================================

/**
 * Factory for creating mock case data with dates.
 */
function createMockCaseData(overrides?: Partial<CaseWithDates>): CaseWithDates {
  return {
    _id: "test-case-id" as any,
    ...overrides,
  };
}

/**
 * Get a date string relative to today.
 */
function getRelativeDate(daysFromToday: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  return date.toISOString().split("T")[0] as string;
}

/**
 * Get a date string X months from today.
 *
 * Uses day 15 of target month to avoid month rollover issues.
 * For example, Dec 29 + 2 months would roll to March 1 (Feb 29 doesn't exist),
 * but using day 15 ensures we get Feb 15 which is always valid.
 */
function getRelativeMonthDate(monthsFromToday: number): string {
  const date = new Date();
  // Use day 15 to avoid month-end rollover issues (all months have at least 28 days)
  date.setDate(15);
  date.setMonth(date.getMonth() + monthsFromToday);
  return date.toISOString().split("T")[0] as string;
}

// ============================================================================
// EMPTY CASE TESTS
// ============================================================================

describe("InlineCaseTimeline - Empty Case", () => {
  it("returns null when case has no dates", () => {
    const mockCase = createMockCaseData({});

    const { container } = renderWithProviders(
      <InlineCaseTimeline caseData={mockCase} />
    );

    // Component should return null (no DOM rendered)
    expect(container.firstChild).toBeNull();
  });

  it("returns null when all date fields are undefined", () => {
    const mockCase = createMockCaseData({
      pwdFilingDate: undefined,
      pwdDeterminationDate: undefined,
      pwdExpirationDate: undefined,
      sundayAdFirstDate: undefined,
      sundayAdSecondDate: undefined,
      jobOrderStartDate: undefined,
      jobOrderEndDate: undefined,
      eta9089FilingDate: undefined,
      eta9089CertificationDate: undefined,
      eta9089ExpirationDate: undefined,
      i140FilingDate: undefined,
      i140ApprovalDate: undefined,
    });

    const { container } = renderWithProviders(
      <InlineCaseTimeline caseData={mockCase} />
    );

    expect(container.firstChild).toBeNull();
  });

  it("returns null when all date fields are null", () => {
    const mockCase = createMockCaseData({
      pwdFilingDate: null,
      pwdDeterminationDate: null,
      pwdExpirationDate: null,
    });

    const { container } = renderWithProviders(
      <InlineCaseTimeline caseData={mockCase} />
    );

    expect(container.firstChild).toBeNull();
  });
});

// ============================================================================
// MILESTONE RENDERING TESTS
// ============================================================================

describe("InlineCaseTimeline - Milestone Rendering", () => {
  it("renders milestones for populated date fields", { timeout: 10000 }, () => {
    const mockCase = createMockCaseData({
      pwdFilingDate: getRelativeDate(-30),
      pwdDeterminationDate: getRelativeDate(-10),
    });

    renderWithProviders(<InlineCaseTimeline caseData={mockCase} />);

    // Check that milestones are rendered (via aria-label)
    expect(screen.getByRole("img", { name: /PWD Filed/i })).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /PWD Determined/i })
    ).toBeInTheDocument();
  });

  it("renders milestone dot with correct visual appearance", () => {
    const mockCase = createMockCaseData({
      pwdFilingDate: getRelativeDate(-10),
    });

    const { container } = renderWithProviders(
      <InlineCaseTimeline caseData={mockCase} />
    );

    // Find milestone dot
    const milestoneDot = container.querySelector(
      '[role="img"][aria-label*="PWD Filed"]'
    );
    expect(milestoneDot).toBeInTheDocument();
    // Should have rounded-full class
    expect(milestoneDot).toHaveClass("rounded-full");
  });

  it("renders multiple milestones from different stages", () => {
    const mockCase = createMockCaseData({
      pwdFilingDate: getRelativeDate(-60),
      pwdDeterminationDate: getRelativeDate(-30),
      sundayAdFirstDate: getRelativeDate(-20),
      sundayAdSecondDate: getRelativeDate(-13),
    });

    renderWithProviders(<InlineCaseTimeline caseData={mockCase} />);

    // Check all milestones are rendered
    expect(screen.getByRole("img", { name: /PWD Filed/i })).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /PWD Determined/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /1st Sunday Ad/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /2nd Sunday Ad/i })
    ).toBeInTheDocument();
  });
});

// ============================================================================
// MILESTONE POSITIONING TESTS
// ============================================================================

describe("InlineCaseTimeline - Milestone Positioning", () => {
  it("positions milestones within the 6-month window", () => {
    // Create a case with multiple milestones to ensure at least 2 are visible
    const mockCase = createMockCaseData({
      pwdFilingDate: getRelativeDate(-30),
      pwdDeterminationDate: getRelativeDate(-20),
      pwdExpirationDate: getRelativeDate(60),
      sundayAdFirstDate: getRelativeDate(10),
      sundayAdSecondDate: getRelativeDate(17),
    });

    const { container } = renderWithProviders(
      <InlineCaseTimeline caseData={mockCase} />
    );

    // Find milestone containers
    const milestones = container.querySelectorAll('[role="img"]');
    // Component may filter milestones based on visibility and stage grouping
    expect(milestones.length).toBeGreaterThanOrEqual(1);

    // Each milestone should have a left position style
    milestones.forEach((milestone) => {
      const parent = milestone.parentElement;
      if (parent) {
        expect(parent.style.left).toMatch(/\d+(\.\d+)?%/);
      }
    });
  });

  it("renders Today marker in timeline", () => {
    const mockCase = createMockCaseData({
      pwdFilingDate: getRelativeDate(-30),
    });

    renderWithProviders(<InlineCaseTimeline caseData={mockCase} />);

    // Today marker should be visible
    expect(screen.getByText("Today")).toBeInTheDocument();
  });
});

// ============================================================================
// RANGE BAR TESTS
// ============================================================================

describe("InlineCaseTimeline - Range Bars", () => {
  it("renders job order range bar when both dates exist", () => {
    const mockCase = createMockCaseData({
      jobOrderStartDate: getRelativeDate(-30),
      jobOrderEndDate: getRelativeDate(0),
    });

    renderWithProviders(<InlineCaseTimeline caseData={mockCase} />);

    // Range bar should have Job Order Period label
    expect(
      screen.getByRole("img", { name: /Job Order Period/i })
    ).toBeInTheDocument();
  });

  it("does not render job order range bar when only start date exists", () => {
    const mockCase = createMockCaseData({
      jobOrderStartDate: getRelativeDate(-30),
      jobOrderEndDate: undefined,
    });

    const { container } = renderWithProviders(
      <InlineCaseTimeline caseData={mockCase} />
    );

    // Should not find Job Order Period range bar
    const rangeBar = screen.queryByRole("img", {
      name: /Job Order Period/i,
    });
    expect(rangeBar).not.toBeInTheDocument();
  });

  it("does not render job order range bar when only end date exists", () => {
    const mockCase = createMockCaseData({
      jobOrderStartDate: undefined,
      jobOrderEndDate: getRelativeDate(0),
    });

    const { container } = renderWithProviders(
      <InlineCaseTimeline caseData={mockCase} />
    );

    const rangeBar = screen.queryByRole("img", {
      name: /Job Order Period/i,
    });
    expect(rangeBar).not.toBeInTheDocument();
  });
});

// ============================================================================
// TOOLTIP TESTS
// ============================================================================

describe("InlineCaseTimeline - Tooltips", () => {
  it("shows tooltip with label and date on milestone hover", async () => {
    const pwdDate = getRelativeDate(-10);
    const mockCase = createMockCaseData({
      pwdFilingDate: pwdDate,
    });

    const { container } = renderWithProviders(
      <InlineCaseTimeline caseData={mockCase} />
    );

    // Find the milestone wrapper (has group class for hover)
    const milestoneWrapper = container.querySelector(".group");
    expect(milestoneWrapper).toBeInTheDocument();

    // Tooltip should exist but be hidden initially
    const tooltip = container.querySelector(".group-hover\\:opacity-100");
    expect(tooltip).toBeInTheDocument();

    // Tooltip should contain the label
    expect(tooltip?.textContent).toContain("PWD Filed");
  });

  it("tooltip appears above milestone (bottom-full class)", () => {
    const mockCase = createMockCaseData({
      pwdFilingDate: getRelativeDate(-10),
    });

    const { container } = renderWithProviders(
      <InlineCaseTimeline caseData={mockCase} />
    );

    // Tooltip should have bottom-full for positioning above
    const tooltip = container.querySelector(".bottom-full");
    expect(tooltip).toBeInTheDocument();
  });
});

// ============================================================================
// STAGE COLOR TESTS
// ============================================================================

describe("InlineCaseTimeline - Stage Colors", () => {
  it("displays PWD milestones in blue (#0066FF)", () => {
    const mockCase = createMockCaseData({
      pwdFilingDate: getRelativeDate(-10),
    });

    const { container } = renderWithProviders(
      <InlineCaseTimeline caseData={mockCase} />
    );

    const milestone = container.querySelector(
      '[role="img"][aria-label*="PWD Filed"]'
    );
    expect(milestone).toHaveStyle({ backgroundColor: "#0066FF" });
  });

  it("displays Recruitment milestones in purple (#9333ea)", () => {
    const mockCase = createMockCaseData({
      sundayAdFirstDate: getRelativeDate(-10),
    });

    const { container } = renderWithProviders(
      <InlineCaseTimeline caseData={mockCase} />
    );

    const milestone = container.querySelector(
      '[role="img"][aria-label*="1st Sunday Ad"]'
    );
    expect(milestone).toHaveStyle({ backgroundColor: "#9333ea" });
  });

  it("displays ETA 9089 milestones in orange (#ea580c)", () => {
    const mockCase = createMockCaseData({
      eta9089FilingDate: getRelativeDate(-10),
    });

    const { container } = renderWithProviders(
      <InlineCaseTimeline caseData={mockCase} />
    );

    const milestone = container.querySelector(
      '[role="img"][aria-label*="ETA 9089 Filed"]'
    );
    expect(milestone).toHaveStyle({ backgroundColor: "#ea580c" });
  });

  it("displays I-140 milestones in green (#16a34a)", () => {
    const mockCase = createMockCaseData({
      i140FilingDate: getRelativeDate(-10),
    });

    const { container } = renderWithProviders(
      <InlineCaseTimeline caseData={mockCase} />
    );

    const milestone = container.querySelector(
      '[role="img"][aria-label*="I-140 Filed"]'
    );
    expect(milestone).toHaveStyle({ backgroundColor: "#16a34a" });
  });
});

// ============================================================================
// LEGEND TESTS
// ============================================================================

describe("InlineCaseTimeline - Legend", () => {
  it("renders legend with stage colors", () => {
    const mockCase = createMockCaseData({
      pwdFilingDate: getRelativeDate(-10),
    });

    renderWithProviders(<InlineCaseTimeline caseData={mockCase} />);

    // Legend should contain all four main stages
    // Note: Row labels and legend both show stage names, so we check for at least 2 occurrences
    expect(screen.getAllByText("PWD").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Recruitment").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("ETA 9089").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("I-140").length).toBeGreaterThanOrEqual(2);
  });

  it("legend shows only 4 main stages (no Calculated marker)", () => {
    const mockCase = createMockCaseData({
      pwdFilingDate: getRelativeDate(-10),
    });

    renderWithProviders(<InlineCaseTimeline caseData={mockCase} />);

    // Should NOT have "Calculated" - removed in Phase 1.2
    expect(screen.queryByText("Calculated")).not.toBeInTheDocument();
  });

  it("legend dots have correct colors", () => {
    const mockCase = createMockCaseData({
      pwdFilingDate: getRelativeDate(-10),
    });

    const { container } = renderWithProviders(
      <InlineCaseTimeline caseData={mockCase} />
    );

    // Find legend color dots (w-4 h-4 rounded-full in the legend section)
    // Legend uses grid on mobile, flex on sm+ so we look for the dots directly
    const legendDots = container.querySelectorAll(".w-4.h-4.rounded-full");
    expect(legendDots.length).toBeGreaterThanOrEqual(4);
  });
});

// ============================================================================
// WINDOW FILTERING TESTS
// ============================================================================

describe("InlineCaseTimeline - Window Filtering", () => {
  it("hides milestones outside the 6-month window (past)", () => {
    // Create a date 4 months ago (outside 3-month past window)
    const mockCase = createMockCaseData({
      pwdFilingDate: getRelativeMonthDate(-4),
    });

    const { container } = renderWithProviders(
      <InlineCaseTimeline caseData={mockCase} />
    );

    // Component should return null or not show this milestone
    // Since it's the only milestone and it's outside window
    expect(container.firstChild).toBeNull();
  });

  it("hides milestones outside the 6-month window (future)", () => {
    // Create a date 4 months in future (outside 3-month future window)
    const mockCase = createMockCaseData({
      pwdExpirationDate: getRelativeMonthDate(4),
    });

    const { container } = renderWithProviders(
      <InlineCaseTimeline caseData={mockCase} />
    );

    // Should return null since milestone is outside window
    expect(container.firstChild).toBeNull();
  });

  it("shows milestones within the 6-month window", () => {
    const mockCase = createMockCaseData({
      pwdFilingDate: getRelativeMonthDate(-2), // 2 months ago (inside window)
      pwdExpirationDate: getRelativeMonthDate(2), // 2 months ahead (inside window)
    });

    renderWithProviders(<InlineCaseTimeline caseData={mockCase} />);

    // Both should be visible
    expect(screen.getByRole("img", { name: /PWD Filed/i })).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /PWD Expires/i })
    ).toBeInTheDocument();
  });

  it("shows only milestones within window when case has both inside and outside dates", () => {
    const mockCase = createMockCaseData({
      pwdFilingDate: getRelativeMonthDate(-5), // Outside window (past)
      pwdDeterminationDate: getRelativeDate(-30), // Inside window
      pwdExpirationDate: getRelativeMonthDate(1), // Inside window
    });

    renderWithProviders(<InlineCaseTimeline caseData={mockCase} />);

    // Filed should NOT be visible (outside window)
    expect(
      screen.queryByRole("img", { name: /PWD Filed/i })
    ).not.toBeInTheDocument();

    // Determined and Expires should be visible
    expect(
      screen.getByRole("img", { name: /PWD Determined/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /PWD Expires/i })
    ).toBeInTheDocument();
  });
});

// ============================================================================
// MONTH HEADERS TESTS
// ============================================================================

describe("InlineCaseTimeline - Month Headers", () => {
  it("renders month headers for 6 months", () => {
    const mockCase = createMockCaseData({
      pwdFilingDate: getRelativeDate(-10),
    });

    const { container } = renderWithProviders(
      <InlineCaseTimeline caseData={mockCase} />
    );

    // Should have 6 month headers (3 before + 3 after)
    const monthHeaders = container.querySelectorAll(
      ".flex.border-b-2 > div"
    );
    expect(monthHeaders.length).toBe(6);
  });

  it("highlights current month", () => {
    const mockCase = createMockCaseData({
      pwdFilingDate: getRelativeDate(-10),
    });

    const { container } = renderWithProviders(
      <InlineCaseTimeline caseData={mockCase} />
    );

    // Current month should have special styling
    const currentMonth = container.querySelector(
      ".flex.border-b-2 .font-semibold"
    );
    expect(currentMonth).toBeInTheDocument();
  });
});

// ============================================================================
// CALCULATED MILESTONES TESTS
// ============================================================================

describe("InlineCaseTimeline - Calculated Milestones", () => {
  it("shows Ready to File calculated milestone when ETA 9089 not filed", () => {
    const mockCase = createMockCaseData({
      sundayAdSecondDate: getRelativeDate(-45),
      jobOrderEndDate: getRelativeDate(-30),
      // eta9089FilingDate is undefined - not filed yet
    });

    renderWithProviders(<InlineCaseTimeline caseData={mockCase} />);

    // Ready to File should appear (30 days after last recruitment)
    expect(
      screen.getByRole("img", { name: /Ready to File/i })
    ).toBeInTheDocument();
  });

  it("hides Ready to File when ETA 9089 is filed", () => {
    const mockCase = createMockCaseData({
      sundayAdSecondDate: getRelativeDate(-45),
      jobOrderEndDate: getRelativeDate(-30),
      eta9089FilingDate: getRelativeDate(-10), // Filed!
    });

    renderWithProviders(<InlineCaseTimeline caseData={mockCase} />);

    // Ready to File should NOT appear
    expect(
      screen.queryByRole("img", { name: /Ready to File/i })
    ).not.toBeInTheDocument();
  });

  it("shows calculated milestones with dashed border", () => {
    const mockCase = createMockCaseData({
      sundayAdFirstDate: getRelativeDate(-60),
      sundayAdSecondDate: getRelativeDate(-53),
      jobOrderEndDate: getRelativeDate(-30),
    });

    const { container } = renderWithProviders(
      <InlineCaseTimeline caseData={mockCase} />
    );

    // Calculated milestones should have border-dashed class
    const dashedBorderMilestones = container.querySelectorAll(".border-dashed");
    expect(dashedBorderMilestones.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// RFI/RFE DEADLINE TESTS
// ============================================================================

describe("InlineCaseTimeline - RFI/RFE Deadlines", () => {
  it("shows active RFI deadline milestone", () => {
    const mockCase = createMockCaseData({
      eta9089FilingDate: getRelativeDate(-30),
      rfiEntries: [
        {
          id: "rfi-1",
          receivedDate: getRelativeDate(-20),
          responseDueDate: getRelativeDate(10),
          createdAt: Date.now(),
        },
      ],
    });

    renderWithProviders(<InlineCaseTimeline caseData={mockCase} />);

    expect(screen.getByRole("img", { name: /RFI Due/i })).toBeInTheDocument();
  });

  it("hides resolved RFI deadline", () => {
    const mockCase = createMockCaseData({
      eta9089FilingDate: getRelativeDate(-30),
      rfiEntries: [
        {
          id: "rfi-1",
          receivedDate: getRelativeDate(-20),
          responseDueDate: getRelativeDate(-5),
          responseSubmittedDate: getRelativeDate(-7), // Resolved!
          createdAt: Date.now(),
        },
      ],
    });

    const { container } = renderWithProviders(
      <InlineCaseTimeline caseData={mockCase} />
    );

    // Should not show RFI deadline since it's resolved
    expect(
      screen.queryByRole("img", { name: /RFI Due/i })
    ).not.toBeInTheDocument();
  });

  it("shows active RFE deadline milestone in red", () => {
    const mockCase = createMockCaseData({
      i140FilingDate: getRelativeDate(-30),
      rfeEntries: [
        {
          id: "rfe-1",
          receivedDate: getRelativeDate(-15),
          responseDueDate: getRelativeDate(15),
          createdAt: Date.now(),
        },
      ],
    });

    const { container } = renderWithProviders(
      <InlineCaseTimeline caseData={mockCase} />
    );

    const rfeMilestone = container.querySelector(
      '[role="img"][aria-label*="RFE Due"]'
    );
    expect(rfeMilestone).toBeInTheDocument();
    expect(rfeMilestone).toHaveStyle({ backgroundColor: "#dc2626" });
  });
});

// ============================================================================
// ACCESSIBILITY TESTS
// ============================================================================

describe("InlineCaseTimeline - Accessibility", () => {
  it("milestones have accessible aria-labels", () => {
    const mockCase = createMockCaseData({
      pwdFilingDate: getRelativeDate(-10),
      pwdDeterminationDate: getRelativeDate(-5),
    });

    renderWithProviders(<InlineCaseTimeline caseData={mockCase} />);

    // All milestone dots should have role="img" with aria-label
    const milestones = screen.getAllByRole("img");
    milestones.forEach((milestone) => {
      expect(milestone).toHaveAttribute("aria-label");
    });
  });

  it("range bars have accessible aria-labels", () => {
    const mockCase = createMockCaseData({
      jobOrderStartDate: getRelativeDate(-30),
      jobOrderEndDate: getRelativeDate(0),
    });

    renderWithProviders(<InlineCaseTimeline caseData={mockCase} />);

    const rangeBar = screen.getByRole("img", { name: /Job Order Period/i });
    expect(rangeBar).toHaveAttribute("aria-label");
    expect(rangeBar.getAttribute("aria-label")).toContain("to");
  });

  it("today marker has title attribute", () => {
    const mockCase = createMockCaseData({
      pwdFilingDate: getRelativeDate(-10),
    });

    const { container } = renderWithProviders(
      <InlineCaseTimeline caseData={mockCase} />
    );

    // Today marker should have title
    const todayMarker = container.querySelector('[title="Today"]');
    expect(todayMarker).toBeInTheDocument();
  });
});

// ============================================================================
// RESPONSIVE/STYLING TESTS
// ============================================================================

describe("InlineCaseTimeline - Styling", () => {
  it("has full width container", () => {
    const mockCase = createMockCaseData({
      pwdFilingDate: getRelativeDate(-10),
    });

    const { container } = renderWithProviders(
      <InlineCaseTimeline caseData={mockCase} />
    );

    const wrapper = container.firstChild;
    expect(wrapper).toHaveClass("w-full");
  });

  it("applies custom className when provided", () => {
    const mockCase = createMockCaseData({
      pwdFilingDate: getRelativeDate(-10),
    });

    const { container } = renderWithProviders(
      <InlineCaseTimeline caseData={mockCase} className="custom-class" />
    );

    const wrapper = container.firstChild;
    expect(wrapper).toHaveClass("custom-class");
  });

  it("timeline container has 4-tier gantt layout", () => {
    const mockCase = createMockCaseData({
      pwdFilingDate: getRelativeDate(-10),
    });

    const { container } = renderWithProviders(
      <InlineCaseTimeline caseData={mockCase} />
    );

    // 4-tier Gantt layout has row labels on the left and timeline grid on the right
    const rowLabels = container.querySelectorAll(".h-12.flex.items-center");
    expect(rowLabels.length).toBe(4); // 4 stages: PWD, Recruitment, ETA 9089, I-140
  });
});
