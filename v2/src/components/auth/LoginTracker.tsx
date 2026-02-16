/**
 * LoginTracker
 *
 * Fallback login counter for OAuth flows (Google sign-in) where we
 * can't call recordMyLogin() directly because the page redirects.
 *
 * For password logins, recordMyLogin() is called directly in
 * LoginPageClient after successful signIn().
 *
 * Uses localStorage with a 30-second debounce to avoid double-counting
 * when both this component and the login page fire for the same login.
 */

"use client";

import { useEffect, useRef } from "react";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";

const LAST_LOGIN_KEY = "perm_last_login_at";
const DEBOUNCE_MS = 30 * 1000; // 30 seconds — avoid double-counting

export function LoginTracker() {
  const { isAuthenticated } = useConvexAuth();
  const recordMyLogin = useMutation(api.users.recordMyLogin);
  const hasFired = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || hasFired.current) return;

    // Skip if login was already recorded recently (by LoginPageClient)
    const lastLoginStr = localStorage.getItem(LAST_LOGIN_KEY);
    const lastLogin = lastLoginStr ? Number(lastLoginStr) : 0;
    if (Date.now() - lastLogin < DEBOUNCE_MS) return;

    hasFired.current = true;
    localStorage.setItem(LAST_LOGIN_KEY, String(Date.now()));

    recordMyLogin().catch((error) => {
      console.error("[LoginTracker] Failed to record login:", error);
      localStorage.removeItem(LAST_LOGIN_KEY);
      hasFired.current = false;
    });
  }, [isAuthenticated, recordMyLogin]);

  return null;
}
