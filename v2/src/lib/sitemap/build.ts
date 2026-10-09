import "server-only";

import { reviewStages } from "@/components/rfi/stageMeta";
import PAGE_DATES from "./page-dates.json";
import { getAllPosts } from "@/lib/content";
import {
  BROWSE_BUCKETS,
  BROWSE_KINDS,
  browseHref,
  type BrowseBucket,
} from "@/lib/entityBrowse";
import { type EntityKind } from "@/lib/entityPayload";
import { captureError } from "@/lib/sentry";
import { browseCounts } from "@/lib/turso/entityBrowse";
import { getBacklogCensus } from "@/lib/turso/backlog";
import { getProcessingTimes } from "@/lib/turso/processingTimes";
import { getSweepCoverage } from "@/lib/turso/sweepCoverage";
import { GROUP_PATH, listGroups, type GroupKind } from "@/lib/turso/groups";
import { countOtherEmployerRanks, getOtherEmployerSlugWindow } from "@/lib/turso/otherEmployers";
import { lcaOnlyCities } from "@/lib/turso/lcaCities";
import { getH1bSummary } from "@/lib/turso/h1bRanks";
import { rankedStates, stateSlug } from "@/lib/h1bRanks";
import {
  countEntityRanks,
  countLiveOnlyRanks,
  getEntitySlugWindow,
  getFreshness,
  getLiveOnlySlugWindow,
  getVisaBulletins,
} from "@/lib/turso/publicData";
import { MIRROR_COMPLETE } from "@/lib/liveQueueGate";
import { lineSlugs } from "@/lib/bulletinLines";
import { categoriesIn } from "@/lib/turso/bulletin";
import type { BulletinMonth } from "@/lib/perm";
import { SITE_URL } from "@/lib/constants/site";

/**
 * The sitemap, split into an index and per-kind children.
 *
 * WHY SPLIT WELL UNDER GOOGLE'S 50,000-URL CAP.
 * Google publishes two numbers that are in tension and never reconciles them:
 * a sitemap may be 50 MB / 50,000 URLs, but "Googlebot crawls the first 2MB
 * of a supported file type" and that limit "is applied on the uncompressed
 * data". Nothing in Google's docs says whether the 2 MB fetch limit applies
 * to sitemap XML, and a single file for this site would be past it - on the
 * line of a rule that may or may not exist.
 *
 * The risk is asymmetric: splitting costs a refactor, truncation costs
 * thousands of URLs silently. So: split, and stop caring which limit applies.
 *
 * The second reason is the better one long-term. Search Console can filter
 * the Page indexing report BY SITEMAP, so per-kind children turn one
 * "submitted, N indexed" figure into a coverage number per kind. That is the
 * measurement that would show whether law-firm pages index worse than
 * occupation pages - which matters here, because DOL prints one firm under
 * several spellings and each gets its own leaf page.
 *
 * What we deliberately do NOT do:
 *   - no `changefreq` or `priority`. Google's docs say it "ignores <priority>
 *     and <changefreq> values", and Bing said the same in July 2025. We never
 *     emitted them; measured at 115 bytes per URL, which is a bare loc+lastmod.
 *   - no .gz. It buys zero headroom (both limits are measured uncompressed)
 *     and Cloudflare already serves application/xml compressed.
 *   - no generateSitemaps() in a root sitemap.ts. Next issue #77304 (open)
 *     reports that 404s /sitemap.xml, which is the URL submitted in Search
 *     Console. These are hand-rolled Route Handlers instead.
 */

export interface Entry {
  url: string;
  lastModified: string;
  /** Absolute image URLs for the image sitemap extension. The page's social card, so image search knows the picture exists. */
  images?: string[];
}

/** Children stay well under any limit in play: 5,000 URLs is ~550 KB. */
export const SITEMAP_CHUNK = 5000;

/** Kind -> the URL segment its detail pages live under. */
const KIND_PATH: Record<EntityKind, string> = {
  employer: "perm-employers",
  attorney: "perm-attorneys",
  occupation: "perm-wages",
};

/**
 * A per-kind floor for the catastrophic-loss guard.
 *
 * The old guard summed all three kinds and tripped below 500. Split per kind,
 * a single kind returning nothing has to trip on its own or the other two
 * would mask it.
 */
const MIN_ROWS_PER_KIND = 100;

/**
 * The day anything a page renders from last changed in git, written at build
 * time by scripts/page_dates.mjs (keys are routes, `[param]` for a template).
 * These were typed by hand until Oct 3 2026 and had stopped moving: /terms
 * said June 15 after changing on Oct 2. A route missing from the file gets a
 * fixed fallback, which is stale rather than false.
 */
export function changed(route: string): string {
  return (PAGE_DATES as Record<string, string>)[route] ?? "2026-08-24";
}

/** The later of two dates, where the first may be missing (DOL's as-of, the sweep's day). */
export function newer(a: string | null | undefined, b: string): string {
  return a && a > b ? a : b;
}

