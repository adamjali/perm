import "server-only";

import { cache } from "react";

import { one, rows } from "./client";
import { slugRange } from "./flagCases";
import { tableColumns } from "./tableColumns";

/**
 * Which rows of the H-1B, wage-request, seasonal and USCIS tables belong to
 * one employer page.
 *
 * DOL prints the name that went on each form, so one employer arrives under
 * many spellings. These reads used to take every slug starting with the
 * employer's normalised name, which counted strangers: Intel's page took
 * 8,219 LCAs filed by Intellectt, Inteli Platforms and Inteliroute (39% over),
 * and Apple's took Apple Tree Dental. `scripts/build_employer_map.py` now
 * decides, nightly, the one page every spelling belongs to, by name identity
 * (`program_key`), and writes it to `employer_page_map`. This reads that
 * table, so the program ledger, the LCA profile, USCIS's H-1B record and the
 * lottery history all read exactly the same spellings.
 *
 * Before the map's first build the old prefix is the fallback, so nothing
 * regresses while it is missing. Once it exists, a page it doesn't list
 * reads its own slug only: a prefix would bring the strangers back.
 */

export interface EmployerMatch {
  /** A condition on `employer_slug`, with its arguments. */
  where: string;
  args: string[];
  /** `map`: the spellings the nightly map assigns this page; `own`: the page's slug alone; `prefix`: the old range. */
  basis: "map" | "own" | "prefix";
  /** How many spellings the condition reads; null for a prefix range. */
  spellings: number | null;
}

const MAP = "employer_page_map";

/** Far more than any employer has (Oct 4 2026: the most on one page was in the dozens). */
export const MAX_SPELLINGS = 2_000;

export function slugListMatch(slugs: string[], basis: "map" | "own"): EmployerMatch {
  return {
    where: `employer_slug IN (${slugs.map(() => "?").join(", ")})`,
    args: slugs,
    basis,
    spellings: slugs.length,
  };
}

async function prefixMatch(slug: string): Promise<EmployerMatch | null> {
  const entity = await one<{ merge_key: string | null }>(
    "SELECT merge_key FROM perm_entities WHERE kind = 'employer' AND slug = ?",
    [slug],
  ).catch(() => null);
  const range = slugRange(entity?.merge_key ? String(entity.merge_key) : slug);
  return range
    ? { where: "employer_slug >= ? AND employer_slug < ?", args: [range.lo, range.hi], basis: "prefix", spellings: null }
    : null;
}

export const employerMatch = cache(async (slug: string): Promise<EmployerMatch | null> => {
  if (!slug) return null;
  if (!(await tableColumns(MAP)).has("page_slug")) return prefixMatch(slug);
  const mapped = await rows<{ source_slug: string }>(
    `SELECT source_slug FROM ${MAP} WHERE page_slug = ? ORDER BY source_slug LIMIT ${MAX_SPELLINGS}`,
    [slug],
  );
  const slugs = mapped.map((r) => String(r.source_slug));
  return slugs.length > 0 ? slugListMatch(slugs, "map") : slugListMatch([slug], "own");
});

/**
 * The page a spelling belongs to, for a slug that has no page of its own:
 * an old link, or a spelling seen in a search result. Null when the map
 * doesn't know it or points it at itself.
 */
export const pageForSpelling = cache(async (slug: string): Promise<{ page: string; kind: string } | null> => {
  if (!slug || !(await tableColumns(MAP)).has("page_slug")) return null;
  const row = await one<{ page_slug: string; page_kind: string }>(
    `SELECT page_slug, page_kind FROM ${MAP} WHERE source_slug = ?`,
    [slug],
  ).catch(() => null);
  if (!row || String(row.page_slug) === slug) return null;
  return { page: String(row.page_slug), kind: String(row.page_kind) };
});
