/**
 * useUnsavedChanges Hook
 *
 * Tracks form dirty state and warns users before navigating away with unsaved changes.
 * Handles browser close/refresh, browser back/forward navigation, and in-app navigation.
 *
 * Features:
 * - Browser close/refresh warning via beforeunload event
 * - Browser back/forward navigation interception via popstate event
 * - Exposes state for use with UnsavedChangesDialog for in-app navigation
 * - Automatically resets when submission is in progress
 *
 * @example
 * const { isDirty, setDirty, confirmNavigation, shouldShowDialog } = useUnsavedChanges();
 *
 * // Track form changes
 * useEffect(() => {
 *   setDirty(formData !== initialData);
 * }, [formData, initialData, setDirty]);
 *
 * // Show dialog when navigating
 * <UnsavedChangesDialog
 *   open={shouldShowDialog}
 *   onStay={cancelNavigation}
 *   onLeave={confirmNavigation}
 * />
 *
 * Phase: 21+ (UI/UX Global)
 * Created: 2025-12-27
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface UseUnsavedChangesOptions {
  /**
   * Initial dirty state (default: false)
   */
  initialDirty?: boolean;

  /**
   * Whether form submission is in progress (disables warning)
   */
  isSubmitting?: boolean;

  /**
   * Custom message for beforeunload (browsers may ignore this)
   */
  message?: string;
}

export interface UseUnsavedChangesReturn {
  /**
   * Whether the form has unsaved changes
   */
  isDirty: boolean;

  /**
   * Set the dirty state manually
   */
  setDirty: (dirty: boolean) => void;

  /**
   * Whether the unsaved changes dialog should be shown
   */
  shouldShowDialog: boolean;

  /**
   * Request to navigate away (triggers dialog if dirty)
   * Returns true if navigation should proceed immediately (not dirty)
   */
  requestNavigation: (callback: () => void) => boolean;

  /**
   * Confirm navigation and close dialog
   */
  confirmNavigation: () => void;

  /**
   * Cancel navigation and close dialog
   */
  cancelNavigation: () => void;

  /**
   * Mark changes as saved (resets dirty state)
   */
  markSaved: () => void;

  /**
   * Mark that programmatic navigation is about to occur.
   * Call this before router.push() to prevent cleanup from interfering.
   */
  markNavigating: () => void;
}

export function useUnsavedChanges(
  options: UseUnsavedChangesOptions = {}
): UseUnsavedChangesReturn {
  const {
    initialDirty = false,
    isSubmitting = false,
    message = "You have unsaved changes. Are you sure you want to leave?",
  } = options;

  // Track dirty state
  const [isDirty, setIsDirty] = useState(initialDirty);

  // Track dialog state
  const [shouldShowDialog, setShouldShowDialog] = useState(false);

  // Store pending navigation callback
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);

  // Track if we're handling a popstate navigation
  const isHandlingPopstateRef = useRef(false);
  const pendingPopstateUrlRef = useRef<string | null>(null);

  // Track isSubmitting in a ref so cleanup can access current value
  const isSubmittingRef = useRef(isSubmitting);

  // Update the ref in an effect to avoid updating refs during render
  useEffect(() => {
    isSubmittingRef.current = isSubmitting;
  }, [isSubmitting]);

  // Track whether navigation was successfully initiated (prevents cleanup interference)
  const navigationInitiatedRef = useRef(false);

  // Warn before browser close/refresh
  useEffect(() => {
    // Don't add warning if navigation is already in progress
    if (navigationInitiatedRef.current) return;
    if (!isDirty || isSubmitting) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern browsers ignore custom messages but require returnValue to be set
      e.returnValue = message;
      return message;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty, isSubmitting, message]);

  // Intercept browser back/forward navigation
  useEffect(() => {
    // CRITICAL: Don't re-setup if navigation is already in progress
    // This prevents pushing a new history state that would interfere with router.push()
    if (navigationInitiatedRef.current) return;
    if (!isDirty || isSubmitting) return;

    // Push a duplicate state to enable interception
    // This allows us to detect when user tries to navigate away
    const currentUrl = window.location.href;
    window.history.pushState({ unsavedChangesGuard: true }, "", currentUrl);

    const handlePopstate = (_e: PopStateEvent) => {
      // If we're already handling a popstate (user confirmed), let it proceed
      if (isHandlingPopstateRef.current) {
        isHandlingPopstateRef.current = false;
        return;
      }

      // Store the URL user was trying to go to (will be the URL after popstate)
      pendingPopstateUrlRef.current = window.location.href;

      // Push state back to prevent navigation
      window.history.pushState({ unsavedChangesGuard: true }, "", currentUrl);

      // Show dialog and set callback to actually navigate
      setShouldShowDialog(true);
      setPendingNavigation(() => () => {
        isHandlingPopstateRef.current = true;
        // Navigate to the URL user originally wanted
        if (pendingPopstateUrlRef.current) {
          window.location.href = pendingPopstateUrlRef.current;
        } else {
          window.history.back();
        }
      });
    };

    window.addEventListener("popstate", handlePopstate);
    return () => {
      window.removeEventListener("popstate", handlePopstate);
      // Clean up the duplicate state we pushed if component unmounts while dirty
      // Only pop if we're still on a guarded state AND we're not submitting
      // AND navigation wasn't initiated (to avoid interfering with router.push)
      // (If submitting or navigating, the history change is handled by the navigation)
      if (
        window.history.state?.unsavedChangesGuard &&
        !isSubmittingRef.current &&
        !navigationInitiatedRef.current
      ) {
        window.history.back();
      }
    };
  }, [isDirty, isSubmitting]);

  // Set dirty state
  const setDirty = useCallback((dirty: boolean) => {
    setIsDirty(dirty);
  }, []);

  // Request navigation (triggers dialog if dirty)
  const requestNavigation = useCallback(
    (callback: () => void): boolean => {
      if (!isDirty || isSubmitting) {
        // No unsaved changes or submitting, proceed immediately
        callback();
        return true;
      }

      // Show dialog and store callback
      setShouldShowDialog(true);
      setPendingNavigation(() => callback);
      return false;
    },
    [isDirty, isSubmitting]
  );

  // Confirm navigation (user clicked "Leave")
  const confirmNavigation = useCallback(() => {
    setShouldShowDialog(false);
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    }
  }, [pendingNavigation]);

  // Cancel navigation (user clicked "Stay")
  const cancelNavigation = useCallback(() => {
    setShouldShowDialog(false);
    setPendingNavigation(null);
  }, []);

  // Mark as saved
  const markSaved = useCallback(() => {
    setIsDirty(false);
  }, []);

  // Mark that programmatic navigation is about to occur
  const markNavigating = useCallback(() => {
    navigationInitiatedRef.current = true;
  }, []);

  return {
    isDirty,
    setDirty,
    shouldShowDialog,
    requestNavigation,
    confirmNavigation,
    cancelNavigation,
    markSaved,
    markNavigating,
  };
}
