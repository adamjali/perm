// @vitest-environment jsdom
/**
 * DeadlineItem Component Tests
 *
 * Tests essential behavior:
 * - Renders all required content (employer, label, countdown, date)
 * - Links to case detail page
 * - Shows hazard stripes when overdue
 * - Staggered animation delay based on index
 * - Quick-peek hover card on mouse enter/leave
 *
 * NOTE: Styling tests removed - CSS class assertions don't test behavior.
 * Visual styling verified via Storybook and manual QA.
 */

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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders employer name, deadline label, countdown, and due date", () => {
      renderWithProviders(<DeadlineItem deadline={defaultDeadline} index={0} />);

      expect(screen.getByText(defaultDeadline.employerName)).toBeInTheDocument();
      expect(screen.getByText(defaultDeadline.label)).toBeInTheDocument();
      expect(screen.getByText(`${defaultDeadline.daysUntil}d`)).toBeInTheDocument();
      expect(screen.getByText(defaultDeadline.dueDate)).toBeInTheDocument();
    });

    it("is a link to case detail page", () => {
      renderWithProviders(<DeadlineItem deadline={defaultDeadline} index={0} />);

      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("href", `/cases/${defaultDeadline.caseId}`);
    });
  });

  describe("overdue styling", () => {
    it("shows hazard stripes when overdue", () => {
      const overdueDeadline = createOverdueDeadline();
      const { container } = renderWithProviders(
        <DeadlineItem deadline={overdueDeadline} index={0} />
      );

      const hazardStripes = container.querySelector(
        '[style*="repeating-linear-gradient"]'
      );
      expect(hazardStripes).toBeInTheDocument();
    });

    it("shows absolute days in past for overdue items", () => {
      const overdueDeadline = createOverdueDeadline({ daysUntil: -5 });
      renderWithProviders(<DeadlineItem deadline={overdueDeadline} index={0} />);

      expect(screen.getByText("5d ago")).toBeInTheDocument();
    });

    it("does NOT show hazard stripes when not overdue", () => {
      const thisWeekDeadline = createThisWeekDeadline();
      const { container } = renderWithProviders(
        <DeadlineItem deadline={thisWeekDeadline} index={0} />
      );

      const hazardStripes = container.querySelector(
        '[style*="repeating-linear-gradient"]'
      );
      expect(hazardStripes).not.toBeInTheDocument();
    });
  });

  describe("staggered animation", () => {
    it("has animation delay based on index", () => {
      const { container } = renderWithProviders(
        <DeadlineItem deadline={defaultDeadline} index={2} />
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.animationDelay).toBe("100ms"); // 2 * 50ms
    });
  });

  describe("quick-peek hover card", () => {
    beforeEach(() => {
      // Mock matchMedia to enable hover capability detection
      // This needs to be set before component mounts
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
    });

    it("shows hover card on mouse enter", async () => {
      const { container } = renderWithProviders(
        <DeadlineItem deadline={defaultDeadline} index={0} />
      );

      const wrapper = container.firstChild as Element;

      // Wait for useEffect to run and detect hover capability, then trigger hover
      await vi.waitFor(() => {
        fireEvent.mouseEnter(wrapper);
        // Hover card appears via portal after hover capability is detected
        expect(screen.queryByText("Case #")).toBeInTheDocument();
      });

      expect(screen.getByText("Position")).toBeInTheDocument();
      expect(screen.getByText("Due")).toBeInTheDocument();
    });

    it("hides hover card on mouse leave", async () => {
      const { container } = renderWithProviders(
        <DeadlineItem deadline={defaultDeadline} index={0} />
      );

      const wrapper = container.firstChild as Element;

      // Wait for hover detection then test show/hide
      await vi.waitFor(() => {
        fireEvent.mouseEnter(wrapper);
        expect(screen.queryByText("Case #")).toBeInTheDocument();
      });

      fireEvent.mouseLeave(wrapper);
      expect(screen.queryByText("Case #")).not.toBeInTheDocument();
    });

    it("hover card shows case details", async () => {
      const { container } = renderWithProviders(
        <DeadlineItem deadline={defaultDeadline} index={0} />
      );

      const wrapper = container.firstChild as Element;

      await vi.waitFor(() => {
        fireEvent.mouseEnter(wrapper);
        expect(screen.queryByText("Case #")).toBeInTheDocument();
      });

      expect(
        screen.getAllByText(defaultDeadline.beneficiaryName).length
      ).toBeGreaterThanOrEqual(1);
      expect(
        screen.getAllByText(defaultDeadline.dueDate).length
      ).toBeGreaterThanOrEqual(1);
    });
  });
});
