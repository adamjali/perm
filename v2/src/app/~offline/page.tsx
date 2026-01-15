"use client";

/**
 * Offline Fallback Page
 *
 * Shown when the user is offline and tries to access uncached content.
 * Follows the neobrutalist design system:
 * - No rounded corners (--radius: 0px)
 * - Hard shadows (4px 4px)
 * - Lime green accent (#2ECC40)
 * - Bold, direct messaging
 */

import { WifiOff, RefreshCw } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Main card */}
        <div className="bg-card border-2 border-border shadow-hard p-8">
          {/* Icon container */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-muted border-2 border-border shadow-hard-sm flex items-center justify-center">
              <WifiOff className="w-10 h-10 text-muted-foreground" strokeWidth={2.5} />
            </div>
          </div>

          {/* Heading */}
          <h1 className="font-heading text-3xl font-bold text-center text-foreground mb-4">
            You&apos;re Offline
          </h1>

          {/* Description */}
          <p className="text-center text-muted-foreground font-body mb-8">
            It looks like you&apos;ve lost your internet connection.
            Your data will load automatically when you&apos;re back online.
          </p>

          {/* Status indicator */}
          <div className="bg-muted border-2 border-border p-4 mb-8">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-destructive border border-border" />
              <span className="text-sm font-body text-foreground">
                Network status: <span className="font-semibold">Disconnected</span>
              </span>
            </div>
          </div>

          {/* Retry button */}
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-primary text-primary-foreground font-heading font-bold text-lg py-4 px-6 border-2 border-border shadow-hard hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-hard-lg active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-150"
          >
            <span className="flex items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5" strokeWidth={2.5} />
              Try Again
            </span>
          </button>

          {/* Tips section */}
          <div className="mt-8 pt-6 border-t-2 border-border">
            <h2 className="font-heading font-bold text-sm text-foreground uppercase tracking-wide mb-4">
              While you wait
            </h2>
            <ul className="space-y-2 text-sm text-muted-foreground font-body">
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold mt-0.5">1.</span>
                Check your WiFi or mobile data connection
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold mt-0.5">2.</span>
                Try moving to an area with better signal
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold mt-0.5">3.</span>
                Your unsaved work will sync when reconnected
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom branding */}
        <p className="text-center text-muted-foreground text-sm mt-6 font-body">
          PERM Tracker
        </p>
      </div>
    </div>
  );
}
