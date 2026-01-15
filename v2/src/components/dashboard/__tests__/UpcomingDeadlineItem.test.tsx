/**
 * UpcomingDeadlineItem Component Tests
 *
 * Tests for deadline item display including:
 * - Countdown formatting (Today, 1 day, X days)
 * - Urgency styling (urgent ≤7 days, warning 8-14 days, normal >14 days)
 * - Date formatting
 * - Accessibility attributes
 *
 * @see v2/docs/DESIGN_SYSTEM.md
 * @see perm_flow.md
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import UpcomingDeadlineItem from "../UpcomingDeadlineItem";
import type { DeadlineItem } from "../../../../convex/lib/dashboardTypes";

// ============================================================================
// TEST FIXTURES
// ============================================================================

/**
 * Create a mock deadline item for testing.
 * Uses type assertion to bypass Convex brand symbol.
 */
function createMockDeadline(overrides: Partial<DeadlineItem> = {}): DeadlineItem {
  return {
    caseId: "mock-case-id",
    caseNumber: "PERM-2024-001",
    employerName: "Test Company",
    beneficiaryName: "John Doe",
    type: "pwd_expiration",
    label: "PWD Expiration",
    dueDate: "2024-12-28",
    daysUntil: 5,
    urgency: "thisWeek",
    caseStatus: "pwd",
    progressStatus: "working",
    ...overrides,
  } as unknown as DeadlineItem;
}

// ============================================================================
// COUNTDOWN FORMATTING TESTS
// ============================================================================

describe("UpcomingDeadlineItem - Countdown Formatting", () => {
  it("displays 'Today' for daysUntil = 0", () => {
    const deadline = createMockDeadline({ daysUntil: 0 });
    render(<UpcomingDeadlineItem deadline={deadline} />);

    expect(screen.getByText("Today")).toBeInTheDocument();
  });

  it("displays '1 day' for daysUntil = 1 (singular)", () => {
    const deadline = createMockDeadline({ daysUntil: 1 });
    render(<UpcomingDeadlineItem deadline={deadline} />);

    expect(screen.getByText("1 day")).toBeInTheDocument();
  });

  it("displays 'X days' for daysUntil > 1 (plural)", () => {
    const deadline = createMockDeadline({ daysUntil: 5 });
    render(<UpcomingDeadlineItem deadline={deadline} />);

    expect(screen.getByText("5 days")).toBeInTheDocument();
  });

  it("displays 'Overdue' for negative daysUntil", () => {
    const deadline = createMockDeadline({ daysUntil: -3 });
    render(<UpcomingDeadlineItem deadline={deadline} />);

    expect(screen.getByText("Overdue")).toBeInTheDocument();
  });
});

// ============================================================================
// URGENCY STYLING TESTS
// ============================================================================

describe("UpcomingDeadlineItem - Urgency Styling", () => {
  it("applies urgent styling for daysUntil ≤ 7 days", () => {
    const deadline = createMockDeadline({ daysUntil: 7 });
    render(<UpcomingDeadlineItem deadline={deadline} />);

    const countdownElement = screen.getByTestId("urgent-deadline");
    expect(countdownElement).toBeInTheDocument();
    expect(countdownElement.className).toMatch(/text-red/);
  });

  it("applies warning styling for daysUntil 8-14 days", () => {
    const deadline = createMockDeadline({ daysUntil: 10 });
    render(<UpcomingDeadlineItem deadline={deadline} />);

    const countdownElement = screen.getByTestId("warning-deadline");
    expect(countdownElement).toBeInTheDocument();
    expect(countdownElement.className).toMatch(/text-orange/);
  });

  it("applies normal styling for daysUntil > 14 days", () => {
    const deadline = createMockDeadline({ daysUntil: 30 });
    render(<UpcomingDeadlineItem deadline={deadline} />);

    const countdownElement = screen.getByTestId("deadline");
    expect(countdownElement).toBeInTheDocument();
    expect(countdownElement.className).toMatch(/text-muted/);
  });

  it("edge case: 8 days is warning (boundary)", () => {
    const deadline = createMockDeadline({ daysUntil: 8 });
    render(<UpcomingDeadlineItem deadline={deadline} />);

    expect(screen.getByTestId("warning-deadline")).toBeInTheDocument();
  });

  it("edge case: 14 days is warning (boundary)", () => {
    const deadline = createMockDeadline({ daysUntil: 14 });
    render(<UpcomingDeadlineItem deadline={deadline} />);

    expect(screen.getByTestId("warning-deadline")).toBeInTheDocument();
  });

  it("edge case: 15 days is normal (boundary)", () => {
    const deadline = createMockDeadline({ daysUntil: 15 });
    render(<UpcomingDeadlineItem deadline={deadline} />);

    expect(screen.getByTestId("deadline")).toBeInTheDocument();
  });
});

