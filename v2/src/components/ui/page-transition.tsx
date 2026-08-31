"use client";

/**
 * PageTransition Component
 *
 * Wraps page content with a quick fade + slide-up animation on route changes.
 * Uses key={pathname} to remount on navigation, triggering the enter animation.
 * Respects prefers-reduced-motion.
 *
 * Note: AnimatePresence mode="wait" was removed because it causes intermittent
 * blank pages during client-side navigation, the exit animation races with
 * Next.js App Router's Suspense streaming (loading.tsx → page swap).
 * Current behavior: enter-only animation (fade+slide-up). No exit animation
 * to avoid the Suspense race.
 *
 * THE FIRST LOAD MUST NOT ANIMATE, AND THAT IS NOT A STYLE CHOICE (2026-08-31)
 * -------------------------------------------------------------------------
 * `initial` is not a client-only instruction. Motion serializes it as an
 * INLINE STYLE during SSR so the element does not flash before hydration, so
 * a bare `initial={{ opacity: 0 }}` shipped this in the prerendered HTML of
 * every public page:
 *
 *   <main id="main-content" ...>
 *     <div style="opacity:0;transform:translateY(8px)">   <- 266KB of 296KB
 *
 * Measured on the live site: 90% of each page's bytes sat inside that div, on
 * all ~298 URLs. Three consequences, and only the first is a performance
 * problem:
 *
 *   1. FCP and LCP were gated on the whole JS bundle downloading, parsing and
 *      hydrating - on a prerendered page whose HTML had arrived at 20ms.
 *      PageSpeed mobile: FCP 3.0s, LCP 5.8s, with LCP breakdown reporting
 *      TTFB 20ms and **element render delay 2,470ms**. The server was never
 *      the problem.
 *   2. With JavaScript disabled or broken, nothing ever removes the inline
 *      style, so the page is permanently blank below the header. A decoration
 *      became a hard dependency for reading the site.
 *   3. It is invisible on desktop, where hydration is fast enough that the
 *      fade looks like the intended design. Desktop scored 96 with the same
 *      defect present.
 *
 * `initial={false}` tells Motion to render AT the animate state instead, so
 * the SSR'd markup is visible with no JS required. We only opt back into the
 * animation once mounted, which is exactly when it is wanted: a route change
 * is the only time a viewer can perceive a "transition" at all. On a hard
 * load there is no previous page to transition FROM, so the fade was paying
 * for nothing.
 *
 * Do not "simplify" this back to a constant `initial`. Verify with
 * `curl -s https://permtracker.app/ | grep -c 'opacity:0;transform'` - the
 * wrapper must not appear.
 */

import { motion } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useReducedMotion } from "@/lib/animations";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();

  // False during SSR and on the first client render, so the initial markup
  // carries no hiding style and hydration matches. Flipped in an effect,
  // which cannot re-trigger `initial` on an already-mounted element - Motion
  // reads it once, at mount. Every LATER pathname change remounts via `key`
  // and does animate.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (reducedMotion) {
    return <>{children}</>;
  }

  return (
    <motion.div
      key={pathname}
      initial={mounted ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {children}
    </motion.div>
  );
}
