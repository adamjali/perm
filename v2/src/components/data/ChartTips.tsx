"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * Exact figures on hover, tap or arrow key, for any chart on the site.
 *
 * Charts here are drawn by hand (HTML bars or inline SVG) and rendered on the
 * server. Each mark that has something to say carries it as `data-tip`, lines
 * split by "\n" with the first line as the heading:
 *
 *   <div data-tip={"Wed, Sep 30\n901 decided\n840 certified"} ... />
 *
 * Wrapping the chart in `<ChartTips label="...">` is the only client code a
 * chart needs. The marks stay server markup, so the chart is complete without
 * JavaScript, and every chart's tooltip looks and behaves the same:
 *   - a mouse shows the mark under the pointer;
 *   - a tap shows it and keeps it until the next tap;
 *   - the chart is one tab stop, and the arrow keys step through the marks
 *     (Home and End jump, Escape closes), with the figure read out politely.
 *
 * A mark that has a page behind it carries it as `data-href`, and opens it the
 * way people already try to: a click, a second tap on the mark a tap is
 * showing, or Enter. Rage clicks on chart bars (Oct 2026, PostHog) were
 * readers expecting exactly that, so no button or text is added for it.
 *
 * A chart still owns its accessible summary (an `aria-label` or a screen-reader
 * table); the tooltip adds detail, it isn't the only route to the numbers.
 *
 * A chart wider than a phone scrolls sideways: pass the scroll box's classes
 * as `scroll` instead of wrapping the chart in an `overflow-x-auto` div. The
 * tab stop then sits on the box that scrolls, so a keyboard reaches it and the
 * arrow keys bring each mark into view (WCAG 2.1.1), while the tooltip stays
 * outside the box, which would clip it.
 */

interface Shown {
  lines: string[];
  x: number;
  y: number;
  align: "start" | "center" | "end";
}

/** How close to an edge, as a share of the chart's width, a tooltip anchors to that side instead. */
const EDGE_SHARE = 0.18;

function marks(root: HTMLElement): Element[] {
  return Array.from(root.querySelectorAll("[data-tip]"));
}

export function ChartTips({
  label,
  className,
  scroll,
  startAtEnd = false,
  children,
}: {
  /** What the chart shows, for the keyboard focus announcement. */
  label: string;
  className?: string;
  /** Classes for a box the chart scrolls sideways in; omit for a chart that fits. */
  scroll?: string;
  /** A scrolling chart whose newest end is on the right opens scrolled there. */
  startAtEnd?: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const openAtEnd = useCallback(
    (el: HTMLDivElement | null) => {
      if (el && startAtEnd) el.scrollLeft = el.scrollWidth;
    },
    [startAtEnd],
  );
  const [shown, setShown] = useState<Shown | null>(null);
  const activeRef = useRef<Element | null>(null);
  const router = useRouter();
  const open = (el: Element | null, target?: EventTarget | null): boolean => {
    // A real link or button inside the mark does its own job.
    if (target instanceof Element && target.closest("a, button")) return false;
    const href = el?.getAttribute("data-href");
    if (!href) return false;
    router.push(href);
    return true;
  };

  const hide = useCallback(() => {
    activeRef.current?.removeAttribute("data-tip-active");
    activeRef.current = null;
    setShown(null);
  }, []);

  const show = useCallback((el: Element) => {
    const root = ref.current;
    if (!root) return;
    if (activeRef.current !== el) {
      activeRef.current?.removeAttribute("data-tip-active");
      el.setAttribute("data-tip-active", "");
      activeRef.current = el;
    }
    const box = root.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2 - box.left;
    const share = box.width > 0 ? x / box.width : 0.5;
    setShown({
      lines: (el.getAttribute("data-tip") ?? "").split("\n"),
      x,
      y: r.top - box.top,
      align: share < EDGE_SHARE ? "start" : share > 1 - EDGE_SHARE ? "end" : "center",
    });
  }, []);

  const markAt = (target: EventTarget | null): Element | null => {
    const el = target instanceof Element ? target.closest("[data-tip]") : null;
    return el && ref.current?.contains(el) ? el : null;
  };

  const step = (by: number | "first" | "last") => {
    const root = ref.current;
    if (!root) return;
    const all = marks(root);
    if (all.length === 0) return;
    const at = activeRef.current ? all.indexOf(activeRef.current) : -1;
    const next =
      by === "first" ? 0 : by === "last" ? all.length - 1 : at < 0 ? (by > 0 ? 0 : all.length - 1) : Math.min(all.length - 1, Math.max(0, at + by));
    const el = all[next]!;
    // A wide chart scrolls inside its own box on a phone; keep the mark the
    // keyboard just reached in view.
    el.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    show(el);
  };

  // One tab stop for the whole chart, on the scroll box when there is one;
  // the arrow keys move inside it.
  const stop = {
    tabIndex: 0,
    role: "group",
    "aria-label": `${label}. Use the arrow keys to read each value.`,
  } as const;

  return (
    <div
      ref={ref}
      {...(scroll === undefined ? stop : {})}
      className={cn("chart-tips relative", className)}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        const el = markAt(e.target);
        if (el) show(el);
        else hide();
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") hide();
      }}
      onPointerUp={(e) => {
        // A mouse already shows marks on hover, so its click opens the mark's
        // page when it has one. A tap shows a mark and keeps it until the next
        // tap; a second tap on the same mark opens its page.
        const el = markAt(e.target);
        if (e.pointerType === "mouse") {
          if (e.button === 0) open(el, e.target);
          return;
        }
        if (el && el !== activeRef.current) show(el);
        else if (!open(el, e.target)) hide();
      }}
      onKeyDown={(e) => {
        const keys: Record<string, number | "first" | "last"> = {
          ArrowRight: 1,
          ArrowDown: 1,
          ArrowLeft: -1,
          ArrowUp: -1,
          Home: "first",
          End: "last",
        };
        if (e.key === "Escape") {
          hide();
          return;
        }
        if (e.key === "Enter" && open(activeRef.current)) {
          e.preventDefault();
          return;
        }
        const by = keys[e.key];
        if (by === undefined) return;
        e.preventDefault();
        step(by);
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) hide();
      }}
    >
      {scroll === undefined ? (
        children
      ) : (
        <div {...stop} ref={openAtEnd} className={cn("chart-tips-scroll overflow-x-auto", scroll)}>
          {children}
        </div>
      )}
      <div role="status" aria-live="polite" className="sr-only">
        {shown ? shown.lines.join(", ") : ""}
      </div>
      {shown ? (
        <div
          aria-hidden="true"
          className="chart-tip"
          data-align={shown.align}
          style={{ left: shown.x, top: shown.y }}
        >
          {shown.lines.map((line, i) => (
            <span key={i} className="block">
              {line}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
