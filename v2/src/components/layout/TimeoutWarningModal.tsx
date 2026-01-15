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
 * Phase: 20 (Dashboard + UI Polish)
 * Updated: 2025-12-24 - Use centralized z-index
 * Inspired by: v1/frontend/src/js/components/TimeoutWarningModal.js
 */

import { useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Clock, LogOut } from "lucide-react";
import { formatTimeRemaining } from "@/lib/hooks/useInactivityTimeout";
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
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        aria-hidden="true"
        onClick={onExtend}
      />

      {/* Modal */}
      <div
        className="relative z-10 glass-panel border-2 border-black shadow-hard-lg
                   w-full max-w-md mx-4 p-8
                   animate-in fade-in slide-in-from-bottom-4 zoom-in-95 duration-300"
      >
        {/* Header with icon */}
        <div className="flex flex-col items-center gap-4 mb-6">
          <div
            className={`p-3 rounded-full border-2 border-black ${
              isUrgent ? "bg-red-100 dark:bg-red-900/30" : "bg-amber-100 dark:bg-amber-900/30"
            }`}
          >
            <Clock
              className={`size-8 ${isUrgent ? "text-red-600" : "text-amber-600"}`}
              strokeWidth={2.5}
            />
          </div>

          <h2
            id="timeout-title"
            className="font-heading text-2xl font-bold text-foreground text-center"
          >
            Session Timeout Warning
          </h2>
        </div>

        {/* Message */}
        <p
          id="timeout-description"
          className="text-center text-muted-foreground mb-6"
        >
          You&apos;ve been inactive for a while. Your session will end in:
        </p>

        {/* Countdown */}
        <div
          className={`text-center py-4 px-6 mb-6 border-2 border-black ${
            isUrgent
              ? "bg-red-50 dark:bg-red-900/20"
              : "bg-muted"
          }`}
        >
          <span
            className={`font-heading text-5xl font-bold tracking-wider ${
              isUrgent ? "text-red-600" : "text-foreground"
            }`}
          >
            {formattedTime}
          </span>
        </div>

        {/* Advice */}
        <p className="text-center text-sm text-muted-foreground mb-8 italic">
          Click &quot;Stay Logged In&quot; to continue working, or you&apos;ll be logged out to protect your account.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={onLogout}
          >
            <LogOut className="size-4" />
            Log Out Now
          </Button>
          <Button
            className="flex-1 border-2 border-black dark:border-input focus-visible:border-black focus-visible:ring-black/20 dark:focus-visible:border-input dark:focus-visible:ring-white/20"
            onClick={onExtend}
            autoFocus
          >
            Stay Logged In
          </Button>
        </div>

        {/* Keyboard hint */}
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Press <kbd className="mono px-1.5 py-0.5 border border-black/20 bg-muted rounded-sm">Esc</kbd> to stay logged in
        </p>
      </div>
    </div>
  );
}