export function baseUrl(): string {
  return SITE_URL;
}

/** DOL's own as-of stamp, or null. Optional: it degrades one date. */
async function permAsOf(): Promise<string | null> {
  return getProcessingTimes()
    .then((s) => s?.permAsOf ?? null)
    .catch(() => null);
}

/**
 * When the DISCLOSURE CORPUS last changed, for the entity URLs.
 *
 * Not `permAsOf()`. That returns DOL's PROCESSING-TIMES as-of, which moves
 * daily - so every entity URL would restamp every day for data that changes
 * four times a year.
 *
 * A lastmod that behaves like a timestamp rather than a fact is one Google
 * discounts, and discounting it costs recrawl priority on exactly the pages
 * whose numbers DID move. Per-row granularity would be better still, but
 * perm_entities carries no change column, and inventing one from the build
 * clock would put us back where we started.
 */
async function corpusAsOf(): Promise<string | null> {
  return getFreshness()
    .then((f) => f["perm-cases"]?.asOf ?? null)
    .catch(() => null);
}

/**
 * Static pages plus MDX content.
 *
 * These keep their OWN dates rather than inheriting the DOL stamp. A uniform
 * quarterly date across pages that change on their own schedule is the one
 * place a shared lastmod would be a false claim, and Google only trusts
 * lastmod that is "consistently and verifiably accurate".
 */
