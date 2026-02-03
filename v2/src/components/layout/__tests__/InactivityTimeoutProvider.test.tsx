/**
 * InactivityTimeoutProvider Component Tests
 *
 * Tests:
 * - Renders children
 * - Passes props correctly to hook and modal
 * - Handles sign-out on timeout callback
 * - Handles sign-out on manual logout button
 * - Shows toast on sign-out error
 *
 * Note: Timer behavior is tested in useInactivityTimeout.test.ts
 *       This test focuses on component integration with mocked hook.
 *
 * Phase: 20 (Dashboard + UI Polish)
 * Created: 2025-12-24
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor, act, render } from "@testing-library/react";
import { ThemeProvider } from "next-themes";

// ============================================================================
// MOCKS (must be before imports that use them)
// ============================================================================

// Mock useRouter (component uses window.location.href for redirect, not router.push)
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/dashboard",
}));

// Mock useAuthActions
const mockSignOut = vi.fn();
vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signOut: mockSignOut }),
}));

// Mock auth-aware toast wrapper (not sonner directly)
const mockToastError = vi.fn();
vi.mock("@/lib/toast", () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
  },
  // Required by AuthContext
  updateToastAuthState: vi.fn(),
}));

// Mock AuthContext
const mockBeginSignOut = vi.fn();
const mockCancelSignOut = vi.fn();
let mockIsSigningOut = false;

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuthContext: () => ({
    isSigningOut: mockIsSigningOut,
    authState: mockIsSigningOut ? "signingOut" : "idle",
    beginSignOut: mockBeginSignOut,
    completeSignOut: vi.fn(),
    cancelSignOut: mockCancelSignOut,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock useInactivityTimeout hook to control warning state
let mockIsWarningVisible = false;
let mockOnTimeoutCallback: (() => void) | null = null;
const mockExtendSession = vi.fn();

vi.mock("@/lib/hooks/useInactivityTimeout", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/hooks/useInactivityTimeout")>();
  return {
    ...actual,
    useInactivityTimeout: ({ onTimeout }: { onTimeout: () => void }) => {
      mockOnTimeoutCallback = onTimeout;
      return {
        isWarningVisible: mockIsWarningVisible,
        remainingSeconds: 120,
        extendSession: mockExtendSession,
        resetTimeout: vi.fn(),
      };
    },
  };
});

// Import after mocks
import InactivityTimeoutProvider from "../InactivityTimeoutProvider";

// ============================================================================
// HELPERS
// ============================================================================

function renderWithTheme(ui: React.ReactElement) {
  return render(
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      {ui}
    </ThemeProvider>
  );
}

// ============================================================================
// TESTS
// ============================================================================

describe("InactivityTimeoutProvider", () => {
  // Component uses window.location.href = "/login" for hard redirect
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSignOut.mockResolvedValue(undefined);
    mockIsWarningVisible = false;
    mockOnTimeoutCallback = null;
    mockIsSigningOut = false;
    // Mock window.location to capture href assignment (jsdom doesn't support navigation)
    Object.defineProperty(window, "location", {
      value: { ...originalLocation, href: originalLocation.href },
      writable: true,
      configurable: true,
    });
  });

  // --------------------------------------------------------------------------
  // RENDERING TESTS
  // --------------------------------------------------------------------------

  describe("Rendering", () => {
    it("renders children", () => {
      renderWithTheme(
        <InactivityTimeoutProvider>
          <div data-testid="child">Child content</div>
        </InactivityTimeoutProvider>
      );

      expect(screen.getByTestId("child")).toBeInTheDocument();
      expect(screen.getByText("Child content")).toBeInTheDocument();
    });

    it("does not show warning modal initially", () => {
      mockIsWarningVisible = false;
      renderWithTheme(
        <InactivityTimeoutProvider>
          <div>Content</div>
        </InactivityTimeoutProvider>
      );

      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });

    it("shows warning modal when isWarningVisible is true", () => {
      mockIsWarningVisible = true;
      renderWithTheme(
        <InactivityTimeoutProvider>
          <div>Content</div>
        </InactivityTimeoutProvider>
      );

      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // SIGN OUT TESTS
  // --------------------------------------------------------------------------

  describe("Sign out behavior", () => {
    it("calls signOut and navigates to /login when onTimeout is triggered", async () => {
      renderWithTheme(
        <InactivityTimeoutProvider>
          <div>Content</div>
        </InactivityTimeoutProvider>
      );

      // Trigger the timeout callback
      await act(async () => {
        mockOnTimeoutCallback?.();
      });

      await waitFor(() => {
        expect(mockBeginSignOut).toHaveBeenCalledTimes(1);
        expect(mockSignOut).toHaveBeenCalledTimes(1);
      });

      expect(window.location.href).toBe("/login");
    });

    it("calls signOut when Log Out Now is clicked", async () => {
      mockIsWarningVisible = true;
      renderWithTheme(
        <InactivityTimeoutProvider>
          <div>Content</div>
        </InactivityTimeoutProvider>
      );

      // Click Log Out Now
      const logoutButton = screen.getByRole("button", { name: /log out now/i });
      await act(async () => {
        fireEvent.click(logoutButton);
      });

      await waitFor(() => {
        expect(mockBeginSignOut).toHaveBeenCalledTimes(1);
        expect(mockSignOut).toHaveBeenCalledTimes(1);
      });

      expect(window.location.href).toBe("/login");
    });

    it("shows toast on sign-out error", async () => {
      mockSignOut.mockRejectedValueOnce(new Error("Sign out failed"));
      mockIsWarningVisible = true;

      renderWithTheme(
        <InactivityTimeoutProvider>
          <div>Content</div>
        </InactivityTimeoutProvider>
      );

      // Click Log Out Now
      const logoutButton = screen.getByRole("button", { name: /log out now/i });
      await act(async () => {
        fireEvent.click(logoutButton);
      });

      await waitFor(() => {
        expect(mockCancelSignOut).toHaveBeenCalledTimes(1);
        expect(mockToastError).toHaveBeenCalledWith(
          "Failed to sign out. Please try again."
        );
      });
    });

    it("does not trigger signOut if already signing out", async () => {
      mockIsSigningOut = true;
      renderWithTheme(
        <InactivityTimeoutProvider>
          <div>Content</div>
        </InactivityTimeoutProvider>
      );

      // Trigger the timeout callback
      await act(async () => {
        mockOnTimeoutCallback?.();
      });

      expect(mockBeginSignOut).not.toHaveBeenCalled();
      expect(mockSignOut).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // EXTEND SESSION TESTS
  // --------------------------------------------------------------------------

  describe("Extend session", () => {
    it("calls extendSession when Stay Logged In is clicked", async () => {
      mockIsWarningVisible = true;
      renderWithTheme(
        <InactivityTimeoutProvider>
          <div>Content</div>
        </InactivityTimeoutProvider>
      );

      const stayButton = screen.getByRole("button", { name: /stay logged in/i });
      fireEvent.click(stayButton);

      expect(mockExtendSession).toHaveBeenCalledTimes(1);
    });
  });
});
