"use client";

/**
 * Admin Authentication
 *
 * Provides admin authentication helpers for the frontend.
 * Admin check is performed server-side, no secrets exposed to the client.
 *
 * THE DIRECTIVE IS LOAD-BEARING (added 2026-09-01). This module calls
 * `useQuery` from `convex/react` and `useAuthContext`, both of which reach
 * `React.createContext`, so it is a client module in every sense except the
 * annotation. It survived without one only because all three of its importers
 * (AdminDashboardClient, SecurityDashboardClient, Header) are themselves client
 * components, so it was always pulled in through somebody else's boundary.
 *
 * That made it a latent trap rather than a safe omission: the moment an
 * unrelated change reshuffled the module graph - here, making Footer a server
 * component - `/admin/security` failed to collect page data with
 * `TypeError: (0 , d.createContext) is not a function`, pointing at webpack
 * bootstrap rather than at this file. Declaring the boundary where it actually
 * belongs stops the next reshuffle from doing the same thing.
 */

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
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
