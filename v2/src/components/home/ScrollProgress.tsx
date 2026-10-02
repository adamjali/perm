"use client";

/**
 * A thin progress bar fixed to the top of the page, showing how far the reader
 * has scrolled. Updated once per animation frame, and scaled rather than
 * resized so the browser composites it instead of running layout.
 */

import * as React from "react";

export function ScrollProgress() {
  const [progress, setProgress] = React.useState(0);
  const rafRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    const handleScroll = () => {
      if (rafRef.current !== null) return;

      rafRef.current = requestAnimationFrame(() => {
        const scrollTop = document.documentElement.scrollTop;
        const scrollHeight =
          document.documentElement.scrollHeight - window.innerHeight;
        const progressValue = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
        setProgress(progressValue);
        rafRef.current = null;
      });
    };

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
      className="scroll-progress"
      // scaleX, not width. See .scroll-progress in globals.css. The bar is full
      // width in CSS and scaled here, so the browser composites the update
      // instead of running layout on every scroll frame.
      style={{ transform: `scaleX(${progress / 100})` }}
      aria-hidden="true"
    />
  );
}
