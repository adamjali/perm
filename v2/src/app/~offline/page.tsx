"use client";

/**
 * Offline Fallback Page
 *
 * Shown when the user is offline and tries to open a page that isn't cached.
 */

import { useEffect } from "react";
import { ArrowsClockwiseIcon as RefreshCw, WifiSlashIcon } from "@phosphor-icons/react";

export default function OfflinePage() {
  // The page says it loads on reconnection, so it does.
  useEffect(() => {
    const reload = () => window.location.reload();
    window.addEventListener("online", reload);
    return () => window.removeEventListener("online", reload);
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Main card */}
        <div className="bg-card border border-border p-8">
          {/* Icon container */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-muted border border-border flex items-center justify-center">
              <WifiSlashIcon className="w-10 h-10 text-muted-foreground" />
            </div>
          </div>

          <h1 className="font-heading text-3xl font-bold text-center text-foreground mb-4">
            You&apos;re offline
          </h1>{" "}
          <p className="text-center text-muted-foreground font-body mb-8">
            This page needs a connection. It loads as soon as you&apos;re back online.
          </p>{" "}
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-primary text-primary-foreground font-heading font-bold text-lg py-4 px-6 border border-border transition-colors duration-150"
          >
            <span className="flex items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5" />
              Try again
            </span>
          </button>
        </div>

        {/* Bottom branding */}
        <p className="text-center text-muted-foreground text-sm mt-6 font-body">
          PERM Tracker
        </p>
      </div>
    </div>
  );
}
