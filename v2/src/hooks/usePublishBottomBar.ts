"use client";

import { useEffect, useRef } from "react";

/**
 * Publish a bottom-docked bar's height as `--bottom-bar-h` on the root, so
 * corner chrome (the chat bubble) can sit just above it instead of carrying a
 * fixed offset that is too high on every page without a bar. The same idea as
 * AuthHeader's `--site-header-h`.
 *
 * Several bars may be mounted at once; the variable holds the tallest, and is
 * removed when the last one unmounts. Pass `active` for a bar that renders
 * nothing some of the time, so the measurement follows it in and out.
 */
const heights = new Map<HTMLElement, number>();

function publish(): void {
  const root = document.documentElement;
  const tallest = Math.max(0, ...heights.values());
  if (tallest > 0) root.style.setProperty("--bottom-bar-h", `${tallest}px`);
  else root.style.removeProperty("--bottom-bar-h");
}

export function usePublishBottomBar<T extends HTMLElement>(active = true) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!active || !el) return;
    const measure = () => {
      heights.set(el, el.getBoundingClientRect().height);
      publish();
    };
    measure();
    // Border box: a bar that changes only its padding never fires a
    // content-box observer (the header learned this the hard way).
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    ro?.observe(el, { box: "border-box" });
    return () => {
      ro?.disconnect();
      heights.delete(el);
      publish();
    };
  }, [active]);

  return ref;
}
