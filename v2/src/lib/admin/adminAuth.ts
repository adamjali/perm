"use client";

/**
 * Admin Authentication
 *
 * Provides admin authentication helpers for the frontend.
 * Admin check is performed server-side, no secrets exposed to the client.
 *
 * THE DIRECTIVE IS LOAD-BEARING. This module calls `useQuery` from
 * `convex/react` and `useAuthContext`, both of which reach
 * `React.createContext`, so it is a client module in every sense. Without the
 * annotation it works only while every importer is itself a client
 * component, pulling it in through somebody else's boundary; the first
 * change that reshuffles the module graph then fails the build with
 * `TypeError: (0 , d.createContext) is not a function`, pointing at webpack
 * bootstrap rather than at this file. Declaring the boundary where it
 * belongs prevents that.
 */

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useAuthContext } from "@/lib/contexts/AuthContext";

/**
 * Hook to check if current user is admin.
 * Uses server-side query, admin email never leaves the backend.
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
