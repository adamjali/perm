/**
 * The data surface's map: what pages exist, how they group, and which one a
 * URL is on.
 *
 * EXTRACTED FROM `DataNav.tsx` when the two-tier tab bar became a sidebar.
 * The list outlived the control that rendered it, which is the usual reason to
 * move something into its own module: the rail, the tests and the layout all
 * need the map, and none of them should have to import a component to get it.
 *
 * The group headers are disclosures (a caret, no link styling), because a
 * parent that looks like a link and goes nowhere is a known usability failure.
 * Overview is the section's home, a standalone entry above the groups. Labels
 * say what's inside ("Employers and wages", "Denials and audits").
 */

export type DataSection =
  | "overview"
  | "case-status"
  | "case-statuses"
  | "glossary"
  | "scorecard"
  | "badges"
  | "open-data"
  | "layoffs"
  | "visa-bulletin-family"
  | "visa-bulletin-categories"
  // Track B's receipt page (its SECTIONS entry was added without its key).
  | "uscis-case-status"
  | "uscis-times"
  | "i485-offices"
  | "awaiting-visa"
  | "timelines"
  | "h1b-lottery"
  | "h1b-lottery-calc"
  | "opt-employers"
  | "nvc-waiting-list"
  | "by-city"
  | "by-industry"
  | "by-country"
  | "calculators"
  | "queue"
  | "processing-times"
  | "activity"
  | "by-state"
  | "wages"
  | "lca-wages"
  | "compare-offer"
  | "compare-employers"
  | "policy-changes"
  | "debarments"
  | "employers"
  | "attorneys"
  | "cases"
  | "all-cases"
  | "pwd-cases"
  | "lca-cases"
  | "seasonal-cases"
  | "risk"
  | "rfi-audit"
  | "employers-under-review"
  | "visa-bulletin"
  | "visa-bulletin-next"
  | "methodology";

