"use client";

import { useCallback, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A sideways-scrolling box that opens at its right-hand end: for a chart wider
 * than a phone whose newest point is on the right, so "now" is what a phone
 * sees first. On a screen wide enough to hold the chart there is nothing to scroll.
 */
export function OpenAtEnd({ className, children }: { className?: string; children: ReactNode }) {
  const openAtEnd = useCallback((el: HTMLDivElement | null) => {
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);
  return (
    <div ref={openAtEnd} className={cn("overflow-x-auto", className)}>
      {children}
    </div>
  );
}
