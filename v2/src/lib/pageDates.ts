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
 * The date is the later of two days: the day the page's code last changed and,
 * for a page that prints figures, the day those figures last moved (its source
 * below). A single page's code day is its git day (page-dates.json, written at
 * deploy by scripts/page_dates.mjs); a template's is set by hand in
 * TEMPLATE_DAY.
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

/**
 * The day each template last changed what its pages say, set by hand.
 *
 * A `[param]` route serves thousands of pages (the employer template alone
 * about 78,000 sitemap URLs), and git dates it by any commit to its files or
 * their imports, so a spacing fix would tell Google every one of them changed.
 * Google then asks for them all at once, faster than two CPUs build cold pages:
 * from Oct 13 2026 it was turned away 15 to 19% of the time on its busiest days,
 * and Search Console listed employer pages as "Server error (5xx)".
 *
 * Move a template's day when a change alters what each of its pages says (a new
 * answer line, a new section, different figures), never for layout or styling.
 * The figures' own day still moves the date by itself. Started from the git
 * days live on Oct 17 2026, so nothing moved when this table replaced them.
 */
export const TEMPLATE_DAY: Readonly<Record<string, string>> = {
  "/blog/[slug]": "2026-10-09",
  "/changelog/[slug]": "2026-10-01",
  "/guides/[slug]": "2026-09-26",
  "/h1b-employers/[state]": "2026-10-17",
  "/perm-attorneys/[slug]": "2026-10-16",
  "/perm-attorneys/browse/[letter]": "2026-10-15",
  "/perm-cities/[slug]": "2026-10-16",
  "/perm-countries/[slug]": "2026-10-16",
  "/perm-employers/[slug]": "2026-10-17",
  "/perm-employers/browse/[letter]": "2026-10-15",
  "/perm-industries/[slug]": "2026-10-16",
  "/perm-queue/[month]": "2026-10-16",
  "/perm-rfi-audit/[stage]": "2026-10-17",
  "/perm-wages/[slug]": "2026-10-16",
  "/perm-wages/browse/[letter]": "2026-10-15",
  "/visa-bulletin/[month]": "2026-10-17",
  "/visa-bulletin/categories/[line]": "2026-10-16",
};

/** The day this route's code last changed: a template's hand-set day, else its git day. */
export function changed(route: string): string {
  if (route.includes("[")) return TEMPLATE_DAY[route] ?? FALLBACK;
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
