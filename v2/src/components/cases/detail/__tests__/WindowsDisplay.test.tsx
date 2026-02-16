// @vitest-environment jsdom
/**
 * WindowsDisplay Component Tests
 *
 * Tests for the recruitment and filing window display component.
 *
 * Requirements:
 * 1. Recruitment Window Card
 *    - Shows ACTIVE status when within 180-day window from first recruitment
 *    - Shows COMPLETED status when all recruitment steps are done
 *    - Shows EXPIRED status when past 180 days
 *    - Shows NOT_STARTED when no recruitment dates
 * 2. Filing Window Card
 *    - Shows OPEN status when within filing window
 *    - Shows OPENING_SOON when within 7 days of opening
 *    - Shows CLOSING_SOON when within 14 days of closing
 *    - Shows CLOSED when past closing date
 *    - Shows FILED when ETA 9089 already filed
 *    - Shows NOT_AVAILABLE when can't calculate
 * 3. UI/UX
 *    - Two side-by-side cards on desktop
 *    - Stacks vertically on mobile
 *    - Color-coded status chips
 *    - Hero number with unit and label
 *    - Progress bar with short date labels
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../../../test-utils/render-utils";
import { WindowsDisplay } from "../WindowsDisplay";
import type { CaseWithDates } from "@/lib/timeline";

// ============================================================================
// MOCK SETUP
// ============================================================================

// Mock current date for consistent testing (use local midnight to match component's setHours(0,0,0,0))
const MOCK_TODAY = new Date(2024, 5, 15); // June 15, 2024 midnight LOCAL

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(MOCK_TODAY);
});

afterEach(() => {
  vi.useRealTimers();
});

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
 * Get a date string relative to MOCK_TODAY.
 */
