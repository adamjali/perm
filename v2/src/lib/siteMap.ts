/**
 * The public site's map: every page's one name, and where each one sits.
 *
 * ONE SOURCE (Oct 14 2026). The header, the Data menu, the "In this section"
 * list, the breadcrumbs, the search palette and the footer all read this, so a
 * page is called the same thing everywhere it appears. Before, the side menu,
 * the footer, the palette and each page's heading named pages separately, and
 * one page could be "Daily activity" in a menu, "Decision activity" in search
 * and something else in its H1.
 *
 * The site's jobs, by how much they're used: check a case and hear when it
 * changes; find a case without the number; look up an employer or law firm;
 * how long it will take; the rest of the data; learn; the attorney app. The
 * header leads with the first two, and the Data menu holds the rest in six
 * groups a reader can scan at once.
 */

import { LOCALES } from "@/lib/i18n/locales";

export interface SitePage {
  href: string;
  /** The page's one name: the menus, the trail, search and its H1 use it. */
  name: string;
}

/** The six groups of the Data menu, in the order a waiting reader needs them. */
export type DataGroup =
  | "Cases"
  | "Wait times"
  | "Employers and firms"
  | "Wages"
  | "Green card line"
  | "Approvals and denials";

/** The keys the data pages are known by (entity pages name their index by one). */
export type DataSection =
  | "case-status"
  | "all-cases"
  | "cases"
  | "pwd-cases"
  | "lca-cases"
  | "seasonal-cases"
  | "uscis-case-status"
  | "processing-times"
  | "timeline-calculator"
  | "queue"
  | "activity"
  | "pwd-wait"
  | "uscis-times"
  | "timelines"
  | "employers"
  | "attorneys"
  | "sponsor-finder"
  | "recruitment"
  | "compare-employers"
  | "h1b-employers"
  | "opt-employers"
  | "employers-under-review"
  | "layoffs"
  | "debarments"
  | "wages"
  | "salary-explorer"
  | "lca-wages"
  | "wage-levels"
  | "compare-offer"
  | "wage-sources"
  | "visa-bulletin"
  | "priority-dates"
  | "green-card-line"
  | "awaiting-visa"
  | "i485-offices"
  | "nvc-waiting-list"
  | "visa-issuances"
  | "risk"
  | "rfi-audit"
  | "uscis-rfe"
  | "by-state"
  | "by-city"
  | "by-industry"
  | "by-country"
  | "h1b-lottery"
  | "calculators";

export interface DataNavSection extends SitePage {
  key: DataSection;
  /** Kept as `label` for the readers that grew up on the old menu. */
  label: string;
  group: DataGroup | "Calculators";
}

const s = (key: DataSection, group: DataNavSection["group"], name: string, href: string): DataNavSection => ({
  key,
  group,
  name,
  label: name,
  href,
});

/** The Data hub: the parent of every group. */
export const OVERVIEW = { key: "overview" as const, name: "Data", label: "Data", href: "/tools" };

/** The calculators index: the section a calculator page without its own entry falls under. */
export const CALCULATORS = s("calculators", "Calculators", "Calculators", "/calculators");

