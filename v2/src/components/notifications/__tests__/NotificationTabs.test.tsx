// @vitest-environment jsdom
/**
 * NotificationTabs Component Tests
 *
 * Tests for the notification tabs component that filters notifications by type.
 *
 * Requirements:
 * - Renders all 5 tabs (All, Unread, Deadlines, Status, RFE/RFI)
 * - Active tab highlighted correctly
 * - Clicking tab updates filter via callback
 * - Count badges display correct numbers
 * - Proper accessibility attributes (role="tablist", aria-selected)
 *
 * Phase: 24 (Notifications)
 * Created: 2025-12-31
 */

import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import NotificationTabs, { type NotificationTabType } from "../NotificationTabs";

describe("NotificationTabs", () => {
  // ============================================================================
  // RENDERING TESTS
  // ============================================================================

  describe("Basic Rendering", () => {
    it("renders all 5 tabs", () => {
      const onTabChange = vi.fn();
      renderWithProviders(
        <NotificationTabs activeTab="all" onTabChange={onTabChange} />
      );

      expect(screen.getByRole("tab", { name: /all/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /unread/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /deadlines/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /status/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /rfe\/rfi/i })).toBeInTheDocument();
    });

    it("renders tab container with tablist role", () => {
      const onTabChange = vi.fn();
      renderWithProviders(
        <NotificationTabs activeTab="all" onTabChange={onTabChange} />
      );

      expect(screen.getByRole("tablist")).toBeInTheDocument();
    });

    it("renders with aria-label for accessibility", () => {
      const onTabChange = vi.fn();
      renderWithProviders(
        <NotificationTabs activeTab="all" onTabChange={onTabChange} />
      );

      const tablist = screen.getByRole("tablist");
      expect(tablist).toHaveAttribute("aria-label", "Notification filters");
    });

    it("applies custom className when provided", () => {
      const onTabChange = vi.fn();
      renderWithProviders(
        <NotificationTabs
          activeTab="all"
          onTabChange={onTabChange}
          className="custom-class"
        />
      );

      const tablist = screen.getByRole("tablist");
      expect(tablist).toHaveClass("custom-class");
    });
  });

  // ============================================================================
  // ACTIVE TAB TESTS
  // ============================================================================

  describe("Active Tab Highlighting", () => {
    const testCases: NotificationTabType[] = ["all", "unread", "deadlines", "status", "rfe_rfi"];

    it.each(testCases)("marks %s tab as selected when active", (activeTab) => {
      const onTabChange = vi.fn();
      renderWithProviders(
        <NotificationTabs activeTab={activeTab} onTabChange={onTabChange} />
      );

      // Find the specific tab that should be selected
      const tabs = screen.getAllByRole("tab");
      const tabLabels = {
        all: "All",
        unread: "Unread",
        deadlines: "Deadlines",
        status: "Status",
        rfe_rfi: "RFE/RFI",
      };

      const activeTabElement = screen.getByRole("tab", { name: new RegExp(tabLabels[activeTab], "i") });
      expect(activeTabElement).toHaveAttribute("aria-selected", "true");

      // Other tabs should not be selected
      tabs.forEach((tab) => {
        if (tab !== activeTabElement) {
          expect(tab).toHaveAttribute("aria-selected", "false");
        }
      });
    });

    it("applies active styling to selected tab", () => {
      const onTabChange = vi.fn();
      const { container } = renderWithProviders(
        <NotificationTabs activeTab="unread" onTabChange={onTabChange} />
      );

      const unreadTab = screen.getByRole("tab", { name: /unread/i });
      // Active tab should have dark background
      expect(unreadTab).toHaveClass("bg-black");
      expect(unreadTab).toHaveClass("text-white");
    });

    it("applies inactive styling to non-selected tabs", () => {
      const onTabChange = vi.fn();
      renderWithProviders(
        <NotificationTabs activeTab="unread" onTabChange={onTabChange} />
      );

      const allTab = screen.getByRole("tab", { name: /^all$/i });
      // Inactive tabs should have transparent border
      expect(allTab).toHaveClass("border-transparent");
      expect(allTab).toHaveClass("text-muted-foreground");
    });
  });

  // ============================================================================
  // TAB CLICK TESTS
  // ============================================================================

  describe("Tab Click Behavior", () => {
    it("calls onTabChange with 'all' when All tab clicked", async () => {
      const onTabChange = vi.fn();
      const { user } = renderWithProviders(
        <NotificationTabs activeTab="unread" onTabChange={onTabChange} />
      );

      const allTab = screen.getByRole("tab", { name: /^all$/i });
      await user.click(allTab);

      expect(onTabChange).toHaveBeenCalledWith("all");
      expect(onTabChange).toHaveBeenCalledTimes(1);
    });

    it("calls onTabChange with 'unread' when Unread tab clicked", async () => {
      const onTabChange = vi.fn();
      const { user } = renderWithProviders(
        <NotificationTabs activeTab="all" onTabChange={onTabChange} />
      );

      const unreadTab = screen.getByRole("tab", { name: /unread/i });
      await user.click(unreadTab);

      expect(onTabChange).toHaveBeenCalledWith("unread");
    });

    it("calls onTabChange with 'deadlines' when Deadlines tab clicked", async () => {
      const onTabChange = vi.fn();
      const { user } = renderWithProviders(
        <NotificationTabs activeTab="all" onTabChange={onTabChange} />
      );

      const deadlinesTab = screen.getByRole("tab", { name: /deadlines/i });
      await user.click(deadlinesTab);

      expect(onTabChange).toHaveBeenCalledWith("deadlines");
    });

    it("calls onTabChange with 'status' when Status tab clicked", async () => {
      const onTabChange = vi.fn();
      const { user } = renderWithProviders(
        <NotificationTabs activeTab="all" onTabChange={onTabChange} />
      );

      const statusTab = screen.getByRole("tab", { name: /status/i });
      await user.click(statusTab);

      expect(onTabChange).toHaveBeenCalledWith("status");
    });

    it("calls onTabChange with 'rfe_rfi' when RFE/RFI tab clicked", async () => {
      const onTabChange = vi.fn();
      const { user } = renderWithProviders(
        <NotificationTabs activeTab="all" onTabChange={onTabChange} />
      );

      const rfeRfiTab = screen.getByRole("tab", { name: /rfe\/rfi/i });
      await user.click(rfeRfiTab);

      expect(onTabChange).toHaveBeenCalledWith("rfe_rfi");
    });

    it("still calls onTabChange when clicking already active tab", async () => {
      const onTabChange = vi.fn();
      const { user } = renderWithProviders(
        <NotificationTabs activeTab="all" onTabChange={onTabChange} />
      );

      const allTab = screen.getByRole("tab", { name: /^all$/i });
      await user.click(allTab);

      expect(onTabChange).toHaveBeenCalledWith("all");
    });
  });

  // ============================================================================
  // COUNT BADGES TESTS
  // ============================================================================

  describe("Count Badges", () => {
    it("displays count badge when count > 0", () => {
      const onTabChange = vi.fn();
      renderWithProviders(
        <NotificationTabs
          activeTab="all"
          onTabChange={onTabChange}
          counts={{ unread: 5 }}
        />
      );

      expect(screen.getByText("5")).toBeInTheDocument();
    });

    it("does not display badge when count is 0", () => {
      const onTabChange = vi.fn();
      renderWithProviders(
        <NotificationTabs
          activeTab="all"
          onTabChange={onTabChange}
          counts={{ unread: 0 }}
        />
      );

      // There should be no "0" badge visible
      // The tab text "Unread" should exist but not a "0" count
      expect(screen.getByRole("tab", { name: /unread/i })).toBeInTheDocument();
      const unreadTab = screen.getByRole("tab", { name: /unread/i });
      expect(unreadTab.textContent).not.toContain("0");
    });

    it("does not display badge when count is undefined", () => {
      const onTabChange = vi.fn();
      renderWithProviders(
        <NotificationTabs
          activeTab="all"
          onTabChange={onTabChange}
          counts={{}}
        />
      );

      // Tabs should still render without any count badges
      expect(screen.getByRole("tab", { name: /^all$/i })).toBeInTheDocument();
    });

    it("displays multiple count badges for different tabs", () => {
      const onTabChange = vi.fn();
      renderWithProviders(
        <NotificationTabs
          activeTab="all"
          onTabChange={onTabChange}
          counts={{
            all: 25,
            unread: 10,
            deadlines: 3,
            status: 7,
            rfe_rfi: 2,
          }}
        />
      );

      expect(screen.getByText("25")).toBeInTheDocument();
      expect(screen.getByText("10")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
      expect(screen.getByText("7")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument();
    });

    it("truncates count to 99+ when count > 99", () => {
      const onTabChange = vi.fn();
      renderWithProviders(
        <NotificationTabs
          activeTab="all"
          onTabChange={onTabChange}
          counts={{ all: 150 }}
        />
      );

      expect(screen.getByText("99+")).toBeInTheDocument();
      expect(screen.queryByText("150")).not.toBeInTheDocument();
    });

    it("displays exact count when count is exactly 99", () => {
      const onTabChange = vi.fn();
      renderWithProviders(
        <NotificationTabs
          activeTab="all"
          onTabChange={onTabChange}
          counts={{ all: 99 }}
        />
      );

      expect(screen.getByText("99")).toBeInTheDocument();
    });

    it("displays exact count when count is 100 as 99+", () => {
      const onTabChange = vi.fn();
      renderWithProviders(
        <NotificationTabs
          activeTab="all"
          onTabChange={onTabChange}
          counts={{ all: 100 }}
        />
      );

      expect(screen.getByText("99+")).toBeInTheDocument();
    });
  });

  // ============================================================================
  // ACCESSIBILITY TESTS
  // ============================================================================

  describe("Accessibility", () => {
    it("has aria-controls pointing to panel ID", () => {
      const onTabChange = vi.fn();
      renderWithProviders(
        <NotificationTabs activeTab="all" onTabChange={onTabChange} />
      );

      const allTab = screen.getByRole("tab", { name: /^all$/i });
      expect(allTab).toHaveAttribute("aria-controls", "notification-panel-all");
    });

    it("all tabs are focusable", () => {
      const onTabChange = vi.fn();
      renderWithProviders(
        <NotificationTabs activeTab="all" onTabChange={onTabChange} />
      );

      const tabs = screen.getAllByRole("tab");
      tabs.forEach((tab) => {
        expect(tab).not.toHaveAttribute("tabindex", "-1");
      });
    });

    it("tabs have type=button to prevent form submission", () => {
      const onTabChange = vi.fn();
      renderWithProviders(
        <NotificationTabs activeTab="all" onTabChange={onTabChange} />
      );

      const tabs = screen.getAllByRole("tab");
      tabs.forEach((tab) => {
        expect(tab).toHaveAttribute("type", "button");
      });
    });
  });

  // ============================================================================
  // NEOBRUTALIST STYLING TESTS
  // ============================================================================

  describe("Neobrutalist Styling", () => {
    it("has border-b-2 on container", () => {
      const onTabChange = vi.fn();
      renderWithProviders(
        <NotificationTabs activeTab="all" onTabChange={onTabChange} />
      );

      const tablist = screen.getByRole("tablist");
      expect(tablist).toHaveClass("border-b-2");
    });

    it("tabs have font-heading class", () => {
      const onTabChange = vi.fn();
      renderWithProviders(
        <NotificationTabs activeTab="all" onTabChange={onTabChange} />
      );

      const tabs = screen.getAllByRole("tab");
      tabs.forEach((tab) => {
        expect(tab).toHaveClass("font-heading");
      });
    });

    it("tabs have uppercase tracking-wide", () => {
      const onTabChange = vi.fn();
      renderWithProviders(
        <NotificationTabs activeTab="all" onTabChange={onTabChange} />
      );

      const tabs = screen.getAllByRole("tab");
      tabs.forEach((tab) => {
        expect(tab).toHaveClass("uppercase");
        expect(tab).toHaveClass("tracking-wide");
      });
    });

    it("tabs have 2px border", () => {
      const onTabChange = vi.fn();
      renderWithProviders(
        <NotificationTabs activeTab="all" onTabChange={onTabChange} />
      );

      const tabs = screen.getAllByRole("tab");
      tabs.forEach((tab) => {
        expect(tab).toHaveClass("border-2");
      });
    });
  });
});
