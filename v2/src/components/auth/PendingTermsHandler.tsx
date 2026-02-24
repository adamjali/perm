/**
 * PendingTermsHandler
 *
 * Safety-net component that ensures a user profile exists for authenticated users.
 *
 * Handles the edge case where a user is authenticated but their profile record
 * is missing (e.g., auth callback failure after account deletion + re-signup).
 * The reactive query re-fires once the profile is created.
 *
 * Terms acceptance is now handled automatically at profile creation time via
 * buildDefaultProfile() in convex/lib/userDefaults.ts — no explicit consent
 * step is needed. Passive consent text on signup/login pages provides notice.
 *
 * Must be rendered inside a ConvexProvider with authenticated user.
 */

"use client";

import { useEffect, useRef } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { captureError } from "@/lib/sentry";

export function PendingTermsHandler() {
  const { isAuthenticated } = useConvexAuth();
  const ensureProfile = useMutation(api.users.ensureUserProfile);
  const profile = useQuery(api.users.currentUserProfile);
  const hasCreatedProfile = useRef(false);

  useEffect(() => {
    // Wait for profile query to load
    if (profile === undefined) return;

    // If profile is null and user is authenticated, create the missing profile.
    // This is a safety net for callback failures (e.g., account re-creation after deletion).
    if (profile === null && isAuthenticated && !hasCreatedProfile.current) {
      hasCreatedProfile.current = true;
      ensureProfile({})
        .then(() => {
          console.log("[PendingTermsHandler] Safety net: created missing user profile");
        })
        .catch((error) => {
          console.error("[PendingTermsHandler] Failed to create user profile:", error);
          captureError(error);
          hasCreatedProfile.current = false;
        });
    }
  }, [profile, isAuthenticated, ensureProfile]);

  return null;
}
