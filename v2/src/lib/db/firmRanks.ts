import "server-only";

import { cache } from "react";

import { one, rows } from "./client";
import type { FirmProgram, FirmRankRow, FirmRanksSummary } from "@/lib/firmRanks";

/**
 * `firm_ranks` and `perm_docs['firm_ranks_summary']`, as build_firm_ranks.py
 * writes them. A failed read throws, so a page keeps its last good render.
 */

const num = (v: unknown): number => Number(v ?? 0);

export const getFirmRanksSummary = cache(async (): Promise<FirmRanksSummary | null> => {
  const r = await one<{ json: string }>("SELECT json FROM perm_docs WHERE key = 'firm_ranks_summary'");
  if (!r) return null;
  const d = JSON.parse(String(r.json)) as FirmRanksSummary;
  return d && d.programs ? d : null;
});

export const getFirmRanks = cache(async (program: FirmProgram, fy: number, state: string): Promise<FirmRankRow[]> => {
  const list = await rows<Record<string, unknown>>(
    `SELECT slug, linked, name, rank, prev_rank, filings, certified, denied, withdrawn, positions, employers, median_days
       FROM firm_ranks WHERE program = ? AND fy = ? AND state = ? ORDER BY rank`,
    [program, fy, state],
  );
  return list.map((r) => ({
    slug: String(r.slug),
    linked: num(r.linked) === 1,
    name: String(r.name),
    rank: num(r.rank),
    prevRank: r.prev_rank === null || r.prev_rank === undefined ? null : num(r.prev_rank),
    filings: num(r.filings),
    certified: num(r.certified),
    denied: num(r.denied),
    withdrawn: num(r.withdrawn),
    positions: num(r.positions),
    employers: num(r.employers),
    medianDays: r.median_days === null || r.median_days === undefined ? null : Number(r.median_days),
  }));
});
