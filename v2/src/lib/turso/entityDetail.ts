/**
 * The reads that turn an entity page from a record into a picture.
 *
 * Separate from `entities.ts` and `publicData.ts` on purpose: those two own
 * the entity ROW and the cohort it is compared against, which come from the
 * decided corpus. Everything here comes from somewhere else - the live
 * per-case mirror, the build-time facet rollups, the alias table - and
 * mixing the two would put four different as-of dates behind one import.
 *
 * WHAT EACH SOURCE CAN AND CANNOT SAY
 * -----------------------------------
 * `perm_entity_pending` reads `perm_case_status`, the live mirror. It is the
 * ONLY source in the product that knows a case is still waiting: every row in
 * DOL's disclosure files carries a decision date, so a pending case appears
 * in none of the counts on the rest of the page. That is why a sponsor's
 * "filings" and its "pending" do not add up to anything, and why the page has
 * to say so rather than putting them in one row of stat cards.
 *
 * `perm_entity_facets` reads `perm_cases`, the decided corpus, rolled up at
 * build time. A GROUP BY over 373,939 rows on every one of 21,000 page
 * regenerations is not a query, it is a bill.
 *
 * `perm_entity_alias` is the merge's memory. See `scripts/entity_identity.py`.
 *
 * ERRORS ARE NOT SWALLOWED. A `.catch(() => [])` here renders an entity page
 * with its live-queue module silently missing, which is indistinguishable
 * from a sponsor that genuinely has nothing pending.
 */
import "server-only";
import { unstable_cache } from "next/cache";

import type { EntityKind } from "@/lib/entityPayload";

import { getEntityBySlug } from "./publicData";
import { one, rows } from "./client";

// ---------------------------------------------------------------------------
// Aliases: the merged spellings' old URLs
// ---------------------------------------------------------------------------

/**
 * Where a retired slug now lives, or null if it was never one.
 *
 * DOL prints one practice under dozens of spellings and the entity table used
 * to give each its own page. Merging them means 791 URLs that people, Google
 * and our own sitemap already hold now name nothing, so every one of them
 * redirects instead of 404ing.
 */
export async function aliasTarget(kind: EntityKind, slug: string): Promise<string | null> {
  const r = await one<{ target_slug: string }>(
    "SELECT target_slug FROM perm_entity_alias WHERE kind = ? AND slug = ?",
    [kind, slug],
  );
  return r?.target_slug ?? null;
}

export interface ResolvedEntity {
  row: NonNullable<Awaited<ReturnType<typeof getEntityBySlug>>>;
  /** The slug the page should declare as canonical. */
  canonicalSlug: string;
  /** True when the requested slug was a retired spelling. */
  viaAlias: boolean;
}

/**
 * The entity behind a URL, following a retired spelling if that is what it is.
 *
 * ## Why this resolves instead of redirecting
 *
 * `permanentRedirect` was the first implementation and it does not work on
 * this route. `(site)/(public)/loading.tsx` puts a Suspense boundary above
 * every public page, so Next flushes the shell with a 200 before the page
 * body finishes. A redirect thrown after that flush cannot become a 3xx:
 * React reports "Switched to client rendering because the server rendering
 * errored" and ships a 200 whose payload is the NEXT_REDIRECT error. Measured
 * on /perm-attorneys/jackson-lewis-pc: 200, 122 KB, five copies of
 * `NEXT_REDIRECT;replace;/perm-attorneys/jackson-lewis-p-c;308;` in the body.
 * Moving the call into a segment `layout.tsx` does not help; that layout is
 * inside the same boundary.
 *
 * So the retired URL RESOLVES instead. It serves the merged entity's page at
 * a 200, with `<link rel="canonical">` pointing at the surviving slug, which
 * is the consolidation signal Google documents for exactly this case. The
 * sitemap lists only canonical slugs, so nothing advertises the duplicate.
 *
 * A true 308 is still the better answer and needs a `redirects()` entry in
 * `next.config.ts`, which is outside this task's file ownership.
 */
export async function resolveEntity(
  kind: EntityKind,
  slug: string,
): Promise<ResolvedEntity | null> {
  const direct = await getEntityBySlug(kind, slug);
  if (direct) return { row: direct, canonicalSlug: slug, viaAlias: false };
  const target = await aliasTarget(kind, slug);
  if (!target) return null;
  const row = await getEntityBySlug(kind, target);
  // A dangling alias is a data defect the rebuild gate refuses to write, so
  // reaching here means the table changed under us. Treat it as a 404 rather
  // than looping.
  if (!row) return null;
  return { row, canonicalSlug: target, viaAlias: true };
}

