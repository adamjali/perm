"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Plays the queue tape's fill once, left to right up to DOL's month, the
 * first time the tape scrolls into view: the motion is the queue advancing.
 *
 * The server draws the tape filled and this never hides it on screen. It arms
 * only a tape that starts below the fold (so nobody sees it empty), never under
 * reduced motion, and never without IntersectionObserver. The animation itself
 * is CSS (`[data-tape]` rules in globals.css), so nothing re-renders.
 */
export function TapeReveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return;

    el.dataset.tape = "armed";
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        el.dataset.tape = "play";
        io.disconnect();
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return <div ref={ref}>{children}</div>;
}
