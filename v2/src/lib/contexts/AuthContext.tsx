"use client";

/**
 * AuthContext
 * Provides global authentication state management for sign-out handling.
 *
 * Features:
 * - Action-based interface (prevents invalid state transitions)
 * - Tracks "signing out" state to prevent query errors during sign out
 * - Used by dashboard components to skip queries when signing out
 *
 * State Machine:
 * - idle: Normal operation
 * - signingOut: Sign-out in progress (queries should be skipped)
 *
 * Transitions:
 * - beginSignOut(): idle → signingOut
 * - completeSignOut(): signingOut → idle (success, component unmounts)
 * - cancelSignOut(): signingOut → idle (error recovery)
 *
 * Phase: 20 (Dashboard + UI Polish)
 * Created: 2025-12-24
 * Updated: 2025-12-24 - Refactored to action-based interface
 */

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { updateToastAuthState } from "@/lib/toast";

// ============================================================================
// TYPES
// ============================================================================

type AuthState = "idle" | "signingOut";

interface AuthContextValue {
  /** Current auth state */
  readonly authState: AuthState;

  /** Convenience getter for checking sign-out state */
  readonly isSigningOut: boolean;

  /**
   * Begin sign-out process.
   * Transitions: idle → signingOut
   * No-op if already signing out.
   */
  beginSignOut: () => void;

  /**
   * Mark sign-out as complete.
   * Transitions: signingOut → idle
   * Called after successful sign-out (before redirect).
   */
  completeSignOut: () => void;

  /**
   * Cancel sign-out (error recovery).
   * Transitions: signingOut → idle
   * Called when sign-out fails and user should retry.
   */
  cancelSignOut: () => void;
}

// ============================================================================
// CONTEXT
// ============================================================================

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ============================================================================
// PROVIDER
// ============================================================================

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>("idle");

  // Sync auth state to toast singleton for auth-aware toast suppression
  // This allows toasts to be suppressed even in async callbacks outside React
  useEffect(() => {
    updateToastAuthState(authState === "signingOut");
  }, [authState]);

  const beginSignOut = useCallback(() => {
    setAuthState((current) => {
      // Only transition from idle to signingOut
      if (current === "idle") {
        return "signingOut";
      }
      return current;
    });
  }, []);

  const completeSignOut = useCallback(() => {
    setAuthState("idle");
  }, []);

  const cancelSignOut = useCallback(() => {
    setAuthState("idle");
  }, []);

  const value: AuthContextValue = {
    authState,
    isSigningOut: authState === "signingOut",
    beginSignOut,
    completeSignOut,
    cancelSignOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook to access authentication context.
 *
 * @returns AuthContextValue with state and action functions
 * @throws Error if used outside of AuthProvider
 *
 * @example
 * const { isSigningOut, beginSignOut, cancelSignOut } = useAuthContext();
 *
 * const handleSignOut = async () => {
 *   beginSignOut();
 *   try {
 *     await signOut();
 *   } catch (error) {
 *     cancelSignOut();
 *     toast.error("Failed to sign out");
 *   }
 * };
 */
export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
}