/** How many spellings this entity absorbed. Printed, never implied. */
export async function absorbedCount(kind: EntityKind, slug: string): Promise<number> {
  const r = await one<{ n: number }>(
    "SELECT count(*) AS n FROM perm_entity_alias WHERE kind = ? AND target_slug = ?",
    [kind, slug],
  );
  return r?.n ?? 0;
}

// ---------------------------------------------------------------------------
// The live queue
// ---------------------------------------------------------------------------

export interface PendingStage {
  status: string;
  n: number;
}

export interface EntityPending {
  /** Cases for this entity in the live mirror, decided and pending alike. */
  tracked: number;
  pending: number;
  /** Stages, biggest first. Empty when nothing is pending. */
  stages: PendingStage[];
  /** Filing date of the oldest case still waiting, ISO. */
  oldest: string | null;
}

interface PendingDbRow {
  tracked: number;
  pending: number;
  stages: string;
  oldest: string | null;
}

export async function entityPending(
  kind: EntityKind,
  slug: string,
): Promise<EntityPending | null> {
  const r = await one<PendingDbRow>(
    "SELECT tracked, pending, stages, oldest FROM perm_entity_pending "
      + "WHERE kind = ? AND slug = ?",
    [kind, slug],
  );
  if (!r) return null;
  let stages: PendingStage[] = [];
  try {
    const parsed: unknown = JSON.parse(r.stages);
    if (parsed && typeof parsed === "object") {
      stages = Object.entries(parsed as Record<string, unknown>)
        .map(([status, n]) => ({ status, n: Number(n) || 0 }))
        .filter((s) => s.n > 0)
        .sort((a, b) => b.n - a.n || a.status.localeCompare(b.status));
    }
  } catch {
    // A malformed blob is a build defect, not a reader's problem: the module
    // degrades to counts without a breakdown rather than taking the page out.
    stages = [];
  }
  return { tracked: r.tracked, pending: r.pending, stages, oldest: r.oldest };
}

export interface PendingLeader {
  slug: string;
  name: string;
  pending: number;
  tracked: number;
  /** The stage holding the most of them, and how many. */
  topStage: string | null;
  topStageN: number;
}

/**
 * The sponsors with the most cases waiting right now.
 *
 * Deliberately NOT the same list as "who sponsors the most". Volume is a
 * decade of history; this is a photograph of one morning, and the two
 * disagree hard enough to be worth showing side by side - Stoughton Trailers
 * is 1,207 cases deep in the queue and is nobody's idea of a top sponsor.
 */
export async function pendingLeaders(limit = 12): Promise<PendingLeader[]> {
  const take = Math.min(Math.max(1, Math.floor(limit)), 50);
  const found = await rows<{
    slug: string;
    name: string;
    pending: number;
    tracked: number;
    stages: string;
  }>(
    "SELECT p.slug, e.name, p.pending, p.tracked, p.stages FROM perm_entity_pending p "
      + "JOIN perm_entities e ON e.kind = p.kind AND e.slug = p.slug "
      + "WHERE p.kind = 'employer' AND p.pending > 0 ORDER BY p.pending DESC LIMIT ?",
    [take],
  );
  return found.map((r) => {
    let topStage: string | null = null;
    let topStageN = 0;
    try {
      const parsed = JSON.parse(r.stages) as Record<string, number>;
      for (const [status, n] of Object.entries(parsed)) {
        if (Number(n) > topStageN) {
          topStage = status;
          topStageN = Number(n);
        }
      }
    } catch {
      topStage = null;
    }
    return {
      slug: r.slug,
      name: r.name,
      pending: r.pending,
      tracked: r.tracked,
      topStage,
      topStageN,
    };
  });
}

// ---------------------------------------------------------------------------
// What an entity's filings are made of
// ---------------------------------------------------------------------------

export type FacetKind = "occupation" | "state" | "attorney" | "employer";

export interface FacetRow {
  /** The facet entity's SLUG, or the two-letter code for a state. */
  key: string | null;
  label: string;
  /** SOC code, for occupation facets only. See the note on `entityFacets`. */
  code: string | null;
  n: number;
  certified: number;
  denied: number;
}

