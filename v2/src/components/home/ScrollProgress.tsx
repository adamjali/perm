"use client";

/**
 * A thin progress bar fixed to the top of the page, showing how far the reader
 * has scrolled. Updated once per animation frame, and scaled rather than
 * resized so the browser composites it instead of running layout.
 */

import * as React from "react";

export function ScrollProgress() {
  const barRef = React.useRef<HTMLDivElement>(null);
  const rafRef = React.useRef<number | null>(null);

  // No React state: the bar is written straight onto its element. It is on screen
  // during every scroll, including the burst Next makes when someone presses Back
  // several times quickly, and an update per frame there was one of the updates
  // that tripped React's "Maximum update depth exceeded" (#185) in production.
  React.useEffect(() => {
    const draw = () => {
      rafRef.current = null;
      const bar = barRef.current;
      if (!bar) return;
      const scrollTop = document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const share = scrollHeight > 0 ? Math.min(1, Math.max(0, scrollTop / scrollHeight)) : 0;
      bar.style.transform = `scaleX(${share})`;
    };
    const handleScroll = () => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(draw);
    };

    // A page restored by Back keeps its scroll position, so start from it.
    draw();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={barRef}
      className="scroll-progress"
      // scaleX, not width. See .scroll-progress in globals.css: the bar is full
      // width in CSS and starts at scaleX(0) there, so the browser composites the
      // update instead of running layout on every scroll frame.
      aria-hidden="true"
    />
  );
}
