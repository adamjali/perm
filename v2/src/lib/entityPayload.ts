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

export interface EntityPayload {
  kind: EntityKind;
  /** How many rows exist in total. Equals rows.length for a complete payload. */
  count: number;
  /** Millis, from the ingest that wrote these rows. */
  computedAt: number | null;
  rows: PackedRow[];
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
 * Filings an entity needs before it gets a page of its own.
 *
 * Every entity is STORED and searchable; this decides which are worth a URL.
 * Below three, the page would say "one case, certified" and nothing else,
 * and 65,000 of those is the doorway-page pattern rather than a directory.
 * The sitemap, `generateStaticParams` and the index tables all read this, so
 * a row that links somewhere and a page that exists cannot disagree.
 */
export const MIN_TOTAL_FOR_PAGE = 3;

/** Does this entity have a page, or is it search-only? */
export function hasOwnPage(row: { total: number }): boolean {
  return row.total >= MIN_TOTAL_FOR_PAGE;
}
