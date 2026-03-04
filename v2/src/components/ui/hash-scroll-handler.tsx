"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Handles hash-based scroll navigation on page load and cross-page navigation.
 * Waits for DOM render before scrolling to the target element.
 * CSS `scroll-padding-top` on `html` handles the fixed header offset.
 */
export function HashScrollHandler() {
  const pathname = usePathname();

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;

    const id = hash.slice(1);

    // Wait for React to finish rendering the new page content
    const raf = requestAnimationFrame(() => {
      setTimeout(() => {
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 50);
    });

    return () => cancelAnimationFrame(raf);
  }, [pathname]);

  return null;
}
