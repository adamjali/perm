"use client";

import { useEffect, useState } from "react";

/**
 * Home-only load curtain, the same device the client-site fleet ships.
 *
 * Its job is honesty about the first second: mask the pre-hydration frame
 * with the brand instead of a flash of half-styled content, then get out of
 * the way. The fleet's doctrine, applied:
 *
 * - The TIMEOUT failsafe is armed FIRST, before anything that could throw, so
 *   broken JS can never strand the curtain over the page.
 * - Dismiss on window `load` or the cap, whichever comes first — never wait
 *   on a lazy-loaded image (that deadlocks; the cap is the guarantee).
 * - Scroll is locked only while the curtain exists (`html:has` in CSS).
 * - Reduced motion gets a fast fade, not the slide.
 * - Session-once: repeat home visits in one tab skip it entirely.
 */

const CAP_MS = 1600;
const KEY = "pt-preloaded";

export function Preloader() {
  const [gone, setGone] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(KEY)) {
      setGone(true);
      return;
    }
    let done = false;
    const leave = () => {
      if (done) return;
      done = true;
      sessionStorage.setItem(KEY, "1");
      setLeaving(true);
      // Match the CSS exit duration; then unmount for good.
      window.setTimeout(() => setGone(true), 480);
    };
    // Failsafe FIRST.
    const cap = window.setTimeout(leave, CAP_MS);
    if (document.readyState === "complete") leave();
    else window.addEventListener("load", leave, { once: true });
    return () => window.clearTimeout(cap);
  }, []);

  if (gone) return null;

  return (
    <div
      className={"pre fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-background" + (leaving ? " pre-leave" : "")}
      aria-hidden="true"
    >
      <div className="flex items-center gap-3">
        <span className="inline-block h-8 w-8 border-3 border-border bg-primary shadow-hard-sm" />
        <span className="font-heading text-2xl font-black tracking-tight">
          PERM <span className="text-primary">Tracker</span>
        </span>
      </div>
      <div className="h-1.5 w-44 overflow-hidden border-2 border-border bg-card">
        <div className="pre-bar h-full bg-primary" />
      </div>
    </div>
  );
}
