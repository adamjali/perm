"use client";

import { useEffect } from "react";

/**
 * Has this app hydrated at least once in this browser session?
 *
 * WHAT IT IS FOR
 * --------------
 * Motion serializes a component's `initial` prop as an INLINE STYLE during
 * server rendering, so `initial="hidden"` (or `initial={{ opacity: 0 }}`)
 * ships the element invisible in the prerendered HTML and it only appears
 * once React hydrates and the animation runs. For an ENTRANCE animation -
 * one whose `animate` prop is unconditional rather than driven by
 * `useInView` - that trade is bad on a hard load and good on a soft one:
 *
 *   hard load   there is no previous page to transition FROM, so the fade
 *               shows the reader nothing. It costs LCP (the content waits on
 *               the whole JS bundle) and it makes the page permanently blank
 *               with JS disabled or broken.
 *   soft nav    the reader was just looking at a different page, so the
 *               entrance is doing real work.
 *
 * Measured on this site 2026-08-31: `<h1>`, the article description, the
 * breadcrumb and the entire `article-content` div shipped with
 * `style="opacity:0"` on every blog, guide and changelog page.
 *
 * HOW TO USE IT
 * -------------
 *     const hydrated = useHasHydratedOnce();
 *     <motion.div initial={hydrated ? "hidden" : false} animate="show">
 *
 * `initial={false}` tells Motion to render AT the `animate` state, so the
 * server emits visible markup and the animation is simply skipped that once.
 *
 * WHY MODULE STATE AND NOT useState
 * ---------------------------------
 * A `useState(false)` + effect pair resets on every mount, and these
 * components unmount and remount on each client-side navigation - so they
 * would never animate again, losing the effect entirely rather than moving
 * it. The flag has to outlive the component, so it lives in the module.
 *
 * Reading module state during render is normally a hazard. It is safe here
 * for one specific reason: the only writer is inside `useEffect`, which never
 * runs on the server. In a long-lived Node process the module IS shared
 * across requests, and it stays `false` there forever, so SSR output is
 * deterministic. On the client the very first render also reads `false`,
 * matching the server exactly, which is what keeps hydration clean.
 */
let hydratedOnce = false;

export function useHasHydratedOnce(): boolean {
  // Captured at render time. False on the server and on the first client
  // render of the session; true for every mount after that.
  const value = hydratedOnce;

  useEffect(() => {
    hydratedOnce = true;
  }, []);

  return value;
}

/** Test-only. Resets the module flag so a suite can exercise both branches. */
export function __resetHasHydratedOnce(): void {
  hydratedOnce = false;
}
