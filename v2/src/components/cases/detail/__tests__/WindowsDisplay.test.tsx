// @vitest-environment jsdom
/**
 * WindowsDisplay Component Tests
 *
 * Tests for the recruitment and filing window display component.
 *
 * Requirements:
 * 1. Recruitment Window Card
 *    - Shows ACTIVE status when within 180-day window from first recruitment
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
 *    - Color-coded status badges
 *    - Days remaining/elapsed helper text
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../../../test-utils/render-utils";
import { WindowsDisplay } from "../WindowsDisplay";
import type { CaseWithDates } from "@/lib/timeline";

// ============================================================================
// MOCK SETUP
// ============================================================================

// Mock current date for consistent testing
const MOCK_TODAY = new Date("2024-06-15");

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
  return date.toISOString().split("T")[0] as string;
}

// ============================================================================
// RECRUITMENT WINDOW TESTS
// ============================================================================

describe("WindowsDisplay - Recruitment Window", () => {
  it("shows NOT_STARTED when no recruitment dates exist", () => {
    const mockCase = createMockCaseData({});

    renderWithProviders(<WindowsDisplay caseData={mockCase} />);

    // Should show Not Started status
    expect(screen.getByText("Not Started")).toBeInTheDocument();
    expect(screen.getByText("No recruitment activities recorded")).toBeInTheDocument();
  });

  it("shows ACTIVE status when within 180-day window from first recruitment", () => {
    const mockCase = createMockCaseData({
      sundayAdFirstDate: getRelativeDate(-30), // 30 days ago
      jobOrderStartDate: getRelativeDate(-25), // 25 days ago
    });

    renderWithProviders(<WindowsDisplay caseData={mockCase} />);

    // Should show Active status
    expect(screen.getByText("Active")).toBeInTheDocument();
    // Should show days remaining (approximately 180 - 30 = 150)
    expect(screen.getByText(/\d+ days remaining/)).toBeInTheDocument();
  });

  it("uses earliest recruitment date as start", () => {
    const mockCase = createMockCaseData({
      sundayAdFirstDate: getRelativeDate(-30), // 30 days ago (earliest)
      jobOrderStartDate: getRelativeDate(-20), // 20 days ago
    });

    renderWithProviders(<WindowsDisplay caseData={mockCase} />);

    // Start date should be 30 days ago
    const startDateStr = getRelativeDate(-30);
    const formattedDate = new Date(startDateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    expect(screen.getByText(formattedDate)).toBeInTheDocument();
  });

  it("shows EXPIRED status when past 180-day window", () => {
    const mockCase = createMockCaseData({
      sundayAdFirstDate: getRelativeDate(-200), // 200 days ago
    });

    renderWithProviders(<WindowsDisplay caseData={mockCase} />);

    // Should show Expired status
    expect(screen.getByText("Expired")).toBeInTheDocument();
    // Should show days elapsed since expiration (approximately 200 - 180 = 20)
    expect(screen.getByText(/Expired \d+ days ago/)).toBeInTheDocument();
  });

  it("renders recruitment window card with correct labels", () => {
    const mockCase = createMockCaseData({
      sundayAdFirstDate: getRelativeDate(-30),
    });

    renderWithProviders(<WindowsDisplay caseData={mockCase} />);

    expect(screen.getByText("Recruitment Window")).toBeInTheDocument();
    expect(screen.getByText("Start:")).toBeInTheDocument();
    expect(screen.getByText("Expires:")).toBeInTheDocument();
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
    expect(screen.getByText("Complete recruitment to calculate window")).toBeInTheDocument();
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

    expect(screen.getByText("Filed")).toBeInTheDocument();
    expect(screen.getByText("ETA 9089 has been filed")).toBeInTheDocument();
  });

  it("shows OPEN status when within filing window", () => {
    const mockCase = createMockCaseData({
      sundayAdFirstDate: getRelativeDate(-60),
      sundayAdSecondDate: getRelativeDate(-53),
      jobOrderEndDate: getRelativeDate(-40), // Last recruitment ended 40 days ago
      pwdExpirationDate: getRelativeDate(60), // PWD expires in 60 days
      // No eta9089FilingDate - not filed yet
    });

    renderWithProviders(<WindowsDisplay caseData={mockCase} />);

    // Window opened 30 days after job order end = 10 days ago
    // Window closes in 60 days (PWD expiration)
    expect(screen.getByText("Open")).toBeInTheDocument();
  });

  it("shows OPENING_SOON when within 7 days of window opening", () => {
    const mockCase = createMockCaseData({
      sundayAdFirstDate: getRelativeDate(-30),
      sundayAdSecondDate: getRelativeDate(-26),
      jobOrderEndDate: getRelativeDate(-26), // Last recruitment ended 26 days ago
      pwdExpirationDate: getRelativeDate(90), // PWD expires in 90 days
    });

    renderWithProviders(<WindowsDisplay caseData={mockCase} />);

    // Window opens 30 days after job order end = in 4 days
    expect(screen.getByText("Opening Soon")).toBeInTheDocument();
    expect(screen.getByText(/Opens in \d+ days/)).toBeInTheDocument();
  });

  it("shows CLOSING_SOON when within 14 days of window closing", () => {
    const mockCase = createMockCaseData({
      sundayAdFirstDate: getRelativeDate(-60),
      sundayAdSecondDate: getRelativeDate(-53),
      jobOrderEndDate: getRelativeDate(-40),
      pwdExpirationDate: getRelativeDate(10), // PWD expires in 10 days
    });

    renderWithProviders(<WindowsDisplay caseData={mockCase} />);

    expect(screen.getByText("Closing Soon")).toBeInTheDocument();
    expect(screen.getByText(/Only \d+ days left to file!/)).toBeInTheDocument();
  });

  it("shows CLOSED when past PWD expiration", () => {
    const mockCase = createMockCaseData({
      sundayAdFirstDate: getRelativeDate(-200),
      sundayAdSecondDate: getRelativeDate(-193),
      jobOrderEndDate: getRelativeDate(-180),
      pwdExpirationDate: getRelativeDate(-10), // PWD expired 10 days ago
    });

    renderWithProviders(<WindowsDisplay caseData={mockCase} />);

    expect(screen.getByText("Closed")).toBeInTheDocument();
    expect(screen.getByText(/Closed \d+ days ago/)).toBeInTheDocument();
  });

  it("uses earlier of PWD expiration or 180-day limit as close date", () => {
    // Test case where 180 days from first recruitment is earlier than PWD expiration
    const mockCase = createMockCaseData({
      sundayAdFirstDate: getRelativeDate(-170), // 180 days ends in 10 days
      sundayAdSecondDate: getRelativeDate(-163),
      jobOrderEndDate: getRelativeDate(-145),
      pwdExpirationDate: getRelativeDate(60), // PWD expires in 60 days
    });

    renderWithProviders(<WindowsDisplay caseData={mockCase} />);

    // Close date should be 180 days from first recruitment (10 days from now)
    expect(screen.getByText("Closing Soon")).toBeInTheDocument();
  });

  it("renders filing window card with correct labels", () => {
    const mockCase = createMockCaseData({
      sundayAdFirstDate: getRelativeDate(-60),
      sundayAdSecondDate: getRelativeDate(-53),
      jobOrderEndDate: getRelativeDate(-40),
      pwdExpirationDate: getRelativeDate(60),
    });

    renderWithProviders(<WindowsDisplay caseData={mockCase} />);

    expect(screen.getByText("ETA 9089 Filing Window")).toBeInTheDocument();
    expect(screen.getByText("Opens:")).toBeInTheDocument();
    expect(screen.getByText("Closes:")).toBeInTheDocument();
  });
});

// ============================================================================
// UI/UX TESTS
// ============================================================================

describe("WindowsDisplay - UI/UX", () => {
  it("renders two cards", () => {
    const mockCase = createMockCaseData({
      sundayAdFirstDate: getRelativeDate(-30),
      sundayAdSecondDate: getRelativeDate(-23),
      jobOrderEndDate: getRelativeDate(-20),
      pwdExpirationDate: getRelativeDate(90),
    });

    renderWithProviders(<WindowsDisplay caseData={mockCase} />);

    expect(screen.getByText("Recruitment Window")).toBeInTheDocument();
    expect(screen.getByText("ETA 9089 Filing Window")).toBeInTheDocument();
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
// STATUS BADGE COLOR TESTS
// ============================================================================

describe("WindowsDisplay - Status Badge Colors", () => {
  it("ACTIVE status has green styling", () => {
    const mockCase = createMockCaseData({
      sundayAdFirstDate: getRelativeDate(-30),
    });

    const { container } = renderWithProviders(
      <WindowsDisplay caseData={mockCase} />
    );

    const activeBadge = container.querySelector(".bg-green-100");
    expect(activeBadge).toBeInTheDocument();
  });

  it("EXPIRED status has red styling", () => {
    const mockCase = createMockCaseData({
      sundayAdFirstDate: getRelativeDate(-200),
    });

    const { container } = renderWithProviders(
      <WindowsDisplay caseData={mockCase} />
    );

    const expiredBadge = container.querySelector(".bg-red-100");
    expect(expiredBadge).toBeInTheDocument();
  });

  it("NOT_STARTED status has gray styling", () => {
    const mockCase = createMockCaseData({});

    const { container } = renderWithProviders(
      <WindowsDisplay caseData={mockCase} />
    );

    const grayBadge = container.querySelector(".bg-gray-100");
    expect(grayBadge).toBeInTheDocument();
  });

  it("OPENING_SOON status has yellow styling", () => {
    const mockCase = createMockCaseData({
      sundayAdFirstDate: getRelativeDate(-30),
      sundayAdSecondDate: getRelativeDate(-26),
      jobOrderEndDate: getRelativeDate(-26),
      pwdExpirationDate: getRelativeDate(90),
    });

    const { container } = renderWithProviders(
      <WindowsDisplay caseData={mockCase} />
    );

    const yellowBadge = container.querySelector(".bg-yellow-100");
    expect(yellowBadge).toBeInTheDocument();
  });

  it("CLOSING_SOON status has orange styling", () => {
    const mockCase = createMockCaseData({
      sundayAdFirstDate: getRelativeDate(-60),
      sundayAdSecondDate: getRelativeDate(-53),
      jobOrderEndDate: getRelativeDate(-40),
      pwdExpirationDate: getRelativeDate(10),
    });

    const { container } = renderWithProviders(
      <WindowsDisplay caseData={mockCase} />
    );

    const orangeBadge = container.querySelector(".bg-orange-100");
    expect(orangeBadge).toBeInTheDocument();
  });

  it("FILED status has blue styling", () => {
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
// ICON TESTS
// ============================================================================

describe("WindowsDisplay - Icons", () => {
  it("renders Calendar icon for recruitment window", () => {
    const mockCase = createMockCaseData({
      sundayAdFirstDate: getRelativeDate(-30),
    });

    const { container } = renderWithProviders(
      <WindowsDisplay caseData={mockCase} />
    );

    // Calendar icon should be present (as SVG)
    const calendarIcons = container.querySelectorAll("svg");
    expect(calendarIcons.length).toBeGreaterThanOrEqual(2);
  });

  it("renders status icons in badges", () => {
    const mockCase = createMockCaseData({
      sundayAdFirstDate: getRelativeDate(-30),
    });

    const { container } = renderWithProviders(
      <WindowsDisplay caseData={mockCase} />
    );

    // Status badges should contain icons
    const badges = container.querySelectorAll(".inline-flex.items-center.gap-1");
    expect(badges.length).toBeGreaterThanOrEqual(2);

    badges.forEach((badge) => {
      const icon = badge.querySelector("svg");
      expect(icon).toBeInTheDocument();
    });
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
    expect(screen.getByText("ETA 9089 Filing Window")).toBeInTheDocument();
  });

  it("shows dash for missing dates", () => {
    const mockCase = createMockCaseData({});

    renderWithProviders(<WindowsDisplay caseData={mockCase} />);

    // Should show dashes for missing dates
    const dashes = screen.getAllByText("-");
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it("handles filing window with no PWD expiration but has 180-day limit", () => {
    const mockCase = createMockCaseData({
      sundayAdFirstDate: getRelativeDate(-60),
      sundayAdSecondDate: getRelativeDate(-53),
      jobOrderEndDate: getRelativeDate(-40),
      // No pwdExpirationDate - will use 180-day limit
    });

    renderWithProviders(<WindowsDisplay caseData={mockCase} />);

    // Should still calculate filing window using 180-day limit
    expect(screen.getByText("ETA 9089 Filing Window")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
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
