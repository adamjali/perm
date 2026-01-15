/**
 * Auth-Aware Toast Wrapper
 *
 * Drop-in replacement for `import { toast } from "sonner"`.
 * Suppresses toasts when user is signing out to prevent async operations
 * from showing stale notifications.
 *
 * Architecture:
 * - Singleton ref holds current `isSigningOut` state
 * - AuthContext syncs state via `updateToastAuthState()` setter
 * - All toast methods check ref before forwarding to Sonner
 *
 * Usage:
 *   import { toast } from "@/lib/toast"; // Instead of "sonner"
 *   toast.success("Case updated");        // Suppressed if signing out
 *
 * Works everywhere:
 * - Inside React components
 * - In async callbacks (setTimeout, fetch.then, etc.)
 * - In custom hooks
 * - In event handlers
 *
 * Phase: 32-05 (Auth-Aware Toasts)
 * Created: 2026-01-13
 */

import { toast as sonnerToast, type ExternalToast } from "sonner";
import type { ReactElement, ReactNode } from "react";

// ============================================================================
// SINGLETON STATE BRIDGE
// ============================================================================

/**
 * Singleton ref that holds the current sign-out state.
 * Updated by AuthContext via updateToastAuthState().
 *
 * Default: false (toasts allowed)
 */
let isSigningOutRef = false;

/**
 * Updates the sign-out state from AuthContext.
 * Called by AuthContext.tsx when authState changes.
 *
 * @param isSigningOut - true when user is signing out
 */
export function updateToastAuthState(isSigningOut: boolean): void {
  isSigningOutRef = isSigningOut;
}

/**
 * Gets current sign-out state (for testing).
 * @internal
 */
export function getToastAuthState(): boolean {
  return isSigningOutRef;
}

// ============================================================================
// GUARD HELPER
// ============================================================================

/**
 * Checks if toast should be shown.
 * Returns false if user is signing out.
 */
function shouldShowToast(): boolean {
  return !isSigningOutRef;
}

// ============================================================================
// WRAPPED TOAST METHODS
// ============================================================================

type ToastMessage = ReactNode;
type ToastData = ExternalToast;

/**
 * Auth-aware toast object.
 * Same API as sonner, but suppresses toasts during sign-out.
 */
export const toast = Object.assign(
  // Default toast (callable as function)
  (message: ToastMessage, data?: ToastData) => {
    if (!shouldShowToast()) return;
    return sonnerToast(message, data);
  },
  {
    /**
     * Success toast (green checkmark)
     */
    success: (message: ToastMessage, data?: ToastData) => {
      if (!shouldShowToast()) return;
      return sonnerToast.success(message, data);
    },

    /**
     * Error toast (red X)
     */
    error: (message: ToastMessage, data?: ToastData) => {
      if (!shouldShowToast()) return;
      return sonnerToast.error(message, data);
    },

    /**
     * Warning toast (yellow triangle)
     */
    warning: (message: ToastMessage, data?: ToastData) => {
      if (!shouldShowToast()) return;
      return sonnerToast.warning(message, data);
    },

    /**
     * Info toast (blue info icon)
     */
    info: (message: ToastMessage, data?: ToastData) => {
      if (!shouldShowToast()) return;
      return sonnerToast.info(message, data);
    },

    /**
     * Loading toast (spinner)
     */
    loading: (message: ToastMessage, data?: ToastData) => {
      if (!shouldShowToast()) return;
      return sonnerToast.loading(message, data);
    },

    /**
     * Custom toast with React component
     */
    custom: (jsx: (id: number | string) => ReactElement, data?: ToastData) => {
      if (!shouldShowToast()) return;
      return sonnerToast.custom(jsx, data);
    },

    /**
     * Message toast (alias for default)
     */
    message: (message: ToastMessage, data?: ToastData) => {
      if (!shouldShowToast()) return;
      return sonnerToast.message(message, data);
    },

    /**
     * Promise-based toast (loading → success/error)
     * Note: Promise still executes, only toast is suppressed
     */
    promise: <T,>(
      promise: Promise<T>,
      data?: ExternalToast & {
        loading?: string | ReactNode;
        success?: string | ReactNode | ((data: T) => ReactNode | string);
        error?: string | ReactNode | ((error: unknown) => ReactNode | string);
        finally?: () => void | Promise<void>;
      }
    ) => {
      if (!shouldShowToast()) {
        // Still return the promise wrapped to match sonner's API
        return { unwrap: () => promise };
      }
      return sonnerToast.promise(promise, data);
    },

    /**
     * Dismiss a toast by ID, or all toasts if no ID.
     * Always allowed (cleanup should never be blocked)
     */
    dismiss: (toastId?: string | number) => {
      sonnerToast.dismiss(toastId);
    },
  }
);

// Re-export Sonner types for convenience
export type { ExternalToast } from "sonner";
