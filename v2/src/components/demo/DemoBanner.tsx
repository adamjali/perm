/**
 * DemoBanner Component
 *
 * Portals into the <header> element so it's part of the same
 * fixed container — no positioning math, no scroll lag.
 */

"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

const BANNER_HEIGHT = 40; // pixels

export function DemoBanner() {
  const [headerEl, setHeaderEl] = useState<Element | null>(null);

  useEffect(() => {
    const el = document.querySelector("header");
    if (el) setHeaderEl(el);
  }, []);

  const banner = (
    <div className="absolute inset-x-0 top-full z-40">
      <div
        className="flex min-h-10 items-center justify-center gap-x-2 gap-y-0 px-4 py-1.5 text-sm font-bold text-white flex-wrap"
        style={{
          background:
            "linear-gradient(90deg, var(--primary) 0%, var(--stage-pwd) 100%)",
        }}
        role="banner"
        aria-label="Demo mode indicator"
      >
        <span className="text-center">
          Demo Mode - Changes saved to this browser only
        </span>
        <span className="mx-1 hidden sm:inline">|</span>
        <Link
          href="/signup"
          className="font-extrabold underline transition-opacity hover:opacity-80"
        >
          Sign up for real account
        </Link>
      </div>
    </div>
  );

  if (!headerEl) return null;
  return createPortal(banner, headerEl);
}

export { BANNER_HEIGHT };
