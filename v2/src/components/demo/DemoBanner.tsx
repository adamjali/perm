/**
 * DemoBanner Component
 *
 * Fixed banner displayed at top of demo pages.
 * Indicates demo mode with localStorage-only persistence.
 *
 * Features:
 * - Fixed position below header, moves with header on scroll
 * - Gradient background (primary green to stage-pwd blue)
 * - Link to sign-up page
 *
 */

"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const BANNER_HEIGHT = 40; // pixels

export function DemoBanner() {
  const [isScrolled, setIsScrolled] = React.useState(false);
  const rafRef = React.useRef<number | null>(null);

  // Track scroll to match header behavior
  React.useEffect(() => {
    const handleScroll = () => {
      // Throttle with requestAnimationFrame
      if (rafRef.current !== null) return;

      rafRef.current = requestAnimationFrame(() => {
        setIsScrolled(window.scrollY > 10);
        rafRef.current = null;
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Initial check
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return (
    /* Fixed banner - positioned below the fixed header, moves with header on scroll */
    <div
      className={cn(
        "fixed inset-x-0 z-40 flex h-10 items-center justify-center gap-2 text-sm font-bold text-white shadow-hard-sm transition-[top] duration-200",
        isScrolled ? "top-[52px]" : "top-[72px]"
      )}
      style={{
        background: "linear-gradient(90deg, var(--primary) 0%, var(--stage-pwd) 100%)",
      }}
      role="banner"
      aria-label="Demo mode indicator"
    >
      <span>Demo Mode - Changes saved to this browser only</span>
      <span className="mx-1">|</span>
      <Link
        href="/signup"
        className="font-extrabold underline transition-opacity hover:opacity-80"
      >
        Sign up for real account
      </Link>
    </div>
  );
}

export { BANNER_HEIGHT };
