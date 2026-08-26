/**
 * The entity pages' read path, backed by Turso.
 *
 * Replaces `convex/permEntities.ts`'s public queries. `getEntitySeed`,
 * `getAllEntities` and `getEntityBySlug` already live in publicData.ts and
 * are reused here rather than reimplemented, so the column list and the row
 * mapper have one home; the queries below are the ones that need their own
 * projection.
 *
 * ## Two Convex constraints disappeared, and one of them was load-bearing
 *
 * `fieldDistribution` used to scan a bounded head of the rank index (3,000
 * rows) and report `complete: false` when that scan could not prove it had
 * reached the last entity that could qualify. The bound existed because
 * Convex caps reads at 4,096 per function execution. SQL has no such cap, so
 * the cohort is now selected by predicate and is complete by construction.
 * The field is KEPT and always true: the pages read it to decide whether to
 * print a "this is the busiest part of the field rather than all of it"
 * caveat, and removing it would mean editing that wording in three places to
 * say the same thing.
 *
 * `comparables` is unchanged in shape and in arithmetic. Its window is a rank
 * window, and rank is assigned by volume, so the nearest ranks are exactly
 * the entities filing at a similar rate.
 *
 * ERRORS ARE NOT SWALLOWED - see publicData.ts for what a `.catch(() => [])`
 * cost here.
 */
import "server-only";

import type { EntityKind, EntityRow } from "@/lib/entityPayload";

import { getEntityBySlug, getEntitySeed } from "./publicData";
import { one, rows } from "./client";

/**
 * One entity by slug. `null` means no such page, which callers turn into a 404.
 *
 * Re-exported rather than rewritten: this is `api.permEntities.getBySlug`'s
 * replacement and the implementation already exists one module over. Keeping
 * the name here means a page imports its four entity reads from one place.
 */
export const getBySlug = getEntityBySlug;

/**
 * A ranked page of one kind.
 *
 * The Convex version took an `afterRank` cursor for paging deeper than the
 * first page. No caller ever passed one - the index pages fetch a whole kind
 * through `getAllEntities` instead - so it is not carried over. Adding it
 * back is one `AND rank > ?`.
 */
export async function listByKind(kind: EntityKind, limit = 250): Promise<EntityRow[]> {
  const take = Math.min(Math.max(1, Math.floor(limit)), 2000);
  const seed = await getEntitySeed(kind, take);
  return seed.rows;
}

// ---------------------------------------------------------------------------
// The comparison cohort
// ---------------------------------------------------------------------------

export interface FieldDistribution {
  /** How many entities cleared the bar. */
  cohort: number;
  /** How many exist in the kind, cohort or not. */
  kindTotal: number;
  /** The bar itself, echoed so the page and the query cannot disagree. */
  minDecided: number;
  /** True when the cohort is the whole of it. Always true under SQL. */
  complete: boolean;
  /** Approval percentages, one per cohort member. */
  approval: number[];
  /** Median days, one per cohort member that has one. */
  medianDays: number[];
  /** Median offered wages, one per cohort member that has one. */
  wages: number[];
}

interface CohortDbRow {
  certified: number;
  denied: number;
  median_days: number | null;
  median_annual_wage: number | null;
}

/**
 * How long a computed cohort is reused.
 *
 * NOT decoration, and not a performance nicety. `fieldDistribution` takes the
 * same two arguments on every page of a kind, so Convex's query cache served
 * all 16,305 employer pages from one execution. Next's per-page ISR shares
 * nothing, so without this each page regeneration would re-read the whole
 * cohort: measured at 1,338 rows and 256 ms for employers at minDecided=30,
 * which across a fully-crawled 16,305-page surface is ~21.8M rows a day off a
 * table that changes once a quarter.
 *
 * An hour is far below the data's own cadence and bounds this to a couple of
 * dozen reads a day per kind per server instance.
 */
const COHORT_TTL_MS = 60 * 60 * 1000;

const cohortCache = new Map<string, { at: number; value: Promise<FieldDistribution> }>();

/**
 * The cohort a rate can honestly be compared against, and its distribution.
 *
 * The detail pages used to draw their "position in the field" histogram from
 * the aggregate document's top-250 list, which put a sponsor ranked 4,000th
 * against 250 of its 16,305 peers and printed "#4000 of 250". Worse, it put
 * an employer with three cases on the same axis as one with four thousand,
 * where a spotless three-case record reads as best in class.
 *
 * So the population is defined by whether the measure can carry a number at
 * all: entities with at least `minDecided` DECIDED cases. Withdrawals are in
 * neither numerator nor denominator, matching the risk tables.
 */
