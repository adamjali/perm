/**
 * Every page a person can be sent to by name, for the search palette and for
 * the 404 page's "did you mean". Built from the site map (lib/siteMap.ts), so
 * a page is called here what it's called in the header, the menus and its own
 * title. A plain module, so neither reader has to load the other.
 */

import {
  HEADER_PAGES,
  LEARN_PAGES,
  PAGE_NAMES,
  SECTIONS,
  type SitePage,
} from "@/lib/siteMap";
import { FORM_PAGES } from "@/lib/uscisForms";

export interface SiteIndexEntry {
  label: string;
  href: string;
  group: string;
  keywords: string;
  /** Shown before anything is typed: the site's main jobs. */
  main?: boolean;
}

/** What the palette shows before anything is typed, in this order. */
export const MAIN_JOBS: readonly string[] = [
  "/perm-case-status",
  "/case-search",
  "/tools/perm-timeline-calculator",
  "/perm-processing-times",
  "/perm-employers",
  "/visa-bulletin",
];

/**
 * The words people type for a page whose name doesn't carry them. A name is
 * short ("By city"); without these the fuzzy match can't tie "worksite",
 * "naics" or "nationality" to the page that filters by it.
 */
export const PAGE_KEYWORDS: Readonly<Record<string, string>> = {
  "/perm-case-status": "check track lookup status case number dol flag g-100",
  "/case-search": "search find case employer firm without number",
  "/open-data": "open data download csv json dataset bulk licence license cc-by bulletin history",
  "/perm-cities": "city cities town metro worksite location",
  "/perm-industries": "industry industries naics sector",
  "/perm-countries": "country countries citizenship nationality birth",
  "/perm-by-state": "state states worksite location",
  "/perm-decision-activity": "decided decisions day certified denied withdrawn",
  "/pwd-cases": "prevailing wage request p-100 pwd",
  "/lca-cases": "lca h-1b labor condition i-200",
  "/seasonal-cases": "h-2a h-2b h2a h2b cw-1 cw1 seasonal farm agricultural temporary h-300 h-400 p-400 p-500 jo-a-300 c-500 job order northern mariana",
  "/opt-employers": "opt stem opt cpt f-1 student students practical training sevis ice",
  "/tools/green-card-timeline": "green card planner plan timeline every step dates how long when will i get my green card cost fees total perm i-140 i-485 premium processing",
  "/tools/green-card-line": "green card line place in line queue ahead of me how many years wait backlog priority date eb-2 eb-3 india china",
  "/sponsor-finder": "sponsor sponsors green card employer employers find search filter job occupation state industry wage salary timing transfer cap-exempt",
  "/today": "today now everything board dashboard overview summary all steps wage request pwd perm i-140 i140 visa bulletin cutoff where line stands growing shrinking moved forward back retrogression status",
  "/perm-by-the-numbers": "numbers statistics stats totals counts data pending waiting on hold holds decisions per day new filings jobs crew member new employers sponsors rfi wage requests visa bulletin archive press",
  "/perm-recruitment": "recruitment sunday ad ads advertisement newspaper newspapers job order notice of filing additional steps professional journal timing",
  "/h1b-employers": "h-1b h1b top employers sponsors biggest largest busiest companies ranking lca uscis data hub approvals by state",
  "/lca-wage-sources": "prevailing wage source survey oes radford aon mercer willis towers watson cba union h-1b lca",
  "/uscis-rfe-rates": "rfe request for evidence rate rates h-1b h1b l-1 l1 o-1 tn h-2a h-2b i-129 uscis denial",
  "/uscis-processing-times": "uscis processing time times median wait form i-140 i-485 i-765 i-131 ead advance parole daca deferred action i-821d",
  "/tools/h1b-lottery-odds-calculator": "h-1b h1b lottery registration cap selection odds chance wage level weighted",
  "/perm-employers/under-review": "on hold rfi audit appeals census",
  "/perm-employers/compare": "compare sponsors side by side",
  "/layoffs": "warn layoff notices",
  "/debarments": "debarred barred banned sponsors",
  "/green-card-timelines": "i-140 i-485 timeline community reports rfe premium ead advance parole",
  "/developers": "api developer developers key json mcp claude cursor chatgpt assistant connector openapi integration",
  "/api-terms": "api terms license licence rules",
  "/extension": "chrome extension browser add-on plugin linkedin indeed glassdoor handshake wellfound job posting sponsor h-1b",
  "/email-preferences": "unsubscribe alerts notifications",
  "/reviews": "reviews review testimonials rating ratings stars feedback what people say",
  "/perm-employers/browse": "browse alphabetical index employers companies sponsors",
  "/perm-attorneys/browse": "browse alphabetical index attorneys law firms counsel",
  "/perm-wages/browse": "browse alphabetical index occupations job titles soc wages",
  "/zh": "chinese 中文 绿卡 排期 劳工证 guide",
  "/es": "spanish español green card guía",
  "/pt-br": "portuguese português brasil guia",
  "/ko": "korean 한국어 영주권 문호 안내",
  "/vi": "vietnamese tiếng việt thẻ xanh hướng dẫn",
};

/** Pages reached by name that no menu group holds. */
const OTHER_GO_TO = [
  "/for-attorneys",
  "/open-data",
  "/badges",
  "/developers",
  "/api-terms",
  "/extension",
  "/email-preferences",
  "/press",
  "/reviews",
  "/compare",
  "/contact",
  "/perm-employers/browse",
  "/perm-attorneys/browse",
  "/perm-wages/browse",
  "/zh",
  "/es",
  "/pt-br",
  "/ko",
  "/vi",
];

/** The browse hubs share one page name; search needs to tell them apart. */
const SEARCH_LABELS: Readonly<Record<string, string>> = {
  "/perm-employers/browse": "Browse employers A to Z",
  "/perm-attorneys/browse": "Browse law firms A to Z",
  "/perm-wages/browse": "Browse occupations A to Z",
};

export function staticIndex(): SiteIndexEntry[] {
  const out: SiteIndexEntry[] = [];
  const add = (p: SitePage, group: string, base = "") =>
    out.push({
      label: SEARCH_LABELS[p.href] ?? PAGE_NAMES.get(p.href) ?? p.name,
      href: p.href,
      group,
      keywords: `${base} ${PAGE_KEYWORDS[p.href] ?? ""}`.trim(),
      ...(MAIN_JOBS.includes(p.href) ? { main: true } : {}),
    });
  for (const p of Object.values(HEADER_PAGES)) add(p, "Go to");
  for (const s of SECTIONS) add(s, s.group, s.tool ? "calculator estimate" : "data statistics");
  for (const p of LEARN_PAGES) add(p, "Learn");
  for (const href of OTHER_GO_TO) {
    const name = PAGE_NAMES.get(href);
    if (name) add({ href, name }, "Go to");
  }
  // Every other page the map names (the hubs, the legal pages, the bulletin's
  // tabs), so search reaches every page that has a name.
  for (const [href, name] of PAGE_NAMES) {
    if (href !== "/" && href !== "/login" && href !== "/signup") add({ href, name }, "Go to");
  }
  // One page per USCIS form, under the name people search for ("i-485 processing time").
  for (const f of FORM_PAGES) {
    add({ href: `/uscis-processing-times/${f.slug}`, name: `${f.form} processing time` }, "USCIS processing times", f.terms);
  }
  // One row per page: a page in two lists keeps its first, most specific group.
  const seen = new Set<string>();
  return out.filter((e) => (seen.has(e.href) ? false : (seen.add(e.href), true)));
}
