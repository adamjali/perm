/**
 * Header and ThemeToggle Component Tests
 * TDD tests written BEFORE implementation.
 *
 * Tests:
 * - Header rendering (logo, navigation, user, theme toggle)
 * - Active navigation state
 * - Header styling (sticky, border, black background)
 * - ThemeToggle rendering and styling
 *
 * Phase: 20-02 (Dashboard Data Layer)
 * Created: 2025-12-23
 * Updated: 2025-12-24 (Phase 20 UI polish)
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import { createMockUser, NAV_LINKS } from "../../../../test-utils/ui-fixtures";
import Header from "../Header";
import ThemeToggle from "../ThemeToggle";

// ============================================================================
// MOCKS
// ============================================================================

// Mock Next.js navigation
const mockPathname = vi.fn(() => "/dashboard");
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
  useRouter: () => ({ push: mockPush }),
}));

// Mock Convex useQuery and useMutation for user data
const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn(() => vi.fn());
vi.mock("convex/react", () => ({
  useQuery: () => mockUseQuery(),
  useMutation: () => mockUseMutation(),
}));

// Mock Convex Auth
const mockSignOut = vi.fn();
vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signOut: mockSignOut }),
}));

// Mock notification hooks and components to prevent useQuery conflicts
vi.mock("@/hooks", () => ({
  useNotificationToasts: vi.fn(),
}));

vi.mock("@/components/notifications", () => ({
  NotificationBell: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="notification-bell">{children}</div>
  ),
  NotificationDropdown: () => <div data-testid="notification-dropdown" />,
}));

// Mock AuthContext - need both the hook AND the provider
vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuthContext: () => ({
    isSigningOut: false,
    beginSignOut: vi.fn(),
    cancelSignOut: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Import React for JSX in mocks
import React from "react";

// ============================================================================
// HEADER TESTS
// ============================================================================

describe("Header", () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    mockPathname.mockReturnValue("/dashboard");
    mockUseQuery.mockReturnValue(createMockUser());
  });

  // --------------------------------------------------------------------------
  // RENDERING TESTS
  // --------------------------------------------------------------------------

  describe("Rendering", () => {
    it("renders logo with link to /dashboard", () => {
      renderWithProviders(<Header />);

      // Logo has split text (PERM in green, Tracker in white)
      const logoLink = screen.getByRole("link", { name: /perm/i });
      expect(logoLink).toBeInTheDocument();
      expect(logoLink).toHaveAttribute("href", "/dashboard");
    });

    it("renders all navigation links", () => {
      renderWithProviders(<Header />);

      // Check all nav links exist
      NAV_LINKS.forEach((link) => {
        const navLink = screen.getByRole("link", { name: link.label });
        expect(navLink).toBeInTheDocument();
        expect(navLink).toHaveAttribute("href", link.href);
      });
    });

    it("renders theme toggle button", () => {
      renderWithProviders(<Header />);

      const themeToggle = screen.getByRole("button", {
        name: /switch to .* mode/i,
      });
      expect(themeToggle).toBeInTheDocument();
    });

    it("displays user name when authenticated", () => {
      const mockUser = createMockUser({ name: "Jane Attorney" });
      mockUseQuery.mockReturnValue(mockUser);

      renderWithProviders(<Header />);

      expect(screen.getByText("Jane Attorney")).toBeInTheDocument();
    });

    it("does not display user name when not authenticated", () => {
      mockUseQuery.mockReturnValue(undefined);

      renderWithProviders(<Header />);

      // User name should not be present
      expect(screen.queryByText("Test User")).not.toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // ACTIVE STATE TESTS
  // --------------------------------------------------------------------------

  describe("Active navigation state", () => {
    it("highlights Dashboard link when on /dashboard", () => {
      mockPathname.mockReturnValue("/dashboard");

      renderWithProviders(<Header />);

      const dashboardLink = screen.getByRole("link", { name: "Dashboard" });
      // Active state now uses text-primary instead of border-primary
      expect(dashboardLink).toHaveClass("text-primary");
    });

    it("highlights Cases link when on /cases", () => {
      mockPathname.mockReturnValue("/cases");

      renderWithProviders(<Header />);

      const casesLink = screen.getByRole("link", { name: "Cases" });
      expect(casesLink).toHaveClass("text-primary");
    });

    it("highlights Calendar link when on /calendar", () => {
      mockPathname.mockReturnValue("/calendar");

      renderWithProviders(<Header />);

      const calendarLink = screen.getByRole("link", { name: "Calendar" });
      expect(calendarLink).toHaveClass("text-primary");
    });

    it("highlights Timeline link when on /timeline", () => {
      mockPathname.mockReturnValue("/timeline");

      renderWithProviders(<Header />);

      const timelineLink = screen.getByRole("link", { name: "Timeline" });
      expect(timelineLink).toHaveClass("text-primary");
    });

    it("does not highlight non-active pages", () => {
      mockPathname.mockReturnValue("/dashboard");

      renderWithProviders(<Header />);

      const casesLink = screen.getByRole("link", { name: "Cases" });
      const calendarLink = screen.getByRole("link", { name: "Calendar" });

      expect(casesLink).not.toHaveClass("text-primary");
      expect(calendarLink).not.toHaveClass("text-primary");
    });

    it("no links are highlighted on unknown route", () => {
      mockPathname.mockReturnValue("/unknown");

      renderWithProviders(<Header />);

      NAV_LINKS.forEach((link) => {
        const navLink = screen.getByRole("link", { name: link.label });
        expect(navLink).not.toHaveClass("text-primary");
      });
    });
  });

  // --------------------------------------------------------------------------
  // STYLING TESTS
  // --------------------------------------------------------------------------

  describe("Styling", () => {
    it("has sticky positioning", () => {
      const { container } = renderWithProviders(<Header />);

      const header = container.querySelector("header");
      expect(header).toHaveClass("sticky");
      expect(header).toHaveClass("top-0");
    });

    it("has neobrutalist border", () => {
      const { container } = renderWithProviders(<Header />);

      const header = container.querySelector("header");
      expect(header).toHaveClass("border-b-4");
      expect(header).toHaveClass("border-black");
    });

    it("has black background to match auth header", () => {
      const { container } = renderWithProviders(<Header />);

      const header = container.querySelector("header");
      // Updated: Header now uses black background to match auth pages
      expect(header).toHaveClass("bg-black");
    });

    it("has z-index for layering", () => {
      const { container } = renderWithProviders(<Header />);

      const header = container.querySelector("header");
      expect(header).toHaveClass("z-50");
    });
  });

  // --------------------------------------------------------------------------
  // DARK MODE TESTS
  // --------------------------------------------------------------------------

  describe("Dark mode", () => {
    it("renders correctly in dark mode", () => {
      const { container } = renderWithProviders(<Header />, {
        providerProps: { theme: "dark" },
      });

      const header = container.querySelector("header");
      expect(header).toBeInTheDocument();
    });

    it("maintains border styling in dark mode", () => {
      const { container } = renderWithProviders(<Header />, {
        providerProps: { theme: "dark" },
      });

      const header = container.querySelector("header");
      expect(header).toHaveClass("border-b-4");
      expect(header).toHaveClass("border-black");
    });
  });

  // --------------------------------------------------------------------------
  // ACCESSIBILITY TESTS
  // --------------------------------------------------------------------------

  describe("Accessibility", () => {
    it("uses semantic header element", () => {
      const { container } = renderWithProviders(<Header />);

      const header = container.querySelector("header");
      expect(header).toBeInTheDocument();
    });

    it("uses semantic nav element", () => {
      const { container } = renderWithProviders(<Header />);

      const nav = container.querySelector("nav");
      expect(nav).toBeInTheDocument();
    });

    it("all navigation links are keyboard accessible", () => {
      renderWithProviders(<Header />);

      NAV_LINKS.forEach((link) => {
        const navLink = screen.getByRole("link", { name: link.label });
        expect(navLink).toHaveAttribute("href");
      });
    });
  });
});

// ============================================================================
// THEMETOGGLE TESTS
// ============================================================================

describe("ThemeToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // RENDERING TESTS
  // --------------------------------------------------------------------------

  describe("Rendering", () => {
    it("renders button with accessible label", () => {
      renderWithProviders(<ThemeToggle />);

      const button = screen.getByRole("button", { name: /switch to .* mode/i });
      expect(button).toBeInTheDocument();
    });

    it("has aria-label for accessibility", () => {
      renderWithProviders(<ThemeToggle />);

      const button = screen.getByRole("button", { name: /switch to .* mode/i });
      expect(button).toHaveAttribute("aria-label");
    });
  });

  // --------------------------------------------------------------------------
  // STYLING TESTS
  // --------------------------------------------------------------------------

  describe("Styling", () => {
    it("has ghost border styling (transparent by default)", () => {
      const { container } = renderWithProviders(<ThemeToggle />);

      const button = container.querySelector("button");
      expect(button).toHaveClass("border-2");
      // Ghost effect: semi-transparent white border by default
      expect(button).toHaveClass("border-white/30");
    });

    it("has hover transition", () => {
      const { container } = renderWithProviders(<ThemeToggle />);

      const button = container.querySelector("button");
      expect(button).toHaveClass("transition-all");
    });

    it("has proper sizing", () => {
      const { container } = renderWithProviders(<ThemeToggle />);

      const button = container.querySelector("button");
      // Should have square aspect ratio for icon button
      expect(button).toHaveClass("w-11");
      expect(button).toHaveClass("h-11");
    });
  });

  // --------------------------------------------------------------------------
  // DARK MODE TESTS
  // --------------------------------------------------------------------------

  describe("Dark mode", () => {
    it("renders correctly in light mode", () => {
      const { container } = renderWithProviders(<ThemeToggle />, {
        providerProps: { theme: "light" },
      });

      const button = container.querySelector("button");
      expect(button).toBeInTheDocument();
    });

    it("renders correctly in dark mode", () => {
      const { container } = renderWithProviders(<ThemeToggle />, {
        providerProps: { theme: "dark" },
      });

      const button = container.querySelector("button");
      expect(button).toBeInTheDocument();
    });

    it("shows sun icon in dark mode (to switch to light)", () => {
      renderWithProviders(<ThemeToggle />, {
        providerProps: { theme: "dark" },
      });

      // Icon should indicate switching TO light mode
      const button = screen.getByRole("button", { name: /switch to light mode/i });
      expect(button).toBeInTheDocument();
    });

    it("shows moon icon in light mode (to switch to dark)", () => {
      renderWithProviders(<ThemeToggle />, {
        providerProps: { theme: "light" },
      });

      // Icon should indicate switching TO dark mode
      const button = screen.getByRole("button", { name: /switch to dark mode/i });
      expect(button).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // INTERACTION TESTS (behavior will be tested after implementation)
  // --------------------------------------------------------------------------

  describe("Interaction", () => {
    it("is clickable", () => {
      renderWithProviders(<ThemeToggle />);

      const button = screen.getByRole("button", { name: /switch to .* mode/i });
      expect(button).not.toBeDisabled();
    });

    it("has button type to prevent form submission", () => {
      const { container } = renderWithProviders(<ThemeToggle />);

      const button = container.querySelector("button");
      expect(button).toHaveAttribute("type", "button");
    });
  });

  // --------------------------------------------------------------------------
  // ACCESSIBILITY TESTS
  // --------------------------------------------------------------------------

  describe("Accessibility", () => {
    it("uses semantic button element", () => {
      const { container } = renderWithProviders(<ThemeToggle />);

      const button = container.querySelector("button");
      expect(button).toBeInTheDocument();
    });

    it("is keyboard accessible", () => {
      renderWithProviders(<ThemeToggle />);

      const button = screen.getByRole("button", { name: /switch to .* mode/i });
      expect(button).toHaveAttribute("type");
    });

    it("provides clear accessible label", () => {
      renderWithProviders(<ThemeToggle />);

      const button = screen.getByRole("button", { name: /switch to .* mode/i });
      const ariaLabel = button.getAttribute("aria-label");

      expect(ariaLabel).toBeTruthy();
      expect(ariaLabel?.toLowerCase()).toContain("mode");
    });
  });
});
