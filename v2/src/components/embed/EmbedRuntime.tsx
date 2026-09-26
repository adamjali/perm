"use client";

import { useEffect } from "react";

/**
 * The two things an embed does in the browser, and nothing else.
 *
 * 1. EVERY LINK OPENS IN A NEW TAB. The tools were written for this site, where
 *    a link to another page should navigate. Framed on somebody else's page,
 *    the same click would load a whole PERM Tracker page inside their iframe.
 *    One capture listener covers every link a tool renders, including ones
 *    added after load, without touching the tools. In-page anchors stay.
 *
 * 2. IT REPORTS ITS HEIGHT to the page that framed it, as a
 *    `{ type: "permtracker:embed-height", slug, height }` message, so a site
 *    that wants the frame to fit can listen and resize it. A height is not
 *    sensitive, hence the `*` target. Nothing is sent when not framed.
 */
export function EmbedRuntime({ slug }: { slug: string }) {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || (a.getAttribute("href") ?? "").startsWith("#")) return;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    };
    document.addEventListener("click", onClick, true);

    let observer: ResizeObserver | null = null;
    if (window.parent !== window && typeof ResizeObserver !== "undefined") {
      let last = 0;
      observer = new ResizeObserver(() => {
        const height = Math.ceil(document.documentElement.scrollHeight);
        if (height === last) return;
        last = height;
        window.parent.postMessage({ type: "permtracker:embed-height", slug, height }, "*");
      });
      observer.observe(document.body, { box: "border-box" });
    }

    return () => {
      document.removeEventListener("click", onClick, true);
      observer?.disconnect();
    };
  }, [slug]);
  return null;
}