export function fieldDistribution(
  kind: EntityKind,
  minDecided: number,
): Promise<FieldDistribution> {
  const bar = Math.max(1, Math.min(Math.floor(minDecided), 500));
  const key = `${kind}:${bar}`;
  const hit = cohortCache.get(key);
  if (hit && Date.now() - hit.at < COHORT_TTL_MS) return hit.value;

  const value = computeFieldDistribution(kind, bar);
  cohortCache.set(key, { at: Date.now(), value });
  // A rejected promise must not be pinned for an hour: evict it so the next
  // request retries rather than replaying one bad minute all afternoon.
  value.catch(() => {
    if (cohortCache.get(key)?.value === value) cohortCache.delete(key);
  });
  return value;
}

async function computeFieldDistribution(
  kind: EntityKind,
  bar: number,
): Promise<FieldDistribution> {
  // IFNULL on both sides of the predicate AND on the values read back. The
  // columns are nullable in the DDL and non-null on today's data; NULL + 30
  // is NULL, which is falsy in SQL, so a null count would silently drop the
  // row from its own cohort rather than counting as zero.
  const [members, count] = await Promise.all([
    rows<CohortDbRow>(
      "SELECT IFNULL(certified, 0) AS certified, IFNULL(denied, 0) AS denied, " +
        "median_days, median_annual_wage FROM perm_entities " +
        "WHERE kind = ? AND (IFNULL(certified, 0) + IFNULL(denied, 0)) >= ?",
      [kind, bar],
    ),
    one<{ n: number }>("SELECT count(*) AS n FROM perm_entities WHERE kind = ?", [kind]),
  ]);

  const approval: number[] = [];
  const medianDays: number[] = [];
  const wages: number[] = [];
  for (const row of members) {
    const decided = row.certified + row.denied;
    if (decided <= 0) continue;
    approval.push((row.certified / decided) * 100);
    if (row.median_days !== null) medianDays.push(row.median_days);
    if (row.median_annual_wage !== null) wages.push(row.median_annual_wage);
  }

  return {
    cohort: approval.length,
    kindTotal: count?.n ?? 0,
    minDecided: bar,
    // The Convex version could only prove this when its bounded scan ran past
    // the last entity that could qualify. A WHERE clause reads all of them.
    complete: true,
    approval,
    medianDays,
    wages,
  };
}

// ---------------------------------------------------------------------------
// Neighbours
// ---------------------------------------------------------------------------

/**
 * The slice of an entity a link needs: enough to render a card, nothing more.
 *
 * Deliberately narrower than `EntityRow` - it drops `code`. A comparables
 * list renders six to eight of these, and shipping every field would put a
 * second copy of the detail page's payload on the page for each one.
 */
export interface EntityNeighbor {
  slug: string;
  name: string;
  rank: number;
  total: number;
  certified: number;
  denied: number;
  medianDays: number | null;
  medianAnnualWage: number | null;
  state: string | null;
}

interface NeighborDbRow {
  slug: string;
  name: string;
  rank: number;
  total: number;
  certified: number | null;
  denied: number | null;
  median_days: number | null;
  median_annual_wage: number | null;
  state: string | null;
  code: string | null;
}

const NEIGHBOR_COLS =
  "slug, name, rank, total, certified, denied, median_days, median_annual_wage, state, code";

function toNeighbor(r: NeighborDbRow): EntityNeighbor {
  return {
    slug: r.slug,
    name: r.name,
    rank: r.rank,
    total: r.total,
    certified: r.certified ?? 0,
    denied: r.denied ?? 0,
    medianDays: r.median_days,
    medianAnnualWage: r.median_annual_wage,
    state: r.state,
  };
}

export interface ComparablesArgs {
  kind: EntityKind;
  rank: number;
  /** Ranks either side to read. Wider when a facet will thin the result. */
  span?: number;
  /** Keep only rows filed from this state. */
  state?: string;
  /** Keep only rows whose SOC code starts with this. */
  codePrefix?: string;
  limit?: number;
}

export interface Comparables {
  above: EntityNeighbor | null;
  below: EntityNeighbor | null;
  peers: EntityNeighbor[];
  /**
   * Which set `peers` actually came from. A facet that matches nothing falls
   * back to volume peers rather than returning an empty list, and the page
   * has to word its heading from this rather than from what it asked for -
   * "other Wyoming firms" over six firms from anywhere is a false caption.
   */
  matched: "facet" | "volume";
  /** How many rows the window held. Printed, so the reach is visible. */
  scanned: number;
}

/**
 * The entities either side of one rank, and the peers worth linking to.
 *
 * This is what turns 21,178 pages from a flat list of orphans into a graph.
 * A visitor who reaches one sponsor almost always wants the next thing along:
 * others of the same size, or in the same state, or in the same line of work.
 *
 * `state` and `codePrefix` are passed by the caller rather than derived here,
 * because the SOC major-group lookup lives in `src/lib/socGroups.ts` and one
 * copy of a mapping is the only safe number of copies.
 */
