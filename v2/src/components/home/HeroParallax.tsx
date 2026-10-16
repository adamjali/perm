"use client";

import { useEffect, useRef } from "react";

/** How much slower than the page the hero's pattern drifts: 0.3 of the scroll. */
const RATE = 0.3;
/** The pattern layer starts this far above the section (globals.css), so the drift stops there. */
const MAX_SHIFT = 240;

/**
 * The hero's background drifts slower than the page as it scrolls (owner, Oct
 * 16 2026). It writes one CSS variable on the hero section, `--hero-shift`,
 * read by `.hero-ground::before`; nothing goes through React state, so a fast
 * scroll can't queue renders. It listens only while the hero is on screen,
 * and never under reduced motion, where the pattern stays still.
 */
export function HeroParallax() {
  const markRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const hero = markRef.current?.closest<HTMLElement>(".hero-ground");
    if (!hero) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const apply = () => {
      frame = 0;
      const shift = Math.min(MAX_SHIFT, Math.max(0, window.scrollY * RATE));
      hero.style.setProperty("--hero-shift", `${shift.toFixed(1)}px`);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };

    let listening = false;
    const io = new IntersectionObserver(([entry]) => {
      const on = Boolean(entry?.isIntersecting);
      if (on && !listening) {
        window.addEventListener("scroll", onScroll, { passive: true });
        listening = true;
        apply();
      } else if (!on && listening) {
        window.removeEventListener("scroll", onScroll);
        listening = false;
      }
    });
    io.observe(hero);

    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
      hero.style.removeProperty("--hero-shift");
    };
  }, []);

  return <span ref={markRef} hidden />;
}
