/**
 * Admin Authentication
 *
 * Provides admin authentication helpers for the frontend.
 * Only the email defined in ADMIN_EMAIL is considered an admin.
 */

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

/**
 * Admin email address (must match backend constant)
 */
export const ADMIN_EMAIL = "admin@yahoo.com";

/**
 * Hook to check if current user is admin
 */
export function useAdminAuth() {
  const user = useQuery(api.users.currentUser);

  return {
    isAdmin: user?.email === ADMIN_EMAIL,
    isLoading: user === undefined,
    user: user ?? null,
  };
}
