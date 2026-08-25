/**
 * LoginTracker
 *
 * Fallback login counter for OAuth flows (Google sign-in) where we
 * can’t call recordMyLogin() directly because the page redirects.
 *
 * For password logins, recordMyLogin() is called directly in
 * LoginPageClient after successful signIn().
 *
 * Uses localStorage with a 30-second debounce to avoid double-counting
 * when both this component and the login page fire for the same login.
 *
 * Also identifies the user in PostHog and fires a `user_logged_in` event
 * (debounced to match the login recording).
 *
 * Users listed in POSTHOG_EXCLUDED_EMAILS env var are opted out of all
 * PostHog capturing to preserve quota.
 */

"use client";

import { useEffect, useRef } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { analytics } from "@/lib/analytics";
import { captureError } from "@/lib/sentry";

const LAST_LOGIN_KEY = "perm_last_login_at";
const DEBOUNCE_MS = 30 * 1000; // 30 seconds — avoid double-counting

export function LoginTracker() {
  const { isAuthenticated } = useConvexAuth();
  const recordMyLogin = useMutation(api.users.recordMyLogin);
  const hasFired = useRef(false);

  // Fetch profile for PostHog identify
  const profile = useQuery(
    api.users.currentUserProfile,
    isAuthenticated ? undefined : "skip"
  );

  // Check if user should be excluded from PostHog
  const isExcluded = useQuery(
    api.users.isPostHogExcluded,
    isAuthenticated ? undefined : "skip"
  );

  // Handle PostHog opt-out for excluded users
  useEffect(() => {
    if (isExcluded === undefined) return; // Still loading
    if (isExcluded) {
      analytics.optOut();
    } else if (analytics.hasOptedOut()) {
      // User was previously excluded but no longer — re-enable
      analytics.optIn();
    }
  }, [isExcluded]);

  useEffect(() => {
    if (!isAuthenticated || !profile || hasFired.current) return;
    // Skip all analytics for excluded users
    if (isExcluded) return;

    // Always identify (idempotent) so subsequent events are attributed correctly
    analytics.identify(profile._id, { name: profile.fullName });

    // Skip login recording + event if already recorded recently (by LoginPageClient)
    const lastLoginStr = localStorage.getItem(LAST_LOGIN_KEY);
    const lastLogin = lastLoginStr ? Number(lastLoginStr) : 0;
    if (Date.now() - lastLogin < DEBOUNCE_MS) return;

    hasFired.current = true;
    localStorage.setItem(LAST_LOGIN_KEY, String(Date.now()));

    analytics.capture("user_logged_in", { auth_method: "oauth_or_password" });

    recordMyLogin().catch((error) => {
      console.error("[LoginTracker] Failed to record login:", error);
      captureError(error, { operation: "LoginTracker.recordMyLogin" });
      localStorage.removeItem(LAST_LOGIN_KEY);
      hasFired.current = false;
    });
  }, [isAuthenticated, profile, recordMyLogin, isExcluded]);

  return null;
}