export async function pagesEntries(): Promise<Entry[]> {
  const base = baseUrl();
  // Sorted ascending; an archive read that fails leaves the static list intact
  // rather than failing the whole sitemap. try/catch rather than `.catch`:
  // a test that mocks the module without this export would throw
  // synchronously on the call itself, before any promise existed.
  let bulletinMonths: string[] = [];
  // The category-by-country pages come from the SAME read, so a line page is
  // listed only when the archive holds that line (the route 404s otherwise).
  let bulletinLines: string[] = [];
  try {
    const raw = await getVisaBulletins();
    bulletinMonths = raw.map((r) => r.bulletinMonth).sort();
    bulletinLines = lineSlugs(
      categoriesIn(
        raw.map((b) => ({
          bulletinMonth: b.bulletinMonth,
          finalAction: (b.finalAction ?? {}) as BulletinMonth["finalAction"],
          datesForFiling: (b.datesForFiling ?? {}) as BulletinMonth["datesForFiling"],
        })),
      ),
    );
  } catch {
    bulletinMonths = [];
    bulletinLines = [];
  }
  // One URL per filing month holding at least one case, read from the SAME
  // census `/perm-queue` builds its month strip from and the month route
  // peeks before rendering (a month whose total is zero 404s there). Listing
  // them from that read is what keeps this file and the router from
  // disagreeing. Unlisted, the month pages are never advertised, and Search
  // Console reports even the month DOL is adjudicating as "URL is unknown to
  // Google". The lastmod
  // is the sweep's own finish date, because the pending counts on every one
  // of these pages move when the sweep runs and at no other time.
  let queueMonths: string[] = [];
  let queueAsOf: string | null = null;
  try {
    const census = await getBacklogCensus();
    queueMonths = census.months.filter((m) => m.total > 0).map((m) => m.month);
    queueAsOf = (await getSweepCoverage())?.finishedOn ?? null;
  } catch {
    queueMonths = [];
  }
  // The top H-1B employer state pages: one per state the default year ranks,
  // from the SAME summary the route's generateStaticParams reads (an unranked
  // state 404s there). Dated by the newest day either source covers.
  let h1bStates: string[] = [];
  let h1bAsOf: string | null = null;
  try {
    const summary = await getH1bSummary();
    if (summary) {
      h1bStates = rankedStates(summary);
      const newest = summary.years[0]!;
      h1bAsOf = [newest.lcaThrough, newest.uscisThrough].filter((d): d is string => !!d).sort().pop() ?? null;
    }
  } catch {
    h1bStates = [];
  }
  const allPosts = getAllPosts();
  if (allPosts.length === 0) {
    captureError(
      new Error(
        "Sitemap built with zero content posts: content/ may be missing or all MDX parses failed",
      ),
    );
  }
  // A FIXED fallback, not `new Date()`, which is what this was.
  //
  // The empty case only happens when the content directory is missing or every
  // MDX parse failed - it is alerted above and the sitemap still ships, which
  // is the right trade. But the date it shipped was the clock's, on `/`,
  // /blog, /guides and /changelog, and that is wrong twice over. It moves
  // every day, which is exactly the "lastmod that behaves like a timestamp
  // rather than a fact" corpusAsOf above exists to avoid and which Google
  // discounts. And `toISOString()` is UTC, so after ~8pm ET it stamps
  // TOMORROW - a future lastmod on the homepage, from a degraded build.
  //
  // A frozen date claims nothing that moves. It is stale rather than false,
  // and staleness is the honest state when the thing it summarises is gone.
  const latest =
    allPosts.length > 0
      ? allPosts.reduce((acc, p) => {
          const d = p.meta.updated ?? p.meta.date;
          return d > acc ? d : acc;
        }, allPosts[0]!.meta.date)
      : "2026-08-24";

  const dol = await permAsOf();
  // lastmod tracks DOL's as-of date wherever the page renders live figures:
  // the date should move when the numbers move, not when an unrelated blog
  // post ships. /login and /signup stay out - their metadata sets
  // robots:{index:false} and advertising them here would contradict that.
  const statics: Entry[] = [
    // `${base}/` with the slash: it is the form Google inspects and the
    // form the canonical declares; without it the homepage inspection reads
    // "no referring sitemaps".
    { url: `${base}/`, lastModified: newer(latest, changed("/")), images: [`${base}/og/home.jpg`] },
    { url: `${base}/blog`, lastModified: newer(latest, changed("/blog")), images: [`${base}/og/blog.jpg`] },
    { url: `${base}/guides`, lastModified: newer(latest, changed("/guides")), images: [`${base}/og/guides.jpg`] },
    { url: `${base}/changelog`, lastModified: newer(latest, changed("/changelog")), images: [`${base}/og/changelog.jpg`] },
    { url: `${base}/faq`, lastModified: changed("/faq"), images: [`${base}/og/faq.jpg`] },
    { url: `${base}/for-attorneys`, lastModified: changed("/for-attorneys"), images: [`${base}/og/for-attorneys.jpg`] },
    { url: `${base}/email-preferences`, lastModified: changed("/email-preferences"), images: [`${base}/og/email-preferences.jpg`] },
    { url: `${base}/perm-processing-times`, lastModified: newer(dol, changed("/perm-processing-times")), images: [`${base}/og/perm-processing-times.jpg`] },
    { url: `${base}/tools`, lastModified: changed("/tools"), images: [`${base}/og/tools.jpg`] },
    { url: `${base}/tools/green-card-timeline`, lastModified: newer(dol, changed("/tools/green-card-timeline")), images: [`${base}/og/green-card-timeline.jpg`] },
    { url: `${base}/tools/perm-timeline-calculator`, lastModified: newer(dol, changed("/tools/perm-timeline-calculator")), images: [`${base}/og/perm-timeline-calculator.jpg`] },
    { url: `${base}/tools/pwd-calculator`, lastModified: newer(dol, changed("/tools/pwd-calculator")), images: [`${base}/og/pwd-calculator.jpg`] },
    { url: `${base}/tools/i140-calculator`, lastModified: changed("/tools/i140-calculator"), images: [`${base}/og/i140-calculator.jpg`] },
    { url: `${base}/tools/i485-queue-position`, lastModified: changed("/tools/i485-queue-position"), images: [`${base}/og/i485-queue-position.jpg`] },
    { url: `${base}/tools/green-card-line`, lastModified: changed("/tools/green-card-line"), images: [`${base}/og/green-card-line.jpg`] },
    { url: `${base}/tools/eb2-vs-eb3`, lastModified: changed("/tools/eb2-vs-eb3"), images: [`${base}/og/eb2-vs-eb3.jpg`] },
    { url: `${base}/tools/which-green-card`, lastModified: changed("/tools/which-green-card"), images: [`${base}/og/which-green-card.jpg`] },
    { url: `${base}/h1b-lottery-odds`, lastModified: changed("/h1b-lottery-odds"), images: [`${base}/og/h1b-lottery-odds.jpg`] },
    { url: `${base}/nvc-waiting-list`, lastModified: changed("/nvc-waiting-list"), images: [`${base}/og/nvc-waiting-list.jpg`] },
    { url: `${base}/visa-issuances`, lastModified: changed("/visa-issuances"), images: [`${base}/og/visa-issuances.jpg`] },
    { url: `${base}/perm-cities`, lastModified: changed("/perm-cities"), images: [`${base}/og/perm-cities.jpg`] },
    { url: `${base}/perm-industries`, lastModified: changed("/perm-industries"), images: [`${base}/og/perm-industries.jpg`] },
    { url: `${base}/perm-countries`, lastModified: changed("/perm-countries"), images: [`${base}/og/perm-countries.jpg`] },
    { url: `${base}/green-card-timelines`, lastModified: changed("/green-card-timelines"), images: [`${base}/og/green-card-timelines.jpg`] },
    // The guide for the person waiting, in five languages. Their hreflang
    // alternates are in each page's own head (src/lib/i18n/locales.ts).
    { url: `${base}/zh`, lastModified: changed("/zh") },
    { url: `${base}/es`, lastModified: changed("/es") },
    { url: `${base}/pt-br`, lastModified: changed("/pt-br") },
    { url: `${base}/ko`, lastModified: changed("/ko") },
    { url: `${base}/vi`, lastModified: changed("/vi") },
    { url: `${base}/tools/salary-explorer`, lastModified: changed("/tools/salary-explorer"), images: [`${base}/og/salary-explorer.jpg`] },
    { url: `${base}/tools/i140-trends`, lastModified: changed("/tools/i140-trends"), images: [`${base}/og/i140-trends.jpg`] },
    { url: `${base}/uscis-processing-times`, lastModified: changed("/uscis-processing-times"), images: [`${base}/og/uscis-processing-times.jpg`] },
    { url: `${base}/i485-by-field-office`, lastModified: changed("/i485-by-field-office"), images: [`${base}/og/i485-by-field-office.jpg`] },
    { url: `${base}/i140-awaiting-visa`, lastModified: changed("/i140-awaiting-visa"), images: [`${base}/og/i140-awaiting-visa.jpg`] },
    // Gated on MIRROR_COMPLETE together with the page's own robots directive
    // and its provisional notice: a page carrying provisional counts must not
    // be listed for search, and one that is listed must not still be calling
    // itself provisional.
    ...(MIRROR_COMPLETE
      ? [{ url: `${base}/perm-queue`, lastModified: changed("/perm-queue"), images: [`${base}/og/perm-queue.jpg`] }]
      : []),
    // The month pages share the hub's gate: the route noindexes them on the
    // same constant, and a sitemap must never advertise a page that asks not
    // to be indexed.
    ...(MIRROR_COMPLETE
      ? queueMonths.map((m) => ({
          url: `${base}/perm-queue/${m}`,
          lastModified: newer(queueAsOf, changed("/perm-queue/[month]")),
        }))
      : []),
    { url: `${base}/tools/priority-date-calculator`, lastModified: changed("/tools/priority-date-calculator"), images: [`${base}/og/priority-date-calculator.jpg`] },
    { url: `${base}/tools/perm-deadline-calculator`, lastModified: changed("/tools/perm-deadline-calculator"), images: [`${base}/og/perm-deadline-calculator.jpg`] },
    { url: `${base}/calculators`, lastModified: changed("/calculators"), images: [`${base}/og/calculators.jpg`] },
    { url: `${base}/methodology`, lastModified: changed("/methodology"), images: [`${base}/og/methodology.jpg`] },
    { url: `${base}/about`, lastModified: changed("/about"), images: [`${base}/og/about.jpg`] },
    { url: `${base}/visa-bulletin`, lastModified: newer(dol, changed("/visa-bulletin")), images: [`${base}/og/visa-bulletin.jpg`] },
    // One page per archived bulletin. An older month's table is that month's
    // bulletin and nothing else, so its lastmod is the bulletin's own month;
    // the newest one carries the DOL stamp because its "since" column moves
    // with the next parse. Never the clock.
    ...bulletinMonths.map((m, i) => ({
      url: `${base}/visa-bulletin/${m}`,
      lastModified: i === bulletinMonths.length - 1 ? newer(dol, changed("/visa-bulletin/[month]")) : `${m}-01`,
    })),
    // The hub is a static page and always listed; its line pages only when
    // the archive holds the line (the route 404s otherwise).
    { url: `${base}/visa-bulletin/categories`, lastModified: newer(dol, changed("/visa-bulletin/categories")), images: [`${base}/og/visa-bulletin-categories.jpg`] },
    ...bulletinLines.map((slug) => ({
      url: `${base}/visa-bulletin/categories/${slug}`,
      lastModified: newer(dol, changed("/visa-bulletin/categories/[line]")),
    })),
    { url: `${base}/perm-by-state`, lastModified: newer(dol, changed("/perm-by-state")), images: [`${base}/og/perm-by-state.jpg`] },
    { url: `${base}/perm-wages`, lastModified: newer(dol, changed("/perm-wages")), images: [`${base}/og/perm-wages.jpg`] },
    { url: `${base}/lca-wages`, lastModified: newer(dol, changed("/lca-wages")), images: [`${base}/og/lca-wages.jpg`] },
    { url: `${base}/h1b-employers`, lastModified: newer(h1bAsOf, changed("/h1b-employers")), images: [`${base}/og/h1b-employers.jpg`] },
    ...h1bStates.map((code) => ({
      url: `${base}/h1b-employers/${stateSlug(code)}`,
      lastModified: newer(h1bAsOf, changed("/h1b-employers/[state]")),
    })),
    { url: `${base}/tools/compare-my-offer`, lastModified: changed("/tools/compare-my-offer"), images: [`${base}/og/compare-my-offer.jpg`] },
    { url: `${base}/tools/rfi-deadline`, lastModified: changed("/tools/rfi-deadline"), images: [`${base}/og/rfi-deadline.jpg`] },
    { url: `${base}/tools/pwd-validity`, lastModified: changed("/tools/pwd-validity"), images: [`${base}/og/pwd-validity.jpg`] },
    { url: `${base}/tools/h1b-six-year-limit`, lastModified: changed("/tools/h1b-six-year-limit"), images: [`${base}/og/h1b-six-year-limit.jpg`] },
    { url: `${base}/tools/priority-date-retention`, lastModified: changed("/tools/priority-date-retention"), images: [`${base}/og/priority-date-retention.jpg`] },
    { url: `${base}/tools/green-card-fees`, lastModified: changed("/tools/green-card-fees"), images: [`${base}/og/green-card-fees.jpg`] },
    { url: `${base}/tools/wage-levels`, lastModified: changed("/tools/wage-levels"), images: [`${base}/og/wage-levels.jpg`] },
    // No card of their own yet, so no image entry.
    { url: `${base}/tools/h1b-lottery-odds-calculator`, lastModified: changed("/tools/h1b-lottery-odds-calculator") },
    { url: `${base}/opt-employers`, lastModified: changed("/opt-employers") },
    { url: `${base}/sponsor-finder`, lastModified: changed("/sponsor-finder") },
    { url: `${base}/tools/ead-extension`, lastModified: changed("/tools/ead-extension") },
    { url: `${base}/lca-wage-sources`, lastModified: changed("/lca-wage-sources") },
    // `/perm-employers/compare` IS DELIBERATELY ABSENT. The page sets
    // `robots: { index: false }` - it is a tool that renders whatever two
    // slugs the query names, so there is nothing stable to index - and
    // listing it here would be a sitemap telling Google to index a page that
    // tells Google not to, which SEO audits report as an error. robots.txt
    // disallows `/perm-employers/compare?`, and the bare path must not be
    // advertised either. `sitemap-excludes-noindex.test.ts` keeps the class
    // shut.
    { url: `${base}/policy-changes`, lastModified: newer(dol, changed("/policy-changes")), images: [`${base}/og/policy-changes.jpg`] },
    { url: `${base}/debarments`, lastModified: newer(dol, changed("/debarments")), images: [`${base}/og/debarments.jpg`] },
    { url: `${base}/perm-case-statuses`, lastModified: newer(dol, changed("/perm-case-statuses")), images: [`${base}/og/perm-case-statuses.jpg`] },
    { url: `${base}/glossary`, lastModified: changed("/glossary"), images: [`${base}/og/glossary.jpg`] },
    { url: `${base}/estimate-scorecard`, lastModified: newer(dol, changed("/estimate-scorecard")), images: [`${base}/og/estimate-scorecard.jpg`] },
    { url: `${base}/badges`, lastModified: changed("/badges"), images: [`${base}/og/badges.jpg`] },
    { url: `${base}/open-data`, lastModified: newer(dol, changed("/open-data")), images: [`${base}/og/open-data.jpg`] },
    { url: `${base}/developers`, lastModified: changed("/developers"), images: [`${base}/og/developers.jpg`] },
    { url: `${base}/extension`, lastModified: changed("/extension") },
    { url: `${base}/api-terms`, lastModified: changed("/api-terms"), images: [`${base}/og/api-terms.jpg`] },
    { url: `${base}/layoffs`, lastModified: newer(dol, changed("/layoffs")), images: [`${base}/og/layoffs.jpg`] },
    { url: `${base}/visa-bulletin/family`, lastModified: newer(dol, changed("/visa-bulletin/family")), images: [`${base}/og/visa-bulletin-family.jpg`] },
    { url: `${base}/perm-employers`, lastModified: newer(dol, changed("/perm-employers")), images: [`${base}/og/perm-employers.jpg`] },
    { url: `${base}/perm-attorneys`, lastModified: newer(dol, changed("/perm-attorneys")), images: [`${base}/og/perm-attorneys.jpg`] },
    // The A-Z index pages. Written literally rather than generated from
    // BROWSE_KINDS because `scripts/audit_page_registration.py` matches a
    // template literal here against every static route in the app tree, and a
    // generated entry is invisible to it. Their letter children ARE generated,
    // below, since those are dynamic segments the gate skips anyway.
    { url: `${base}/perm-employers/browse`, lastModified: newer(dol, changed("/perm-employers/browse")), images: [`${base}/og/perm-employers-browse.jpg`] },
    { url: `${base}/perm-attorneys/browse`, lastModified: newer(dol, changed("/perm-attorneys/browse")), images: [`${base}/og/perm-attorneys-browse.jpg`] },
    { url: `${base}/perm-wages/browse`, lastModified: newer(dol, changed("/perm-wages/browse")), images: [`${base}/og/perm-wages-browse.jpg`] },
    { url: `${base}/perm-cases`, lastModified: newer(dol, changed("/perm-cases")), images: [`${base}/og/perm-cases.jpg`] },
    { url: `${base}/pwd-cases`, lastModified: changed("/pwd-cases"), images: [`${base}/og/pwd-cases.jpg`] },
    { url: `${base}/lca-cases`, lastModified: changed("/lca-cases"), images: [`${base}/og/lca-cases.jpg`] },
    // No card image yet: the page's own card is made from a capture after it ships.
    { url: `${base}/seasonal-cases`, lastModified: changed("/seasonal-cases"), images: [`${base}/og/seasonal-cases.jpg`] },
    { url: `${base}/case-search`, lastModified: changed("/case-search"), images: [`${base}/og/case-search.jpg`] },
    // The bare path only. A `?case=` result sets robots:{index:false} and
    // canonicalises back here, so advertising one would contradict the page's
    // own directive and open ~412,000 URLs of crawl space.
    { url: `${base}/perm-case-status`, lastModified: changed("/perm-case-status"), images: [`${base}/og/perm-case-status.jpg`] },
    { url: `${base}/uscis-case-status`, lastModified: changed("/uscis-case-status"), images: [`${base}/og/uscis-case-status.jpg`] },
    { url: `${base}/perm-denial-risk`, lastModified: newer(dol, changed("/perm-denial-risk")), images: [`${base}/og/perm-denial-risk.jpg`] },
    { url: `${base}/perm-rfi-audit`, lastModified: changed("/perm-rfi-audit"), images: [`${base}/og/perm-rfi-audit.jpg`] },
    { url: `${base}/perm-employers/under-review`, lastModified: newer(dol, changed("/perm-employers/under-review")), images: [`${base}/og/perm-employers-under-review.jpg`] },
    // One page per review stage. Listed from `reviewStages()`, the same
    // function the route's `generateStaticParams` reads, so the sitemap and
    // the router cannot come to disagree about which of these exist - a
    // sitemap advertising a URL that 404s is a crawl error we published
    // ourselves. The queue group is absent from that list on purpose:
    // ANALYST REVIEW is /perm-queue's subject, not a page here.
    ...reviewStages().map((s) => ({
      url: `${base}/perm-rfi-audit/${s.slug}`,
      lastModified: newer(queueAsOf, changed("/perm-rfi-audit/[stage]")),
    })),
    { url: `${base}/perm-decision-activity`, lastModified: changed("/perm-decision-activity"), images: [`${base}/og/perm-decision-activity.jpg`] },
    { url: `${base}/contact`, lastModified: changed("/contact"), images: [`${base}/og/contact.jpg`] },
    { url: `${base}/terms`, lastModified: changed("/terms"), images: [`${base}/og/terms.jpg`] },
    { url: `${base}/privacy`, lastModified: changed("/privacy"), images: [`${base}/og/privacy.jpg`] },
    { url: `${base}/security`, lastModified: changed("/security"), images: [`${base}/og/security.jpg`] },
    { url: `${base}/accessibility`, lastModified: changed("/accessibility"), images: [`${base}/og/accessibility.jpg`] },
  ];

  const content: Entry[] = allPosts.map((post) => ({
    url: `${base}/${post.type}/${post.slug}`,
    lastModified: post.meta.updated ?? post.meta.date,
  }));

  return [...statics, ...(await browseEntries(dol)), ...content];
}

