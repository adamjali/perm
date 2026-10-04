import "server-only";

import { cache } from "react";

import { rows } from "./client";
import { employerMatch } from "./employerSlugs";
import { tableColumns } from "./tableColumns";

/**
 * One employer's H-1B lottery registrations, FY2021 to FY2024, from USCIS's
 * FOIA release (scripts/ingest_h1b_lottery_foia.py). Same spellings as the
 * rest of the employer page's H-1B figures (`employerMatch`). A frozen snapshot: USCIS queried
 * it in May 2024 and it will not move.
 */

export interface LotteryYear {
  fy: number;
  registrations: number;
  selected: number;
  petitioned: number;
  approved: number;
  denied: number;
}

const TABLE = "h1b_lottery_employers";

export const lotteryYearsSql = (where: string) =>
  `SELECT fy, SUM(registrations) AS registrations, SUM(selected) AS selected, SUM(petitioned) AS petitioned, ` +
  `SUM(approved) AS approved, SUM(denied) AS denied FROM ${TABLE} INDEXED BY ${TABLE}_emp ` +
  `WHERE ${where} GROUP BY fy ORDER BY fy`;

export const getEmployerLottery = cache(async (slug: string): Promise<LotteryYear[] | null> => {
  if (!(await tableColumns(TABLE)).has("fy")) return null;
  const match = await employerMatch(slug);
  if (!match) return null;
  const out = (await rows<Record<keyof LotteryYear, number | string>>(lotteryYearsSql(match.where), match.args)).map((r) => ({
    fy: Number(r.fy),
    registrations: Number(r.registrations) || 0,
    selected: Number(r.selected) || 0,
    petitioned: Number(r.petitioned) || 0,
    approved: Number(r.approved) || 0,
    denied: Number(r.denied) || 0,
  }));
  return out.length > 0 ? out : null;
});
