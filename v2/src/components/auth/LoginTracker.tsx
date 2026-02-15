/**
 * LoginTracker
 *
 * Records a login event once per browser session. Uses sessionStorage
 * to ensure the mutation fires exactly once — on the first page load
 * after sign-in — regardless of auth method (password, OAuth, OTP).
 *
 * The Convex Auth library's createOrUpdateUser callback only fires for
 * OAuth and new accounts, NOT for password sign-ins of existing users.
 * This client-side component covers ALL auth flows reliably.
 */

"use client";

import { useEffect, useRef } from "react";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";

const SESSION_KEY = "perm_login_recorded";

export function LoginTracker() {
  const { isAuthenticated } = useConvexAuth();
  const recordMyLogin = useMutation(api.users.recordMyLogin);
  const hasFired = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || hasFired.current) return;

    // Only fire once per browser session
    if (sessionStorage.getItem(SESSION_KEY)) return;

    hasFired.current = true;
    sessionStorage.setItem(SESSION_KEY, "1");

    recordMyLogin().catch((error) => {
      // Non-critical — don't break the app for login tracking
      console.error("[LoginTracker] Failed to record login:", error);
      // Reset so it can retry next navigation
      sessionStorage.removeItem(SESSION_KEY);
      hasFired.current = false;
    });
  }, [isAuthenticated, recordMyLogin]);

  return null;
}
