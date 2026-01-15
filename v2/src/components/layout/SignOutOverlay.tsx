"use client";

/**
 * SignOutOverlay Component
 * Minimal glass-panel modal shown when user is signing out.
 *
 * Features:
 * - Blocks all interaction with background
 * - Glass panel with backdrop blur (frosted effect)
 * - Snappy Forest Green spinner
 * - Smooth, fast animations (150ms)
 *
 * Design System: Neobrutalist + Glass Panel
 * Phase: 20 (Dashboard + UI Polish)
 * Updated: 2025-12-24 - Use centralized z-index
 */

import { useAuthContext } from "@/lib/contexts/AuthContext";
import { Z_INDEX } from "@/lib/constants/zIndex";
import { Loader2 } from "lucide-react";

export default function SignOutOverlay() {
  const { isSigningOut } = useAuthContext();

  if (!isSigningOut) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: Z_INDEX.overlay }}
      role="dialog"
      aria-modal="true"
      aria-label="Signing out"
    >
      {/* Backdrop with blur - fast fade-in */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-md animate-in fade-in duration-150"
        aria-hidden="true"
      />

      {/* Glass panel modal - slide up with scale */}
      <div
        className="relative z-10 glass-panel border-2 border-black shadow-hard-lg
                   flex flex-col items-center gap-4 px-10 py-8
                   animate-in fade-in slide-in-from-bottom-4 zoom-in-95 duration-200"
      >
        {/* Spinner - Forest Green */}
        <Loader2 className="size-8 animate-spin text-primary" strokeWidth={2.5} />

        {/* Text */}
        <div className="text-center">
          <p className="font-heading text-lg font-bold text-foreground tracking-tight">
            Signing out...
          </p>
        </div>
      </div>
    </div>
  );
}
