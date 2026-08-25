"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

/**
 * The curtain for CLIENT-SIDE navigations to the home page.
 *
 * PRELOADER_BOOT runs from <head>, which means it runs once per DOCUMENT.
 * Clicking "Home" from /blog is a soft navigation — React swaps the tree,
 * no new document is parsed, and that script never runs again. So the
 * reported "skeleton loading states and blank page with just header happens
 * instead" was not a bug in the curtain; the curtain was never invoked.
 *
 * Arming on the CLICK rather than on arrival is the whole point. usePathname
 * only updates once navigation has already committed, so a curtain driven by
 * it would appear after the wait it exists to cover.
 *
 * The cover is `html[data-pre="on"] body::before`, which needs no markup, so
 * setting the attribute is enough to cover the screen instantly. The branded
 * .pre panel arrives with the page's own RSC payload and layers on top.
 */

// Same values as the boot script. They are duplicated rather than imported
// because that module's copies are baked into a string that ships in <head>.
const CAP_MS = 1200;
const EXIT_MS = 560;

export function HomeCurtainNav() {
  const pathname = usePathname();
  const armed = useRef(false);
  const capTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const disarm = useCallback(() => {
    if (capTimer.current) {
      clearTimeout(capTimer.current);
      capTimer.current = null;
    }
    if (!armed.current) return;
    armed.current = false;
    const h = document.documentElement;
    const el = document.querySelector(".pre");
    if (el) el.classList.add("pre-leave");
    setTimeout(() => {
      h.setAttribute("data-pre", "off");
      if (el?.parentNode) el.parentNode.removeChild(el);
    }, EXIT_MS);
  }, []);

  const arm = useCallback(() => {
    if (armed.current) return;
    armed.current = true;
    document.documentElement.setAttribute("data-pre", "on");
    // A navigation can be cancelled, fail, or simply never commit. Without
    // this the cover would stay up over a perfectly working page, which is
    // the exact failure the document-level curtain already had once.
    capTimer.current = setTimeout(disarm, CAP_MS);
  }, [disarm]);

  // Arm on a left-click heading to "/". Capture phase, so it runs before
  // Next's own Link handler starts the transition.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = e.target;
      if (!(target instanceof Element)) return;
      const a = target.closest("a");
      if (!(a instanceof HTMLAnchorElement)) return;
      if (a.hasAttribute("download")) return;
      if (a.target && a.target !== "_self") return;
      let url: URL;
      try {
        url = new URL(a.href, window.location.href);
      } catch {
        return;
      }
      // Same origin, actually the home page, and not a link home from home.
      if (url.origin !== window.location.origin) return;
      if (url.pathname !== "/") return;
      if (window.location.pathname === "/") return;
      arm();
    }
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [arm]);

  // Navigation committed. The page's .pre markup is in the tree by now, so
  // this is the moment the panel can be animated out.
  useEffect(() => {
    if (!armed.current) return;
    if (pathname !== "/") {
      // Armed for home but we ended up somewhere else (a redirect, or a
      // second click mid-flight). Never leave the cover over another page.
      disarm();
      return;
    }
    const t = setTimeout(disarm, 260);
    return () => clearTimeout(t);
  }, [pathname, disarm]);

  // Same reasoning as the boot script: someone already trying to use the
  // page must never be held behind decoration.
  useEffect(() => {
    const types = ["keydown", "wheel", "touchstart", "pointerdown"] as const;
    const onInteract = () => {
      if (armed.current) disarm();
    };
    types.forEach((t) =>
      window.addEventListener(t, onInteract, { capture: true, passive: true }),
    );
    return () =>
      types.forEach((t) =>
        window.removeEventListener(t, onInteract, { capture: true }),
      );
  }, [disarm]);

  return null;
}