export const SECTIONS: DataNavSection[] = [
  s("case-status", "Cases", "Case status", "/perm-case-status"),
  s("all-cases", "Cases", "Find a case", "/case-search"),
  s("cases", "Cases", "PERM cases", "/perm-cases"),
  s("pwd-cases", "Cases", "Wage requests", "/pwd-cases"),
  s("lca-cases", "Cases", "H-1B LCAs", "/lca-cases"),
  s("seasonal-cases", "Cases", "H-2A, H-2B and CW-1", "/seasonal-cases"),
  s("uscis-case-status", "Cases", "USCIS case status", "/uscis-case-status"),

  s("processing-times", "Wait times", "PERM processing times", "/perm-processing-times"),
  s("timeline-calculator", "Wait times", "Processing time calculator", "/tools/perm-timeline-calculator"),
  s("queue", "Wait times", "Queue backlog", "/perm-queue"),
  s("activity", "Wait times", "Daily decisions", "/perm-decision-activity"),
  s("pwd-wait", "Wait times", "Wage request wait", "/tools/pwd-calculator"),
  s("uscis-times", "Wait times", "USCIS processing times", "/uscis-processing-times"),
  s("timelines", "Wait times", "Reported green card timelines", "/green-card-timelines"),

  s("employers", "Employers and firms", "Employers", "/perm-employers"),
  s("attorneys", "Employers and firms", "Law firms", "/perm-attorneys"),
  s("sponsor-finder", "Employers and firms", "Find a sponsor", "/sponsor-finder"),
  s("compare-employers", "Employers and firms", "Compare employers", "/perm-employers/compare"),
  s("h1b-employers", "Employers and firms", "Top H-1B employers", "/h1b-employers"),
  s("opt-employers", "Employers and firms", "OPT and CPT employers", "/opt-employers"),
  s("employers-under-review", "Employers and firms", "Employers under review", "/perm-employers/under-review"),
  s("layoffs", "Employers and firms", "Layoff notices", "/layoffs"),
  s("debarments", "Employers and firms", "Debarments", "/debarments"),

  s("wages", "Wages", "PERM wages by job", "/perm-wages"),
  s("salary-explorer", "Wages", "PERM salary explorer", "/tools/salary-explorer"),
  s("lca-wages", "Wages", "H-1B salaries", "/lca-wages"),
  s("wage-levels", "Wages", "Prevailing wage levels", "/tools/wage-levels"),
  s("compare-offer", "Wages", "Compare my offer", "/tools/compare-my-offer"),
  s("wage-sources", "Wages", "H-1B wage sources", "/lca-wage-sources"),

  s("visa-bulletin", "Green card line", "Visa bulletin", "/visa-bulletin"),
  s("priority-dates", "Green card line", "Priority date calculator", "/tools/priority-date-calculator"),
  s("green-card-line", "Green card line", "Your place in line", "/tools/green-card-line"),
  s("awaiting-visa", "Green card line", "I-140s awaiting a visa", "/i140-awaiting-visa"),
  s("i485-offices", "Green card line", "I-485 by office", "/i485-by-field-office"),
  s("nvc-waiting-list", "Green card line", "NVC waiting list", "/nvc-waiting-list"),
  s("visa-issuances", "Green card line", "Visas issued", "/visa-issuances"),

  s("risk", "Approvals and denials", "Denial rates", "/perm-denial-risk"),
  s("rfi-audit", "Approvals and denials", "RFI and audits", "/perm-rfi-audit"),
  s("recruitment", "Approvals and denials", "PERM recruitment", "/perm-recruitment"),
  s("uscis-rfe", "Approvals and denials", "USCIS RFE rates", "/uscis-rfe-rates"),
  s("by-state", "Approvals and denials", "By state", "/perm-by-state"),
  s("by-city", "Approvals and denials", "By city", "/perm-cities"),
  s("by-industry", "Approvals and denials", "By industry", "/perm-industries"),
  s("by-country", "Approvals and denials", "By citizenship", "/perm-countries"),
  s("h1b-lottery", "Approvals and denials", "H-1B lottery odds", "/h1b-lottery-odds"),
];

export const GROUPS: DataGroup[] = [
  "Cases",
  "Wait times",
  "Employers and firms",
  "Wages",
  "Green card line",
  "Approvals and denials",
];

