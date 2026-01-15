"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const { signOut } = useAuthActions();
  const { isSigningOut, beginSignOut, cancelSignOut } = useAuthContext();

  const performSignOut = useCallback(async (): Promise<void> => {
    if (isSigningOut) return;

    beginSignOut();
    try {
      await signOut();
      router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);
      cancelSignOut();
      toast.error("Failed to sign out. Please try again.");
    }
  }, [isSigningOut, beginSignOut, signOut, router, cancelSignOut]);

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
