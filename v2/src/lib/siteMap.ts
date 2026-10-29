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
 * header leads with the first two, and the Data menu holds the rest in the
 * steps of the process, in order (owner, Oct 27 2026: one list, by step), each
 * step's calculators beside its data, so the menu, the rail, /today, /tools and
 * the calculators index all read the same groups.
 */

import { LOCALES } from "@/lib/i18n/locales";

export interface SitePage {
  href: string;
  /** The page's one name: the menus, the trail, search and its H1 use it. */
  name: string;
}

/** The Data menu's groups: the reader's own case, then the steps of the process in order, then the rest. */
export type DataGroup =
  | "Your case"
  | "Wage request"
  | "Recruitment"
  | "PERM"
  | "I-140"
  | "Green card line"
  | "Employers and firms"
  | "Breakdowns"
  | "Wages"
  | "Other visas";

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
  | "firm-rankings"
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
  | "visa-wait-times"
  | "risk"
  | "rfi-audit"
  | "uscis-rfe"
  | "by-state"
  | "by-city"
  | "by-industry"
  | "by-country"
  | "h1b-lottery"
  | "calculators"
  | "green-card-timeline"
  | "which-green-card"
  | "pwd-validity"
  | "deadlines"
  | "rfi-deadline"
  | "i140-wait"
  | "i140-trends"
  | "retention"
  | "eb2-vs-eb3"
  | "i485-position"
  | "fees"
  | "ead-extension"
  | "lottery-calculator"
  | "six-year-limit";

export interface DataNavSection extends SitePage {
  key: DataSection;
  /** Kept as `label` for the readers that grew up on the old menu. */
  label: string;
  group: DataGroup | "Calculators";
  /** A calculator: it works something out from the reader's own inputs, and the calculators index lists it. */
  tool?: true;
  /** A calculator's job in a few words, wherever the calculators are listed with what they do. */
  does?: string;
}

const s = (key: DataSection, group: DataNavSection["group"], name: string, href: string): DataNavSection => ({
  key,
  group,
  name,
  label: name,
  href,
});
/** A calculator's entry, with what it does. */
const t = (key: DataSection, group: DataGroup, name: string, href: string, does: string): DataNavSection => ({
  ...s(key, group, name, href),
  tool: true,
  does,
});

/** The Data hub: the parent of every group. */
export const OVERVIEW = { key: "overview" as const, name: "Data", label: "Data", href: "/tools" };

/** The calculators index: the section a calculator page without its own entry falls under. */
export const CALCULATORS = s("calculators", "Calculators", "Calculators", "/calculators");

