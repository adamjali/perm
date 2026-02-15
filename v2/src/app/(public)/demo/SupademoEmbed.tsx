"use client";

import { useState, useRef, useEffect } from "react";

/**
 * Lazy-loaded Supademo iframe embed.
 * Only renders the iframe when scrolled within 300px of viewport,
 * preventing the heavy third-party JS from blocking TBT on page load.
 */
export function SupademoEmbed() {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShow(true);
          obs.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="relative overflow-hidden border-3 border-border shadow-hard-lg"
      style={{ aspectRatio: "16/9" }}
    >
      <div className="flex items-center gap-1.5 border-b-3 border-border bg-muted px-3 py-2">
        <div className="h-2.5 w-2.5 border border-border bg-[#FF5F57]" />
        <div className="h-2.5 w-2.5 border border-border bg-[#FFBD2E]" />
        <div className="h-2.5 w-2.5 border border-border bg-[#28CA41]" />
        <span className="ml-3 font-mono text-[10px] text-muted-foreground">
          permtracker.app — Interactive Tour
        </span>
      </div>
      {show ? (
        <iframe
          src="https://app.supademo.com/embed/cmli1lvlg1lkg5351b6olnd9n?embed_v=2"
          loading="lazy"
          title="PERM Tracker interactive product tour"
          allow="clipboard-write"
          className="h-full w-full"
          style={{
            border: "none",
            position: "absolute",
            top: "0",
            left: "0",
            width: "100%",
            height: "100%",
            paddingTop: "34px",
          }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-muted pt-[34px]">
          <p className="font-mono text-sm text-muted-foreground">
            Loading tour...
          </p>
        </div>
      )}
    </div>
  );
}
