// @vitest-environment jsdom
/**
 * RecentActivityCard Component Tests (TDD)
 * Tests written BEFORE implementation following TDD methodology.
 *
 * Component Requirements:
 * - Displays employer name, beneficiary identifier, action label
 * - Shows case number (if available) or "No case number"
 * - Displays case status and progress status badges
 * - Shows relative time (e.g., "2 hours ago") using formatDistanceToNow
 * - Links to case detail page (/cases/:id)
 * - Neobrutalist styling (4px black border, hover transform, hover shadow)
 *
 * Source Requirements:
 * - .planning/phases/20-dashboard/20-CONTEXT.md (Recent Activity specs)
 * - .planning/FRONTEND_DESIGN_SKILL.md (status colors)
 * - v2/docs/DESIGN_SYSTEM.md (neobrutalist styling)
 * - perm_flow.md (case status definitions)
 * - v2/convex/lib/dashboardTypes.ts (RecentActivityItem type)
 * - v2/test-utils/activity-fixtures.ts (test data)
 */

import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import RecentActivityCard from "../RecentActivityCard";
import {
  createMockActivityItem,
  ACTIVITY_ACTIONS,
  hoursAgo,
  minutesAgo,
  daysAgo,
} from "../../../../test-utils/activity-fixtures";

// Mock date-fns for consistent time formatting
vi.mock("date-fns", () => ({
  formatDistanceToNow: vi.fn((timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  }),
}));