export type EntityFacets = Partial<Record<FacetKind, FacetRow[]>>;

/**
 * Every facet for one entity, in one read.
 *
 * One query rather than four. A detail page wants all of them and they live
 * in one table, so splitting by facet would be four round trips for a single
 * index scan's worth of rows.
 *
 * The join carries the SOC code back, and it earns its place: DOL is still
 * filing under two SOC vintages at once, so `Electronics Engineers, Except
 * Computer` appears twice under 17-2072.00 and its 2010 predecessor. Two
 * rows with an identical label read as a rendering bug. Merging them would
 * need the official BLS crosswalk, which we do not hold, so the honest fix
 * is to print the code that tells them apart.
 *
 * `e.kind = f.facet` works because the three entity facets are named exactly
 * after the entity kinds. The state facet matches nothing and comes back
 * null, which is correct: a state is not an entity here.
 */
export async function entityFacets(kind: EntityKind, slug: string): Promise<EntityFacets> {
  const found = await rows<{
    facet: string;
    key: string | null;
    label: string;
    code: string | null;
    n: number;
    certified: number;
    denied: number;
  }>(
    "SELECT f.facet, f.key, f.label, e.code, f.n, f.certified, f.denied "
      + "FROM perm_entity_facets f "
      + "LEFT JOIN perm_entities e ON e.kind = f.facet AND e.slug = f.key "
      + "WHERE f.kind = ? AND f.slug = ? ORDER BY f.facet, f.pos",
    [kind, slug],
  );
  const out: EntityFacets = {};
  for (const r of found) {
    const f = r.facet as FacetKind;
    (out[f] ??= []).push({
      key: r.key,
      label: r.label,
      code: r.code,
      n: r.n,
      certified: r.certified,
      denied: r.denied,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// The spellings the merge would not touch
// ---------------------------------------------------------------------------

export interface NameVariant {
  slug: string;
  name: string;
  total: number;
}

/**
 * Other entities whose printed name starts the same way as this one's.
 *
 * NOT a merge, and the page must not present it as one. Identity merges on
 * exact tokens plus a tightly-scoped typo rule, and everything the rule
 * refuses stays a separate entity: Fragomen still prints twenty ways that
 * differ by a substituted letter, an office city or an email address in the
 * attorney field, and `Fragomen Partners LLP` may genuinely be a different
 * firm. Listing them lets a reader see the residue and judge it, which is
 * the honest alternative to a rank footnote nobody can check.
 *
 * The match is the FIRST token of the merge key, which is the part a
 * misspelling almost never touches. A generic first token would return half
 * the directory, so those return nothing at all rather than a wall of
 * unrelated firms.
 */
const GENERIC_ROOTS = new Set([
  "law", "the", "office", "offices", "immigration", "legal", "global",
  "international", "american", "national", "us", "usa", "united", "first",
  "new", "great", "best", "premier", "advanced", "general", "professional",
  "associates", "group", "consulting", "services", "solutions", "university",
  "city", "county", "state", "north", "south", "east", "west", "saint", "st",
]);

/** Beyond this many same-root entities the list is noise, not a variant set. */
const MAX_VARIANTS = 24;

export async function nameVariants(
  kind: EntityKind,
  slug: string,
): Promise<NameVariant[]> {
  // Employers and firms only. Occupations are keyed on the SOC code, which
  // is canonical and has no spellings; what they have instead is two code
  // VINTAGES for one job, which is a different problem with a different
  // answer and does not belong under this heading.
  if (kind === "occupation") return [];
  const mergeKey = await entityMergeKey(kind, slug);
  if (!mergeKey) return [];
  const root = mergeKey.split(" ")[0] ?? "";
  if (root.length < 4 || GENERIC_ROOTS.has(root)) return [];
  // A HALF-OPEN RANGE ON THE INDEX, NOT LIKE. `merge_key = root OR merge_key
  // LIKE 'root %'` cannot use idx_pe_merge (an OR, and a LIKE on a BINARY
  // column), so EXPLAIN showed it walking every row of the kind: 71,512
  // employer rows per employer page render. Turso meters rows READ, and
  // that one query, multiplied by the regenerations a cold ISR cache causes,
  // was most of a 7.75-billion-row invoice (2026-09-02). Every key that is
  // exactly `root` or starts with `root ` sorts in [root, root + "!"), because
  // the space (0x20) is the last character below "!" (0x21); nothing else
  // lands there. Measured plan: SEARCH perm_entities USING INDEX idx_pe_merge.
  const found = await rows<{ slug: string; name: string; total: number }>(
    "SELECT slug, name, total FROM perm_entities WHERE kind = ? "
      + "AND merge_key >= ? AND merge_key < ? AND slug <> ? ORDER BY total DESC LIMIT ?",
    [kind, root, `${root}!`, slug, MAX_VARIANTS + 1],
  );
  // One over the cap means the root is commoner than it looked, so the list
  // would be a directory rather than a variant set. Withhold instead.
  if (found.length > MAX_VARIANTS) return [];
  return found;
}

/** The merge key for one entity. Read here rather than widened into
 * `EntityRow`, because `publicData.ts` owns that projection and one extra
 * column on it would be paid for by every index page that never uses it. */
async function entityMergeKey(kind: EntityKind, slug: string): Promise<string | null> {
  const r = await one<{ merge_key: string | null }>(
    "SELECT merge_key FROM perm_entities WHERE kind = ? AND slug = ?",
    [kind, slug],
  );
  return r?.merge_key ?? null;
}

// ---------------------------------------------------------------------------
// The size band
// ---------------------------------------------------------------------------

export interface SizeBand {
  /** Entities in the band, NOT counting the subject. */
  n: number;
  /** Filing counts at the band's edges, so the reader can see what "same size" means. */
  minTotal: number;
  maxTotal: number;
  /** Median of the band's own median-days values, or null if too few carry one. */
  medianDays: number | null;
  /** How many band members have a median at all. */
  withDays: number;
}

/**
 * The entities filing at about the same rate as this one.
 *
 * `fieldDistribution` compares an entity against everyone whose case count can
 * carry a rate, which is the right population for a RATE and the wrong one for
 * a wait. Rank is assigned by volume, so a rank window is a size band, and a
 * sponsor with four filings is far better served by "the 121 sponsors filing
 * about as often as you" than by a cohort it is not a member of.
 *
 * NO APPROVAL RATE IS COMPUTED HERE, and that is deliberate. Most bands are
 * made of entities with three or four decided cases, where a rate is the coin
 * landing heads (see `MIN_DECIDED_FOR_RATE`). Restricting the band to members
 * that can carry a rate would quietly turn it back into the field. Median days
 * degrades gracefully instead of inverting, so it is the one figure the band
 * is asked for.
 */
/**
 * Cached in Vercel's Data Cache, which SURVIVES A DEPLOYMENT while the ISR
 * route cache does not. Every entity page calls this, so after a deploy the
 * pages still regenerate but they no longer each re-run the query.
 *
 * Keyed on kind and rank because the band is a window around the rank, so
 * neighbours legitimately share an answer. Small result: five numbers.
 */
const sizeBandUncached = async (
  kind: EntityKind,
  rank: number,
  span = 60,
): Promise<SizeBand | null> => {
  const reach = Math.min(Math.max(1, Math.floor(span)), 500);
  // The subject is excluded. Included, the range reads back its own figure
  // as the band's maximum - Fragomen at rank 1 was told its neighbours filed
  // "between 642 and 48,322 cases", where 48,322 is Fragomen - and the
  // median it is being compared against would contain itself.
  const found = await rows<{ total: number; median_days: number | null }>(
    "SELECT total, median_days FROM perm_entities WHERE kind = ? "
      + "AND rank >= ? AND rank <= ? AND rank <> ?",
    [kind, Math.max(1, rank - reach), rank + reach, rank],
  );
  if (found.length < 8) return null;
  const days = found
    .map((r) => r.median_days)
    .filter((d): d is number => d !== null)
    .sort((a, b) => a - b);
  const totals = found.map((r) => r.total);
  return {
    n: found.length,
    minTotal: Math.min(...totals),
    maxTotal: Math.max(...totals),
    medianDays: days.length >= 8 ? (days[Math.floor(days.length / 2)] ?? null) : null,
    withDays: days.length,
  };
};

export const sizeBand = (kind: EntityKind, rank: number, span = 60) =>
  unstable_cache(
    () => sizeBandUncached(kind, rank, span),
    ["size-band", kind, String(rank), String(span)],
    { revalidate: 86400, tags: ["entities"] },
  )();