/** Every calculator, in the order the index lists them. */
export const CALCULATOR_PAGES: readonly SitePage[] = [
  { href: "/tools/perm-timeline-calculator", name: "Processing time calculator" },
  { href: "/tools/green-card-timeline", name: "Green card timeline calculator" },
  { href: "/tools/pwd-calculator", name: "Wage request wait" },
  { href: "/tools/i140-calculator", name: "I-140 wait" },
  { href: "/tools/i485-queue-position", name: "I-485 queue position" },
  { href: "/tools/green-card-line", name: "Your place in line" },
  { href: "/tools/priority-date-calculator", name: "Priority date calculator" },
  { href: "/tools/eb2-vs-eb3", name: "EB-2 or EB-3" },
  { href: "/tools/which-green-card", name: "Which green card fits" },
  { href: "/tools/salary-explorer", name: "PERM salary explorer" },
  { href: "/tools/compare-my-offer", name: "Compare my offer" },
  { href: "/tools/wage-levels", name: "Prevailing wage levels" },
  { href: "/tools/i140-trends", name: "I-140 trends" },
  { href: "/tools/perm-deadline-calculator", name: "PERM deadlines" },
  { href: "/tools/rfi-deadline", name: "RFI deadline" },
  { href: "/tools/pwd-validity", name: "Wage determination validity" },
  { href: "/tools/h1b-six-year-limit", name: "H-1B six-year limit" },
  { href: "/tools/h1b-lottery-odds-calculator", name: "H-1B lottery calculator" },
  { href: "/tools/priority-date-retention", name: "Priority date retention" },
  { href: "/tools/ead-extension", name: "EAD extension" },
  { href: "/tools/green-card-fees", name: "Green card fees" },
];

/** The Learn menu: reading, then reference, then the site itself. */
export const LEARN_PAGES: readonly SitePage[] = [
  { href: "/guides", name: "Guides" },
  { href: "/blog", name: "Blog" },
  { href: "/faq", name: "FAQ" },
  { href: "/perm-case-statuses", name: "What each status means" },
  { href: "/glossary", name: "Glossary" },
  { href: "/policy-changes", name: "Policy changes" },
  { href: "/methodology", name: "Methodology" },
  { href: "/estimate-scorecard", name: "Estimate scorecard" },
  { href: "/about", name: "About" },
  { href: "/changelog", name: "Changelog" },
];

/** The header's links, beside the Data and Learn menus. */
export const HEADER_PAGES = {
  caseStatus: { href: "/perm-case-status", name: "Case status" },
  processingTimes: { href: "/perm-processing-times", name: "Processing times" },
  forAttorneys: { href: "/for-attorneys", name: "For attorneys" },
} as const satisfies Record<string, SitePage>;

/** The foot of the Data menu: the hubs and the open files. */
export const DATA_MENU_FOOTER: readonly SitePage[] = [
  { href: OVERVIEW.href, name: "All data" },
  { href: CALCULATORS.href, name: `All ${CALCULATOR_PAGES.length} calculators` },
  { href: "/open-data", name: "Open data" },
];

/** Pages named here and nowhere else in the menus. */
const OTHER_PAGES: readonly SitePage[] = [
  { href: "/", name: "Home" },
  { href: OVERVIEW.href, name: OVERVIEW.name },
  { href: CALCULATORS.href, name: CALCULATORS.name },
  { href: "/for-attorneys", name: "For attorneys" },
  { href: "/visa-bulletin/family", name: "Family cutoffs" },
  { href: "/visa-bulletin/categories", name: "By category" },
  { href: "/press", name: "Press" },
  { href: "/reviews", name: "Reviews" },
  { href: "/open-data", name: "Open data" },
  { href: "/badges", name: "Badges" },
  { href: "/developers", name: "API and AI assistants" },
  { href: "/extension", name: "Browser extension" },
  { href: "/email-preferences", name: "Email preferences" },
  { href: "/contact", name: "Contact" },
  { href: "/privacy", name: "Privacy policy" },
  { href: "/terms", name: "Terms of service" },
  { href: "/api-terms", name: "API terms" },
  { href: "/security", name: "Security" },
  { href: "/accessibility", name: "Accessibility" },
  { href: "/login", name: "Sign in" },
  { href: "/signup", name: "Sign up" },
  { href: "/perm-employers/browse", name: "Browse A to Z" },
  { href: "/perm-attorneys/browse", name: "Browse A to Z" },
  { href: "/perm-wages/browse", name: "Browse A to Z" },
  // Each language's guide, named in its own language.
  ...LOCALES.map((l) => ({ href: l.path, name: l.endonym })),
];

