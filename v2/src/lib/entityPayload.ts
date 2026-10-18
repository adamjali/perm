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
   * refreshed nightly by build_entity_detail.py. Null until the nightly
   * refresh has computed it, never 0 by default:
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
 * `src/lib/db/*` is `server-only`: this file is where the encode and
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
  /**
   * A name search stopped at its cap and more published rows match. Without
   * it a capped answer reads as "searched across all of them".
   */
  more?: boolean;
  /** The same, for `live`. */
  liveMore?: boolean;
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
 * Decided cases required before an approval rate is published.
 *
 * Chosen from the data, not from taste. Three measurements set it:
 *
 *  1. The field's own denial rate is 2.57% (`permDisclosure` risk baseline
 *     over 248,158 decided cases). At that rate an entity with 29 decided
 *     cases records a spotless file 47% of the time by chance alone
 *     (0.9743^29). Below thirty, "no denials" is the coin landing heads.
 *  2. It is also the modal outcome, so the figure carries no information:
 *     3,336 of the first 4,000 employers have zero denials.
 *  3. Thirty is where the 95% Wilson upper bound on a clean record's denial
 *     rate first falls into single figures (11.4%). It is not where the rate
 *     becomes trustworthy - that takes about 146 decided cases, which only
 *     255 of 12,240 employers reach - it is where the number stops being
 *     pure noise and starts being worth printing with a caveat.
 *
 * The same bar defines the comparison cohort in `fieldDistribution` in src/lib/db/entities.ts,
 * and the page passes this constant in as that query's argument so the two
 * cannot drift apart.
 */
export const MIN_DECIDED_FOR_RATE = 30;

/**
 * Decided cases required before a median is presented without a caveat.
 *
 * A median over four cases is two numbers, and one over three is the middle
 * one. Lower than the rate bar on purpose: a median is not pinned against a
 * boundary the way a near-100% rate is, so it degrades rather than inverting.
 */
export const MIN_DECIDED_FOR_MEDIAN = 10;

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

/** The rate a page may print: the approval rate, or null under MIN_DECIDED_FOR_RATE decided cases. */
export function shownApprovalRate(r: { certified: number; denied: number }): number | null {
  return r.certified + r.denied >= MIN_DECIDED_FOR_RATE ? approvalRate(r) : null;
}

/** A median a page may print: the value, or null under MIN_DECIDED_FOR_MEDIAN decided cases. */
export function shownMedian(value: number | null, r: { certified: number; denied: number }): number | null {
  return r.certified + r.denied >= MIN_DECIDED_FOR_MEDIAN ? value : null;
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
 * The floor is 1: every entity with a filing gets an indexed page. Two
 * things keep that cheap: the sitemap reads only its own chunk from SQL (a
 * rank window), and the bulk API dump keeps its own higher floor
 * (MIN_TOTAL_FOR_BULK).
 *
 * More URLs in a sitemap don't make Google index them: much of an entity
 * page is shared template, which is what gates indexing for the long tail.
 */
export const MIN_TOTAL_FOR_PAGE = 1;

/**
 * The floor for the BULK dump at `/api/perm-entities/<kind>`.
 *
 * Higher than `MIN_TOTAL_FOR_PAGE` on purpose. A page is cheap to publish; one
 * JSON response carrying every row is not: at a floor of 1 it would be about
 * 69,000 employers instead of about 9,000, downloaded by the search palette,
 * and the whole compilation in one request, which §4 of the Terms asks
 * others not to take.
 */
export const MIN_TOTAL_FOR_BULK = 5;

/** Does this entity have a page, or is it search-only? */
export function hasOwnPage(row: { total: number }): boolean {
  return row.total >= MIN_TOTAL_FOR_PAGE;
}
