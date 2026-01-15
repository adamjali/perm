/**
 * Demo localStorage CRUD Operations
 *
 * Provides localStorage-based storage for demo cases when user is not authenticated.
 * Includes React hook for state synchronization.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { generateDemoCaseId } from "./types";
import type { DemoCase, CreateDemoCaseInput, UpdateDemoCaseInput } from "./types";
import { DEFAULT_DEMO_CASES } from "./defaultCases";

// ============================================================================
// Constants
// ============================================================================

/** localStorage key for demo cases */
export const DEMO_CASES_KEY = "perm-tracker-demo-cases";

/** Version key for tracking data migrations */
export const DEMO_CASES_VERSION_KEY = "perm-tracker-demo-cases-version";

/** Current version of demo case storage schema */
export const DEMO_CASES_VERSION = 1;

// ============================================================================
// Storage Result Types
// ============================================================================

/** Error types for storage operations */
export type StorageErrorType = "quota_exceeded" | "storage_unavailable" | "parse_error" | "unknown";

/** Result of a storage write operation */
export interface StorageResult {
  success: boolean;
  error?: StorageErrorType;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get current ISO timestamp.
 */
function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Check if code is running in browser (not SSR).
 */
function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

// ============================================================================
// Core CRUD Operations
// ============================================================================

/**
 * Get all demo cases from localStorage.
 * Returns empty array if no cases exist or on error.
 *
 * @returns Array of demo cases
 */
export function getDemoCases(): DemoCase[] {
  if (!isBrowser()) {
    return [];
  }

  try {
    const stored = localStorage.getItem(DEMO_CASES_KEY);
    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      console.warn("Demo cases data is not an array, returning empty");
      return [];
    }

    return parsed as DemoCase[];
  } catch (error) {
    console.error("Error reading demo cases from localStorage:", error);
    return [];
  }
}

/**
 * Save all demo cases to localStorage.
 *
 * @param cases - Array of demo cases to save
 * @returns StorageResult indicating success or error type
 */
export function setDemoCases(cases: DemoCase[]): StorageResult {
  if (!isBrowser()) {
    return { success: false, error: "storage_unavailable" };
  }

  try {
    localStorage.setItem(DEMO_CASES_KEY, JSON.stringify(cases));
    localStorage.setItem(DEMO_CASES_VERSION_KEY, String(DEMO_CASES_VERSION));
    return { success: true };
  } catch (error) {
    console.error("Error saving demo cases to localStorage:", error);
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
      console.warn("localStorage quota exceeded, unable to save demo cases");
      return { success: false, error: "quota_exceeded" };
    }
    return { success: false, error: "unknown" };
  }
}

/** Result of adding a demo case */
export interface AddDemoCaseResult {
  case: DemoCase;
  storageResult: StorageResult;
}

/**
 * Add a new demo case.
 *
 * @param input - Case data without id/timestamps
 * @returns The created case and storage operation result
 */
export function addDemoCase(input: CreateDemoCaseInput): AddDemoCaseResult {
  const now = getCurrentTimestamp();
  const newCase: DemoCase = {
    ...input,
    id: generateDemoCaseId(),
    createdAt: now,
    updatedAt: now,
  };

  const cases = getDemoCases();
  cases.push(newCase);
  const storageResult = setDemoCases(cases);

  return { case: newCase, storageResult };
}

/** Result of updating a demo case */
export interface UpdateDemoCaseResult {
  case: DemoCase | null;
  storageResult: StorageResult;
}

/**
 * Update an existing demo case.
 *
 * @param id - Case ID to update
 * @param updates - Partial case data to merge
 * @returns Updated case (or null if not found) and storage result
 */
export function updateDemoCase(
  id: string,
  updates: UpdateDemoCaseInput
): UpdateDemoCaseResult {
  const cases = getDemoCases();
  const index = cases.findIndex((c) => c.id === id);

  if (index === -1) {
    console.warn(`Demo case with id ${id} not found`);
    return { case: null, storageResult: { success: true } };
  }

  const existingCase = cases[index];
  if (!existingCase) {
    console.warn(`Demo case with id ${id} not found at index ${index}`);
    return { case: null, storageResult: { success: true } };
  }

  const updatedCase: DemoCase = {
    ...existingCase,
    ...updates,
    id: existingCase.id, // Preserve original id
    createdAt: existingCase.createdAt, // Preserve original createdAt
    updatedAt: getCurrentTimestamp(),
  };

  cases[index] = updatedCase;
  const storageResult = setDemoCases(cases);

  return { case: updatedCase, storageResult };
}

/** Result of deleting a demo case */
export interface DeleteDemoCaseResult {
  deleted: boolean;
  storageResult: StorageResult;
}

/**
 * Delete a demo case by ID.
 *
 * @param id - Case ID to delete
 * @returns Whether case was found and storage result
 */
export function deleteDemoCase(id: string): DeleteDemoCaseResult {
  const cases = getDemoCases();
  const index = cases.findIndex((c) => c.id === id);

  if (index === -1) {
    console.warn(`Demo case with id ${id} not found`);
    return { deleted: false, storageResult: { success: true } };
  }

  cases.splice(index, 1);
  const storageResult = setDemoCases(cases);

  return { deleted: true, storageResult };
}

