/**
 * AuthContext Tests
 *
 * Tests:
 * - Provider renders children
 * - Initial state is idle
 * - State transitions: beginSignOut, completeSignOut, cancelSignOut
 * - isSigningOut derived correctly from state
 * - Hook throws when used outside provider
 *
 * Phase: 20 (Dashboard + UI Polish)
 * Created: 2025-12-24
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { AuthProvider, useAuthContext } from "../AuthContext";

// ============================================================================
// PROVIDER TESTS
// ============================================================================

describe("AuthProvider", () => {
  it("renders children", () => {
    render(
      <AuthProvider>
        <div data-testid="child">Child content</div>
      </AuthProvider>
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByText("Child content")).toBeInTheDocument();
  });
});

// ============================================================================
// HOOK TESTS
// ============================================================================

describe("useAuthContext", () => {
  // Wrapper for hook tests
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );

  // --------------------------------------------------------------------------
  // INITIAL STATE TESTS
  // --------------------------------------------------------------------------

  describe("Initial state", () => {
    it("authState is idle initially", () => {
      const { result } = renderHook(() => useAuthContext(), { wrapper });

      expect(result.current.authState).toBe("idle");
    });

    it("isSigningOut is false initially", () => {
      const { result } = renderHook(() => useAuthContext(), { wrapper });

      expect(result.current.isSigningOut).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // STATE TRANSITION TESTS
  // --------------------------------------------------------------------------

  describe("State transitions", () => {
    it("beginSignOut transitions from idle to signingOut", () => {
      const { result } = renderHook(() => useAuthContext(), { wrapper });

      act(() => {
        result.current.beginSignOut();
      });

      expect(result.current.authState).toBe("signingOut");
      expect(result.current.isSigningOut).toBe(true);
    });

    it("completeSignOut transitions from signingOut to idle", () => {
      const { result } = renderHook(() => useAuthContext(), { wrapper });

      // First, begin sign out
      act(() => {
        result.current.beginSignOut();
      });
      expect(result.current.authState).toBe("signingOut");

      // Then complete it
      act(() => {
        result.current.completeSignOut();
      });

      expect(result.current.authState).toBe("idle");
      expect(result.current.isSigningOut).toBe(false);
    });

    it("cancelSignOut transitions from signingOut to idle", () => {
      const { result } = renderHook(() => useAuthContext(), { wrapper });

      // First, begin sign out
      act(() => {
        result.current.beginSignOut();
      });
      expect(result.current.authState).toBe("signingOut");

      // Then cancel it
      act(() => {
        result.current.cancelSignOut();
      });

      expect(result.current.authState).toBe("idle");
      expect(result.current.isSigningOut).toBe(false);
    });

    it("beginSignOut is a no-op when already signingOut", () => {
      const { result } = renderHook(() => useAuthContext(), { wrapper });

      // Begin sign out
      act(() => {
        result.current.beginSignOut();
      });
      expect(result.current.authState).toBe("signingOut");

      // Call beginSignOut again
      act(() => {
        result.current.beginSignOut();
      });

      // State should still be signingOut (no error, no change)
      expect(result.current.authState).toBe("signingOut");
    });
  });

  // --------------------------------------------------------------------------
  // ERROR HANDLING TESTS
  // --------------------------------------------------------------------------

  describe("Error handling", () => {
    it("throws error when used outside provider", () => {
      // Suppress console.error for this test
      const originalError = console.error;
      console.error = () => {};

      expect(() => {
        renderHook(() => useAuthContext());
      }).toThrow("useAuthContext must be used within an AuthProvider");

      console.error = originalError;
    });
  });

  // --------------------------------------------------------------------------
  // DERIVED STATE TESTS
  // --------------------------------------------------------------------------

  describe("Derived state", () => {
    it("isSigningOut is true only when authState is signingOut", () => {
      const { result } = renderHook(() => useAuthContext(), { wrapper });

      // Initial: idle -> isSigningOut is false
      expect(result.current.authState).toBe("idle");
      expect(result.current.isSigningOut).toBe(false);

      // After beginSignOut: signingOut -> isSigningOut is true
      act(() => {
        result.current.beginSignOut();
      });
      expect(result.current.authState).toBe("signingOut");
      expect(result.current.isSigningOut).toBe(true);

      // After completeSignOut: idle -> isSigningOut is false
      act(() => {
        result.current.completeSignOut();
      });
      expect(result.current.authState).toBe("idle");
      expect(result.current.isSigningOut).toBe(false);
    });
  });
});