/**
 * The A-Z letter pages, at most 81 of them, in the `pages` child.
 *
 * They belong here rather than in a child of their own: 81 URLs is a rounding
 * error against the 5,000-per-child budget, and putting them beside the hubs
 * keeps Search Console's per-sitemap coverage split reading "the three entity
 * corpora" rather than gaining a fourth line nobody asked a question about.
 *
 * A bucket with nothing in it is OMITTED, and the letter page itself carries
 * `robots: noindex` in the same case. Three occupation letters (X, Y, Z) are
 * genuinely empty, and a sitemap that advertises a page saying "nothing here"
 * is asking for exactly the thin-page judgement the rest of this surface works
 * to avoid. The two halves are separate code and must not drift; the sitemap
 * test asserts the count against `browseCounts`.
 *
 * A failed counts read degrades to no letter URLs rather than throwing. Unlike
 * `entityEntries` there is no catastrophic-loss shape to guard against: the
 * detail pages these letters index are already in their own children, so the
 * worst case is that a crawler discovers them one hop later.
 */
async function browseEntries(dol: string | null): Promise<Entry[]> {
  const root = baseUrl();
  const lastModified = dol ?? "2026-08-24";
  const kinds = Object.values(BROWSE_KINDS);
  // REPORT AND CONTINUE, and this is deliberately the OPPOSITE of what
  // `entityEntries` does. The arithmetic:
  //
  // `pagesEntries` builds ONE child, pages.xml, and 69 of its URLs are the
  // site's most important - `/`, `/faq`, every calculator, every article. The
  // browse letters are 81 more. The entity URLs are NOT here; they are
  // in employer-*.xml and friends, 5,000 apiece, and a browse failure cannot
  // touch them.
  //
  // So throwing would risk the 69 to protect the 81, and the 81 are the
  // cheapest URLs on the site to lose: they are a navigational layer, and
  // every page they lead to is already listed directly in its own child
  // sitemap. Losing them costs a crawl hop. Losing pages.xml costs the
  // homepage.
  //
  // It is not silent either - `captureError` fires. What it is not is visible
  // to GOOGLE, which is a real limitation and the reason to keep the Sentry
  // alert loud rather than to change the failure mode.
  const counts = await Promise.all(
    kinds.map((cfg) =>
      browseCounts(cfg.kind).catch((e: unknown) => {
        captureError(
          e instanceof Error ? e : new Error(`browse counts failed: ${String(e)}`),
        );
        return null;
      }),
    ),
  );
  const out: Entry[] = [];
  kinds.forEach((cfg, i) => {
    const byBucket = counts[i];
    if (!byBucket) return;
    for (const bucket of BROWSE_BUCKETS as readonly BrowseBucket[]) {
      if ((byBucket[bucket] ?? 0) === 0) continue;
      out.push({ url: `${root}${browseHref(cfg.base, bucket)}`, lastModified });
    }
  });
  return out;
}

