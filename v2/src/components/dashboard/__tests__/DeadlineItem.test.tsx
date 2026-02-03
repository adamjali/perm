// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import {
  createMockDeadlineItem,
  createOverdueDeadline,
  createThisWeekDeadline,
} from "../../../../test-utils/deadline-fixtures";
import DeadlineItem from "../DeadlineItem";

describe("DeadlineItem", () => {
  const defaultDeadline = createMockDeadlineItem();
  beforeEach(() => vi.clearAllMocks());

  it("renders employer, label, countdown, date, and links to case", () => {
    renderWithProviders(<DeadlineItem deadline={defaultDeadline} index={0} />);

    expect(screen.getByText(defaultDeadline.employerName)).toBeInTheDocument();
    expect(screen.getByText(defaultDeadline.label)).toBeInTheDocument();
    expect(screen.getByText(`${defaultDeadline.daysUntil}d`)).toBeInTheDocument();
    expect(screen.getByText(defaultDeadline.dueDate)).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", `/cases/${defaultDeadline.caseId}`);
  });

  it("shows hazard stripes and absolute days for overdue items", () => {
    const overdueDeadline = createOverdueDeadline({ daysUntil: -5 });
    const { container } = renderWithProviders(
      <DeadlineItem deadline={overdueDeadline} index={0} />
    );

    expect(container.querySelector('[style*="repeating-linear-gradient"]')).toBeInTheDocument();
    expect(screen.getByText("5d ago")).toBeInTheDocument();
  });

  it("does NOT show hazard stripes for non-overdue items", () => {
    const { container } = renderWithProviders(
      <DeadlineItem deadline={createThisWeekDeadline()} index={0} />
    );
    expect(container.querySelector('[style*="repeating-linear-gradient"]')).not.toBeInTheDocument();
  });

  it("shows hover card with case details on mouse enter/leave", async () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === "(hover: hover)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    const { container } = renderWithProviders(
      <DeadlineItem deadline={defaultDeadline} index={0} />
    );
    const wrapper = container.firstChild as Element;

    // Show on hover
    await vi.waitFor(() => {
      fireEvent.mouseEnter(wrapper);
      expect(screen.queryByText("Case #")).toBeInTheDocument();
    });
    expect(screen.getByText("Position")).toBeInTheDocument();
    expect(screen.getByText("Due")).toBeInTheDocument();

    // Hide on leave
    fireEvent.mouseLeave(wrapper);
    expect(screen.queryByText("Case #")).not.toBeInTheDocument();
  });
});
