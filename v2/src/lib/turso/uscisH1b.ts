import "server-only";

import { cache } from "react";

import { H1B_KINDS, shapeYears, type H1bYearRow, type UscisH1bRecord } from "../uscisH1b";
import { one, rows } from "./client";
import { employerSlugRange } from "./employerPrograms";
import { tableColumns } from "./tableColumns";

/**
 * One employer's USCIS H-1B decisions, over the same slug range as its
 * program ledger and LCA profile (`employerSlugRange`), so all three count the
 * same spellings. The table arrives with its first load
 * (scripts/ingest_uscis_h1b_hub.py); until then this answers null instead of
 * throwing.
 */

const TABLE = "uscis_h1b_employers";
const WHERE = "employer_slug >= ? AND employer_slug < ?";
const SUMS = H1B_KINDS.map((k) => `SUM(${k.key}_appr) AS ${k.key}_appr, SUM(${k.key}_den) AS ${k.key}_den`).join(", ");
const APPROVED = H1B_KINDS.map((k) => `${k.key}_appr`).join(" + ");

export const H1B_YEARS_SQL = `SELECT fy, ${SUMS} FROM ${TABLE} INDEXED BY ${TABLE}_emp WHERE ${WHERE} GROUP BY fy ORDER BY fy`;
export const H1B_NAMES_SQL =
  `SELECT employer AS name, SUM(${APPROVED}) AS approved FROM ${TABLE} INDEXED BY ${TABLE}_emp ` +
  `WHERE ${WHERE} GROUP BY employer ORDER BY approved DESC LIMIT 4`;
export const H1B_NAME_COUNT_SQL = `SELECT COUNT(DISTINCT employer) AS n FROM ${TABLE} INDEXED BY ${TABLE}_emp WHERE ${WHERE}`;

export const getUscisH1bRecord = cache(async (slug: string): Promise<UscisH1bRecord | null> => {
  if (!(await tableColumns(TABLE)).has("fy")) return null;
  const range = await employerSlugRange(slug);
  if (!range) return null;
  const args = [range.lo, range.hi];
  const [years, names, count] = await Promise.all([
    rows<H1bYearRow>(H1B_YEARS_SQL, args),
    rows<{ name: string; approved: number | string }>(H1B_NAMES_SQL, args),
    one<{ n: number | string }>(H1B_NAME_COUNT_SQL, args),
  ]);
  const shaped = shapeYears(years);
  if (shaped.length === 0) return null;
  return {
    years: shaped,
    names: names.map((r) => ({ name: String(r.name), approved: Number(r.approved) || 0 })),
    nameCount: Number(count?.n ?? 0),
  };
});