function getRelativeDate(daysFromToday: number): string {
  const date = new Date(MOCK_TODAY);
  date.setDate(date.getDate() + daysFromToday);
  // Use local date parts (not toISOString which uses UTC) to match component's parseDate
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ============================================================================
// RECRUITMENT WINDOW TESTS
// ============================================================================

describe("WindowsDisplay - Recruitment Window", () => {
  it("shows NOT_STARTED when no recruitment dates exist", () => {
    const mockCase = createMockCaseData({});

    renderWithProviders(<WindowsDisplay caseData={mockCase} />);

    // Should show Not Started status chip
    expect(screen.getByText("Not Started")).toBeInTheDocument();
    // Should show hero label for not started
    expect(screen.getByText("No activities yet")).toBeInTheDocument();
  });

  it("shows ACTIVE status when within 180-day window from first recruitment", () => {
    const mockCase = createMockCaseData({
      sundayAdFirstDate: getRelativeDate(-30), // 30 days ago
      jobOrderStartDate: getRelativeDate(-25), // 25 days ago
    });

    renderWithProviders(<WindowsDisplay caseData={mockCase} />);

    // Should show Active status chip
    expect(screen.getByText("Active")).toBeInTheDocument();
    // Should show hero number (~150 days remaining, may vary by +-1 due to timezone)
    expect(screen.getByText(/^15[01]$/)).toBeInTheDocument();
    // Should show unit "days"
    expect(screen.getByText("days")).toBeInTheDocument();
    // Should show hero label
    expect(screen.getByText("remaining in window")).toBeInTheDocument();
  });

  it("uses earliest recruitment date as start", () => {
    const mockCase = createMockCaseData({
      sundayAdFirstDate: getRelativeDate(-30), // 30 days ago (earliest)
      jobOrderStartDate: getRelativeDate(-20), // 20 days ago
    });

    const { container } = renderWithProviders(
      <WindowsDisplay caseData={mockCase} />
    );

    // The progress bar should show the start date in short format (e.g. "May 16")
    // Start date is 30 days before June 15, 2024 = May 16
    // formatShortDate parses ISO string directly (timezone-independent)
    const startDateStr = getRelativeDate(-30);
    const monthNum = parseInt(startDateStr.substring(5, 7), 10);
    const dayNum = parseInt(startDateStr.substring(8, 10), 10);
    const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const expectedShortDate = `${SHORT_MONTHS[monthNum - 1]} ${dayNum}`;

    expect(screen.getByText(expectedShortDate)).toBeInTheDocument();
  });

  it("shows EXPIRED status when past 180-day window", () => {
    const mockCase = createMockCaseData({
      sundayAdFirstDate: getRelativeDate(-200), // 200 days ago
    });

    renderWithProviders(<WindowsDisplay caseData={mockCase} />);

    // Should show Expired status chip
    expect(screen.getByText("Expired")).toBeInTheDocument();
    // Should show days elapsed since expiration (~200 - 180 = 20, may vary by +-1 due to timezone)
    expect(screen.getByText(/^[12][09]$/)).toBeInTheDocument();
    // Should show hero label for expired
    expect(screen.getByText("past expiration")).toBeInTheDocument();
  });

  it("renders recruitment window card with correct title", () => {
    const mockCase = createMockCaseData({
      sundayAdFirstDate: getRelativeDate(-30),
    });

    renderWithProviders(<WindowsDisplay caseData={mockCase} />);

    // Card title
    expect(screen.getByText("Recruitment Window")).toBeInTheDocument();
    // Progress bar shows short dates (no "Start:" or "Expires:" labels in redesign)
  });
});

// ============================================================================
// FILING WINDOW TESTS
// ============================================================================

describe("WindowsDisplay - Filing Window", () => {
  it("shows NOT_AVAILABLE when no recruitment end dates exist", () => {
    const mockCase = createMockCaseData({
      sundayAdFirstDate: getRelativeDate(-30),
      // No end dates
    });

    renderWithProviders(<WindowsDisplay caseData={mockCase} />);

    // Should show Not Available for filing window
    const notAvailableElements = screen.getAllByText("Not Available");
    expect(notAvailableElements.length).toBeGreaterThanOrEqual(1);
    // Should show hero label for not available
    expect(screen.getByText("Awaiting recruitment")).toBeInTheDocument();
  });

  it("shows FILED status when ETA 9089 already filed", () => {
    const mockCase = createMockCaseData({
      sundayAdFirstDate: getRelativeDate(-60),
      sundayAdSecondDate: getRelativeDate(-53),
      jobOrderEndDate: getRelativeDate(-30),
      pwdExpirationDate: getRelativeDate(120),
      eta9089FilingDate: getRelativeDate(-10), // Filed!
    });

    renderWithProviders(<WindowsDisplay caseData={mockCase} />);

    // Should show Filed status chip
    expect(screen.getByText("Filed")).toBeInTheDocument();
    // Should show hero label
    expect(screen.getByText("ETA 9089 filed")).toBeInTheDocument();
  });

  it("shows OPEN status when within filing window", () => {
    const mockCase = createMockCaseData({
      sundayAdFirstDate: getRelativeDate(-60),
      sundayAdSecondDate: getRelativeDate(-53),
      jobOrderStartDate: getRelativeDate(-55),
      jobOrderEndDate: getRelativeDate(-40), // Last recruitment ended 40 days ago
      noticeOfFilingStartDate: getRelativeDate(-58),
      noticeOfFilingEndDate: getRelativeDate(-44),
      pwdExpirationDate: getRelativeDate(60), // PWD expires in 60 days
      // No eta9089FilingDate - not filed yet
    });

    renderWithProviders(<WindowsDisplay caseData={mockCase} />);

    // Window opened 30 days after job order end = 10 days ago
    // Window closes in 60 days (PWD expiration)
    expect(screen.getByText("Open")).toBeInTheDocument();
    // Should show days remaining to file
    expect(screen.getByText("remaining to file")).toBeInTheDocument();
  });

  it("shows OPENING_SOON when within 7 days of window opening", () => {
    const mockCase = createMockCaseData({
      sundayAdFirstDate: getRelativeDate(-30),
      sundayAdSecondDate: getRelativeDate(-26),
      jobOrderStartDate: getRelativeDate(-29),
      jobOrderEndDate: getRelativeDate(-26), // Last recruitment ended 26 days ago
      noticeOfFilingStartDate: getRelativeDate(-29),
      noticeOfFilingEndDate: getRelativeDate(-26),
      pwdExpirationDate: getRelativeDate(90), // PWD expires in 90 days
    });

    renderWithProviders(<WindowsDisplay caseData={mockCase} />);

    // Window opens 30 days after job order end = in ~4 days
    expect(screen.getByText("Opening Soon")).toBeInTheDocument();
    // Should show hero number for days until open (may vary by +-1 due to timezone)
    expect(screen.getByText(/^[34]$/)).toBeInTheDocument();
    expect(screen.getByText("until window opens")).toBeInTheDocument();
  });

  it("shows CLOSING_SOON when within 14 days of window closing", () => {
    const mockCase = createMockCaseData({
      sundayAdFirstDate: getRelativeDate(-60),
      sundayAdSecondDate: getRelativeDate(-53),
      jobOrderStartDate: getRelativeDate(-55),
      jobOrderEndDate: getRelativeDate(-40),
      noticeOfFilingStartDate: getRelativeDate(-58),
      noticeOfFilingEndDate: getRelativeDate(-44),
      pwdExpirationDate: getRelativeDate(10), // PWD expires in 10 days
    });

    renderWithProviders(<WindowsDisplay caseData={mockCase} />);

    expect(screen.getByText("Closing Soon")).toBeInTheDocument();
    // Should show days remaining (may vary by +-1 due to timezone)
    expect(screen.getByText(/^1[01]$/)).toBeInTheDocument();
    expect(screen.getByText("left to file")).toBeInTheDocument();
  });

  it("shows CLOSED when past PWD expiration", () => {
    const mockCase = createMockCaseData({
      sundayAdFirstDate: getRelativeDate(-60),  // Recent enough that 180-day limit is far out
      sundayAdSecondDate: getRelativeDate(-53),
      jobOrderStartDate: getRelativeDate(-58),
      jobOrderEndDate: getRelativeDate(-50),     // Filing opens -50+30 = -20 (already open)
      noticeOfFilingStartDate: getRelativeDate(-58),
      noticeOfFilingEndDate: getRelativeDate(-52),
      pwdExpirationDate: getRelativeDate(-10),   // PWD expired 10 days ago → close date
    });

    renderWithProviders(<WindowsDisplay caseData={mockCase} />);

    expect(screen.getByText("Closed")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("since window closed")).toBeInTheDocument();
  });

  it("uses earlier of PWD expiration or 180-day limit as close date", () => {
    // Test case where 180 days from first recruitment is earlier than PWD expiration
    const mockCase = createMockCaseData({
      sundayAdFirstDate: getRelativeDate(-170), // 180 days ends in 10 days
      sundayAdSecondDate: getRelativeDate(-163),
      jobOrderStartDate: getRelativeDate(-168),
      jobOrderEndDate: getRelativeDate(-145),
      noticeOfFilingStartDate: getRelativeDate(-168),
      noticeOfFilingEndDate: getRelativeDate(-155),
      pwdExpirationDate: getRelativeDate(60), // PWD expires in 60 days
    });

    renderWithProviders(<WindowsDisplay caseData={mockCase} />);

    // Close date should be 180 days from first recruitment (10 days from now)
    expect(screen.getByText("Closing Soon")).toBeInTheDocument();
  });

  it("renders filing window card with correct title", () => {
    const mockCase = createMockCaseData({
      sundayAdFirstDate: getRelativeDate(-60),
      sundayAdSecondDate: getRelativeDate(-53),
      jobOrderStartDate: getRelativeDate(-55),
      jobOrderEndDate: getRelativeDate(-40),
      noticeOfFilingStartDate: getRelativeDate(-58),
      noticeOfFilingEndDate: getRelativeDate(-44),
      pwdExpirationDate: getRelativeDate(60),
    });

    renderWithProviders(<WindowsDisplay caseData={mockCase} />);

    // Redesigned card uses "ETA 9089 Filing" as title
    expect(screen.getByText("ETA 9089 Filing")).toBeInTheDocument();
  });
});

// ============================================================================
// UI/UX TESTS
// ============================================================================

describe("WindowsDisplay - UI/UX", () => {
  it("renders two cards with correct titles", () => {
    const mockCase = createMockCaseData({
      sundayAdFirstDate: getRelativeDate(-30),
      sundayAdSecondDate: getRelativeDate(-23),
      jobOrderEndDate: getRelativeDate(-20),
      pwdExpirationDate: getRelativeDate(90),
    });

    renderWithProviders(<WindowsDisplay caseData={mockCase} />);

    expect(screen.getByText("Recruitment Window")).toBeInTheDocument();
    expect(screen.getByText("ETA 9089 Filing")).toBeInTheDocument();
  });

  it("applies grid layout with two columns on larger screens", () => {
    const mockCase = createMockCaseData({
      sundayAdFirstDate: getRelativeDate(-30),
    });

    const { container } = renderWithProviders(
      <WindowsDisplay caseData={mockCase} />
    );

    const grid = container.firstChild;
    expect(grid).toHaveClass("grid");
    expect(grid).toHaveClass("sm:grid-cols-2");
  });

  it("applies custom className when provided", () => {
    const mockCase = createMockCaseData({});

    const { container } = renderWithProviders(
      <WindowsDisplay caseData={mockCase} className="custom-class" />
    );

    expect(container.firstChild).toHaveClass("custom-class");
  });

  it("cards have neobrutalist styling with hard shadows", () => {
    const mockCase = createMockCaseData({
      sundayAdFirstDate: getRelativeDate(-30),
    });

    const { container } = renderWithProviders(
      <WindowsDisplay caseData={mockCase} />
    );

    const cards = container.querySelectorAll(".shadow-hard-sm");
    expect(cards.length).toBe(2);
  });

  it("cards have hover effects", () => {
    const mockCase = createMockCaseData({
      sundayAdFirstDate: getRelativeDate(-30),
    });

    const { container } = renderWithProviders(
      <WindowsDisplay caseData={mockCase} />
    );

    const cards = container.querySelectorAll(".hover\\:shadow-hard");
    expect(cards.length).toBe(2);
  });
});

// ============================================================================
// STATUS CHIP COLOR TESTS
// ============================================================================

describe("WindowsDisplay - Status Chip Colors", () => {
  it("ACTIVE status has emerald green chip styling", () => {
    const mockCase = createMockCaseData({
      sundayAdFirstDate: getRelativeDate(-30),
    });

    const { container } = renderWithProviders(
      <WindowsDisplay caseData={mockCase} />
    );

    // Redesigned component uses bg-emerald-100 for ACTIVE
    const activeBadge = container.querySelector(".bg-emerald-100");
    expect(activeBadge).toBeInTheDocument();
  });

  it("EXPIRED status has red chip styling", () => {
    const mockCase = createMockCaseData({
      sundayAdFirstDate: getRelativeDate(-200),
    });

    const { container } = renderWithProviders(
      <WindowsDisplay caseData={mockCase} />
    );

    const expiredBadge = container.querySelector(".bg-red-100");
    expect(expiredBadge).toBeInTheDocument();
  });

  it("NOT_STARTED status has muted chip styling", () => {
    const mockCase = createMockCaseData({});

    const { container } = renderWithProviders(
      <WindowsDisplay caseData={mockCase} />
    );

    // Redesigned component uses bg-muted for NOT_STARTED
    const mutedBadge = container.querySelector(".bg-muted");
    expect(mutedBadge).toBeInTheDocument();
  });

  it("OPENING_SOON status has amber chip styling", () => {
    const mockCase = createMockCaseData({
      sundayAdFirstDate: getRelativeDate(-30),
      sundayAdSecondDate: getRelativeDate(-26),
      jobOrderStartDate: getRelativeDate(-29),
      jobOrderEndDate: getRelativeDate(-26),
      noticeOfFilingStartDate: getRelativeDate(-29),
      noticeOfFilingEndDate: getRelativeDate(-26),
      pwdExpirationDate: getRelativeDate(90),
    });

    const { container } = renderWithProviders(
      <WindowsDisplay caseData={mockCase} />
    );

    // Redesigned component uses bg-amber-100 for OPENING_SOON
    const amberBadge = container.querySelector(".bg-amber-100");
    expect(amberBadge).toBeInTheDocument();
  });

  it("CLOSING_SOON status has orange chip styling", () => {
    const mockCase = createMockCaseData({
      sundayAdFirstDate: getRelativeDate(-60),
      sundayAdSecondDate: getRelativeDate(-53),
      jobOrderStartDate: getRelativeDate(-55),
      jobOrderEndDate: getRelativeDate(-40),
      noticeOfFilingStartDate: getRelativeDate(-58),
      noticeOfFilingEndDate: getRelativeDate(-44),
      pwdExpirationDate: getRelativeDate(10),
    });

    const { container } = renderWithProviders(
      <WindowsDisplay caseData={mockCase} />
    );

    const orangeBadge = container.querySelector(".bg-orange-100");
    expect(orangeBadge).toBeInTheDocument();
  });

  it("FILED status has blue chip styling", () => {
    const mockCase = createMockCaseData({
      sundayAdFirstDate: getRelativeDate(-60),
      sundayAdSecondDate: getRelativeDate(-53),
      jobOrderEndDate: getRelativeDate(-40),
      pwdExpirationDate: getRelativeDate(60),
      eta9089FilingDate: getRelativeDate(-10),
    });

    const { container } = renderWithProviders(
      <WindowsDisplay caseData={mockCase} />
    );

    const blueBadge = container.querySelector(".bg-blue-100");
    expect(blueBadge).toBeInTheDocument();
  });
});

// ============================================================================
// CARD STRUCTURE TESTS
// ============================================================================

describe("WindowsDisplay - Card Structure", () => {
  it("renders accent strip at top of each card", () => {
    const mockCase = createMockCaseData({
      sundayAdFirstDate: getRelativeDate(-30),
    });

    const { container } = renderWithProviders(
      <WindowsDisplay caseData={mockCase} />
    );

    // Each card has a 3px accent strip div
    const accentStrips = container.querySelectorAll(".h-\\[3px\\]");
    expect(accentStrips.length).toBe(2);
  });

  it("renders status chips with uppercase tracking", () => {
    const mockCase = createMockCaseData({
      sundayAdFirstDate: getRelativeDate(-30),
    });

    const { container } = renderWithProviders(
      <WindowsDisplay caseData={mockCase} />
    );

    // Status chips use font-semibold uppercase tracking-wider
    const chips = container.querySelectorAll(".font-semibold.uppercase.tracking-wider");
    expect(chips.length).toBe(2);
  });
});

// ============================================================================
// EDGE CASE TESTS
// ============================================================================

describe("WindowsDisplay - Edge Cases", () => {
  it("handles case with only job order dates (no Sunday ads)", () => {
    const mockCase = createMockCaseData({
      jobOrderStartDate: getRelativeDate(-40),
      jobOrderEndDate: getRelativeDate(-10),
      pwdExpirationDate: getRelativeDate(90),
    });

    renderWithProviders(<WindowsDisplay caseData={mockCase} />);

    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Recruitment Window")).toBeInTheDocument();
  });

  it("handles case with only Sunday ad dates (no job order)", () => {
    const mockCase = createMockCaseData({
      sundayAdFirstDate: getRelativeDate(-40),
      sundayAdSecondDate: getRelativeDate(-33),
      pwdExpirationDate: getRelativeDate(90),
    });

    renderWithProviders(<WindowsDisplay caseData={mockCase} />);

    expect(screen.getByText("Active")).toBeInTheDocument();
    // Filing window should calculate from sundayAdSecondDate
    expect(screen.getByText("ETA 9089 Filing")).toBeInTheDocument();
  });

  it("shows hero label text when no dates exist", () => {
    const mockCase = createMockCaseData({});

    renderWithProviders(<WindowsDisplay caseData={mockCase} />);

    // Recruitment card shows "No activities yet"
    expect(screen.getByText("No activities yet")).toBeInTheDocument();
    // Filing card shows "Awaiting recruitment"
    expect(screen.getByText("Awaiting recruitment")).toBeInTheDocument();
  });

  it("handles filing window with no PWD expiration but has 180-day limit", () => {
    const mockCase = createMockCaseData({
      sundayAdFirstDate: getRelativeDate(-60),
      sundayAdSecondDate: getRelativeDate(-53),
      jobOrderStartDate: getRelativeDate(-55),
      jobOrderEndDate: getRelativeDate(-40),
      noticeOfFilingStartDate: getRelativeDate(-58),
      noticeOfFilingEndDate: getRelativeDate(-44),
      // No pwdExpirationDate - will use 180-day limit
    });

    renderWithProviders(<WindowsDisplay caseData={mockCase} />);

    // Should still calculate filing window using 180-day limit
    expect(screen.getByText("ETA 9089 Filing")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
  });
});

// ============================================================================
// PROGRESS BAR TESTS
// ============================================================================

describe("WindowsDisplay - Progress Bar", () => {
  it("shows progress bar with short date labels for active recruitment", () => {
    const startDate = getRelativeDate(-30);
    const mockCase = createMockCaseData({
      sundayAdFirstDate: startDate,
    });

    const { container } = renderWithProviders(
      <WindowsDisplay caseData={mockCase} />
    );

    // Progress bar should exist (h-1.5 bar)
    const progressBars = container.querySelectorAll(".h-1\\.5");
    expect(progressBars.length).toBeGreaterThanOrEqual(1);

    // Short date labels should be in font-mono style
    const dateLabels = container.querySelectorAll(".font-mono");
    expect(dateLabels.length).toBeGreaterThanOrEqual(2);
  });

  it("shows full progress bar for terminal states (completed/expired)", () => {
    const mockCase = createMockCaseData({
      sundayAdFirstDate: getRelativeDate(-200),
    });

    const { container } = renderWithProviders(
      <WindowsDisplay caseData={mockCase} />
    );

    // For expired/terminal, progress fill should be 100% with opacity 0.5
    const progressFill = container.querySelector("[style*='width: 100%']");
    expect(progressFill).toBeInTheDocument();
  });
});

// ============================================================================
// RESPONSIVENESS TESTS
// ============================================================================

describe("WindowsDisplay - Responsiveness", () => {
  it("uses single column on mobile (grid-cols-1)", () => {
    const mockCase = createMockCaseData({});

    const { container } = renderWithProviders(
      <WindowsDisplay caseData={mockCase} />
    );

    const grid = container.firstChild;
    expect(grid).toHaveClass("grid-cols-1");
  });

  it("uses two columns on sm+ screens (sm:grid-cols-2)", () => {
    const mockCase = createMockCaseData({});

    const { container } = renderWithProviders(
      <WindowsDisplay caseData={mockCase} />
    );

    const grid = container.firstChild;
    expect(grid).toHaveClass("sm:grid-cols-2");
  });

  it("has consistent gap between cards", () => {
    const mockCase = createMockCaseData({});

    const { container } = renderWithProviders(
      <WindowsDisplay caseData={mockCase} />
    );

    const grid = container.firstChild;
    expect(grid).toHaveClass("gap-4");
  });
});
