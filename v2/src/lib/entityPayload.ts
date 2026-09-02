/**
 * The compact wire format for a whole entity kind.
 *
 * The employer set is 12,240 rows. As objects in the RSC payload that is
 * roughly 1.4 MB of page weight for a table almost nobody scrolls to the
 * bottom of, so the page server-renders a seed and the client fetches the
 * rest on demand. Rows travel as positional arrays because the key names
 * would otherwise be 60% of the bytes.
 *
 * Encode and decode live together on purpose: they are two halves of one
 * format, and a format whose halves live in different files drifts.
 */

export const ENTITY_KINDS = ["employer", "attorney", "occupation"] as const;
export type EntityKind = (typeof ENTITY_KINDS)[number];

export function isEntityKind(v: string): v is EntityKind {
  return (ENTITY_KINDS as readonly string[]).includes(v);
}

/** One row, as the app uses it. */
export interface EntityRow {
  slug: string;
  name: string;
  rank: number;
  total: number;
  certified: number;
  denied: number;
  medianDays: number | null;
  medianAnnualWage: number | null;
  state: string | null;
  code: string | null;
}

/**
 * Positional row. Field ORDER is the contract between encode and decode, so
 * it is declared once here and both sides index through these constants
 * rather than counting positions by eye.
 */
export type PackedRow = [
  slug: string,
  name: string,
  rank: number,
  total: number,
  certified: number,
  denied: number,
  medianDays: number | null,
  medianAnnualWage: number | null,
  state: string | null,
  code: string | null,
];

/**
 * An employer we know about from the live feed and from nowhere else.
 *
 * NOT a `PackedRow`, and that is the whole point. Every field a `PackedRow`
 * carries after the name - rank, total, certified, denied, median days,
 * median wage - is computed from DECIDED cases in DOL's published disclosure
 * files, and for these employers that corpus is empty. Packing one as a row
 * of zeros would put a real-looking record of "0 certified, 0 denied" in a
 * sortable table and rank it #0 by volume. So it travels as its own shape,
 * which no column renderer can accept by accident.
 *
 * Lives here rather than beside its query because it crosses the wire and
 * `src/lib/turso/*` is `server-only`: this file is where the encode and
 * decode halves of that wire format already live together.
 */
export interface LiveEmployerHit {
  slug: string;
  name: string;
  /** Live cases we hold. NOT a lifetime filing total. */
  cases: number;
  pending: number;
  /** ISO date of the newest filing we hold for them. */
  latestFiling: string | null;
}

export interface EntityPayload {
  kind: EntityKind;
  /** How many rows exist in total. Equals rows.length for a complete payload. */
  count: number;
  /** Millis, from the ingest that wrote these rows. */
  computedAt: number | null;
  rows: PackedRow[];
  /**
   * Employers matching the same `?q=` that have no published record at all.
   * Employers only, and only on a search: the live feed carries no law-firm
   * name (DOL reveals the firm at publication) and no occupation, so for the
   * other two kinds there is genuinely nothing to search.
   */
  live?: LiveEmployerHit[];
}

export function packRow(r: EntityRow): PackedRow {
  return [
    r.slug,
    r.name,
    r.rank,
    r.total,
    r.certified,
    r.denied,
    r.medianDays,
    r.medianAnnualWage,
    r.state,
    r.code,
  ];
}

export function unpackRow(p: PackedRow): EntityRow {
  return {
    slug: p[0],
    name: p[1],
    rank: p[2],
    total: p[3],
    certified: p[4],
    denied: p[5],
    medianDays: p[6],
    medianAnnualWage: p[7],
    state: p[8],
    code: p[9],
  };
}

/**
 * Approval rate over DECIDED cases, so withdrawals sit on neither side.
 *
 * Returns null rather than 0 when nothing was decided: an employer with one
 * pending case has no approval rate, and 0% would rank them below a genuine
 * 50% in a sort. Callers sort nulls last.
 */
export function approvalRate(r: {
  certified: number;
  denied: number;
}): number | null {
  const decided = r.certified + r.denied;
  return decided === 0 ? null : r.certified / decided;
}

/**
 * Filings an entity needs before it gets an INDEXED page of its own.
 *
 * Every entity is STORED and searchable, and every entity page still RENDERS at
 * its URL for anyone who searches or follows a link. This decides only which
 * are worth advertising to a crawler: below the floor a page is `noindex` and
 * the sitemap omits it. The sitemap, `generateStaticParams` and the index
 * tables all read this constant, so a row that links somewhere and a page that
 * is indexed cannot disagree.
 *
 * RAISED 3 -> 5 ON 2026-09-01, on cost evidence, with the SEO trade accepted
 * deliberately. Entity pages ARE the crawlable surface: 20,960 of the ~21,110
 * URLs in the sitemap. Every crawler visit to a page whose ISR window has
 * lapsed is a paid regeneration, and Vercel bills those in 8 KB units against
 * pages that are 220-330 KB, so the surface size is the bill.
 *
 *     >= 3   attorney 3,514   employer 16,309   occupation 1,137   = 20,960
 *     >= 5   attorney 2,919   employer  9,646   occupation 1,014   = 13,579
 *
 * That is 7,381 fewer indexed pages, a 35% cut to the crawlable surface. The
 * employer bucket carries almost all of it (16,309 -> 9,646) because most
 * sponsors file a handful of cases, which is exactly the population whose page
 * shows three rows and little else.
 *
 * FIVE RATHER THAN TEN, deliberately. Ten would cut 62% but starts removing
 * pages with a real table, a median and an approval rate on them - genuine
 * content with genuine search value. Three and four rows is thin; ten is not.
 * If more is needed later this is one constant, and nothing 404s either way.
 */
export const MIN_TOTAL_FOR_PAGE = 5;

/** Does this entity have a page, or is it search-only? */
export function hasOwnPage(row: { total: number }): boolean {
  return row.total >= MIN_TOTAL_FOR_PAGE;
}