/** Every page's one name, by path. */
export const PAGE_NAMES: ReadonlyMap<string, string> = (() => {
  const names = new Map<string, string>();
  // The header's labels are short forms ("Processing times" in a PERM site's
  // header), so they aren't checked against the pages' full names.
  for (const list of [SECTIONS, CALCULATOR_PAGES, LEARN_PAGES, OTHER_PAGES]) {
    for (const p of list) {
      const had = names.get(p.href);
      if (had !== undefined && had !== p.name) {
        throw new Error(`siteMap: ${p.href} is named both "${had}" and "${p.name}"`);
      }
      names.set(p.href, p.name);
    }
  }
  return names;
})();

/** The name of a page, or null when the map doesn't name it. */
export function pageName(href: string): string | null {
  return PAGE_NAMES.get(normalisePath(href)) ?? null;
}

function normalisePath(pathname: string): string {
  return pathname.split(/[?#]/)[0]!.replace(/\/+$/, "") || "/";
}

/**
 * Which section a URL belongs to, or null off the data surface.
 *
 * LONGEST MATCH WINS: `/tools/priority-date-calculator` is in the Green card
 * line group even though `/tools` is the Data hub. A calculator with no entry
 * of its own falls under Calculators.
 */
export function sectionForPath(pathname: string): DataNavSection | null {
  const path = normalisePath(pathname);
  const candidates = [...SECTIONS, CALCULATORS].sort((a, b) => b.href.length - a.href.length);
  const hit = candidates.find((x) => path === x.href || path.startsWith(`${x.href}/`));
  if (hit) return hit;
  if (path.startsWith(`${OVERVIEW.href}/`)) return CALCULATORS;
  return null;
}

/** Whether a path is anywhere on the data surface, the Data hub included. */
export function isDataPath(pathname: string): boolean {
  const path = normalisePath(pathname);
  return path === OVERVIEW.href || sectionForPath(path) !== null;
}

/** The pages listed beside a page as "In this section": its group's pages. */
export function sectionPages(pathname: string): { title: string; pages: readonly SitePage[] } | null {
  const section = sectionForPath(pathname);
  if (!section) return null;
  if (section.group === "Calculators") return { title: "Calculators", pages: CALCULATOR_PAGES };
  return { title: section.group, pages: SECTIONS.filter((x) => x.group === section.group) };
}

/** A footer column: a title and the pages under it, named by PAGE_NAMES. */
export interface FooterColumn {
  title: string;
  pages: readonly SitePage[];
}

const named = (...hrefs: string[]): SitePage[] =>
  hrefs.map((href) => {
    const name = PAGE_NAMES.get(href);
    if (!name) throw new Error(`siteMap: the footer links ${href}, which has no name`);
    return { href, name };
  });

/** The footer's three columns. Every page is reachable from here or a menu. */
export const FOOTER_COLUMNS: readonly FooterColumn[] = [
  {
    title: "Cases and data",
    pages: named("/perm-case-status", "/case-search", "/perm-processing-times", "/visa-bulletin", "/perm-employers", "/perm-attorneys", "/tools", "/calculators"),
  },
  {
    title: "Learn",
    pages: named("/guides", "/blog", "/faq", "/perm-case-statuses", "/glossary", "/methodology", "/changelog"),
  },
  {
    title: "PERM Tracker",
    pages: named("/about", "/reviews", "/for-attorneys", "/press", "/open-data", "/badges", "/developers", "/extension", "/email-preferences", "/contact"),
  },
];

/** The footer's last line. */
export const FOOTER_LEGAL: readonly SitePage[] = named("/privacy", "/terms", "/api-terms", "/security", "/accessibility");

/** The signed-in app's one-line footer. */
export const APP_FOOTER: readonly SitePage[] = [
  { href: OVERVIEW.href, name: "Public data" },
  { href: "/guides/getting-started", name: "Help" },
  ...named("/privacy", "/terms", "/changelog"),
];
