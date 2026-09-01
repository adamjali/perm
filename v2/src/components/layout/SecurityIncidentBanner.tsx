"use client";

/**
 * Security Incident Banner, thin dismissible bar fixed to top of public pages.
 *
 * Purpose: surface the April 19-20, 2026 signup-abuse incident to any visitor
 * who lands on the site (especially people Googling "permtracker.app phishing"
 * after receiving an unauthorized email). Links to /security for the full
 * factual record.
 *
 * Behavior:
 *   - Shown on public pages only (imported by (public)/layout.tsx)
 *   - Auto-hides after April 27, 2026 UTC (exactly 1 week after deploy)
 *   - Also dismissible via close button (persisted in localStorage)
 *   - FIXED at top-0 (stays visible on scroll) above the header
 *   - Pushes header + main content down via --security-banner-h CSS variable
 *     on <html>. When dismissed, the variable goes back to 0 and the header
 *     returns to its default top-0 position.
 *   - Neo-brutalist aesthetic: 2px border, mono label, amber accent,
 *     matches existing design system
 *   - Never shown in the authenticated app
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { WarningIcon as AlertTriangle, XIcon } from "@phosphor-icons/react";

const EXPIRES_AT_UTC = new Date("2026-04-27T00:00:00Z").getTime();
const LS_KEY = "security-incident-2026-04-19-dismissed";
const CSS_VAR = "--security-banner-h";

// SSR-safe layout effect
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function SecurityIncidentBanner() {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (Date.now() > EXPIRES_AT_UTC) return;
    try {
      if (localStorage.getItem(LS_KEY) === "1") return;
    } catch {
      /* localStorage unavailable — fall through */
    }
    setVisible(true);
  }, []);

  // Measure banner height and publish as CSS var on <html>.
  // Updates on resize so mobile wrap + desktop single-line both work.
  useIsoLayoutEffect(() => {
    if (!visible || !ref.current) return;
    const el = ref.current;
    const root = document.documentElement;

    const apply = () => {
      root.style.setProperty(CSS_VAR, `${el.offsetHeight}px`);
    };
    apply();

    const observer = new ResizeObserver(apply);
    observer.observe(el);
    window.addEventListener("resize", apply);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", apply);
      root.style.setProperty(CSS_VAR, "0px");
    };
  }, [visible]);

  if (!visible) return null;

  const handleDismiss = () => {
    try {
      localStorage.setItem(LS_KEY, "1");
    } catch {
      /* no-op */
    }
    // The useIsoLayoutEffect cleanup will reset --security-banner-h to 0px,
    // which snaps the header and main content back to their default positions.
    setVisible(false);
  };

  return (
    <div
      ref={ref}
      role="region"
      aria-label="Security notice"
      className="fixed inset-x-0 top-0 z-[60] border-b-2 border-amber-600 bg-amber-50 dark:bg-amber-950/50 dark:border-amber-500"
    >
      <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-2 sm:px-8">
        <AlertTriangle
          className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400"
          aria-hidden="true"
        />
        <p className="flex-1 text-xs sm:text-sm text-amber-900 dark:text-amber-100">
          <span className="font-bold mono uppercase tracking-wider text-[10px] sm:text-xs mr-2">
            Security notice
          </span>
          Unsolicited emails sent on Apr 19-20 didn’t originate from PERM Tracker.{" "}
          <Link
            href="/security"
            className="font-bold underline decoration-2 underline-offset-2 hover:text-amber-950 dark:hover:text-white"
          >
            Learn more
          </Link>
        </p>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss security notice"
          className="shrink-0 rounded-none p-1 text-amber-700 hover:bg-amber-100 hover:text-amber-900 dark:text-amber-400 dark:hover:bg-amber-900/50 dark:hover:text-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
        >
          <XIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
