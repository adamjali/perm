"use client";

import { useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { setUser } from "@/lib/sentry";
import { useAuthContext } from "@/lib/contexts/AuthContext";

/**
 * Sets Sentry user context when authenticated.
 * Clears it on sign-out. Mount once inside the authenticated layout.
 */
export function SentryUserContext(): null {
  const { isSigningOut } = useAuthContext();
  const user = useQuery(api.users.currentUser, isSigningOut ? "skip" : undefined);

  useEffect(() => {
    if (user) {
      setUser({
        id: user._id,
        email: user.email ?? undefined,
        username: user.name ?? undefined,
      });
    } else {
      setUser(null);
    }
  }, [user]);

  return null;
}