export type DataGroup =
  | "Case tools"
  | "Queue"
  | "Employers and wages"
  | "Breakdowns"
  | "Denials and audits"
  | "Visa bulletin"
  | "USCIS"
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
  { key: "all-cases", group: "Case tools", label: "Search all programs", href: "/case-search" },
  // Moved out of "Who files". It searches the case corpus, and somebody
  // holding a case number is the highest-intent reader on this surface; the
  // two lookups belong together.
  { key: "cases", group: "Case tools", label: "PERM cases", href: "/perm-cases" },
  // The step before the PERM, findable the same way: employer, title, month.
  { key: "pwd-cases", group: "Case tools", label: "Wage requests", href: "/pwd-cases" },
  { key: "lca-cases", group: "Case tools", label: "H-1B LCAs", href: "/lca-cases" },
  { key: "seasonal-cases", group: "Case tools", label: "H-2A, H-2B and CW-1", href: "/seasonal-cases" },
  { key: "calculators", group: "Case tools", label: "Calculators", href: "/calculators" },

  // "Queue backlog", not "Live queue": these counts are the last sweep's
  // snapshot rather than a live reading, and a nav label is the last place
  // that distinction should be quietly dropped.
  { key: "queue", group: "Queue", label: "Queue backlog", href: "/perm-queue" },
  { key: "processing-times", group: "Queue", label: "Processing times", href: "/perm-processing-times" },
  { key: "activity", group: "Queue", label: "Daily activity", href: "/perm-decision-activity" },
  // How our queue estimates scored against DOL's outcomes, so it sits with the
  // queue it grades (moved from Reference when Open data joined it, Oct 2 2026:
  // eight entries there ran the rail past its height budget).
  { key: "scorecard", group: "Queue", label: "Estimate scorecard", href: "/estimate-scorecard" },

  { key: "employers", group: "Employers and wages", label: "Employers", href: "/perm-employers" },
  { key: "attorneys", group: "Employers and wages", label: "Law firms", href: "/perm-attorneys" },
  { key: "wages", group: "Employers and wages", label: "Wages", href: "/perm-wages" },
  { key: "lca-wages", group: "Employers and wages", label: "H-1B salaries", href: "/lca-wages" },
  { key: "compare-offer", group: "Employers and wages", label: "Compare my offer", href: "/tools/compare-my-offer" },
  { key: "layoffs", group: "Employers and wages", label: "Layoff notices", href: "/layoffs" },
  { key: "compare-employers", group: "Employers and wages", label: "Compare employers", href: "/perm-employers/compare" },
  // Every decided case sliced one way: by where the job is, what the
  // employer does, and where the worker is a citizen of.
  { key: "by-state", group: "Breakdowns", label: "By state", href: "/perm-by-state" },
  { key: "by-city", group: "Breakdowns", label: "By city", href: "/perm-cities" },
  { key: "by-industry", group: "Breakdowns", label: "By industry", href: "/perm-industries" },
  { key: "by-country", group: "Breakdowns", label: "By citizenship", href: "/perm-countries" },
  // ICE's top-200 OPT and CPT employer lists: employers broken down by the
  // students they hire on practical training (Employers and wages is at the
  // rail's seven-row limit).
  { key: "opt-employers", group: "Breakdowns", label: "OPT and CPT employers", href: "/opt-employers" },

  { key: "risk", group: "Denials and audits", label: "Denial rates", href: "/perm-denial-risk" },
  // Its own key rather than borrowing "risk". Measured before adding: this
  // page had ZERO inbound links from anywhere in the app, so a borrowed entry
  // would have left it unreachable by navigation, not merely mislabelled.
  { key: "rfi-audit", group: "Denials and audits", label: "RFI and audits", href: "/perm-rfi-audit" },
  { key: "employers-under-review", group: "Denials and audits", label: "Employers under review", href: "/perm-employers/under-review" },

  // Its own group, not "Reference". This is a calculator over State Department
  // data: a different agency, a different dataset and a different question from
  // anything else on this rail, and the old filing put a calculator on the
  // reference shelf under a label that named neither.
  // The seasonal question first: what the next bulletin could do, from the
  // archive, rolling forward on its own. The month-by-month history sits
  // under it.
  { key: "visa-bulletin-next", group: "Visa bulletin", label: "Next bulletin", href: "/visa-bulletin" },
  { key: "visa-bulletin", group: "Visa bulletin", label: "Priority dates", href: "/tools/priority-date-calculator" },
  { key: "visa-bulletin-family", group: "Visa bulletin", label: "Family cutoffs", href: "/visa-bulletin/family" },
  { key: "visa-bulletin-categories", group: "Visa bulletin", label: "By category and country", href: "/visa-bulletin/categories" },
  // State's yearly count of consular applicants waiting, the other half of the line.
  { key: "nvc-waiting-list", group: "Visa bulletin", label: "NVC waiting list", href: "/nvc-waiting-list" },
  // USCIS's quarterly workbooks: a different agency from everything above,
  // and the stage AFTER the labor certification. Its own group for the same
  // reason the visa bulletin has one.
  // The receipt lookup sits with the rest of USCIS: Case tools is at the
  // rail's seven-row limit.
  { key: "uscis-case-status", group: "USCIS", label: "USCIS receipt", href: "/uscis-case-status" },
  { key: "uscis-times", group: "USCIS", label: "Processing times", href: "/uscis-processing-times" },
  { key: "i485-offices", group: "USCIS", label: "I-485 by office", href: "/i485-by-field-office" },
  { key: "awaiting-visa", group: "USCIS", label: "Awaiting a visa", href: "/i140-awaiting-visa" },
  // Community reports of the steps after PERM, the PERM half checked against DOL.
  { key: "timelines", group: "USCIS", label: "Green card timelines", href: "/green-card-timelines" },
  // USCIS runs the H-1B cap registration, so its odds sit with USCIS's data.
  { key: "h1b-lottery", group: "USCIS", label: "H-1B lottery odds", href: "/h1b-lottery-odds" },
  { key: "h1b-lottery-calc", group: "USCIS", label: "Lottery odds for a job", href: "/tools/h1b-lottery-odds-calculator" },
  { key: "case-statuses", group: "Reference", label: "Status meanings", href: "/perm-case-statuses" },
  { key: "methodology", group: "Reference", label: "Methodology", href: "/methodology" },
  { key: "policy-changes", group: "Reference", label: "Policy changes", href: "/policy-changes" },
  { key: "debarments", group: "Reference", label: "Debarments", href: "/debarments" },
  { key: "glossary", group: "Reference", label: "Glossary", href: "/glossary" },
  { key: "badges", group: "Reference", label: "Badges", href: "/badges" },
  { key: "open-data", group: "Reference", label: "Open data", href: "/open-data" },
];

export const GROUPS: DataGroup[] = [
  "Case tools",
  "Queue",
  "Employers and wages",
  "Breakdowns",
  "Denials and audits",
  // Its own group rather than a line in Reference: State Department data, a
  // different agency and a different question from everything above it. The
  // rail iterates THIS list, so adding a group to DataGroup without adding it
  // here leaves its pages in no list at all - which is exactly what
  // data-nav-sections.test.ts caught when this moved.
  "Visa bulletin",
  "USCIS",
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
 *
 * AND A TOOL PAGE FALLS BACK TO CALCULATORS. The individual tools live at
 * `/tools/<name>` while their nav entry is the index at `/calculators`, so
 * eight of the nine matched no section at all: the rail rendered (because
 * `isDataPath` accepts anything under `/tools/`) with nothing marked current,
 * on every calculator page. Reported from a screenshot of
 * `/tools/perm-timeline-calculator`.
 *
 * The fallback is DERIVED rather than nine more entries, because `/calculators`
 * already links to exactly these nine pages - a second hand-written list is
 * the drift this function was written to remove. `/tools` itself is excluded
 * (it is the Overview) and any tool with its own explicit entry still wins on
 * the longest match above, which is what keeps the priority-date calculator
 * under Visa bulletin.
 */
export function sectionForPath(pathname: string): DataNavSection | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  const candidates = [...SECTIONS].sort((a, b) => b.href.length - a.href.length);
  const exact = candidates.find((s) => path === s.href || path.startsWith(`${s.href}/`));
  if (exact) return exact;
  if (path.startsWith(`${OVERVIEW.href}/`)) {
    return SECTIONS.find((s) => s.key === "calculators") ?? null;
  }
  return null;
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