export async function comparables(args: ComparablesArgs): Promise<Comparables> {
  const reach = Math.min(Math.max(1, Math.floor(args.span ?? 60)), 500);
  const want = Math.min(Math.max(1, Math.floor(args.limit ?? 6)), 12);
  const lo = Math.max(1, args.rank - reach);
  const hi = args.rank + reach;

  const window = await rows<NeighborDbRow>(
    `SELECT ${NEIGHBOR_COLS} FROM perm_entities ` +
      "WHERE kind = ? AND rank >= ? AND rank <= ? ORDER BY rank",
    [args.kind, lo, hi],
  );

  let above: EntityNeighbor | null = null;
  let below: EntityNeighbor | null = null;
  const matching: EntityNeighbor[] = [];
  const anyRank: EntityNeighbor[] = [];
  for (const row of window) {
    const lite = toNeighbor(row);
    if (row.rank === args.rank - 1) above = lite;
    if (row.rank === args.rank + 1) below = lite;
    if (row.rank === args.rank) continue;
    anyRank.push(lite);
    if (args.state !== undefined && row.state !== args.state) continue;
    if (args.codePrefix !== undefined && !(row.code ?? "").startsWith(args.codePrefix)) {
      continue;
    }
    matching.push(lite);
  }

  // A facet that matched nothing is a real outcome, not an error: a firm may
  // be the only one filing from its state. Returning an empty list would
  // silently drop the module off the page, so fall back to volume peers and
  // SAY which happened, so the caller's heading can stay true.
  const faceted = args.state !== undefined || args.codePrefix !== undefined;
  const useFacet = faceted && matching.length > 0;
  const candidates = useFacet ? matching : anyRank;

  // Nearest by rank is nearest by volume, and taking from both sides keeps
  // the list from being six entities that are all bigger than the subject.
  candidates.sort((a, b) => Math.abs(a.rank - args.rank) - Math.abs(b.rank - args.rank));

  return {
    above,
    below,
    peers: candidates.slice(0, want),
    matched: useFacet ? "facet" : "volume",
    scanned: window.length,
  };
}

// ---------------------------------------------------------------------------
// Name search
// ---------------------------------------------------------------------------

/**
 * The same projection publicData.ts reads for an `EntityRow`.
 *
 * Duplicated because that module's `ENTITY_COLS` is private. Worth
 * collapsing into one exported constant when these two files are next
 * touched together; the two lists must not drift.
 */
const ENTITY_ROW_COLS =
  "slug, name, rank, total, certified, denied, median_days, median_annual_wage, state, code";

interface EntityDbRow {
  slug: string;
  name: string;
  rank: number;
  total: number;
  certified: number | null;
  denied: number | null;
  median_days: number | null;
  median_annual_wage: number | null;
  state: string | null;
  code: string | null;
}

function toEntityRow(r: EntityDbRow): EntityRow {
  return {
    slug: r.slug,
    name: r.name,
    rank: r.rank,
    total: r.total,
    certified: r.certified ?? 0,
    denied: r.denied ?? 0,
    medianDays: r.median_days,
    medianAnnualWage: r.median_annual_wage,
    state: r.state,
    code: r.code,
  };
}

/**
 * Find entities by name, anywhere in the corpus.
 *
 * The index pages server-render a head and lazily fetch a bounded slice of
 * the rank order, so a client-side search can only ever see what was
 * downloaded. For a corpus of 16,305 sponsors that is most of them; the
 * moment the floor drops it is a small minority, and "no match" for a row
 * that exists is a worse answer than a slow one.
 *
 * `perm_entities` has no FTS table, so this is a SUBSTRING match with LIKE
 * and NOTHING RANKS - results come back in rank (volume) order, which is a
 * useful order but is not relevance. A substring is affordable here and is
 * not affordable in `searchCases`: this scans one kind, at most 16,305 rows,
 * measured at 42 ms, against 373,939 rows and 801 ms over there.
 */
export async function searchByName(
  kind: EntityKind,
  text: string,
  limit = 50,
): Promise<EntityRow[]> {
  // Length cap before anything that walks the string; `text` is reachable
  // unauthenticated through /api/perm-entities/[kind]?q=.
  if (text.length > 120) return [];
  const needle = text.trim();
  if (needle.length < 2) return [];
  const take = Math.min(Math.max(1, Math.floor(limit)), 200);

  // `%` and `_` are LIKE wildcards, so a visitor typing one would otherwise
  // widen their own search silently. Escaped, with the escape character
  // itself escaped first or it would eat the escapes that follow.
  const pattern = `%${needle.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

  const found = await rows<EntityDbRow>(
    `SELECT ${ENTITY_ROW_COLS} FROM perm_entities ` +
      "WHERE kind = ? AND name LIKE ? ESCAPE '\\' ORDER BY rank LIMIT ?",
    [kind, pattern, take],
  );
  return found.map(toEntityRow);
}
