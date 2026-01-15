// @vitest-environment jsdom
/**
 * AuthHeader Component Tests
 * Tests for public/auth page header with context-aware auth buttons.
 *
 * Requirements:
 * 1. Renders logo with link to home (/)
 * 2. Renders Home and Demo nav links
 * 3. Renders theme toggle button
 * 4. Context-aware auth buttons:
 *    - Hides Sign In button when on /login page
 *    - Shows Sign Up button when on /login page
 *    - Hides Sign Up button when on /signup page
 *    - Shows Sign In button when on /signup page
 * 5. Sign Up button has neobrutalist primary style
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import { AUTH_NAV_LINKS } from "../../../../test-utils/ui-fixtures";
import AuthHeader from "../AuthHeader";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// Import after mock
import { usePathname } from "next/navigation";

describe("AuthHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders logo with link to home (/)", () => {
      vi.mocked(usePathname).mockReturnValue("/");

      renderWithProviders(<AuthHeader />);

      // Logo has split color spans (PERM green, Tracker white)
      const logoLink = screen.getByRole("link", { name: /perm/i });
      expect(logoLink).toBeInTheDocument();
      expect(logoLink).toHaveAttribute("href", "/");
    });

    it("renders Home nav link (when not on home page)", () => {
      vi.mocked(usePathname).mockReturnValue("/demo");

      renderWithProviders(<AuthHeader />);

      const homeLink = screen.getByRole("link", { name: AUTH_NAV_LINKS[0].label });
      expect(homeLink).toBeInTheDocument();
      expect(homeLink).toHaveAttribute("href", AUTH_NAV_LINKS[0].href);
    });

    it("renders Demo nav link", () => {
      // On non-home pages, AUTH_NAV_LINKS are shown (Home, Demo)
      // The current page is filtered out, so on /login we see Home and Demo
      vi.mocked(usePathname).mockReturnValue("/login");

      renderWithProviders(<AuthHeader />);

      const demoLink = screen.getByRole("link", { name: AUTH_NAV_LINKS[1].label });
      expect(demoLink).toBeInTheDocument();
      expect(demoLink).toHaveAttribute("href", AUTH_NAV_LINKS[1].href);
    });

    it("renders theme toggle button", () => {
      vi.mocked(usePathname).mockReturnValue("/");

      renderWithProviders(<AuthHeader />);

      // There are two theme toggles (desktop + mobile responsive design)
      const themeToggles = screen.getAllByRole("button", { name: /switch to .* mode/i });
      expect(themeToggles.length).toBeGreaterThanOrEqual(1);
      expect(themeToggles[0]).toBeInTheDocument();
    });
  });

  describe("Context-aware auth buttons - /login page", () => {
    beforeEach(() => {
      vi.mocked(usePathname).mockReturnValue("/login");
    });

    it("hides Sign In button when on /login page", () => {
      renderWithProviders(<AuthHeader />);

      const signInButton = screen.queryByRole("link", { name: /sign in/i });
      expect(signInButton).not.toBeInTheDocument();
    });

    it("shows Sign Up button when on /login page", () => {
      renderWithProviders(<AuthHeader />);

      const signUpButton = screen.getByRole("link", { name: /sign up/i });
      expect(signUpButton).toBeInTheDocument();
      expect(signUpButton).toHaveAttribute("href", "/signup");
    });
  });

  describe("Context-aware auth buttons - /signup page", () => {
    beforeEach(() => {
      vi.mocked(usePathname).mockReturnValue("/signup");
    });

    it("hides Sign Up button when on /signup page", () => {
      renderWithProviders(<AuthHeader />);

      const signUpButton = screen.queryByRole("link", { name: /sign up/i });
      expect(signUpButton).not.toBeInTheDocument();
    });

    it("shows Sign In button when on /signup page", () => {
      renderWithProviders(<AuthHeader />);

      const signInButton = screen.getByRole("link", { name: /sign in/i });
      expect(signInButton).toBeInTheDocument();
      expect(signInButton).toHaveAttribute("href", "/login");
    });
  });

  describe("Context-aware auth buttons - other pages", () => {
    it("shows both Sign In and Sign Up buttons on home page", () => {
      vi.mocked(usePathname).mockReturnValue("/");

      renderWithProviders(<AuthHeader />);

      const signInButton = screen.getByRole("link", { name: /sign in/i });
      const signUpButton = screen.getByRole("link", { name: /sign up/i });

      expect(signInButton).toBeInTheDocument();
      expect(signUpButton).toBeInTheDocument();
    });

    it("shows both Sign In and Sign Up buttons on demo page", () => {
      vi.mocked(usePathname).mockReturnValue("/demo");

      renderWithProviders(<AuthHeader />);

      const signInButton = screen.getByRole("link", { name: /sign in/i });
      const signUpButton = screen.getByRole("link", { name: /sign up/i });

      expect(signInButton).toBeInTheDocument();
      expect(signUpButton).toBeInTheDocument();
    });
  });

  // NOTE: CSS class tests removed per CLAUDE.md guidelines
  // Styling should be validated via Storybook visual QA, not unit tests
});
