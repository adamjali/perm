"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Sections rise into place as the reader scrolls to them (round 2, Oct 15
 * 2026: "animations, movement, transitions, on scroll").
 *
 * One component in the public layout does it for every page, so no page has
 * to remember to. The server renders everything visible: a crawler, a page
 * without script and a screenshot all read the whole page, and nothing above
 * the fold is ever hidden. After hydration this holds only the sections that
 * start BELOW the screen on the first frame of an animation (16px down,
 * transparent), and an IntersectionObserver plays each one into place once as
 * it arrives. Those sections are off screen when they're held, so no one sees
 * them vanish.
 *
 * An animation, never an attribute or class: a section inside a Suspense
 * boundary may not be hydrated yet when this runs, and React reports any
 * attribute it didn't render as a hydration mismatch (Oct 15 2026: the old
 * `data-reveal` attribute did exactly that on /perm-cases). Once played the
 * animation ends and leaves no transform behind, because a transform on an
 * ancestor would capture position:fixed children.
 *
 * Off under reduced motion, and a section can opt out with `data-no-reveal`
 * (sticky bars, anything a reader jumps to by anchor).
 */
const TARGETS = "main section, main figure, main [data-reveal-target]";

export function AutoReveal() {
  const pathname = usePathname();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!("IntersectionObserver" in window)) return;
    // A page opened at an anchor lands mid-page; leave it as it is.
    if (window.location.hash) return;

    const fold = window.innerHeight;
    const picked: HTMLElement[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(TARGETS)) {
      if (el.closest("[data-no-reveal]")) continue;
      // The outermost target only: a section inside a revealed section moves with it.
      if (picked.some((p) => p.contains(el))) continue;
      if (el.getBoundingClientRect().top < fold * 0.92) continue;
      picked.push(el);
    }
    if (picked.length === 0) return;

    const held = new Map<Element, Animation>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          held.get(e.target)?.play();
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );
    for (const el of picked) {
      const rise = el.animate(
        [
          { opacity: 0, transform: "translateY(16px)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: 600, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)" },
      );
      rise.pause(); // held on its first frame until the section arrives
      held.set(el, rise);
      io.observe(el);
    }
    return () => {
      io.disconnect();
      for (const rise of held.values()) rise.cancel();
    };
  }, [pathname]);

  return null;
}
