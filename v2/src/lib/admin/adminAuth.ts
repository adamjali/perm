/**
 * Admin Authentication
 *
 * Provides admin authentication helpers for the frontend.
 * Only the email defined in ADMIN_EMAIL is considered an admin.
 */

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuthContext } from "@/lib/contexts/AuthContext";

/**
 * Admin email address — configurable via NEXT_PUBLIC_ADMIN_EMAIL env var.
 * No fallback: if unset, no user is considered admin (fail-closed).
 */
export const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL;

/**
 * Hook to check if current user is admin.
 * Skips query during sign-out to avoid server errors.
 */
export function useAdminAuth() {
  const { isSigningOut } = useAuthContext();
  const user = useQuery(api.users.currentUser, isSigningOut ? "skip" : undefined);

  return {
    isAdmin: !!ADMIN_EMAIL && user?.email === ADMIN_EMAIL,
    isLoading: user === undefined,
    isSigningOut,
    user: user ?? null,
  };
}
