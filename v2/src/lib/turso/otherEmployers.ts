import "server-only";

import { cache } from "react";

import type { OtherEmployerCounts } from "../otherEmployers";
import { one, rows } from "./client";

/**
 * Employers with no PERM page: those whose filings are H-1B LCAs, wage
 * requests, or H-2A, H-2B and CW-1 applications only.
 *
 * `employer_other_index` is written nightly by scripts/build_employer_map.py:
 * one row per employer (its spellings grouped by name identity), keyed by the
 * slug it was first published under. The employer page renders these after
 * the published and live-only lookups miss, and the sitemap lists every row
 * through rank windows.
 *
 * Until that table's first build, `seasonal_employer_index` (Oct 3 2026, the
 * H-2A, H-2B and CW-1 employers only) answers instead, so no page published
 * from it 404s in between. A missing table reads as "no such employer", so an
 * unknown slug stays a 404 rather than a 500; any other failure throws, so a
 * real employer never reads as a 404.
 */

export interface OtherEmployerRecord extends OtherEmployerCounts {
  slug: string;
  name: string;
  /** Filings across the programs that earn the page (perm excluded). */
  cases: number;
  firstFiled: string | null;
  lastChanged: string | null;
}

const INDEX = "employer_other_index";
const OLD_INDEX = "seasonal_employer_index";

const isMissingTable = (e: unknown) => /no such table/i.test(String(e));
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown): string | null => (v === null || v === undefined || v === "" ? null : String(v));

function shape(r: Record<string, unknown>): OtherEmployerRecord {
  return {
    slug: String(r.slug),
    name: String(r.name),
    cases: num(r.cases),
    perm: num(r.perm),
    lca: num(r.lca),
    pwd: num(r.pwd),
    h2a: num(r.h2a),
    h2b: num(r.h2b),
    cw1: num(r.cw1),
    firstFiled: str(r.first_filed),
    lastChanged: str(r.last_changed),
  };
}

/** Run against the new index, or the Oct 3 one while the new one doesn't exist yet. */
async function eitherIndex<T>(read: (table: string, isNew: boolean) => Promise<T>, missing: T): Promise<T> {
  try {
    return await read(INDEX, true);
  } catch (e) {
    if (!isMissingTable(e)) throw e;
  }
  try {
    return await read(OLD_INDEX, false);
  } catch (e) {
    if (isMissingTable(e)) return missing;
    throw e;
  }
}

export const otherEmployerRecord = cache(async (slug: string): Promise<OtherEmployerRecord | null> => {
  if (!slug || slug.length > 80) return null;
  const r = await eitherIndex(
    (table, isNew) =>
      one<Record<string, unknown>>(
        isNew
          ? `SELECT slug, name, cases, perm, lca, pwd, h2a, h2b, cw1, first_filed, last_changed FROM ${table} WHERE slug = ?`
          : `SELECT slug, name, cases, h2a, h2b, cw1, first_filed, last_changed FROM ${table} WHERE slug = ?`,
        [slug],
      ),
    null,
  );
  return r ? shape(r) : null;
});

/** The employers with no PERM page, for the `other-employer-N.xml` sitemap children. */
export async function getOtherEmployerSlugWindow(
  chunk: number,
  size: number,
): Promise<{ slug: string; lastChanged: string | null }[]> {
  const lo = chunk * size;
  const found = await eitherIndex(
    (table) =>
      rows<{ slug: string; last_changed: string | null }>(
        `SELECT slug, last_changed FROM ${table} WHERE rank > ? AND rank <= ? ORDER BY rank`,
        [lo, lo + size],
      ),
    [],
  );
  return found.map((r) => ({ slug: String(r.slug), lastChanged: r.last_changed ?? null }));
}

export async function countOtherEmployerRanks(): Promise<number> {
  const r = await eitherIndex((table) => one<{ n: number }>(`SELECT max(rank) AS n FROM ${table}`), null);
  return num(r?.n);
}
