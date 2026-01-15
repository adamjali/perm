/**
 * SignOutOverlay Component Tests
 *
 * Tests:
 * - Renders nothing when not signing out
 * - Renders overlay when signing out
 * - Has accessible role and label
 * - Uses correct z-index
 * - Shows spinner and text
 *
 * Phase: 20 (Dashboard + UI Polish)
 * Created: 2025-12-24
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, render } from "@testing-library/react";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import SignOutOverlay from "../SignOutOverlay";
import { Z_INDEX } from "@/lib/constants/zIndex";

// Mock AuthContext
const mockIsSigningOut = vi.fn(() => false);

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuthContext: () => ({
    isSigningOut: mockIsSigningOut(),
    authState: mockIsSigningOut() ? "signingOut" : "idle",
    beginSignOut: vi.fn(),
    completeSignOut: vi.fn(),
    cancelSignOut: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ============================================================================
// TESTS
// ============================================================================

describe("SignOutOverlay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSigningOut.mockReturnValue(false);
  });

  // --------------------------------------------------------------------------
  // VISIBILITY TESTS
  // --------------------------------------------------------------------------

  describe("Visibility", () => {
    it("renders nothing when not signing out", () => {
      mockIsSigningOut.mockReturnValue(false);
      const { container } = render(<SignOutOverlay />);

      expect(container.firstChild).toBeNull();
    });

    it("renders overlay when signing out", () => {
      mockIsSigningOut.mockReturnValue(true);
      render(<SignOutOverlay />);

      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // ACCESSIBILITY TESTS
  // --------------------------------------------------------------------------

  describe("Accessibility", () => {
    it("has dialog role", () => {
      mockIsSigningOut.mockReturnValue(true);
      render(<SignOutOverlay />);

      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("has aria-modal true", () => {
      mockIsSigningOut.mockReturnValue(true);
      render(<SignOutOverlay />);

      expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    });

    it("has aria-label for screen readers", () => {
      mockIsSigningOut.mockReturnValue(true);
      render(<SignOutOverlay />);

      expect(screen.getByRole("dialog")).toHaveAttribute(
        "aria-label",
        "Signing out"
      );
    });
  });

  // --------------------------------------------------------------------------
  // STYLING TESTS
  // --------------------------------------------------------------------------

  describe("Styling", () => {
    it("uses centralized z-index constant", () => {
      mockIsSigningOut.mockReturnValue(true);
      render(<SignOutOverlay />);

      const overlay = screen.getByRole("dialog");
      expect(overlay).toHaveStyle({ zIndex: Z_INDEX.overlay.toString() });
    });

    it("has fixed positioning", () => {
      mockIsSigningOut.mockReturnValue(true);
      render(<SignOutOverlay />);

      const overlay = screen.getByRole("dialog");
      expect(overlay).toHaveClass("fixed");
      expect(overlay).toHaveClass("inset-0");
    });

    it("is centered", () => {
      mockIsSigningOut.mockReturnValue(true);
      render(<SignOutOverlay />);

      const overlay = screen.getByRole("dialog");
      expect(overlay).toHaveClass("flex");
      expect(overlay).toHaveClass("items-center");
      expect(overlay).toHaveClass("justify-center");
    });
  });

  // --------------------------------------------------------------------------
  // CONTENT TESTS
  // --------------------------------------------------------------------------

  describe("Content", () => {
    it("shows 'Signing out...' text", () => {
      mockIsSigningOut.mockReturnValue(true);
      render(<SignOutOverlay />);

      expect(screen.getByText("Signing out...")).toBeInTheDocument();
    });

    it("has a spinner element", () => {
      mockIsSigningOut.mockReturnValue(true);
      const { container } = render(<SignOutOverlay />);

      // Check for spinning animation class
      const spinner = container.querySelector(".animate-spin");
      expect(spinner).toBeInTheDocument();
    });

    it("has backdrop with blur", () => {
      mockIsSigningOut.mockReturnValue(true);
      const { container } = render(<SignOutOverlay />);

      const backdrop = container.querySelector('[aria-hidden="true"]');
      expect(backdrop).toBeInTheDocument();
      expect(backdrop).toHaveClass("backdrop-blur-md");
    });
  });
});