/**
 * One chunk of one entity kind.
 *
 * Slugs come from the entity TABLE, the same source the pages and index
 * tables read. Deriving them here would be a second implementation of the
 * collision rule, and a slug computed two ways is a sitemap entry that 404s.
 */
export async function entityEntries(kind: EntityKind, chunk: number): Promise<Entry[]> {
  const base = baseUrl();
  // ONLY THIS CHUNK'S ROWS. This used to fetch every row of the kind and
  // `.slice()` in JS, which was affordable at two employer chunks and is not
  // at fourteen: each chunk revalidates daily, so it was fourteen reads of
  // 69,204 rows a day to emit the same fourteen files. See
  // getEntitySlugWindow for why the window is a rank RANGE and not an OFFSET.
  const slugs = await getEntitySlugWindow(kind, chunk, SITEMAP_CHUNK);

  // A chunk the index asked for must not come back empty. The old guard
  // compared a whole-kind fetch against MIN_ROWS_PER_KIND; with a window that
  // number is only meaningful for the first chunk, since the last chunk of a
  // kind is legitimately a remainder (occupations hold 1,410 rows in total).
  const floor = chunk === 0 ? MIN_ROWS_PER_KIND : 1;
  if (slugs.length < floor) {
    const detail =
      `Sitemap child ${kind} chunk ${chunk} built with only ${slugs.length} rows. ` +
      `The Turso read failed or returned almost nothing.`;
    captureError(new Error(detail));
    // Throw, do not emit. The previous version REPORTED this and shipped the
    // truncated file anyway: while Convex was disabled it captured "0 entity
    // URLs" on every build and the sitemap went out with 46 URLs, telling
    // Google the site has 46 pages. On revalidation Next keeps serving the
    // last good child, so a transient outage costs freshness, not every URL.
    throw new Error(detail);
  }

  // The CORPUS date, not the processing-times one. See corpusAsOf.
  const dol = (await corpusAsOf()) ?? (await permAsOf()) ?? "2026-08-24";
  return slugs.map((slug) => ({
    url: `${base}/${KIND_PATH[kind]}/${slug}`,
    lastModified: dol,
  }));
}


