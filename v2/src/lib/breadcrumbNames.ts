/**
 * The name a detail page's breadcrumb ends on, when the address alone says it.
 *
 * The trail bar renders in the public layout from the URL, before the page, so
 * it can only name what the URL determines: a state from its slug, a bulletin
 * line from its slug, a review stage from its slug. These are small closed sets,
 * written out here rather than imported, because the bar ships on every public
 * page and the modules that own them (the H-1B ranks, the stage glossary, the
 * bulletin archive) are large. `breadcrumbNames.test.ts` holds each map to its
 * owner's own list, so they can't drift.
 *
 * A company, a law firm, a job, a city, an industry or a country is named by
 * the database, not the address, so its trail ends at the list page and its H1
 * names it. Articles render their own bar with their title (they have no data
 * rail, so it sits in the same place).
 */

import { US_STATE_NAMES } from "@/lib/usStateNames";

const STATE_BY_SLUG: Record<string, string> = Object.fromEntries(
  Object.values(US_STATE_NAMES).map((name) => [name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), name]),
);

/** The bulletin's line slugs, as `bulletinLines.ts` builds them. */
const LINE_CATEGORY: Record<string, string> = {
  eb1: "EB-1",
  eb2: "EB-2",
  eb3: "EB-3",
  "eb3-other-workers": "EB-3 Other Workers",
  eb4: "EB-4",
  "eb5-unreserved": "EB-5 Unreserved",
  "eb5-rural": "EB-5 Rural",
  "eb5-high-unemployment": "EB-5 High Unemployment",
  "eb5-infrastructure": "EB-5 Infrastructure",
};
const LINE_COUNTRY: Record<string, string> = {
  india: "India",
  china: "China",
  mexico: "Mexico",
  philippines: "Philippines",
  "rest-of-world": "Rest of World",
};

/** Review-stage slugs and the labels the stage pages give them (`stageMeta.ts`). */
export const STAGE_NAMES: Record<string, string> = {
  "application-on-hold": "Application on hold",
  "rfi-issued": "RFI issued",
  "nord-issued": "NORD issued",
  "supervised-recruitment": "Supervised recruitment",
  "pending-audit-response": "Pending audit response",
  "reconsideration-appeals": "Reconsideration appeals",
  "balca-appeals": "BALCA appeals",
  "request-for-review": "Request for review",
  "denied-balca-dismissed": "Denied, BALCA dismissed",
};

function lineName(slug: string): string | null {
  for (const [cs, category] of Object.entries(LINE_CATEGORY)) {
    for (const [ks, country] of Object.entries(LINE_COUNTRY)) {
      if (slug === `${cs}-${ks}`) return `${category}, ${country}`;
    }
  }
  return null;
}

/** The page's own name for a detail URL the address names, or null. */
export function detailName(path: string): string | null {
  const m = /^\/(h1b-employers|visa-bulletin\/categories|perm-rfi-audit)\/([a-z0-9-]+)$/.exec(path);
  if (!m) return null;
  const [, base, slug] = m;
  if (base === "h1b-employers") return STATE_BY_SLUG[slug!] ?? null;
  if (base === "visa-bulletin/categories") return lineName(slug!);
  return STAGE_NAMES[slug!] ?? null;
}

/** Article pages render their own bar, with the article's title. */
export function isArticlePath(path: string): boolean {
  return /^\/(guides|blog|changelog)\/[^/]+$/.test(path);
}
