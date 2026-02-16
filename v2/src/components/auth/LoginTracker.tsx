/**
 * LoginTracker
 *
 * Records a login event once per browser session. Uses localStorage
 * with a 30-minute time threshold to ensure accurate counting.
 *
 * Desktop browsers keep tabs alive for days, so sessionStorage alone
 * misses re-visits. The timestamp approach catches those: if the
 * last recorded login was >30 min ago, we count it as a new session.
 *
 * The Convex Auth library's createOrUpdateUser callback only fires for
 * OAuth and new accounts, NOT for password sign-ins of existing users.
 * This client-side component covers ALL auth flows reliably.
 */

"use client";

import { useEffect, useRef } from "react";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";

const LAST_LOGIN_KEY = "perm_last_login_at";
const SESSION_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

export function LoginTracker() {
  const { isAuthenticated } = useConvexAuth();
  const recordMyLogin = useMutation(api.users.recordMyLogin);
  const hasFired = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || hasFired.current) return;

    // Check if enough time has passed since last recorded login
    const lastLoginStr = localStorage.getItem(LAST_LOGIN_KEY);
    const lastLogin = lastLoginStr ? Number(lastLoginStr) : 0;
    const timeSinceLastLogin = Date.now() - lastLogin;

    if (timeSinceLastLogin < SESSION_THRESHOLD_MS) return;

    hasFired.current = true;
    localStorage.setItem(LAST_LOGIN_KEY, String(Date.now()));

    recordMyLogin().catch((error) => {
      console.error("[LoginTracker] Failed to record login:", error);
      // Reset so it can retry next mount
      localStorage.removeItem(LAST_LOGIN_KEY);
      hasFired.current = false;
    });
  }, [isAuthenticated, recordMyLogin]);

  return null;
}
