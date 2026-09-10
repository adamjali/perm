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
  /**
   * Filings received in the last 12 months, published and live together,
   * refreshed nightly by build_entity_detail.py. Null until the first
   * refresh after the column was added (Sep 8 2026), never 0 by default:
   * "none" is a claim and "not computed yet" is not.
   */
  recent12m: number | null;
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
  recent12m: number | null,
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
    r.recent12m,
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
    recent12m: p[10] ?? null,
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
 * DROPPED TO 1 ON 2026-09-10, on Adam's call, after the cost evidence that
 * justified the floor turned out to be pointing at something else.
 *
 * The floor was raised 3 -> 5 on 2026-09-01 because entity pages were the
 * crawlable surface and every lapsed-window crawl was a paid ISR regeneration.
 * The cut was real (20,960 -> 13,579 indexed pages, 35%) and the reasoning was
 * sound on the evidence available. It was aimed at the wrong cause. Measured
 * again on 2026-09-10:
 *
 *     Build CPU Minutes        $13.20 (66% of the bill)  ->  $0.35
 *     Function Invocations     crawler REQUESTS          ->  $2.41
 *     Firewall rate limiting   the scraper defence       ->  $0.81
 *     ISR Writes               $2.29                     ->  $23.84
 *
 * Builds were the bill and are now fixed. Crawler requests were never it. The
 * scraper that WAS driving regenerations - Meta at 553,800 requests a day - is
 * answered by the firewall for 81 cents. What is left is ISR writes, and those
 * scale with DEPLOY COUNT, because every deployment cold-starts the whole ISR
 * cache; roughly twenty production deploys in two days is what $23.84 buys.
 * Page count is a multiplier on that, not the driver.
 *
 * So the floor is 1 and the surface is 76,147 pages. Two things make that
 * affordable, and both are in this commit rather than assumed:
 *
 *   - the sitemap now reads ONLY its own chunk from SQL. It used to fetch
 *     every row of a kind and slice in JS, so fourteen employer chunks would
 *     have meant fourteen full-table reads a day.
 *   - the bulk API dump keeps its own, higher floor (MIN_TOTAL_FOR_BULK).
 *     That endpoint feeds the search palette's client-side slice, and at a
 *     floor of 1 it becomes a multi-megabyte public dump of the whole
 *     compilation - which is both a page-weight problem and the exact thing
 *     §4 of the Terms now prohibits other people from doing.
 *
 * WHAT THIS DOES NOT BUY, stated plainly so the next person does not read the
 * page count as a result: Google already holds 19,931 of these URLs in
 * "Discovered, currently not indexed" with no crawl date. It has seen the tail
 * and declined it. Adding URLs to a sitemap does not change that decision, and
 * roughly 75% of an entity page is boilerplate, which is the thing that
 * actually gates indexing. This is a bet that costs little now that the cost
 * model is understood, not a fix for the indexing problem.
 */
export const MIN_TOTAL_FOR_PAGE = 1;

/**
 * The floor for the BULK dump at `/api/perm-entities/<kind>`.
 *
 * Deliberately NOT `MIN_TOTAL_FOR_PAGE`. They were one constant because they
 * used to want the same answer; they no longer do. A page is cheap to publish
 * and is the point of the site. A single JSON response carrying every row of
 * the compilation is a different object: at a floor of 1 it is 69,204
 * employers instead of 9,176, it is downloaded by the search palette on the
 * client, and it hands anybody the compiled corpus in one request - which is
 * precisely what §4 of the Terms now tells other people not to do.
 */
export const MIN_TOTAL_FOR_BULK = 5;

/** Does this entity have a page, or is it search-only? */
export function hasOwnPage(row: { total: number }): boolean {
  return row.total >= MIN_TOTAL_FOR_PAGE;
}