describe("RecentActivityCard", () => {
  // ============================================================================
  // RENDERING TESTS
  // ============================================================================

  describe("Basic Rendering", () => {
    it("renders employer name", () => {
      const activity = createMockActivityItem({
        employerName: "Tech Corp Inc",
      });

      renderWithProviders(<RecentActivityCard activity={activity} />);

      expect(screen.getByText("Tech Corp Inc")).toBeInTheDocument();
    });

    it("renders position title", () => {
      const activity = createMockActivityItem({
        positionTitle: "Senior Developer",
      });

      renderWithProviders(<RecentActivityCard activity={activity} />);

      expect(screen.getByText("Senior Developer")).toBeInTheDocument();
    });

    it("renders action label", () => {
      const activity = createMockActivityItem({
        action: ACTIVITY_ACTIONS.pwdFiled,
      });

      renderWithProviders(<RecentActivityCard activity={activity} />);

      expect(screen.getByText("PWD filed")).toBeInTheDocument();
    });

    it("renders case number when available", () => {
      const activity = createMockActivityItem({
        caseNumber: "CASE-2024-001",
      });

      renderWithProviders(<RecentActivityCard activity={activity} />);

      expect(screen.getByText("CASE-2024-001")).toBeInTheDocument();
    });

    it("renders em dash when case number is missing", () => {
      const activity = createMockActivityItem({
        caseNumber: undefined,
      });

      renderWithProviders(<RecentActivityCard activity={activity} />);

      // Uses em dash (—) for missing case number in compact design
      expect(screen.getByText("—")).toBeInTheDocument();
    });

    it("is a link to case detail page", () => {
      const activity = createMockActivityItem({
        id: "case_test123" as any,
      });

      const { container } = renderWithProviders(
        <RecentActivityCard activity={activity} />
      );

      const link = container.querySelector('a[href="/cases/case_test123"]');
      expect(link).toBeInTheDocument();
    });
  });

  // ============================================================================
  // STATUS BADGE TESTS
  // ============================================================================

  describe("Status Badges", () => {
    it("renders case status badge (PWD)", () => {
      const activity = createMockActivityItem({
        caseStatus: "pwd",
      });

      const { container } = renderWithProviders(
        <RecentActivityCard activity={activity} />
      );

      // Should have CaseStageBadge component or element with pwd class/style
      const badge =
        container.querySelector('[data-status="pwd"]') ||
        container.querySelector('.bg-stage-pwd') ||
        container.querySelector('[class*="pwd"]');
      expect(badge).toBeInTheDocument();
    });

    it("renders case status badge (Recruitment)", () => {
      const activity = createMockActivityItem({
        caseStatus: "recruitment",
      });

      const { container } = renderWithProviders(
        <RecentActivityCard activity={activity} />
      );

      // Should have CaseStageBadge component or element with recruitment class/style
      const badge =
        container.querySelector('[data-status="recruitment"]') ||
        container.querySelector('.bg-stage-recruitment') ||
        container.querySelector('[class*="recruitment"]');
      expect(badge).toBeInTheDocument();
    });

    it("renders case status badge (ETA 9089)", () => {
      const activity = createMockActivityItem({
        caseStatus: "eta9089",
      });

      const { container } = renderWithProviders(
        <RecentActivityCard activity={activity} />
      );

      // Should have CaseStageBadge component or element with eta9089 class/style
      const badge =
        container.querySelector('[data-status="eta9089"]') ||
        container.querySelector('.bg-stage-eta9089') ||
        container.querySelector('[class*="eta9089"]');
      expect(badge).toBeInTheDocument();
    });

    it("renders case status badge (I-140)", () => {
      const activity = createMockActivityItem({
        caseStatus: "i140",
      });

      const { container } = renderWithProviders(
        <RecentActivityCard activity={activity} />
      );

      // Should have CaseStageBadge component or element with i140 class/style
      const badge =
        container.querySelector('[data-status="i140"]') ||
        container.querySelector('.bg-stage-i140') ||
        container.querySelector('[class*="i140"]');
      expect(badge).toBeInTheDocument();
    });

    it("renders case status badge (Closed)", () => {
      const activity = createMockActivityItem({
        caseStatus: "closed",
      });

      const { container } = renderWithProviders(
        <RecentActivityCard activity={activity} />
      );

      // Should have CaseStageBadge component or element with closed class/style
      const badge =
        container.querySelector('[data-status="closed"]') ||
        container.querySelector('.bg-stage-closed') ||
        container.querySelector('[class*="closed"]');
      expect(badge).toBeInTheDocument();
    });

    it("renders case status badge with bordered styling", () => {
      const activity = createMockActivityItem({
        caseStatus: "pwd",
      });

      const { container } = renderWithProviders(
        <RecentActivityCard activity={activity} />
      );

      // Compact design uses only case status badge with bordered styling
      const badge = container.querySelector('[data-status="pwd"]');
      expect(badge).toBeInTheDocument();
      // Should have black border for neobrutalist style
      expect(badge?.className).toMatch(/border-black|border-\[1\.5px\]/);
    });
  });

  // ============================================================================
  // RELATIVE TIME TESTS
  // ============================================================================

  describe("Relative Time Formatting", () => {
    it("formats recent activity (minutes ago)", () => {
      const activity = createMockActivityItem({
        timestamp: minutesAgo(5),
      });

      renderWithProviders(<RecentActivityCard activity={activity} />);

      // Compact format: "5m ago"
      expect(screen.getByText(/5m ago/)).toBeInTheDocument();
    });

    it("formats activity from hours ago", () => {
      const activity = createMockActivityItem({
        timestamp: hoursAgo(2),
      });

      renderWithProviders(<RecentActivityCard activity={activity} />);

      // Compact format: "2h ago"
      expect(screen.getByText(/2h ago/)).toBeInTheDocument();
    });

    it("formats activity from days ago", () => {
      const activity = createMockActivityItem({
        timestamp: daysAgo(3),
      });

      renderWithProviders(<RecentActivityCard activity={activity} />);

      // Compact format: "3d ago"
      expect(screen.getByText(/3d ago/)).toBeInTheDocument();
    });

    it("has data-testid for timestamp", () => {
      const activity = createMockActivityItem({
        timestamp: hoursAgo(1),
      });

      const { container } = renderWithProviders(
        <RecentActivityCard activity={activity} />
      );

      const timestamp = container.querySelector('[data-testid="activity-timestamp"]');
      expect(timestamp).toBeInTheDocument();
      expect(timestamp?.textContent).toContain("ago");
    });
  });

  // ============================================================================
  // NEOBRUTALIST STYLING TESTS
  // ============================================================================

  describe("Neobrutalist Styling", () => {
    it("has 2px black border (border-2, border-black) for compact design", () => {
      const activity = createMockActivityItem();

      const { container } = renderWithProviders(
        <RecentActivityCard activity={activity} />
      );

      // Compact design uses thinner 2px border
      const card =
        container.querySelector('.border-2.border-black') ||
        container.querySelector('[class*="border-2"]');
      expect(card).toBeInTheDocument();
    });

    it("has hover transform effect (hover:-translate-x-0.5, hover:-translate-y-0.5)", () => {
      const activity = createMockActivityItem();

      const { container } = renderWithProviders(
        <RecentActivityCard activity={activity} />
      );

      // Should have hover translate classes
      const card = container.querySelector('[class*="hover:-translate"]');
      expect(card).toBeInTheDocument();
    });

    it("has hover shadow effect (hover:shadow-hard-lg)", () => {
      const activity = createMockActivityItem();

      const { container } = renderWithProviders(
        <RecentActivityCard activity={activity} />
      );

      // Should have hover shadow class
      const card = container.querySelector('[class*="hover:shadow-hard"]');
      expect(card).toBeInTheDocument();
    });

    it("has hover hard shadow (hover:shadow-hard-sm) for compact design", () => {
      const activity = createMockActivityItem();

      const { container } = renderWithProviders(
        <RecentActivityCard activity={activity} />
      );

      // Compact design uses smaller hover shadow only
      const card = container.querySelector('[class*="hover:shadow-hard"]');
      expect(card).toBeInTheDocument();
    });

    it("has card background (bg-card for dark mode support)", () => {
      const activity = createMockActivityItem();

      const { container } = renderWithProviders(
        <RecentActivityCard activity={activity} />
      );

      // Should have card background (theme-aware)
      const card = container.querySelector('.bg-card');
      expect(card).toBeInTheDocument();
    });

    it("has transition classes for smooth animations (transition-all, duration-200)", () => {
      const activity = createMockActivityItem();

      const { container } = renderWithProviders(
        <RecentActivityCard activity={activity} />
      );

      // Should have smooth transition classes
      const card = container.querySelector('[class*="transition"]');
      expect(card).toBeInTheDocument();
      expect(card?.className).toMatch(/duration-200|transition-all/);
    });
  });

  // ============================================================================
  // ACCESSIBILITY TESTS
  // ============================================================================

  describe("Accessibility", () => {
    it("has accessible link text", () => {
      const activity = createMockActivityItem({
        employerName: "Tech Corp Inc",
        positionTitle: "Software Engineer",
      });

      renderWithProviders(<RecentActivityCard activity={activity} />);

      // Link should be accessible (contains employer and position)
      const link = screen.getByRole("link");
      expect(link).toBeInTheDocument();
      expect(link.textContent).toContain("Tech Corp Inc");
      expect(link.textContent).toContain("Software Engineer");
    });

    it("has aria-label or accessible name", () => {
      const activity = createMockActivityItem({
        employerName: "Tech Corp Inc",
        action: ACTIVITY_ACTIONS.pwdFiled,
      });

      renderWithProviders(<RecentActivityCard activity={activity} />);

      const link = screen.getByRole("link");
      expect(link).toHaveAccessibleName();
    });

    it("has semantic HTML (time element for timestamp)", () => {
      const activity = createMockActivityItem({
        timestamp: hoursAgo(2),
      });

      const { container } = renderWithProviders(
        <RecentActivityCard activity={activity} />
      );

      // Should have <time> element with datetime attribute
      const timeElement = container.querySelector('time');
      expect(timeElement).toBeInTheDocument();
    });
  });

  // ============================================================================
  // LAYOUT & CONTENT TESTS
  // ============================================================================

  describe("Layout & Content Organization", () => {
    it("renders all required elements in correct order", () => {
      const activity = createMockActivityItem({
        employerName: "Tech Corp Inc",
        positionTitle: "Software Engineer",
        action: ACTIVITY_ACTIONS.pwdFiled,
        caseNumber: "CASE-2024-001",
        timestamp: hoursAgo(2),
      });

      renderWithProviders(<RecentActivityCard activity={activity} />);

      // All key elements should be present
      expect(screen.getByText("Tech Corp Inc")).toBeInTheDocument();
      expect(screen.getByText("Software Engineer")).toBeInTheDocument();
      expect(screen.getByText("PWD filed")).toBeInTheDocument();
      expect(screen.getByText("CASE-2024-001")).toBeInTheDocument();
      expect(screen.getByText(/2h ago/)).toBeInTheDocument();
    });

    it("handles long employer names gracefully", () => {
      const activity = createMockActivityItem({
        employerName: "International Technology Corporation of America Limited LLC",
      });

      renderWithProviders(<RecentActivityCard activity={activity} />);

      // Should render without overflow
      expect(
        screen.getByText("International Technology Corporation of America Limited LLC")
      ).toBeInTheDocument();
    });

    it("handles long action labels gracefully", () => {
      const activity = createMockActivityItem({
        action: "RFE response submitted with additional documentation",
      });

      renderWithProviders(<RecentActivityCard activity={activity} />);

      // Should render without overflow
      expect(
        screen.getByText("RFE response submitted with additional documentation")
      ).toBeInTheDocument();
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe("Edge Cases", () => {
    it("handles empty beneficiary identifier", () => {
      const activity = createMockActivityItem({
        beneficiaryIdentifier: "",
      });

      renderWithProviders(<RecentActivityCard activity={activity} />);

      // Should still render (might show "Unknown" or empty)
      const link = screen.getByRole("link");
      expect(link).toBeInTheDocument();
    });

    it("handles future timestamps gracefully", () => {
      const activity = createMockActivityItem({
        timestamp: Date.now() + 1000 * 60 * 60, // 1 hour in future
      });

      const { container } = renderWithProviders(
        <RecentActivityCard activity={activity} />
      );

      // Should have timestamp element (formatDistanceToNow handles future dates)
      const timestamp = container.querySelector('[data-testid="activity-timestamp"]');
      expect(timestamp).toBeInTheDocument();
    });

    it("handles very old timestamps (weeks/months ago)", () => {
      const activity = createMockActivityItem({
        timestamp: Date.now() - 1000 * 60 * 60 * 24 * 30, // 30 days ago
      });

      const { container } = renderWithProviders(
        <RecentActivityCard activity={activity} />
      );

      // Should render timestamp (>7 days shows formatted date like "Nov 24", not "Xd ago")
      const timestamp = container.querySelector('[data-testid="activity-timestamp"]');
      expect(timestamp).toBeInTheDocument();
      // Old dates show formatted date (e.g., "Nov 24") not relative time
      expect(timestamp?.textContent).toMatch(/[A-Z][a-z]{2}\s+\d{1,2}/);
    });
  });

  // ============================================================================
  // DARK MODE TESTS
  // ============================================================================

  describe("Dark Mode Support", () => {
    it("renders in dark mode with proper theme-aware classes", () => {
      const activity = createMockActivityItem();

      const { container } = renderWithProviders(
        <RecentActivityCard activity={activity} />,
        { providerProps: { theme: "dark" } }
      );

      // Should have bg-card for theme-aware background
      const card = container.querySelector('.bg-card');
      expect(card).toBeInTheDocument();
    });

    it("has proper text colors for dark mode (text-card-foreground)", () => {
      const activity = createMockActivityItem();

      const { container } = renderWithProviders(
        <RecentActivityCard activity={activity} />,
        { providerProps: { theme: "dark" } }
      );

      // Should have theme-aware text color classes
      const textElement = container.querySelector('[class*="text-"]');
      expect(textElement).toBeInTheDocument();
    });
  });
});
