"use client";

import { useEffect, useLayoutEffect, type RefObject } from "react";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Scrolls a timeline that is wider than its container so today sits a third
 * of the way into the visible months, with some past to its left. Runs before
 * paint, so the grid never shows the oldest months first and then jumps.
 *
 * The container must set `--tl-label` (the sticky label column's width) and
 * hold a single child that is the full-width grid.
 */
export function useScrollToToday(
  ref: RefObject<HTMLElement | null>,
  startDate: Date,
  endDate: Date,
  today: Date,
) {
  const start = startDate.getTime();
  const end = endDate.getTime();
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    const now = today.getTime();
    if (now < start || now > end) return;
    const label = parseFloat(getComputedStyle(el).getPropertyValue("--tl-label")) || 0;
    const dateWidth = el.scrollWidth - label;
    const todayX = label + dateWidth * ((now - start) / (end - start));
    const visible = el.clientWidth - label;
    el.scrollLeft = Math.max(0, todayX - label - visible / 3);
    // Only when the range itself changes, not on every render.
  }, [start, end]);
}
