import "server-only";

import { cache } from "react";

import { H1B_KINDS, shapeYears, type H1bYearRow, type UscisH1bRecord } from "../uscisH1b";
import { one, rows } from "./client";
import { employerMatch } from "./employerSlugs";
import { tableColumns } from "./tableColumns";

/**
 * One employer's USCIS H-1B decisions, over the same spellings as its
 * program ledger and LCA profile (`employerMatch`), so all three count the
 * same rows. The table arrives with its first load
 * (scripts/ingest_uscis_h1b_hub.py); until then this answers null instead of
 * throwing.
 */

const TABLE = "uscis_h1b_employers";
const SUMS = H1B_KINDS.map((k) => `SUM(${k.key}_appr) AS ${k.key}_appr, SUM(${k.key}_den) AS ${k.key}_den`).join(", ");
const APPROVED = H1B_KINDS.map((k) => `${k.key}_appr`).join(" + ");

export const h1bYearsSql = (where: string) =>
  `SELECT fy, ${SUMS} FROM ${TABLE} INDEXED BY ${TABLE}_emp WHERE ${where} GROUP BY fy ORDER BY fy`;
export const h1bNamesSql = (where: string) =>
  `SELECT employer AS name, SUM(${APPROVED}) AS approved FROM ${TABLE} INDEXED BY ${TABLE}_emp ` +
  `WHERE ${where} GROUP BY employer ORDER BY approved DESC LIMIT 4`;
export const h1bNameCountSql = (where: string) =>
  `SELECT COUNT(DISTINCT employer) AS n FROM ${TABLE} INDEXED BY ${TABLE}_emp WHERE ${where}`;

export const getUscisH1bRecord = cache(async (slug: string): Promise<UscisH1bRecord | null> => {
  if (!(await tableColumns(TABLE)).has("fy")) return null;
  const match = await employerMatch(slug);
  if (!match) return null;
  const args = match.args;
  const [years, names, count] = await Promise.all([
    rows<H1bYearRow>(h1bYearsSql(match.where), args),
    rows<{ name: string; approved: number | string }>(h1bNamesSql(match.where), args),
    one<{ n: number | string }>(h1bNameCountSql(match.where), args),
  ]);
  const shaped = shapeYears(years);
  if (shaped.length === 0) return null;
  return {
    years: shaped,
    names: names.map((r) => ({ name: String(r.name), approved: Number(r.approved) || 0 })),
    nameCount: Number(count?.n ?? 0),
  };
});
