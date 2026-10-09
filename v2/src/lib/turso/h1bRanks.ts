import "server-only";

import { cache } from "react";

import {
  parseH1bSummary,
  type H1bBasis,
  type H1bRankRow,
  type H1bSummary,
  type H1bView,
} from "@/lib/h1bRanks";

import { one, rows } from "./client";

/**
 * Reads for /h1b-employers: the summary doc and one view's ranked rows from
 * `h1b_employer_ranks` (scripts/build_h1b_ranks.py). A view is one indexed
 * read of at most 100 rows. Null when the table or doc isn't built yet, so
 * the page says so instead of showing an empty list.
 */

const COLS =
  "slug, linked, name, rank_lca, rank_uscis, lcas, positions, transfers, senior, leveled, wage_median, " +
  "uscis_new, uscis_appr, uscis_den, dependent, willful, on_hold, warn_2y, debarred";

export const getH1bSummary = cache(async (): Promise<H1bSummary | null> => {
  const r = await one<{ json: string }>("SELECT json FROM perm_docs WHERE key = 'h1b_ranks_summary'").catch(
    () => null,
  );
  return r ? parseH1bSummary(String(r.json)) : null;
});

const n = (v: unknown) => Number(v ?? 0) || 0;

export function toRow(r: Record<string, unknown>): H1bRankRow {
  const wage = r.wage_median === null || r.wage_median === undefined || r.wage_median === "" ? null : Number(r.wage_median);
  const dep = r.dependent === null || r.dependent === undefined || r.dependent === "" ? null : Number(r.dependent) === 1;
  const rank = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));
  return {
    slug: String(r.slug),
    linked: Number(r.linked) === 1,
    name: String(r.name),
    rankLca: rank(r.rank_lca),
    rankUscis: rank(r.rank_uscis),
    lcas: n(r.lcas),
    positions: n(r.positions),
    transfers: n(r.transfers),
    senior: n(r.senior),
    leveled: n(r.leveled),
    wageMedian: wage !== null && Number.isFinite(wage) ? wage : null,
    uscisNew: n(r.uscis_new),
    uscisAppr: n(r.uscis_appr),
    uscisDen: n(r.uscis_den),
    dependent: dep,
    willful: n(r.willful),
    onHold: n(r.on_hold),
    warn2y: n(r.warn_2y),
    debarred: Number(r.debarred) === 1,
  };
}

/** One view, or null when the table can't be read. */
export const getH1bView = cache(
  async (fy: number, state: string, by: H1bBasis, summary: H1bSummary): Promise<H1bView | null> => {
    const order = by === "lca" ? "rank_lca" : "rank_uscis";
    try {
      const got = await rows<Record<string, unknown>>(
        `SELECT ${COLS} FROM h1b_employer_ranks WHERE fy = ? AND state = ? AND ${order} IS NOT NULL ORDER BY ${order} LIMIT 100`,
        [fy, state],
      );
      const totals = summary.years.find((y) => y.fy === fy)?.places[state] ?? null;
      return { fy, state, by, rows: got.map(toRow), totals };
    } catch (e) {
      if (/no such table/i.test(String(e))) return null;
      throw e;
    }
  },
);
