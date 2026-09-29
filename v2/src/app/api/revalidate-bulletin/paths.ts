/**
 * The pages that render the visa bulletin, expired the day a new one is stored.
 *
 * IN ITS OWN MODULE BECAUSE A `route.ts` MAY NOT EXPORT ANYTHING ELSE (see
 * `revalidate-dol/paths.ts` for the build error that rule prevents).
 *
 * Derived by following every reader of the bulletin tables (`lib/turso/bulletin`,
 * `lib/turso/bulletinLine`, `getVisaBulletins`, `BulletinBoard`, `badgeData`)
 * to its page. `route.test.ts` re-derives the list from the app tree, so a page
 * added later cannot quietly keep showing last month's cutoffs.
 */
import { BADGE_DEFS } from "@/lib/badge";

export const BULLETIN_PAGES = [
  "/visa-bulletin",
  "/visa-bulletin/family",
  "/visa-bulletin/categories",
  "/tools/green-card-line",
  "/tools/i485-queue-position",
  "/tools/priority-date-calculator",
  "/badges",
  // The sitemap child that lists the month pages, so a new month is advertised
  // the day it lands rather than the next day.
  "/sitemaps/pages.xml",
  // The badges that print a cutoff or the archive's size, derived from the
  // registry for the reason `revalidate-dol` gives: a hand list falls behind.
  ...BADGE_DEFS.filter((d) => d.group === "Visa bulletin" || d.id === "bulletins-held").map(
    (d) => `/badge/${d.id}.svg`,
  ),
];

/**
 * Whole families, expired with the (route, "page") form. Every month page names
 * the newest bulletin and links to the next month, and every category line page
 * shows the current cutoff, so all of them go stale together.
 *
 * `revalidate-dol` refuses this form because on Vercel each regeneration was a
 * billed ISR write. Since Sep 28 2026 the site runs on its own server, where an
 * expired page costs one render on its next visit and nothing if nobody opens
 * it: 145 month pages and 45 line pages, rendered on demand.
 *
 * THE PATTERN IS THE FILE PATH, ROUTE GROUPS INCLUDED. Next tags a page from its
 * file path (`/(site)/(public)/visa-bulletin/[month]/page`), and
 * `revalidatePath(p, "page")` expires the tag `p + "/page"`. Without the groups
 * the call matches nothing and says nothing; the test checks each pattern
 * against a real `page.tsx`.
 */
export const BULLETIN_PAGE_FAMILIES = [
  "/(site)/(public)/visa-bulletin/[month]",
  "/(site)/(public)/visa-bulletin/categories/[line]",
] as const;
