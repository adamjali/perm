/**
 * PendingTermsHandler
 *
 * Client component that handles pending terms acceptance after OAuth redirect.
 *
 * This component:
 * 1. If authenticated but no profile exists, creates one (safety net for callback failures)
 * 2. Checks localStorage for pending terms acceptance (saved before Google OAuth from signup)
 * 3. If found and valid (not expired), calls acceptTermsOfService mutation
 * 4. If no pending terms AND no termsAcceptedAt, shows TermsAcceptanceModal
 * 5. Clears localStorage after successful recording
 *
 * Must be rendered inside a ConvexProvider with authenticated user.
 *
 * Flow A (Google OAuth from /signup page - checkbox checked):
 * 1. User on /signup checks terms checkbox
 * 2. User clicks "Sign up with Google"
 * 3. savePendingTermsAcceptance() saves to localStorage
 * 4. Google OAuth redirect happens
 * 5. User returns, lands on /dashboard
 * 6. This component mounts, reads localStorage
 * 7. Calls acceptTermsOfService mutation
 * 8. Clears localStorage, no modal needed
 *
 * Flow B (Google OAuth from /login page - new user, no checkbox):
 * 1. User on /login clicks "Sign in with Google"
 * 2. Google OAuth creates new account
 * 3. User lands on /dashboard
 * 4. This component mounts, no localStorage, no termsAcceptedAt
 * 5. Shows TermsAcceptanceModal
 * 6. User accepts → mutation called → modal closes
 *
 * Flow C (Account re-creation after deletion):
 * 1. User deletes account (all data wiped)
 * 2. User signs in with Google again
 * 3. New user created but afterUserCreatedOrUpdated callback may fail
 * 4. This component detects null profile + authenticated → creates profile
 * 5. New profile has no termsAcceptedAt → shows TermsAcceptanceModal
 *
 * Phase: 32 (Data Migration / Go-Live polish)
 * Created: 2026-01-13
 * Updated: 2026-02-02 - Handle null profile when authenticated (safety net for callback failures)
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  getPendingTermsAcceptance,
  clearPendingTermsAcceptance,
} from "@/lib/auth/termsStorage";
import { TermsAcceptanceModal } from "./TermsAcceptanceModal";

export function PendingTermsHandler() {
  const router = useRouter();
  const { signOut } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();
  const acceptTerms = useMutation(api.users.acceptTermsOfService);
  const ensureProfile = useMutation(api.users.ensureUserProfile);
  const profile = useQuery(api.users.currentUserProfile);
  const hasProcessed = useRef(false);
  const hasCreatedProfile = useRef(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // Skip if already processed (React strict mode double-mount)
    if (hasProcessed.current) {
      return;
    }

    // Wait for profile to load
    if (profile === undefined) {
      return; // Still loading
    }

    // If profile is null, check if user is authenticated
    // Profile can be null in two cases:
    // 1. User is not authenticated (getCurrentUserIdOrNull returns null)
    // 2. User IS authenticated but profile record doesn't exist (e.g. callback failure after deletion + re-signup)
    if (profile === null) {
      if (!isAuthenticated || hasCreatedProfile.current) {
        return;
      }
      // Safety net: create the missing profile. The reactive query will
      // re-fire once the profile exists, and the terms check will proceed.
      hasCreatedProfile.current = true;
      ensureProfile({})
        .then(() => {
          console.log("[PendingTermsHandler] Safety net: created missing user profile");
        })
        .catch((error) => {
          console.error("[PendingTermsHandler] Failed to create user profile:", error);
          hasCreatedProfile.current = false;
        });
      return;
    }

    // If user already has terms accepted, no need to check anything
    if (profile.termsAcceptedAt) {
      // Clear any stale pending terms
      clearPendingTermsAcceptance();
      return;
    }

    // Check for pending terms acceptance from OAuth flow (signup page)
    const pendingVersion = getPendingTermsAcceptance();
    if (pendingVersion) {
      // Mark as processing to prevent double-execution
      hasProcessed.current = true;

      // Record terms acceptance (from localStorage - signup flow)
      acceptTerms({ termsVersion: pendingVersion })
        .then(() => {
          console.log("[PendingTermsHandler] Terms acceptance recorded for Google OAuth user (signup flow)");
          clearPendingTermsAcceptance();
        })
        .catch((error) => {
          console.error("[PendingTermsHandler] Failed to record terms acceptance:", error);
          // Clear anyway to prevent infinite retries
          clearPendingTermsAcceptance();
          // Reset flag so it can retry on next mount if needed
          hasProcessed.current = false;
        });
      return;
    }

    // No pending terms in localStorage AND no termsAcceptedAt
    // This means user signed in via Google from login page (new user, bypassed signup)
    // Show the terms acceptance modal
    hasProcessed.current = true;
    setShowModal(true);
  }, [profile, acceptTerms, isAuthenticated, ensureProfile]);

  // Handle modal acceptance
  const handleAccepted = () => {
    setShowModal(false);
    // Reset hasProcessed so future checks work correctly
    hasProcessed.current = false;
  };

  // Handle modal decline - sign out and redirect to login
  const handleDecline = async () => {
    setShowModal(false);
    hasProcessed.current = false;
    await signOut();
    router.push("/login");
  };

  // Show modal for new Google users from login page
  if (showModal) {
    return (
      <TermsAcceptanceModal
        open={showModal}
        onAccepted={handleAccepted}
        onDecline={handleDecline}
      />
    );
  }

  // No UI needed for the silent localStorage flow
  return null;
}
