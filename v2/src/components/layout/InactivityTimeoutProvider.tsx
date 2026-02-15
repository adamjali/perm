"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useCallback } from "react";
import { captureError } from "@/lib/sentry";
import { useAuthContext } from "@/lib/contexts/AuthContext";
import { useInactivityTimeout } from "@/lib/hooks/useInactivityTimeout";
import TimeoutWarningModal from "./TimeoutWarningModal";

interface InactivityTimeoutProviderProps {
  children: React.ReactNode;
  enabled?: boolean;
}

export default function InactivityTimeoutProvider({
  children,
  enabled = true,
}: InactivityTimeoutProviderProps): React.ReactElement {
  const { signOut } = useAuthActions();
  const { isSigningOut, beginSignOut } = useAuthContext();

  const performSignOut = useCallback(async (): Promise<void> => {
    if (isSigningOut) return;

    beginSignOut();

    // Best-effort sign-out: try to clear the server session and tokens,
    // but ALWAYS redirect to /login regardless of success or failure.
    // The inactivity timeout fires after long idle periods where network
    // may be degraded (tab backgrounded, sleep/wake). Convex's signOut()
    // can throw when the invalidateCache() server action fails on a stale
    // connection. Previously this called cancelSignOut() which reset
    // isSigningOut, causing the warning modal to reappear with a frozen timer.
    try {
      const timeout = new Promise<"timeout">((resolve) =>
        setTimeout(() => resolve("timeout"), 8000)
      );
      const result = await Promise.race([
        signOut().then(() => "done" as const),
        timeout,
      ]);

      if (result === "timeout") {
        console.warn("Sign-out timed out, forcing redirect");
      }
    } catch (error) {
      // Sign-out failed (network error, stale connection, etc.) — log but
      // do NOT call cancelSignOut(). We still redirect to /login below.
      // The server session will expire on its own; the client token is
      // already cleared or will be cleared on page load.
      console.error("Inactivity sign-out error (redirecting anyway):", error);
      captureError(error, { operation: "inactivitySignOut" });
    }

    // Hard redirect — always reached, whether signOut() succeeded or failed.
    // window.location always works even when the tab was backgrounded.
    window.location.href = "/login";
  }, [isSigningOut, beginSignOut, signOut]);

  const { isWarningVisible, remainingSeconds, extendSession } = useInactivityTimeout({
    onTimeout: performSignOut,
    enabled: enabled && !isSigningOut,
  });

  return (
    <>
      {children}
      <TimeoutWarningModal
        isVisible={isWarningVisible && !isSigningOut}
        remainingSeconds={remainingSeconds}
        onExtend={extendSession}
        onLogout={performSignOut}
      />
    </>
  );
}