/**
 * One chunk of the live-only employers: pages the live feed names and the
 * published files do not. Indexable (the page's `generateMetadata` carries
 * the reasoning); listed from `perm_live_only_index`, the nightly table,
 * through a rank window.
 *
 * LASTMOD IS PER PAGE. Each URL carries the day that employer's page last
 * changed (`last_changed`: the newest perm_case_status.fetched_at among its
 * cases, an Eastern date). Not the sweep's finish date on every URL, which
 * would move every night whether a page changed or not: Google uses lastmod
 * only when it is "consistently and verifiably accurate", and a nightly
 * all-rows date reads as a timestamp. The sweep date is only the fallback
 * for a row the builder has not dated yet.
 */
export async function liveEmployerEntries(chunk: number): Promise<Entry[]> {
  const base = baseUrl();
  const slugs = await getLiveOnlySlugWindow(chunk, SITEMAP_CHUNK);
  const floor = chunk === 0 ? MIN_ROWS_PER_KIND : 1;
  if (slugs.length < floor) {
    const detail =
      `Sitemap child live-employer chunk ${chunk} built with only ${slugs.length} rows. ` +
      `The Turso read failed or the nightly table is empty.`;
    captureError(new Error(detail));
    throw new Error(detail);
  }
  const swept = (await getSweepCoverage().catch(() => null))?.finishedOn ?? null;
  const fallback = swept ?? (await corpusAsOf()) ?? "2026-09-17";
  return slugs.map(({ slug, lastChanged }) => ({
    url: `${base}/perm-employers/${slug}`,
    lastModified: lastChanged ?? fallback,
  }));
}

