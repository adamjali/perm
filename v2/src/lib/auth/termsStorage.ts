/**
 * Terms Acceptance Storage
 *
 * Persists terms acceptance state in localStorage during OAuth redirect flows.
 * Used to restore terms acceptance after Google OAuth redirect completes.
 *
 * Flow:
 * 1. User checks terms checkbox on signup page
 * 2. User clicks "Sign up with Google"
 * 3. Before redirect, we save { accepted: true, version: "2026-01-03", timestamp: Date.now() }
 * 4. Google OAuth redirect happens (loses React state)
 * 5. After redirect, user lands on dashboard
 * 6. Dashboard (or provider) checks localStorage, finds pending terms
 * 7. Calls acceptTermsOfService mutation
 * 8. Clears localStorage
 *
 * Security:
 * - Only stores boolean + version string, no sensitive data
 * - Auto-expires after 5 minutes (prevents stale data)
 * - Cleared immediately after successful use
 */

"use client";

// ============================================================================
// Constants
// ============================================================================

/** localStorage key for pending terms acceptance */
export const PENDING_TERMS_KEY = "perm-tracker-pending-terms";

/** Expiration time in milliseconds (5 minutes) */
const EXPIRATION_MS = 5 * 60 * 1000;

// ============================================================================
// Types
// ============================================================================

interface PendingTermsData {
  accepted: true;
  version: string;
  timestamp: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if code is running in browser (not SSR).
 */
function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

// ============================================================================
// Storage Operations
// ============================================================================

/**
 * Save pending terms acceptance before OAuth redirect.
 *
 * @param version - Terms version being accepted (e.g., "2026-01-03")
 * @returns true if saved successfully, false otherwise
 */
export function savePendingTermsAcceptance(version: string): boolean {
  if (!isBrowser()) {
    return false;
  }

  try {
    const data: PendingTermsData = {
      accepted: true,
      version,
      timestamp: Date.now(),
    };
    localStorage.setItem(PENDING_TERMS_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error("[Terms Storage] Failed to save pending terms:", error);
    return false;
  }
}

/**
 * Get pending terms acceptance if valid (not expired).
 *
 * @returns Terms version if pending and valid, null otherwise
 */
export function getPendingTermsAcceptance(): string | null {
  if (!isBrowser()) {
    return null;
  }

  try {
    const stored = localStorage.getItem(PENDING_TERMS_KEY);
    if (!stored) {
      return null;
    }

    const data: PendingTermsData = JSON.parse(stored);

    // Validate data structure
    if (!data.accepted || !data.version || !data.timestamp) {
      console.warn("[Terms Storage] Invalid data structure, clearing");
      clearPendingTermsAcceptance();
      return null;
    }

    // Check expiration
    const age = Date.now() - data.timestamp;
    if (age > EXPIRATION_MS) {
      console.log("[Terms Storage] Pending terms expired, clearing");
      clearPendingTermsAcceptance();
      return null;
    }

    return data.version;
  } catch (error) {
    console.error("[Terms Storage] Failed to read pending terms:", error);
    clearPendingTermsAcceptance();
    return null;
  }
}

/**
 * Clear pending terms acceptance from storage.
 * Call after successfully recording terms or on error.
 */
export function clearPendingTermsAcceptance(): void {
  if (!isBrowser()) {
    return;
  }

  try {
    localStorage.removeItem(PENDING_TERMS_KEY);
  } catch (error) {
    console.error("[Terms Storage] Failed to clear pending terms:", error);
  }
}

/**
 * Check if there are pending terms to accept.
 *
 * @returns true if there are valid pending terms
 */
export function hasPendingTermsAcceptance(): boolean {
  return getPendingTermsAcceptance() !== null;
}
