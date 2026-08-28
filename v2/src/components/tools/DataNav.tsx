"use client";

import { useState } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * The persistent section nav for the public data surface.
 *
 * Before this existed, every calculator was an island: reaching a sibling tool
 * meant backing out to /tools and clicking again. The rival product keeps its
 * whole data surface one click deep from anywhere, and that is the correct
 * shape for an instrument — sections, not pages.
 *
 * TWO LEVELS, NOT ONE STRIP. The first version rendered all fifteen pages in
 * a single horizontally-scrolling row with 10px group labels between them.
 * Adam's read of it: "too crammed, have to scroll, not obvious where
 * everything is in the hierarchy". He was right — a scroll strip hides
 * everything past the fold and flattens a lookup, an aggregate and the
 * methodology page into peers. Now the five GROUPS are the always-visible
 * row (they fit without scrolling at every width), and the open group's
 * pages render as chips beneath. Two controls, two behaviours, per the
 * house rule: a group tab EXPANDS, a page chip NAVIGATES.
 *
 * Client component now (the open group is state), which is what the old
 * server-component note traded away — the strip costs a few KB of JS and
 * buys the hierarchy the surface was missing.
 */

export type DataSection =
  | "overview"
  | "case-status"
  | "calculators"
  | "queue"
  | "processing-times"
  | "activity"
  | "by-state"
  | "wages"
  | "employers"
  | "attorneys"
  | "cases"
  | "risk"
  | "rfi-audit"
  | "visa-bulletin"
  | "methodology";

export interface DataNavSection {
  key: DataSection;
  label: string;
  href: string;
  /** Which family the tab belongs to — the first-level row. */
  group: "Start" | "Queue" | "Who files" | "Risk" | "Reference";
}

/**
 * Exported so `data-nav-sections.test.ts` can check every page's `active`
 * prop against the real list rather than a second copy of it. A gate that
 * holds its own transcript of the thing it is checking passes the day they
 * diverge, which is the day it was needed.
 */
export const SECTIONS: DataNavSection[] = [
  { key: "overview", group: "Start", label: "Overview", href: "/tools" },
  // Second on purpose. Somebody holding a case number has the highest-intent
  // question on this whole surface, and every other tab is an aggregate.
  { key: "case-status", group: "Start", label: "Case status", href: "/perm-case-status" },
  { key: "calculators", group: "Start", label: "Calculators", href: "/calculators" },
  // "Queue backlog", not "Live queue". 79.8% of pending cases were last
  // re-verified before 2026-08-01, so the counts behind this tab are a
  // rolling snapshot rather than a live reading, and a nav label is the
  // last place that distinction should be quietly dropped.
  { key: "queue", group: "Queue", label: "Queue backlog", href: "/perm-queue" },
  { key: "processing-times", group: "Queue", label: "Processing times", href: "/perm-processing-times" },
  { key: "activity", group: "Queue", label: "Daily activity", href: "/perm-decision-activity" },
  { key: "by-state", group: "Who files", label: "By state", href: "/perm-by-state" },
  { key: "wages", group: "Who files", label: "Wages", href: "/perm-wages" },
  { key: "employers", group: "Who files", label: "Employers", href: "/perm-employers" },
  { key: "attorneys", group: "Who files", label: "Law firms", href: "/perm-attorneys" },
  { key: "cases", group: "Who files", label: "Case search", href: "/perm-cases" },
  { key: "risk", group: "Risk", label: "Denial rates", href: "/perm-denial-risk" },
  // Its own key rather than borrowing "risk". Measured before adding: this
  // page had ZERO inbound links from anywhere in the app, so a borrowed chip
  // would have left it unreachable by navigation, not merely mislabelled.
  { key: "rfi-audit", group: "Risk", label: "RFI and audits", href: "/perm-rfi-audit" },
  { key: "visa-bulletin", group: "Reference", label: "Visa bulletin", href: "/tools/priority-date-calculator" },
  { key: "methodology", group: "Reference", label: "Methodology", href: "/methodology" },
];

const GROUPS = ["Start", "Queue", "Who files", "Risk", "Reference"] as const;

export function DataNav({ active }: { active: DataSection }) {
  const activeGroup =
    SECTIONS.find((s) => s.key === active)?.group ?? "Start";
  const [open, setOpen] = useState<(typeof GROUPS)[number]>(activeGroup);
  const chips = SECTIONS.filter((s) => s.group === open);

  return (
    <nav
      aria-label="Data sections"
      // Opaque on purpose, with a solid apron drawn ABOVE the bar: the header's
      // real height varies by a few pixels across devices (borders, the
      // security-banner variable), and a translucent bar over a 1-8px slit
      // ghosts the page through it — caught on an iPhone within hours of
      // shipping. The apron absorbs the variance instead of chasing it.
      className="sticky top-16 z-30 -mx-4 border-b-2 border-border bg-background px-4 before:absolute before:inset-x-0 before:bottom-full before:h-10 before:bg-background sm:-mx-6 sm:px-6"
      style={{ top: "calc(4rem + var(--security-banner-h, 0px))" }}
    >
      <div className="mx-auto max-w-7xl">
        {/* Level 1: the five groups. They fit at every width, so nothing
            scrolls and nothing is hidden past a fold. */}
        {/* overflow-x-auto is the safety valve for very narrow phones only:
            at 390px the five labels fit at this scale, measured; at 320px
            they scroll rather than wrap or shrink below the legibility
            floor. */}
        <div className="flex items-stretch overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Section groups">
          {GROUPS.map((g) => {
            const isOpen = g === open;
            const holdsActive = g === activeGroup;
            return (
              <button
                key={g}
                type="button"
                role="tab"
                aria-selected={isOpen}
                aria-controls="data-nav-pages"
                onClick={() => setOpen(g)}
                className={cn(
                  "min-h-[44px] flex-1 whitespace-nowrap border-b-4 px-1.5 py-2.5 font-heading text-xs font-black uppercase tracking-wide transition-colors sm:flex-none sm:px-4 sm:text-sm",
                  isOpen
                    ? "border-primary text-foreground"
                    : "border-transparent text-foreground/60 hover:border-border hover:text-foreground",
                )}
              >
                {g}
                {/* The dot marks the group holding the CURRENT page while a
                    different group is open — so "where am I" survives
                    browsing the other tabs. */}
                {holdsActive && !isOpen ? (
                  <span
                    aria-hidden="true"
                    className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary align-middle"
                  />
                ) : null}
              </button>
            );
          })}
        </div>
        {/* Level 2: the open group's pages. Wraps instead of scrolling. */}
        <div
          id="data-nav-pages"
          role="tabpanel"
          className="flex flex-wrap items-center gap-x-1 gap-y-0 border-t-2 border-border/50 py-1"
        >
          {chips.map((s) => {
            const isActive = s.key === active;
            return (
              <Link
                key={s.key}
                href={s.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "whitespace-nowrap border-b-4 px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider transition-colors sm:text-sm",
                  isActive
                    ? "border-primary text-foreground"
                    : "border-transparent text-foreground/60 hover:border-border hover:text-foreground",
                )}
              >
                {s.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
