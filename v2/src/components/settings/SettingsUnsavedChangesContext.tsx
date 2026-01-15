/**
 * SettingsUnsavedChangesContext
 *
 * Context provider for tracking unsaved changes across all settings sections.
 * Allows individual sections to register their dirty state, and provides
 * a central place to check if any section has unsaved changes.
 *
 * Features:
 * - Section registration/unregistration
 * - Aggregated dirty state across all sections
 * - Tab switch confirmation
 * - Browser navigation protection via useUnsavedChanges hook
 * - UnsavedChangesDialog integration
 *
 * Phase: 25 (Settings & Preferences)
 * Created: 2025-12-31
 */

"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  type ReactNode,
} from "react";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { UnsavedChangesDialog } from "@/components/ui/unsaved-changes-dialog";

// ============================================================================
// TYPES
// ============================================================================

interface SettingsUnsavedChangesContextValue {
  /**
   * Register a section's dirty state.
   * Call this whenever a section's dirty state changes.
   *
   * @param sectionId - Unique identifier for the section
   * @param isDirty - Whether the section has unsaved changes
   */
  registerDirtyState: (sectionId: string, isDirty: boolean) => void;

  /**
   * Unregister a section when it unmounts.
   *
   * @param sectionId - The section to unregister
   */
  unregisterSection: (sectionId: string) => void;

  /**
   * Check if any section has unsaved changes.
   */
  hasUnsavedChanges: boolean;

  /**
   * Request to navigate/switch tabs.
   * If there are unsaved changes, shows a confirmation dialog.
   * Returns true if navigation should proceed immediately.
   *
   * @param callback - Function to call if navigation is confirmed
   */
  requestNavigation: (callback: () => void) => boolean;

  /**
   * Mark all changes as saved (clears all dirty states).
   * Use after a successful save operation.
   */
  markAllSaved: () => void;

  /**
   * Get the dirty state for a specific section.
   *
   * @param sectionId - The section to check
   */
  isSectionDirty: (sectionId: string) => boolean;
}

// ============================================================================
// CONTEXT
// ============================================================================

const SettingsUnsavedChangesContext =
  createContext<SettingsUnsavedChangesContextValue | null>(null);

// ============================================================================
// PROVIDER
// ============================================================================

interface SettingsUnsavedChangesProviderProps {
  children: ReactNode;
}

export function SettingsUnsavedChangesProvider({
  children,
}: SettingsUnsavedChangesProviderProps) {
  // Track dirty state for each section
  const [dirtyStates, setDirtyStates] = useState<Record<string, boolean>>({});

  // Calculate aggregate dirty state
  const hasUnsavedChanges = useMemo(
    () => Object.values(dirtyStates).some(Boolean),
    [dirtyStates]
  );

  // Use the unsaved changes hook for browser navigation protection
  const {
    setDirty,
    shouldShowDialog,
    requestNavigation: baseRequestNavigation,
    confirmNavigation,
    cancelNavigation,
    markSaved,
  } = useUnsavedChanges({
    initialDirty: false,
    message: "You have unsaved changes in your settings. Are you sure you want to leave?",
  });

  // Keep the hook's dirty state in sync with our aggregated state
  // Update whenever dirtyStates changes
  useEffect(() => {
    setDirty(hasUnsavedChanges);
  }, [hasUnsavedChanges, setDirty]);

  // Register a section's dirty state
  const registerDirtyState = useCallback(
    (sectionId: string, isDirty: boolean) => {
      setDirtyStates((prev) => {
        if (prev[sectionId] === isDirty) return prev;
        return { ...prev, [sectionId]: isDirty };
      });
    },
    []
  );

  // Unregister a section
  const unregisterSection = useCallback((sectionId: string) => {
    setDirtyStates((prev) => {
      if (!(sectionId in prev)) return prev;
      const next = { ...prev };
      delete next[sectionId];
      return next;
    });
  }, []);

  // Request navigation (for tab switching)
  const requestNavigation = useCallback(
    (callback: () => void): boolean => {
      return baseRequestNavigation(callback);
    },
    [baseRequestNavigation]
  );

  // Mark all changes as saved
  const markAllSaved = useCallback(() => {
    setDirtyStates({});
    markSaved();
  }, [markSaved]);

  // Check if a specific section is dirty
  const isSectionDirty = useCallback(
    (sectionId: string) => {
      return dirtyStates[sectionId] ?? false;
    },
    [dirtyStates]
  );

  const contextValue = useMemo(
    () => ({
      registerDirtyState,
      unregisterSection,
      hasUnsavedChanges,
      requestNavigation,
      markAllSaved,
      isSectionDirty,
    }),
    [
      registerDirtyState,
      unregisterSection,
      hasUnsavedChanges,
      requestNavigation,
      markAllSaved,
      isSectionDirty,
    ]
  );

  return (
    <SettingsUnsavedChangesContext.Provider value={contextValue}>
      {children}
      <UnsavedChangesDialog
        open={shouldShowDialog}
        onStay={cancelNavigation}
        onLeave={confirmNavigation}
        title="Unsaved Settings"
        description="You have unsaved changes in your settings. Are you sure you want to leave? Your changes will be lost."
        stayText="Stay"
        leaveText="Leave Without Saving"
      />
    </SettingsUnsavedChangesContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook to access the settings unsaved changes context.
 * Must be used within a SettingsUnsavedChangesProvider.
 */
export function useSettingsUnsavedChanges(): SettingsUnsavedChangesContextValue {
  const context = useContext(SettingsUnsavedChangesContext);
  if (!context) {
    throw new Error(
      "useSettingsUnsavedChanges must be used within a SettingsUnsavedChangesProvider"
    );
  }
  return context;
}

/**
 * Hook for individual settings sections to register their dirty state.
 * Automatically handles registration/unregistration on mount/unmount.
 *
 * @param sectionId - Unique identifier for this section
 * @param isDirty - Whether this section has unsaved changes
 *
 * @example
 * useSettingsSectionDirtyState("profile", isDirty);
 */
export function useSettingsSectionDirtyState(
  sectionId: string,
  isDirty: boolean
): void {
  const { registerDirtyState, unregisterSection } = useSettingsUnsavedChanges();

  // Register dirty state whenever it changes
  useEffect(() => {
    registerDirtyState(sectionId, isDirty);
  }, [sectionId, isDirty, registerDirtyState]);

  // Unregister on unmount
  useEffect(() => {
    return () => {
      unregisterSection(sectionId);
    };
  }, [sectionId, unregisterSection]);
}
