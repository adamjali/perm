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
 *
 * A page that stays on screen refreshes too (owner, Oct 27 2026: figures update
 * live). While it's visible it asks `/api/sweep-stamp` every POLL_MS when our
 * DOL sweep last finished (one point read on the server), and redraws once that moves past the time it saw
 * first: a sweep's new counts reach an open page within minutes, with no reload.
 */
export const STALE_AFTER_MS = 30 * 60 * 1000;

/** How often a visible page asks whether a sweep has finished since it loaded. */
export const POLL_MS = 5 * 60 * 1000;

/** The sweep's finish time, or null when it can't be told (a failed request changes nothing). */
async function sweepStamp(): Promise<number | null> {
  try {
    const res = await fetch("/api/sweep-stamp");
    if (!res.ok) return null;
    const { checkedAt } = (await res.json()) as { checkedAt: unknown };
    return typeof checkedAt === "number" ? checkedAt : null;
  } catch {
    return null;
  }
}

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

  useEffect(() => {
    let seen: number | null = null;
    let alive = true;
    const poll = async () => {
      if (document.visibilityState !== "visible") return;
      const at = await sweepStamp();
      if (!alive || at === null) return;
      if (seen !== null && at > seen) {
        freshAt.current = Date.now();
        router.refresh();
      }
      seen = at;
    };
    void poll();
    const timer = window.setInterval(() => void poll(), POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [router]);

  return null;
}
