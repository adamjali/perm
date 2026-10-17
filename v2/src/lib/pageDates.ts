import PAGE_DATES from "@/lib/sitemap/page-dates.json";

/**
 * One date per public page: the day its content last changed.
 *
 * The sitemap's lastmod, the "Updated" line under the breadcrumb and the
 * page's WebPage `dateModified` all come from `pageDate`, so the three can't
 * disagree. Google uses a lastmod only when it's "consistently and verifiably
 * accurate", and shows a date beside a result only when the page shows one
 * and its structured data says the same.
 *
 * The date is the later of two days: the day anything the page renders from
 * last changed in git (page-dates.json, written at deploy by
 * scripts/page_dates.mjs; `[param]` keys stand for a template) and, for a page
 * that prints figures, the day those figures last moved (its source below).
 *
 * A plain module: the breadcrumb bar is a client component and reads it too.
 */

/** Where a page's figures come from, for the day they last moved. */
export type DateSource =
  /** DOL's own as-of stamp on its processing times. */
  | "dol"
  /** The newest article's published or updated date. */
  | "posts"
  /** The day our status sweep last finished (queue counts, review stages, the daily board). */
  | "sweep"
  /** The newest day the H-1B employer rankings cover. */
  | "h1b"
  /** The last decision day in DOL's published PERM files. */
  | "corpus";

export type DateSources = { readonly [K in DateSource]?: string | null };

/** For a route missing from page-dates.json: stale rather than false. */
const FALLBACK = "2026-08-24";

/** The day anything this route renders from last changed in git. */
export function changed(route: string): string {
  return (PAGE_DATES as Record<string, string>)[route] ?? FALLBACK;
}

/** The later of two dates, where the first may be missing. */
export function newer(a: string | null | undefined, b: string): string {
  return a && a > b ? a : b;
}

/**
 * The figures a page prints, by route. A route left out changes only when
 * its code does.
 */
export const DATE_SOURCE: Readonly<Record<string, DateSource>> = {
  "/": "sweep",
  "/blog": "posts",
  "/guides": "posts",
  "/changelog": "posts",

  "/perm-processing-times": "dol",
  "/tools/green-card-timeline": "dol",
  "/tools/perm-timeline-calculator": "dol",
  "/tools/pwd-calculator": "dol",
  "/visa-bulletin": "dol",
  "/visa-bulletin/family": "dol",
  "/visa-bulletin/categories": "dol",
  "/visa-bulletin/categories/[line]": "dol",
  "/perm-by-state": "dol",
  "/perm-wages": "dol",
  "/lca-wages": "dol",
  "/policy-changes": "dol",
  "/debarments": "dol",
  "/perm-case-statuses": "dol",
  "/estimate-scorecard": "dol",
  "/open-data": "dol",
  "/layoffs": "dol",
  "/perm-employers": "dol",
  "/perm-attorneys": "dol",
  "/perm-employers/browse": "dol",
  "/perm-attorneys/browse": "dol",
  "/perm-wages/browse": "dol",
  "/perm-employers/browse/[letter]": "dol",
  "/perm-attorneys/browse/[letter]": "dol",
  "/perm-wages/browse/[letter]": "dol",
  "/perm-cases": "dol",
  "/perm-denial-risk": "dol",

  "/perm-queue": "sweep",
  "/perm-queue/[month]": "sweep",
  "/perm-rfi-audit": "sweep",
  "/perm-rfi-audit/[stage]": "sweep",
  "/perm-decision-activity": "sweep",
  "/perm-employers/under-review": "sweep",

  "/h1b-employers": "h1b",
  "/h1b-employers/[state]": "h1b",

  "/perm-employers/[slug]": "corpus",
  "/perm-attorneys/[slug]": "corpus",
  "/perm-wages/[slug]": "corpus",
  "/perm-cities/[slug]": "corpus",
  "/perm-industries/[slug]": "corpus",
  "/perm-countries/[slug]": "corpus",
};

/**
 * Routes whose pages work out their own date and render their own breadcrumb
 * bar with it, the way an article does; the layout's bar steps aside there.
 * An employer with no published record is dated by the newest change among
 * its own cases, a bulletin month by whether it's the newest bulletin, and
 * the H-1B rankings by a doc too large for every page to read; the layout
 * can't know any of them from the address.
 */
export const OWN_DATE: ReadonlySet<string> = new Set([
  "/perm-employers/[slug]",
  "/visa-bulletin/[month]",
  "/h1b-employers",
  "/h1b-employers/[state]",
]);

/** A route's date, from its code and its figures. */
export function pageDate(route: string, sources: DateSources): string {
  const source = DATE_SOURCE[route];
  return newer(source ? sources[source] : null, changed(route));
}

/**
 * A bulletin month's date. The newest month is new: it takes DOL's date too,
 * as the sitemap always has, so the page never says it was updated before it
 * existed. An older month's bulletin never changes, so only its code dates it.
 */
export function bulletinMonthDate(isNewest: boolean, sources: DateSources): string {
  const route = "/visa-bulletin/[month]";
  return isNewest ? newer(sources.dol, changed(route)) : changed(route);
}

/**
 * An employer page's date when its record isn't the published one: the
 * newest change among its own cases (the nightly index's `last_changed`), or
 * the sweep's day for one the builder hasn't dated yet.
 */
export function employerOwnDate(lastChanged: string | null | undefined, sources: DateSources): string {
  return newer(lastChanged || sources.sweep || sources.corpus, changed("/perm-employers/[slug]"));
}

const ROUTES = Object.keys(PAGE_DATES as Record<string, string>);

/**
 * The route a pathname is served by: itself when it's a route, else the
 * template it fills (`/perm-wages/software-developers` is
 * `/perm-wages/[slug]`), preferring the template with the most fixed
 * segments, so `/perm-employers/browse/a` is the letter page. Null for an
 * address no route serves.
 */
export function routeOf(pathname: string): string | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if ((PAGE_DATES as Record<string, string>)[path]) return path;
  const parts = path.split("/");
  let best: string | null = null;
  let bestFixed = -1;
  for (const route of ROUTES) {
    if (!route.includes("[")) continue;
    const segs = route.split("/");
    if (segs.length !== parts.length) continue;
    let fixed = 0;
    let ok = true;
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i]!;
      if (seg.startsWith("[") && seg.endsWith("]")) {
        if (!parts[i]) ok = false;
      } else if (seg === parts[i]) {
        fixed++;
      } else {
        ok = false;
      }
      if (!ok) break;
    }
    if (ok && fixed > bestFixed) {
      best = route;
      bestFixed = fixed;
    }
  }
  return best;
}