export const SECTIONS: DataNavSection[] = [
  // Named for the phrase people search (Search Console, Oct 28 2026: "perm case status" found the homepage first).
  s("case-status", "Your case", "PERM case status", "/perm-case-status"),
  s("all-cases", "Your case", "Find a case", "/case-search"),
  t("green-card-timeline", "Your case", "Green card timeline and planner", "/tools/green-card-timeline", "Every step dated from your own dates, with the fees."),
  t("which-green-card", "Your case", "Which green card fits", "/tools/which-green-card", "The categories your job points to."),
  t("fees", "Your case", "Green card fees", "/tools/green-card-fees", "USCIS's fees for the whole case."),
  t("ead-extension", "Your case", "EAD extension", "/tools/ead-extension", "Whether a renewal keeps work authorization."),
  s("uscis-case-status", "Your case", "USCIS case status", "/uscis-case-status"),
  s("timelines", "Your case", "Reported green card timelines", "/green-card-timelines"),

  s("pwd-cases", "Wage request", "Wage requests", "/pwd-cases"),
  t("pwd-wait", "Wage request", "Wage request wait", "/tools/pwd-calculator", "How many wage requests sit ahead of yours."),
  t("wage-levels", "Wage request", "Prevailing wage levels", "/tools/wage-levels", "DOL's four levels for a job and an area, read live."),
  t("pwd-validity", "Wage request", "Wage determination validity", "/tools/pwd-validity", "The day a determination expires, and which rule set it."),

  s("recruitment", "Recruitment", "PERM recruitment", "/perm-recruitment"),
  t("deadlines", "Recruitment", "PERM deadlines", "/tools/perm-deadline-calculator", "The recruitment window, the quiet period and the filing window."),

  s("cases", "PERM", "PERM cases", "/perm-cases"),
  s("processing-times", "PERM", "PERM processing times", "/perm-processing-times"),
  t("timeline-calculator", "PERM", "Processing time calculator", "/tools/perm-timeline-calculator", "The likely decision day and its range."),
  s("queue", "PERM", "Queue backlog", "/perm-queue"),
  s("activity", "PERM", "Daily decisions", "/perm-decision-activity"),
  s("risk", "PERM", "Denial rates", "/perm-denial-risk"),
  s("rfi-audit", "PERM", "RFI and audits", "/perm-rfi-audit"),
  t("rfi-deadline", "PERM", "RFI deadline", "/tools/rfi-deadline", "Thirty days from the date on DOL's letter."),

  s("uscis-times", "I-140", "USCIS processing times", "/uscis-processing-times"),
  t("i140-wait", "I-140", "I-140 wait", "/tools/i140-calculator", "Petitions waiting against how fast USCIS clears them."),
  t("i140-trends", "I-140", "I-140 trends", "/tools/i140-trends", "Petitions received, approved and denied, by quarter."),
  s("awaiting-visa", "I-140", "I-140s awaiting a visa", "/i140-awaiting-visa"),
  s("uscis-rfe", "I-140", "USCIS RFE rates", "/uscis-rfe-rates"),
  t("retention", "I-140", "Priority date retention", "/tools/priority-date-retention", "When the date is kept, and when an I-485 can move."),

  s("visa-bulletin", "Green card line", "Visa bulletin", "/visa-bulletin"),
  t("priority-dates", "Green card line", "Priority date calculator", "/tools/priority-date-calculator", "Your date against every bulletin."),
  t("green-card-line", "Green card line", "Your place in line", "/tools/green-card-line", "Everyone ahead of your priority date."),
  t("eb2-vs-eb3", "Green card line", "EB-2 or EB-3", "/tools/eb2-vs-eb3", "Which line has fewer people ahead of your date."),
  s("i485-offices", "Green card line", "I-485 by office", "/i485-by-field-office"),
  t("i485-position", "Green card line", "I-485 queue position", "/tools/i485-queue-position", "Adjustment applications pending ahead of you."),
  s("nvc-waiting-list", "Green card line", "NVC waiting list", "/nvc-waiting-list"),
  s("visa-issuances", "Green card line", "Visas issued", "/visa-issuances"),

  s("employers", "Employers and firms", "Employers", "/perm-employers"),
  s("attorneys", "Employers and firms", "Law firms", "/perm-attorneys"),
  s("firm-rankings", "Employers and firms", "Law firm rankings", "/law-firm-rankings"),
  s("sponsor-finder", "Employers and firms", "Find a sponsor", "/sponsor-finder"),
  s("compare-employers", "Employers and firms", "Compare employers", "/perm-employers/compare"),
  s("employers-under-review", "Employers and firms", "Employers under review", "/perm-employers/under-review"),
  s("h1b-employers", "Employers and firms", "Top H-1B employers", "/h1b-employers"),
  s("layoffs", "Employers and firms", "Layoff notices", "/layoffs"),
  s("debarments", "Employers and firms", "Debarments", "/debarments"),

  s("by-state", "Breakdowns", "By state", "/perm-by-state"),
  s("by-city", "Breakdowns", "By city", "/perm-cities"),
  s("by-industry", "Breakdowns", "By industry", "/perm-industries"),
  s("by-country", "Breakdowns", "By citizenship", "/perm-countries"),

  s("wages", "Wages", "PERM wages by job", "/perm-wages"),
  t("salary-explorer", "Wages", "PERM salary explorer", "/tools/salary-explorer", "What certified PERM jobs pay, as a ladder."),
  s("lca-wages", "Wages", "H-1B salaries", "/lca-wages"),
  t("compare-offer", "Wages", "Compare my offer", "/tools/compare-my-offer", "Where an offer sits among certified filings."),
  s("wage-sources", "Wages", "H-1B wage sources", "/lca-wage-sources"),

  s("lca-cases", "Other visas", "H-1B LCAs", "/lca-cases"),
  s("h1b-lottery", "Other visas", "H-1B lottery odds", "/h1b-lottery-odds"),
  t("lottery-calculator", "Other visas", "H-1B lottery calculator", "/tools/h1b-lottery-odds-calculator", "An offer's wage level and its chance in the draw."),
  t("six-year-limit", "Other visas", "H-1B six-year limit", "/tools/h1b-six-year-limit", "The end of six years and the 365-day rule."),
  s("seasonal-cases", "Other visas", "H-2A, H-2B and CW-1", "/seasonal-cases"),
  s("visa-wait-times", "Other visas", "Visa interview waits", "/visa-wait-times"),
  s("opt-employers", "Other visas", "OPT and CPT employers", "/opt-employers"),
];