// ============================================================================
// DATE FORMATTING TESTS
// ============================================================================

describe("UpcomingDeadlineItem - Date Formatting", () => {
  it("formats date as 'Mon D' (e.g., Dec 28)", () => {
    const deadline = createMockDeadline({ dueDate: "2024-12-28" });
    render(<UpcomingDeadlineItem deadline={deadline} />);

    expect(screen.getByText("Dec 28")).toBeInTheDocument();
  });

  it("handles single-digit day correctly", () => {
    const deadline = createMockDeadline({ dueDate: "2024-01-05" });
    render(<UpcomingDeadlineItem deadline={deadline} />);

    expect(screen.getByText("Jan 5")).toBeInTheDocument();
  });

  it("handles year boundaries correctly", () => {
    const deadline = createMockDeadline({ dueDate: "2025-01-01" });
    render(<UpcomingDeadlineItem deadline={deadline} />);

    expect(screen.getByText("Jan 1")).toBeInTheDocument();
  });
});

// ============================================================================
// CONTENT & STRUCTURE TESTS
// ============================================================================

describe("UpcomingDeadlineItem - Content Display", () => {
  it("displays employer name", () => {
    const deadline = createMockDeadline({ employerName: "Acme Corp" });
    render(<UpcomingDeadlineItem deadline={deadline} />);

    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
  });

  it("displays deadline label", () => {
    const deadline = createMockDeadline({ label: "PWD Expiration" });
    render(<UpcomingDeadlineItem deadline={deadline} />);

    expect(screen.getByText("PWD Expiration")).toBeInTheDocument();
  });

  it("includes case stage badge", () => {
    const deadline = createMockDeadline({ caseStatus: "pwd" });
    render(<UpcomingDeadlineItem deadline={deadline} />);

    // Badge should be present with data-status attribute
    const badge = document.querySelector('[data-status="pwd"]');
    expect(badge).toBeInTheDocument();
  });

  it("links to case detail page", () => {
    const deadline = createMockDeadline({ caseId: "case-123" as unknown as DeadlineItem["caseId"] });
    render(<UpcomingDeadlineItem deadline={deadline} />);

    const link = screen.getByTestId("deadline-item");
    expect(link).toHaveAttribute("href", "/cases/case-123");
  });
});

// ============================================================================
// ACCESSIBILITY TESTS
// ============================================================================

describe("UpcomingDeadlineItem - Accessibility", () => {
  it("has deadline-item testid on the link", () => {
    const deadline = createMockDeadline({});
    render(<UpcomingDeadlineItem deadline={deadline} />);

    expect(screen.getByTestId("deadline-item")).toBeInTheDocument();
  });

  it("countdown has testid for urgency level", () => {
    // Urgent
    const urgentDeadline = createMockDeadline({ daysUntil: 5 });
    const { rerender } = render(<UpcomingDeadlineItem deadline={urgentDeadline} />);
    expect(screen.getByTestId("urgent-deadline")).toBeInTheDocument();

    // Warning
    const warningDeadline = createMockDeadline({ daysUntil: 10 });
    rerender(<UpcomingDeadlineItem deadline={warningDeadline} />);
    expect(screen.getByTestId("warning-deadline")).toBeInTheDocument();

    // Normal
    const normalDeadline = createMockDeadline({ daysUntil: 30 });
    rerender(<UpcomingDeadlineItem deadline={normalDeadline} />);
    expect(screen.getByTestId("deadline")).toBeInTheDocument();
  });
});
