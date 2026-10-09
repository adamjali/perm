"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * A page left open refreshes its figures when the reader comes back to it.
 *
 * A phone keeps a tab, or a page added to the home screen, exactly as it was
 * drawn: switching back to it days later shows the old figures and asks the
 * server for nothing. That is how a homepage reading "Checked against DOL
 * 4:01 PM ET, Oct 2" was seen on Oct 9, while the server, Cloudflare's copy,
 * the browser's cache and the service worker all held Oct 8 (measured Oct 9
 * 2026). So when the page becomes visible again (a tab switch, an unlocked
 * screen, a back-forward restore) and its figures are older than
 * STALE_AFTER_MS, it asks the server for the current page. `router.refresh()`
 * re-renders the server parts and keeps whatever the reader typed.
 */
export const STALE_AFTER_MS = 30 * 60 * 1000;

/** Whether figures fetched at `freshAt` are too old to show at `now`. */
export function isStale(freshAt: number, now: number, after: number = STALE_AFTER_MS): boolean {
  return now - freshAt >= after;
}

export function RefreshWhenStale() {
  const router = useRouter();
  const pathname = usePathname();
  // A client-side move to another page fetches that page, so it counts as fresh.
  const freshAt = useRef(0);

  useEffect(() => {
    freshAt.current = Date.now();
  }, [pathname]);

  useEffect(() => {
    const check = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (!isStale(freshAt.current, now)) return;
      freshAt.current = now;
      router.refresh();
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) check();
    };
    document.addEventListener("visibilitychange", check);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("online", check);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("online", check);
    };
  }, [router]);

  return null;
}
