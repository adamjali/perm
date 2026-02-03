/**
 * UpcomingDeadlineItem Component Tests
 *
 * Tests countdown formatting, content display, and urgency-level test IDs.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import UpcomingDeadlineItem from "../UpcomingDeadlineItem";
import type { DeadlineItem } from "../../../../convex/lib/dashboardTypes";

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

describe("UpcomingDeadlineItem", () => {
  it.each([
    [0, "Today"],
    [1, "1 day"],
    [5, "5 days"],
    [-3, "Overdue"],
  ])("displays correct countdown for daysUntil=%i → %s", (daysUntil, expected) => {
    render(<UpcomingDeadlineItem deadline={createMockDeadline({ daysUntil })} />);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it.each([
    [7, "urgent-deadline"],
    [8, "warning-deadline"],
    [14, "warning-deadline"],
    [15, "deadline"],
    [30, "deadline"],
  ])("applies correct urgency testid for daysUntil=%i → %s", (daysUntil, testId) => {
    render(<UpcomingDeadlineItem deadline={createMockDeadline({ daysUntil })} />);
    expect(screen.getByTestId(testId)).toBeInTheDocument();
  });

  it.each([
    ["2024-12-28", "Dec 28"],
    ["2024-01-05", "Jan 5"],
    ["2025-01-01", "Jan 1"],
  ])("formats date %s as %s", (dueDate, expected) => {
    render(<UpcomingDeadlineItem deadline={createMockDeadline({ dueDate })} />);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it("displays employer name, label, stage badge, and links to case", () => {
    const deadline = createMockDeadline({
      employerName: "Acme Corp",
      label: "PWD Expiration",
      caseStatus: "pwd",
      caseId: "case-123" as unknown as DeadlineItem["caseId"],
    });
    render(<UpcomingDeadlineItem deadline={deadline} />);

    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("PWD Expiration")).toBeInTheDocument();
    expect(document.querySelector('[data-status="pwd"]')).toBeInTheDocument();
    expect(screen.getByTestId("deadline-item")).toHaveAttribute("href", "/cases/case-123");
  });
});
