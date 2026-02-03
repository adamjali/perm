"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

/**
 * Persistent warning banner for accounts with scheduled deletion.
 * Shown on all authenticated pages between Header and main content.
 * Dismissible per session (sessionStorage). Reappears on next login.
 *
 * SessionStorage key: `dismissedDeletionBanner_${deletedAt}` so if user
 * cancels and re-schedules, the banner reappears with a new key.
 */
export default function DeletionBanner() {
  const profile = useQuery(api.users.currentUserProfile, {});
  // Start hidden to avoid flash of banner before sessionStorage is checked
  const [dismissed, setDismissed] = useState(true);

  // useState initializer runs once — avoids impure Date.now() during render
  const [mountTime] = useState(() => Date.now());

  const isDeletionScheduled =
    profile?.deletedAt !== undefined &&
    profile?.deletedAt !== null &&
    profile.deletedAt > mountTime;

  const storageKey = isDeletionScheduled
    ? `dismissedDeletionBanner_${profile.deletedAt}`
    : null;

  useEffect(() => {
    if (!storageKey) {
      setDismissed(true);
      return;
    }
    try {
      const wasDismissed = sessionStorage.getItem(storageKey) === "true";
      setDismissed(wasDismissed);
    } catch {
      // sessionStorage may be unavailable (SSR, private browsing)
      setDismissed(false);
    }
  }, [storageKey]);

  const handleDismiss = () => {
    if (storageKey) {
      try {
        sessionStorage.setItem(storageKey, "true");
      } catch {
        // Ignore storage errors
      }
    }
    setDismissed(true);
  };

  if (!isDeletionScheduled || dismissed) {
    return null;
  }

  const deletionDate = new Date(profile.deletedAt!).toLocaleDateString(
    "en-US",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
    }
  );

  return (
    <div
      className="relative z-10 bg-amber-50 dark:bg-amber-950/40 border-b-2 border-amber-300 dark:border-amber-800 px-4 py-3 sm:px-6"
      role="alert"
      aria-label="Account deletion warning"
    >
      <div className="mx-auto max-w-7xl flex items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <p className="text-xs sm:text-sm text-amber-800 dark:text-amber-200 min-w-0">
            <span className="hidden sm:inline">
              Your account is scheduled for deletion on{" "}
              <strong>{deletionDate}</strong>.{" "}
            </span>
            <span className="sm:hidden">
              Deletion scheduled: <strong>{deletionDate}</strong>.{" "}
            </span>
            <Link
              href="/settings"
              className="underline font-medium hover:text-amber-900 dark:hover:text-amber-100 whitespace-nowrap"
            >
              Go to Settings
            </Link>{" "}
            <span className="hidden sm:inline">to cancel or delete now.</span>
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleDismiss}
          className="flex-shrink-0 text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/30"
          aria-label="Dismiss deletion warning"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
