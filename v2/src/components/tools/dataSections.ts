/**
 * The data surface's map: what pages exist, how they group, and which one a
 * URL is on.
 *
 * EXTRACTED FROM `DataNav.tsx` when the two-tier tab bar became a sidebar.
 * The list outlived the control that rendered it, which is the usual reason to
 * move something into its own module: the rail, the tests and the layout all
 * need the map, and none of them should have to import a component to get it.
 *
 * WHY THE GROUPING CHANGED. Adam, on the old bar: "theres like two headers...
 * double header is awk, esp how were doing it ppl click the top ones and are
 * confused why they didnt go anywhere." Two fixes, and only one of them is
 * about the control:
 *
 *   - The group headers were never links, and nothing said so. That is a
 *     documented usability failure, not a preference - a reader cannot tell a
 *     parent is inert until they click it. They are disclosures now, with a
 *     caret and no link styling.
 *   - Two groups were wrong about their own contents. "Start" held Overview,
 *     Case status and Calculators, which is a hub plus two tools; Overview is
 *     the section's home and is now a standalone entry above the groups.
 *     "Who files" held Case search, which is a case tool and has moved to sit
 *     beside Case status.
 *
 * The labels say what is inside rather than characterising it: "Employers and
 * wages", not "Who files"; "Denials and audits", not "Risk".
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

export type DataGroup =
  | "Case tools"
  | "Queue"
  | "Employers and wages"
  | "Denials and audits"
  | "Reference";

export interface DataNavSection {
  key: DataSection;
  label: string;
  href: string;
  group: DataGroup;
}

/**
 * The section's home. Deliberately outside `SECTIONS`: it is the parent of
 * every group rather than a peer of any item, and filing it under one of them
 * is what made the old first group incoherent.
 */
export const OVERVIEW = {
  key: "overview" as const,
  label: "Overview",
  href: "/tools",
};

/**
 * Exported so `data-nav-sections.test.ts` can check the real list rather than
 * a second copy of it. A gate holding its own transcript of the thing it
 * checks passes on the day they diverge, which is the day it was needed.
 */
export const SECTIONS: DataNavSection[] = [
  { key: "case-status", group: "Case tools", label: "Case status", href: "/perm-case-status" },
  // Moved out of "Who files". It searches the case corpus, and somebody
  // holding a case number is the highest-intent reader on this surface; the
  // two lookups belong together.
  { key: "cases", group: "Case tools", label: "Case search", href: "/perm-cases" },
  { key: "calculators", group: "Case tools", label: "Calculators", href: "/calculators" },

  // "Queue backlog", not "Live queue". 79.8% of pending cases were last
  // re-verified before 2026-08-01, so these counts are a rolling snapshot
  // rather than a live reading, and a nav label is the last place that
  // distinction should be quietly dropped.
  { key: "queue", group: "Queue", label: "Queue backlog", href: "/perm-queue" },
  { key: "processing-times", group: "Queue", label: "Processing times", href: "/perm-processing-times" },
  { key: "activity", group: "Queue", label: "Daily activity", href: "/perm-decision-activity" },

  { key: "employers", group: "Employers and wages", label: "Employers", href: "/perm-employers" },
  { key: "attorneys", group: "Employers and wages", label: "Law firms", href: "/perm-attorneys" },
  { key: "wages", group: "Employers and wages", label: "Wages", href: "/perm-wages" },
  { key: "by-state", group: "Employers and wages", label: "By state", href: "/perm-by-state" },

  { key: "risk", group: "Denials and audits", label: "Denial rates", href: "/perm-denial-risk" },
  // Its own key rather than borrowing "risk". Measured before adding: this
  // page had ZERO inbound links from anywhere in the app, so a borrowed entry
  // would have left it unreachable by navigation, not merely mislabelled.
  { key: "rfi-audit", group: "Denials and audits", label: "RFI and audits", href: "/perm-rfi-audit" },

  { key: "visa-bulletin", group: "Reference", label: "Visa bulletin", href: "/tools/priority-date-calculator" },
  { key: "methodology", group: "Reference", label: "Methodology", href: "/methodology" },
];

export const GROUPS: DataGroup[] = [
  "Case tools",
  "Queue",
  "Employers and wages",
  "Denials and audits",
  "Reference",
];

/**
 * Which section a URL belongs to, or null when the path is not on this
 * surface at all.
 *
 * DERIVED FROM THE PATH, not passed in by each page. Every one of the 28
 * pages used to hand the bar an `active` prop naming its own section, which
 * is a fact stated twice - once by the route it lives at and once by hand -
 * and a test existed solely to stop the two drifting. Reading the pathname
 * removes the second copy, so drift is not possible rather than merely
 * caught.
 *
 * LONGEST MATCH WINS, and that is load-bearing. `/tools` is the Overview and
 * `/tools/priority-date-calculator` is the visa bulletin; a first-match scan
 * over a list that happens to hold `/tools` earlier would put every
 * calculator under Overview. Sorting by href length makes the answer
 * independent of the order the list is written in.
 */
export function sectionForPath(pathname: string): DataNavSection | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  const candidates = [...SECTIONS].sort((a, b) => b.href.length - a.href.length);
  return (
    candidates.find((s) => path === s.href || path.startsWith(`${s.href}/`)) ??
    null
  );
}

/** Whether a path is anywhere on the data surface, Overview included. */
export function isDataPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  return (
    path === OVERVIEW.href ||
    path.startsWith(`${OVERVIEW.href}/`) ||
    sectionForPath(path) !== null
  );
}
