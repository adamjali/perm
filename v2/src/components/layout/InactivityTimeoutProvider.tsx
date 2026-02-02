"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useCallback } from "react";
import { toast } from "@/lib/toast";
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
  const { isSigningOut, beginSignOut, cancelSignOut } = useAuthContext();

  const performSignOut = useCallback(async (): Promise<void> => {
    if (isSigningOut) return;

    beginSignOut();
    try {
      // Race sign-out against a 8s safety timeout — if the network call
      // hangs (common after computer sleep/wake), force a hard redirect
      // instead of leaving the overlay stuck forever.
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

      // Hard redirect as fallback — router.push can fail when the tab
      // was backgrounded. window.location always works.
      window.location.href = "/login";
    } catch (error) {
      console.error("Logout error:", error);
      cancelSignOut();
      toast.error("Failed to sign out. Please try again.");
    }
  }, [isSigningOut, beginSignOut, signOut, cancelSignOut]);

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