/**
 * Every city, industry and country page (perm_groups, a few thousand rows).
 * Dated by the published corpus, the only thing that moves these figures.
 * An empty table lists nothing rather than throwing: this family is new, and
 * a missing build must not take the sitemap index down with it.
 */
export async function groupEntries(): Promise<Entry[]> {
  const base = baseUrl();
  const asOf = (await corpusAsOf()) ?? "2026-09-26";
  const kinds: GroupKind[] = ["city", "industry", "country"];
  const [lists, h1bCities] = await Promise.all([
    Promise.all(kinds.map((k) => listGroups(k).catch(() => []))),
    // Cities with 20+ H-1B LCAs and no PERM page have a page of their own (Oct 4 2026).
    lcaOnlyCities().catch(() => []),
  ]);
  return [
    ...kinds.flatMap((k, i) =>
      (lists[i] ?? []).map((g) => ({ url: `${base}${GROUP_PATH[k]}/${g.slug}`, lastModified: asOf })),
    ),
    ...h1bCities.map((c) => ({ url: `${base}${GROUP_PATH.city}/${c.slug}`, lastModified: asOf })),
  ];
}

/**
 * One chunk of the employers with no PERM record: those whose filings are
 * H-1B LCAs, wage requests, or H-2A, H-2B and CW-1 (employer_other_index,
 * built nightly). Listed in full by the owner's decision (Oct 3 2026 for the
 * seasonal ones, Oct 4 for the rest); lastmod is each page's own day.
 */