export const GROUPS: DataGroup[] = [
  "Your case",
  "Wage request",
  "Recruitment",
  "PERM",
  "I-140",
  "Green card line",
  "Employers and firms",
  "Breakdowns",
  "Wages",
  "Other visas",
];

/** Every calculator, in the order of the steps they serve: the entries the menu files as tools. */
export const CALCULATOR_PAGES: readonly SitePage[] = SECTIONS.filter((x) => x.tool).map(({ href, name }) => ({ href, name }));

/** The Learn menu: reading, then reference, then the site itself. */
export const LEARN_PAGES: readonly SitePage[] = [
  { href: "/guides", name: "Guides" },
  { href: "/blog", name: "Blog" },
  { href: "/faq", name: "FAQ" },
  { href: "/perm-case-statuses", name: "What each status means" },
  { href: "/glossary", name: "Glossary" },
  { href: "/policy-changes", name: "Policy changes" },
  { href: "/methodology", name: "Methodology" },
  { href: "/editorial-standards", name: "Editorial standards" },
  { href: "/estimate-scorecard", name: "Estimate scorecard" },
  { href: "/about", name: "About" },
  { href: "/changelog", name: "Changelog" },
];

/** The header's links, beside the Data and Learn menus. */
export const HEADER_PAGES = {
  caseStatus: { href: "/perm-case-status", name: "Case status" },
  processingTimes: { href: "/perm-processing-times", name: "Processing times" },
  forAttorneys: { href: "/for-attorneys", name: "For professionals" },
} as const satisfies Record<string, SitePage>;

/** The foot of the Data menu: the hubs and the open files. */
export const DATA_MENU_FOOTER: readonly SitePage[] = [
  { href: OVERVIEW.href, name: "All data" },
  { href: "/today", name: "Where every step stands" },
  { href: "/perm-by-the-numbers", name: "PERM by the numbers" },
  { href: CALCULATORS.href, name: `All ${CALCULATOR_PAGES.length} calculators` },
  { href: "/open-data", name: "Open data" },
];

/** Pages named here and nowhere else in the menus. */
const OTHER_PAGES: readonly SitePage[] = [
  { href: "/", name: "Home" },
  { href: OVERVIEW.href, name: OVERVIEW.name },
  { href: CALCULATORS.href, name: CALCULATORS.name },
  { href: "/for-attorneys", name: "For professionals" },
  { href: "/visa-bulletin/family", name: "Family cutoffs" },
  { href: "/visa-bulletin/categories", name: "By category" },
  { href: "/press", name: "Press" },
  { href: "/reviews", name: "Reviews" },
  { href: "/compare", name: "PERM trackers compared" },
  { href: "/open-data", name: "Open data" },
  { href: "/perm-by-the-numbers", name: "PERM by the numbers" },
  { href: "/today", name: "Where every step stands" },
  { href: "/badges", name: "Badges" },
  { href: "/developers", name: "API and AI assistants" },
  { href: "/extension", name: "Browser extension" },
  { href: "/email-preferences", name: "Email preferences" },
  { href: "/contact", name: "Contact" },
  // The corrections log, an article, linked from the footer beside the editorial standards.
  { href: "/changelog/corrections", name: "Corrections" },
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
    pages: named("/guides", "/blog", "/faq", "/perm-case-statuses", "/glossary", "/methodology", "/editorial-standards", "/changelog/corrections", "/changelog"),
  },
  {
    title: "PERM Tracker",
    pages: named("/about", "/reviews", "/compare", "/for-attorneys", "/press", "/open-data", "/badges", "/developers", "/extension", "/email-preferences", "/contact"),
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
