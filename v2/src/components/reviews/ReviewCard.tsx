"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { QuotesIcon, StarIcon } from "@phosphor-icons/react/ssr";

import { cn } from "@/lib/utils";

/**
 * One review, as a tile: stars, the words, the name and day. The same card on the homepage and on /reviews.
 *
 * A tile sits on the tint with no edge or shadow (DESIGN_SYSTEM.md, "Objects and ground"): a hard shadow here
 * made a card read as a button that did nothing (owner, Oct 23 2026). The only thing a card does is open a long
 * review: past `lines` the words are cut, and "Read more" shows them whole. Whether they were cut is measured in
 * the browser, so a short review never shows the button.
 */

export interface ReviewCardData {
  id: string;
  rating: number;
  text: string;
  name: string;
  /** "October 23, 2026", or null when the date couldn't be read. */
  day: string | null;
}

const CLAMP: Record<number, string> = { 5: "line-clamp-5", 6: "line-clamp-6", 8: "line-clamp-[8]" };

export function ReviewCard({
  review: r,
  lines = 8,
  compact = false,
  hidden = false,
  className,
}: {
  review: ReviewCardData;
  /** How many lines of the words show before "Read more" (5, 6 or 8). */
  lines?: 5 | 6 | 8;
  compact?: boolean;
  /** The drifting rows' looping copy: hidden from assistive tech, which reads each review once. */
  hidden?: boolean;
  className?: string;
}) {
  const words = useRef<HTMLSpanElement>(null);
  const [cut, setCut] = useState(false);
  const [open, setOpen] = useState(false);

  // Measured with the clamp on; once open, the button stays so the words can be folded again.
  useLayoutEffect(() => {
    const el = words.current;
    if (!el || open) return;
    const measure = () => setCut(el.scrollHeight > el.clientHeight + 1);
    measure();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [open, r.text]);

  return (
    <figure aria-hidden={hidden || undefined} className={cn("flex flex-col bg-tint", compact ? "p-5" : "p-6", className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((n) => (
            <StarIcon key={n} weight={n <= r.rating ? "fill" : "regular"} className={cn("size-5", n <= r.rating ? "text-primary" : "text-foreground")} />
          ))}
        </span>{" "}
        <span className="text-sm text-muted-foreground">{`${r.rating} of 5`}</span>
      </div>{" "}
      {r.text ? (
        <blockquote className={cn("mt-4 flex-1 [overflow-wrap:anywhere]", compact ? "text-base" : "text-lg", "leading-relaxed")}>
          <QuotesIcon weight="fill" className="mb-1 size-6 text-primary" aria-hidden="true" />
          <span ref={words} className={cn("block whitespace-pre-line", open ? "" : CLAMP[lines])}>
            {r.text}
          </span>{" "}
          {cut || open ? (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              className="link mt-1 inline-flex min-h-11 items-center text-base"
            >
              {open ? "Show less" : "Read more"}
            </button>
          ) : null}
        </blockquote>
      ) : (
        <p className={cn("mt-4 flex-1 text-muted-foreground", compact ? "text-base" : "text-lg")}>Rated without words.</p>
      )}{" "}
      <figcaption className="mt-5 border-t-2 border-border pt-3">
        <span className="font-heading text-base font-bold">{r.name}</span>{" "}
        {r.day ? <span className="block text-sm text-muted-foreground">{r.day}</span> : null}
      </figcaption>
    </figure>
  );
}
