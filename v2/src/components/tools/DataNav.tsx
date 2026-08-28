import { Fragment } from "react";
import Link from "next/link";

/**
 * The persistent section nav for the public data surface.
 *
 * Before this existed, every calculator was an island: reaching a sibling tool
 * meant backing out to /tools and clicking again. The rival product keeps its
 * whole data surface one click deep from anywhere, and that is the correct
 * shape for an instrument — sections, not pages.
 *
 * Server component on purpose: the active state is set by the page that mounts
 * it (each page knows its own section), so no client JS is spent on a nav.
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
  /**
   * Which family the tab belongs to. Rendered as a small label at each
   * family's start, because fifteen same-weight chips in one strip read as
   * noise: a lookup, an aggregate, and the methodology page are not peers,
   * and the grouping is the hierarchy the strip was missing.
   */
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
  // Added 2026-08-27. Without it `/perm-queue` and every `/perm-queue/<month>`
  // page passed `active="overview"`, so the tab marked `aria-current="page"`
  // was Overview, which points at `/tools`. Same defect class as the
  // `/perm-cases` tab that shipped highlighting Employers: a section with its
  // own pages and no section key has to borrow somebody else's.
  // `data-nav-sections.test.ts` now derives the expected key from each page's
  // own route so a third one cannot be introduced quietly.
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

export function DataNav({ active }: { active: DataSection }) {
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
      <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto py-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SECTIONS.map((s, i) => {
          const isActive = s.key === active;
          const startsGroup = i === 0 || SECTIONS[i - 1]!.group !== s.group;
          // Keyed Fragment with a real space: mapped siblings render with
          // ZERO characters between them otherwise, and every DOM extractor
          // (Google included) reads the tab labels as one glued word.
          return (
            <Fragment key={s.key}>{" "}
            {startsGroup ? (
              <span
                aria-hidden="true"
                className={
                  "select-none self-center whitespace-nowrap font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/60 " +
                  (i === 0 ? "pr-1" : "border-l-2 border-border/50 pl-3 pr-1")
                }
              >
                {s.group}
              </span>
            ) : null}{" "}
            <Link
              href={s.href}
              aria-current={isActive ? "page" : undefined}
              className={
                "whitespace-nowrap border-b-4 px-3 py-3 font-mono text-xs font-bold uppercase tracking-wider transition-colors " +
                (isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-foreground/60 hover:border-border hover:text-foreground")
              }
            >
              {s.label}
            </Link>
            </Fragment>
          );
        })}
      </div>
    </nav>
  );
}
