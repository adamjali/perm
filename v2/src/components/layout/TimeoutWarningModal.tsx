"use client";

/**
 * TimeoutWarningModal Component
 * Warning modal shown before automatic logout due to inactivity.
 *
 * Features:
 * - Glass panel with backdrop blur
 * - Countdown timer with pulsing animation
 * - "Stay Logged In" and "Log Out Now" buttons
 * - Neobrutalist design with Forest Green accent
 * - Accessible (ARIA roles, keyboard support)
 *
 * Design System: Neobrutalist + Glass Panel
 * Inspired by: v1/frontend/src/js/components/TimeoutWarningModal.js
 */

import { useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ClockIcon, SignOutIcon } from "@phosphor-icons/react";
import { formatTimeRemaining } from "@/hooks/useInactivityTimeout";
import { Z_INDEX } from "@/lib/constants/zIndex";

interface TimeoutWarningModalProps {
  isVisible: boolean;
  remainingSeconds: number;
  onExtend: () => void;
  onLogout: () => void;
}

export default function TimeoutWarningModal({
  isVisible,
  remainingSeconds,
  onExtend,
  onLogout,
}: TimeoutWarningModalProps) {
  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isVisible) return;

      // ESC key - extend session
      if (e.key === "Escape") {
        e.preventDefault();
        onExtend();
      }
    },
    [isVisible, onExtend]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isVisible) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isVisible]);

  if (!isVisible) return null;

  const isUrgent = remainingSeconds <= 30;
  const formattedTime = formatTimeRemaining(remainingSeconds);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: Z_INDEX.timeoutWarning }}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="timeout-title"
      aria-describedby="timeout-description"
    >
      {/* Backdrop with blur */}
      <div
        className="absolute inset-0 bg-black/60 animate-in fade-in duration-150"
        aria-hidden="true"
        onClick={onExtend}
      />

      {/* Modal */}
      <div
        className="relative z-10 bg-background border-2 border-border shadow-hard-lg
                   w-full max-w-md mx-4 p-8
                   animate-in fade-in slide-in-from-bottom-4 zoom-in-95 duration-300"
      >
        {/* Header with icon */}
        <div className="flex flex-col items-center gap-4 mb-6">
          <div
            className={`p-3 border-2 border-border ${
              isUrgent ? "bg-destructive/10" : "bg-data-warn/15"
            }`}
          >
            <ClockIcon
              className={`size-8 ${isUrgent ? "text-destructive" : "text-data-warn-ink"}`}
            />
          </div>

          <h2
            id="timeout-title"
            className="font-heading text-xl font-bold tracking-tight text-foreground text-center"
          >
            Session timeout warning
          </h2>
        </div>

        {/* Message */}
        <p
          id="timeout-description"
          className="text-center text-muted-foreground mb-6"
        >
          You&apos;ve been inactive for a while. Your session will end in:
        </p>{" "}

        {/* Countdown */}
        <div
          className={`text-center py-4 px-6 mb-6 border-2 border-border ${
            isUrgent
              ? "bg-destructive/10"
              : "bg-muted"
          }`}
        >
          <span
            className={`font-heading text-5xl font-bold tracking-wider ${
              isUrgent ? "text-destructive" : "text-foreground"
            }`}
          >
            {formattedTime}
          </span>
        </div>

        {/* Advice */}
        <p className="text-center text-sm text-muted-foreground mb-8 italic">
          Click &quot;Stay Logged In&quot; to continue working, or you&apos;ll be logged out to protect your account.
        </p>{" "}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={onLogout}
          >
            <SignOutIcon className="size-4" />
            Log out now
          </Button>
          <Button
            className="flex-1"
            onClick={onExtend}
            autoFocus
          >
            Stay logged in
          </Button>
        </div>

        {/* Keyboard hint */}
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Press <kbd className="mono border-2 border-border bg-muted px-1.5 py-0.5">Esc</kbd> to stay logged in
        </p>
      </div>
    </div>
  );
}
