"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Envelope as Mail } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";

/**
 * Shown on authenticated pages when a user's weekly summary was auto-paused after
 * a spell of inactivity (set by the reengagement cron). Lets them turn it back on
 * or acknowledge the pause. Both actions clear the server-side paused marker, so
 * the banner disappears on its own, no sessionStorage needed.
 *
 * Sits below the deletion/security banners. Neutral tone (not a warning) with a
 * brand-green primary action.
 */
export default function ReengagementBanner() {
  const state = useQuery(api.reengagement.getReengagementBannerState, {});
  const reactivate = useMutation(api.reengagement.reactivateWeeklyDigest);
  const dismiss = useMutation(api.reengagement.dismissReengagementBanner);
  const [busy, setBusy] = useState(false);

  if (!state?.weeklyDigestPaused) return null;

  const handleReactivate = async () => {
    setBusy(true);
    try {
      await reactivate({});
      toast.success("Weekly summary turned back on");
    } catch {
      toast.error("Couldn’t turn it back on. Try again.");
      setBusy(false);
    }
  };

  const handleDismiss = async () => {
    setBusy(true);
    try {
      await dismiss({});
    } catch {
      setBusy(false);
    }
  };

  return (
    <div
      className="relative z-10 border-b-2 border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/60 sm:px-6"
      role="status"
      aria-label="Weekly summary paused"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Mail className="h-5 w-5 flex-shrink-0 text-zinc-500 dark:text-zinc-400" />
          <p className="min-w-0 text-sm text-zinc-700 dark:text-zinc-300">
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              Your weekly summary is paused.
            </span>{" "}
            <span className="hidden sm:inline">
              We stopped it while you were away, your deadline reminders kept coming.
            </span>
          </p>
        </div>
        {/* On mobile the row stacks; indent the buttons under the text (past the icon). */}
        <div className="flex flex-shrink-0 items-center gap-2 pl-7 sm:pl-0">
          <Button size="sm" onClick={handleReactivate} disabled={busy}>
            Turn it back on
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            disabled={busy}
            className="text-zinc-600 dark:text-zinc-400"
          >
            Keep it off
          </Button>
        </div>
      </div>
    </div>
  );
}
