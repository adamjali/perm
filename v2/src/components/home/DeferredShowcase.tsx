"use client";

import { useEffect, useRef, useState } from "react";
import VideoPlayer from "@/components/content/VideoPlayer";

/**
 * The Remotion product demo, mounted only once its section is near the
 * viewport.
 *
 * The player auto-played from initial mount, which meant a full animation
 * runtime spending main-thread time before the visitor had scrolled anywhere
 * near it — a measurable slice of the "home page feels laggy" report. The
 * chunk was already dynamic; the RUNTIME cost was not gated. Now nothing
 * loads or runs until the section is ~400px from view, and the placeholder
 * reserves the exact aspect so mounting shifts no layout.
 */
export function DeferredShowcase() {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "400px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className="aspect-video w-full">
      {near ? (
        <VideoPlayer videoId="ProductDemo" className="border-0 shadow-none" autoPlay loop />
      ) : (
        <div className="h-full w-full bg-foreground/5" aria-hidden="true" />
      )}
    </div>
  );
}