/**
 * Get a single demo case by ID.
 *
 * @param id - Case ID to find
 * @returns Demo case or null if not found
 */
export function getDemoCaseById(id: string): DemoCase | null {
  const cases = getDemoCases();
  return cases.find((c) => c.id === id) ?? null;
}

/**
 * Reset demo cases to default state.
 * Clears all existing cases and restores defaults.
 *
 * @returns StorageResult indicating success or error
 */
export function resetDemoCases(): StorageResult {
  return setDemoCases(DEFAULT_DEMO_CASES);
}

/**
 * Clear all demo cases.
 *
 * @returns StorageResult indicating success or error
 */
export function clearDemoCases(): StorageResult {
  return setDemoCases([]);
}

/** Result of initializing demo cases */
export interface InitDemoCasesResult {
  initialized: boolean;
  storageResult: StorageResult;
}

/**
 * Initialize demo cases if empty.
 * Only populates with defaults if no cases exist.
 *
 * @returns Whether initialized with defaults and storage result
 */
export function initDemoCases(): InitDemoCasesResult {
  const existing = getDemoCases();
  if (existing.length === 0) {
    const storageResult = setDemoCases(DEFAULT_DEMO_CASES);
    return { initialized: true, storageResult };
  }
  return { initialized: false, storageResult: { success: true } };
}

/**
 * Check if demo cases have been initialized.
 */
export function hasDemoCases(): boolean {
  return getDemoCases().length > 0;
}

// ============================================================================
// React Hook
// ============================================================================

/**
 * React hook for managing demo cases with automatic state synchronization.
 *
 * @returns Object with cases array, CRUD operations, and error state
 *
 * @example
 * ```tsx
 * const { cases, addCase, updateCase, deleteCase, resetCases, error, clearError } = useDemoCases();
 *
 * // Add a new case
 * const newCase = addCase({
 *   beneficiaryName: "John Doe",
 *   employerName: "Acme Corp",
 *   status: "pwd",
 *   progressStatus: "working",
 *   isProfessionalOccupation: false,
 *   isFavorite: false,
 * });
 *
 * // Check for errors after operations
 * if (error) {
 *   toast.error("Failed to save changes");
 *   clearError();
 * }
 * ```
 */
export function useDemoCases() {
  const [cases, setCasesState] = useState<DemoCase[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<StorageErrorType | null>(null);

  // Clear error state
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Load cases from localStorage on mount
  useEffect(() => {
    const loadCases = () => {
      const stored = getDemoCases();
      if (stored.length === 0) {
        // Initialize with defaults if empty
        const result = setDemoCases(DEFAULT_DEMO_CASES);
        if (!result.success && result.error) {
          setError(result.error);
        }
        setCasesState(DEFAULT_DEMO_CASES);
      } else {
        setCasesState(stored);
      }
      setIsInitialized(true);
    };

    loadCases();
  }, []);

  // Listen for storage events (cross-tab sync)
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === DEMO_CASES_KEY) {
        const newCases = getDemoCases();
        setCasesState(newCases);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const addCase = useCallback((input: CreateDemoCaseInput): DemoCase => {
    const { case: newCase, storageResult } = addDemoCase(input);
    if (!storageResult.success && storageResult.error) {
      setError(storageResult.error);
    }
    setCasesState((prev) => [...prev, newCase]);
    return newCase;
  }, []);

  const updateCase = useCallback(
    (id: string, updates: UpdateDemoCaseInput): DemoCase | null => {
      const { case: updated, storageResult } = updateDemoCase(id, updates);
      if (!storageResult.success && storageResult.error) {
        setError(storageResult.error);
      }
      if (updated) {
        setCasesState((prev) =>
          prev.map((c) => (c.id === id ? updated : c))
        );
      }
      return updated;
    },
    []
  );

  const deleteCase = useCallback((id: string): boolean => {
    const { deleted, storageResult } = deleteDemoCase(id);
    if (!storageResult.success && storageResult.error) {
      setError(storageResult.error);
    }
    if (deleted) {
      setCasesState((prev) => prev.filter((c) => c.id !== id));
    }
    return deleted;
  }, []);

  const resetCases = useCallback(() => {
    const result = resetDemoCases();
    if (!result.success && result.error) {
      setError(result.error);
    }
    setCasesState(DEFAULT_DEMO_CASES);
  }, []);

  const clearCases = useCallback(() => {
    const result = clearDemoCases();
    if (!result.success && result.error) {
      setError(result.error);
    }
    setCasesState([]);
  }, []);

  const getCase = useCallback(
    (id: string): DemoCase | null => {
      return cases.find((c) => c.id === id) ?? null;
    },
    [cases]
  );

  return {
    cases,
    isInitialized,
    error,
    clearError,
    addCase,
    updateCase,
    deleteCase,
    resetCases,
    clearCases,
    getCase,
  };
}
