"use client";

import { Fragment, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * A long page in named parts: the bar stays under the site header while the
 * page scrolls, says which part is on screen, and jumps to any of them (back
 * by the owner's ask, Oct 15 2026: the plain row scrolled away and left a long
 * page with no way back to its parts).
 */

export interface ChapterItem {
  id: string;
  label: string;
}

export function ChapterNav({ items, className }: { items: ChapterItem[]; className?: string }) {
  const [active, setActive] = useState<string | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const navRef = useRef<HTMLElement>(null);

  // The bar's rules run edge to edge (owner, Oct 15 2026: they stopped short of
  // the rail on the left and the window on the right). The page's own column
  // is narrower than that, so the bar measures how far it has to reach: on a
  // data page to the rail's edge, elsewhere and on a phone to the screen's.
  // Before this runs the rules span the column, as they always did.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const column = nav.closest<HTMLElement>("[data-shell-column]");
    const wide = window.matchMedia("(min-width: 64rem)");
    const measure = () => {
      const box = nav.getBoundingClientRect();
      let edge = 0;
      if (column && wide.matches && column.parentElement) {
        const gap = parseFloat(getComputedStyle(column.parentElement).columnGap) || 0;
        edge = column.getBoundingClientRect().left - gap;
      }
      nav.style.setProperty("--bleed-l", `${Math.max(0, box.left - edge)}px`);
      nav.style.setProperty("--bleed-r", `${Math.max(0, document.documentElement.clientWidth - box.right)}px`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(document.documentElement);
    ro.observe(nav);
    if (column) ro.observe(column);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const sections = items
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => el !== null);
    const visible = new Map<string, boolean>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible.set(e.target.id, e.isIntersecting);
        // The first part, in page order, whose top band is on screen. Above
        // the first part (scrolled back to the top) nothing is marked.
        const first = items.find((i) => visible.get(i.id));
        if (first) setActive(first.id);
        else if (sections[0] && sections[0].getBoundingClientRect().top > window.innerHeight * 0.25) setActive(null);
      },
      { rootMargin: "-25% 0px -65% 0px" },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [items]);

  // On a phone the bar scrolls sideways: keep the current part in view,
  // without moving the page.
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
      ref={navRef}
      aria-label="On this page"
      className={cn(
        // Sticks under the fixed header. `-mx` lines its parts up with the
        // column's edges; the ground and rules are a layer behind them that
        // reaches as far as the effect above measured.
        "sticky top-(--site-header-h) z-30 -mx-4 px-4 sm:-mx-6 sm:px-6 print:hidden",
        "before:absolute before:inset-y-0 before:-z-10 before:border-y-2 before:border-border before:bg-background before:content-['']",
        "before:left-[calc(-1*var(--bleed-l,0px))] before:right-[calc(-1*var(--bleed-r,0px))]",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <p className="hidden shrink-0 text-sm font-semibold text-muted-foreground lg:block">On this page</p>{" "}
        {/* `max-lg:pl-8`: below lg the data rail's 44px handle is fixed at the
            screen's left edge at this same height, and covered the first link. */}
        <ol
          ref={listRef}
          className="flex min-w-0 gap-2 overflow-x-auto py-2 pr-1 max-lg:pl-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((i) => (
            <Fragment key={i.id}>
              {" "}
              <li className="shrink-0">
                <a
                  href={`#${i.id}`}
                  aria-current={active === i.id ? "location" : undefined}
                  // Boxes, not underlined links (round 3, Oct 15 2026): each part
                  // is a tile, the one on screen filled lime.
                  className="inline-flex min-h-11 items-center whitespace-nowrap border-2 border-border bg-card px-3 text-sm font-bold text-foreground shadow-hard-sm transition-colors duration-150 hover:bg-sage-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-[current=location]:border-black aria-[current=location]:bg-primary aria-[current=location]:text-black"
                >
                  {i.label}
                </a>
              </li>
            </Fragment>
          ))}
        </ol>
      </div>
    </nav>
  );
}
