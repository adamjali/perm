// @vitest-environment jsdom
/**
 * UrgencyGroup Component Tests
 * Tests for v1-matching column layout (no collapse, always visible).
 *
 * Component Requirements:
 * - Renders group title and item count
 * - Renders all items (always visible, no collapse)
 * - Returns null when no items
 * - Overflow pattern: shows maxItems (default 5) initially
 * - Shows "+N more" button when items exceed maxItems
 * - Shows "Show less" button after expanding all
 * - Urgency-specific gradient backgrounds and colors
 * - Empty state when no items
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import {
  createManyDeadlinesGroup,
  createOverdueDeadline,
} from "../../../../test-utils/deadline-fixtures";
import type { Id } from "../../../../convex/_generated/dataModel";
import UrgencyGroup from "../UrgencyGroup";

describe("UrgencyGroup", () => {
  const overdueItems = [
    createOverdueDeadline({ caseId: "case_001" as Id<"cases">, caseNumber: "CASE-001" }),
    createOverdueDeadline({ caseId: "case_002" as Id<"cases">, caseNumber: "CASE-002" }),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // RENDERING TESTS
  // ============================================================================

  describe("rendering", () => {
    it("renders group title", () => {
      renderWithProviders(
        <UrgencyGroup
          title="Overdue"
          items={overdueItems}
          urgency="overdue"
        />
      );

      expect(screen.getByText("Overdue")).toBeInTheDocument();
    });

    it("renders item count", () => {
      renderWithProviders(
        <UrgencyGroup
          title="Overdue"
          items={overdueItems}
          urgency="overdue"
        />
      );

      expect(screen.getByText("2")).toBeInTheDocument();
    });

    it("renders all items immediately (always visible, no collapse)", () => {
      renderWithProviders(
        <UrgencyGroup
          title="Overdue"
          items={overdueItems}
          urgency="overdue"
        />
      );

      // V1 style: items are always visible (no defaultExpanded needed)
      // Both items should be visible
      const employers = screen.getAllByText("Tech Corp Inc");
      expect(employers.length).toBe(2);
    });

    it("shows empty state when no items", () => {
      renderWithProviders(
        <UrgencyGroup title="Overdue" items={[]} urgency="overdue" />
      );

      expect(screen.getByText(/no deadlines/i)).toBeInTheDocument();
    });
  });

  // ============================================================================
  // OVERFLOW PATTERN (+N MORE) TESTS
  // ============================================================================

  describe("overflow pattern (+N more)", () => {
    it("shows only maxItems initially", () => {
      const manyItems = createManyDeadlinesGroup(8, "overdue");
      renderWithProviders(
        <UrgencyGroup
          title="Overdue"
          items={manyItems}
          urgency="overdue"
          maxItems={5}
        />
      );

      // Should show 5 items (each has employer "Tech Corp Inc")
      const employers = screen.getAllByText("Tech Corp Inc");
      expect(employers.length).toBe(5);
    });

    it("shows +N more button when items exceed maxItems", () => {
      const manyItems = createManyDeadlinesGroup(8, "overdue");
      renderWithProviders(
        <UrgencyGroup
          title="Overdue"
          items={manyItems}
          urgency="overdue"
          maxItems={5}
        />
      );

      expect(screen.getByText("+3 more")).toBeInTheDocument();
    });

    it("shows all items when +N more clicked", async () => {
      const user = userEvent.setup();
      const manyItems = createManyDeadlinesGroup(8, "overdue");
      renderWithProviders(
        <UrgencyGroup
          title="Overdue"
          items={manyItems}
          urgency="overdue"
          maxItems={5}
        />
      );

      await user.click(screen.getByText("+3 more"));

      // All 8 items should now be visible
      const employers = screen.getAllByText("Tech Corp Inc");
      expect(employers.length).toBe(8);
    });

    it("shows Show less button after expanding", async () => {
      const user = userEvent.setup();
      const manyItems = createManyDeadlinesGroup(8, "overdue");
      renderWithProviders(
        <UrgencyGroup
          title="Overdue"
          items={manyItems}
          urgency="overdue"
          maxItems={5}
        />
      );

      await user.click(screen.getByText("+3 more"));

      expect(screen.getByText("Show less")).toBeInTheDocument();
    });

    it("does not show +N more when items <= maxItems", () => {
      const fewItems = createManyDeadlinesGroup(3, "overdue");
      renderWithProviders(
        <UrgencyGroup
          title="Overdue"
          items={fewItems}
          urgency="overdue"
          maxItems={5}
        />
      );

      expect(screen.queryByText(/more/)).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // URGENCY-SPECIFIC STYLING TESTS
  // ============================================================================

  describe("urgency-specific styling", () => {
    it("overdue group has red text color", () => {
      renderWithProviders(
        <UrgencyGroup title="Overdue" items={overdueItems} urgency="overdue" />
      );

      // Title should have red text color
      const title = screen.getByText("Overdue");
      const headerDiv = title.closest("div");
      expect(headerDiv).toHaveClass("text-red-600");
    });

    it("thisWeek group has orange text color", () => {
      renderWithProviders(
        <UrgencyGroup
          title="This Week"
          items={overdueItems}
          urgency="thisWeek"
        />
      );

      const title = screen.getByText("This Week");
      const headerDiv = title.closest("div");
      expect(headerDiv).toHaveClass("text-orange-600");
    });

    it("thisMonth group has amber text color", () => {
      renderWithProviders(
        <UrgencyGroup
          title="This Month"
          items={overdueItems}
          urgency="thisMonth"
        />
      );

      const title = screen.getByText("This Month");
      const headerDiv = title.closest("div");
      expect(headerDiv).toHaveClass("text-amber-600");
    });

    it("later group has emerald text color", () => {
      renderWithProviders(
        <UrgencyGroup title="Later" items={overdueItems} urgency="later" />
      );

      const title = screen.getByText("Later");
      const headerDiv = title.closest("div");
      expect(headerDiv).toHaveClass("text-emerald-600");
    });
  });

  // ============================================================================
  // COLUMN LAYOUT TESTS
  // ============================================================================

  describe("column layout (v1 style)", () => {
    it("has right border when not isLast", () => {
      const { container } = renderWithProviders(
        <UrgencyGroup
          title="Overdue"
          items={overdueItems}
          urgency="overdue"
          isLast={false}
        />
      );

      const group = container.firstChild as HTMLElement;
      expect(group).toHaveClass("border-r-2");
    });

    it("has no right border when isLast", () => {
      const { container } = renderWithProviders(
        <UrgencyGroup
          title="Later"
          items={overdueItems}
          urgency="later"
          isLast={true}
        />
      );

      const group = container.firstChild as HTMLElement;
      expect(group).not.toHaveClass("border-r-2");
    });

    it("has gradient background", () => {
      const { container } = renderWithProviders(
        <UrgencyGroup
          title="Overdue"
          items={overdueItems}
          urgency="overdue"
        />
      );

      const group = container.firstChild as HTMLElement;
      // V1 style gradient backgrounds
      expect(group).toHaveClass("bg-gradient-to-br");
    });
  });
});
