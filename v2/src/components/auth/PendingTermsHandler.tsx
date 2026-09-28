"use client";

// DECLARED, not inherited (2026-09-01). This module uses useEffect, so it is a
// client module in every sense except the annotation. It worked without one
// only because every path that reached it happened to cross somebody else's
// `"use client"` boundary first, which made it a latent trap: move a boundary
// anywhere above it and this lands on the server, where the API does not exist.
// See lib/ai/page-context.tsx for the failure this actually caused.

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
 * buildDefaultProfile() in convex/lib/userDefaults.ts, no explicit consent
 * step is needed. Passive consent text on signup/login pages provides notice.
 *
 * Must be rendered inside a ConvexProvider with authenticated user.
 */

"use client";

import { useEffect, useRef } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { captureError } from "@/lib/sentry";
import { useAuthContextOptional } from "@/lib/contexts/AuthContext";

export function PendingTermsHandler() {
  const { isAuthenticated } = useConvexAuth();
  // While signing out (including right after "Delete now" purged the
  // account) a missing profile is expected, not a failure to repair.
  const isSigningOut = useAuthContextOptional()?.isSigningOut ?? false;
  const ensureProfile = useMutation(api.users.ensureUserProfile);
  const profile = useQuery(api.users.currentUserProfile, isSigningOut ? "skip" : {});
  const hasCreatedProfile = useRef(false);

  useEffect(() => {
    // Wait for profile query to load (it is skipped while signing out)
    if (isSigningOut || profile === undefined) return;

    // If profile is null and user is authenticated, create the missing profile.
    // This is a safety net for callback failures (e.g., account re-creation after deletion).
    if (profile === null && isAuthenticated && !hasCreatedProfile.current) {
      hasCreatedProfile.current = true;
      ensureProfile({})
        .then((profileId) => {
          // null: the server declined (the account is deleted or being deleted).
          if (profileId) console.log("[PendingTermsHandler] Safety net: created missing user profile");
        })
        .catch((error) => {
          console.error("[PendingTermsHandler] Failed to create user profile:", error);
          captureError(error);
          hasCreatedProfile.current = false;
        });
    }
  }, [profile, isAuthenticated, ensureProfile, isSigningOut]);

  return null;
}
