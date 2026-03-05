"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Handles hash-based scroll navigation on page load and cross-page navigation.
 * Defers scrolling via rAF + setTimeout to wait for React to paint the new page
 * content (including Suspense streaming). CSS `scroll-behavior: smooth` on `html`
 * handles native browser hash navigation; this component handles the deferred
 * programmatic scroll after React page transitions where the target element may
 * not yet exist in the DOM. CSS `scroll-padding-top` on `html` handles the
 * fixed header offset.
 */
export function HashScrollHandler() {
  const pathname = usePathname();

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;

    const id = hash.slice(1);

    // rAF defers past the next paint; 50ms timeout provides buffer for
    // Suspense streaming to resolve the page content before scrolling.
    let timeoutId: ReturnType<typeof setTimeout>;
    const raf = requestAnimationFrame(() => {
      timeoutId = setTimeout(() => {
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 50);
    });

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timeoutId);
    };
  }, [pathname]);

  return null;
}
