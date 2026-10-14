"use client";

import { Fragment, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * A long entity page in named parts: the bar stays under the site header while
 * the page scrolls, says which part is on screen, and jumps to any of them.
 * An employer page ran to about 13,000 px of stacked boxes with nothing to say
 * where one subject ended and the next began.
 */

export interface ChapterItem {
  id: string;
  label: string;
}

export function ChapterNav({ items, className }: { items: ChapterItem[]; className?: string }) {
  const [active, setActive] = useState<string | null>(null);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const sections = items
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => el !== null);
    const visible = new Map<string, boolean>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible.set(e.target.id, e.isIntersecting);
        // The first part, in page order, whose top band is on screen.
        const first = items.find((i) => visible.get(i.id));
        if (first) setActive(first.id);
      },
      { rootMargin: "-25% 0px -65% 0px" },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [items]);

  // On a phone the bar scrolls sideways: keep the current part in view, without moving the page.
  useEffect(() => {
    const list = listRef.current;
    const link = active ? list?.querySelector<HTMLElement>(`a[href="#${active}"]`) : null;
    if (!list || !link) return;
    const left = link.offsetLeft - list.offsetLeft;
    if (left < list.scrollLeft || left + link.offsetWidth > list.scrollLeft + list.clientWidth) {
      list.scrollLeft = Math.max(0, left - 16);
    }
  }, [active]);

  return (
    <nav
      aria-label="On this page"
      className={cn(
        "sticky top-[var(--site-header-h,71px)] z-30 -mx-4 border-y border-border bg-background px-4 sm:-mx-6 sm:px-6",
        className,
      )}
    >
      {/* `max-lg:pl-8`: below lg the data rail's 44px handle is fixed at the
          screen's left edge at this same height, and covered the first link. */}
      <ol
        ref={listRef}
        className="flex gap-1 overflow-x-auto py-1 max-lg:pl-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((i) => (
          <Fragment key={i.id}>
            {" "}
            <li className="shrink-0">
              <a
                href={`#${i.id}`}
                aria-current={active === i.id ? "location" : undefined}
                className="inline-flex min-h-11 items-center whitespace-nowrap px-3 text-sm font-bold text-soft hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary aria-[current=location]:bg-primary aria-[current=location]:text-black"
              >
                {i.label}
              </a>
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
