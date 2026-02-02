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
 * Admin email address (must match backend constant)
 */
export const ADMIN_EMAIL = "admin@yahoo.com";

/**
 * Hook to check if current user is admin.
 * Skips query during sign-out to avoid server errors.
 */
export function useAdminAuth() {
  const { isSigningOut } = useAuthContext();
  const user = useQuery(api.users.currentUser, isSigningOut ? "skip" : undefined);

  return {
    isAdmin: user?.email === ADMIN_EMAIL,
    isLoading: user === undefined,
    isSigningOut,
    user: user ?? null,
  };
}