export async function otherEmployerEntries(chunk: number): Promise<Entry[]> {
  const base = baseUrl();
  const slugs = await getOtherEmployerSlugWindow(chunk, SITEMAP_CHUNK);
  const floor = chunk === 0 ? MIN_ROWS_PER_KIND : 1;
  if (slugs.length < floor) {
    const detail =
      `Sitemap child other-employer chunk ${chunk} built with only ${slugs.length} rows. ` +
      `The read failed or the nightly table is empty.`;
    captureError(new Error(detail));
    throw new Error(detail);
  }
  const fallback = (await corpusAsOf()) ?? "2026-10-04";
  return slugs.map(({ slug, lastChanged }) => ({
    url: `${base}/perm-employers/${slug}`,
    lastModified: lastChanged ?? fallback,
  }));
}

/** The child-sitemap families: three entity kinds, the live-only employers and those with no PERM record. */
export type ChildKind = EntityKind | "live-employer" | "other-employer";

/** Every child sitemap name, in the order the index lists them. */
export async function childNames(): Promise<string[]> {
  const kinds: EntityKind[] = ["employer", "attorney", "occupation"];
  const counts = await Promise.all(kinds.map((k) => countEntityRanks(k)));
  const names = ["pages", "groups"];
  kinds.forEach((kind, i) => {
    const n = Math.max(1, Math.ceil((counts[i] ?? 0) / SITEMAP_CHUNK));
    for (let c = 0; c < n; c += 1) names.push(`${kind}-${c + 1}`);
  });
  // The live-only family degrades to NO children when its table cannot be
  // read: before the first nightly run there is nothing to list, and a family
  // of four that fails must not take the other three families with it.
  const live = await countLiveOnlyRanks().catch((e: unknown) => {
    captureError(e instanceof Error ? e : new Error(`live-only count failed: ${String(e)}`));
    return 0;
  });
  for (let c = 0; c < Math.ceil(live / SITEMAP_CHUNK); c += 1) names.push(`live-employer-${c + 1}`);
  // Same rule for the employers with no PERM record: no table, no children,
  // and the other families stay up.
  const other = await countOtherEmployerRanks().catch((e: unknown) => {
    captureError(e instanceof Error ? e : new Error(`other-employer count failed: ${String(e)}`));
    return 0;
  });
  for (let c = 0; c < Math.ceil(other / SITEMAP_CHUNK); c += 1) names.push(`other-employer-${c + 1}`);
  return names;
}

/** `employer-3` -> { kind: "employer", chunk: 2 }; `live-employer-1` -> { kind: "live-employer", chunk: 0 }. Null for anything else. */
export function parseChildName(
  name: string,
): { kind: ChildKind; chunk: number } | null {
  const m = /^(employer|attorney|occupation|live-employer|other-employer|seasonal-employer)-(\d+)$/.exec(name);
  if (!m) return null;
  const chunk = Number(m[2]) - 1;
  if (!Number.isInteger(chunk) || chunk < 0 || chunk > 999) return null;
  // `seasonal-employer-N` was this family's name from Oct 3 to Oct 4 2026; a
  // crawler that read it then still asks for it, so it answers the same window.
  const kind = m[1] === "seasonal-employer" ? "other-employer" : (m[1] as ChildKind);
  return { kind, chunk };
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function urlsetXml(entries: Entry[]): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n' +
    entries
      .map(
        (e) =>
          `<url><loc>${esc(e.url)}</loc><lastmod>${e.lastModified}</lastmod>${(e.images ?? [])
            .map((i) => `<image:image><image:loc>${esc(i)}</image:loc></image:image>`)
            .join("")}</url>`,
      )
      .join("\n") +
    "\n</urlset>\n"
  );
}

export function indexXml(names: string[], lastmod: string): string {
  const base = baseUrl();
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    names
      .map(
        (n) =>
          `<sitemap><loc>${esc(`${base}/sitemaps/${n}.xml`)}</loc><lastmod>${lastmod}</lastmod></sitemap>`,
      )
      .join("\n") +
    "\n</sitemapindex>\n"
  );
}
