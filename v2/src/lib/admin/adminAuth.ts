/**
 * Admin Authentication
 *
 * Provides admin authentication helpers for the frontend.
 * Admin check is performed server-side — no secrets exposed to the client.
 */

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuthContext } from "@/lib/contexts/AuthContext";

/**
 * Hook to check if current user is admin.
 * Uses server-side query — admin email never leaves the backend.
 * Skips query during sign-out to avoid server errors.
 */
export function useAdminAuth() {
  const { isSigningOut } = useAuthContext();
  const user = useQuery(api.users.currentUser, isSigningOut ? "skip" : undefined);
  const adminCheck = useQuery(api.users.isAdmin, isSigningOut ? "skip" : undefined);

  return {
    isAdmin: adminCheck?.isAdmin || false,
    isLoading: user === undefined || adminCheck === undefined,
    isSigningOut,
    user: user ?? null,
  };
}
