import "server-only";

import { cache } from "react";

import { shapeLcaProfile, type LcaNewestRow, type LcaProfile, type LcaProfileRow } from "../lcaProfile";
import { one } from "./client";
import { employerMatch } from "./employerSlugs";
import { tableColumns } from "./tableColumns";

/**
 * One employer's LCA profile, read over the same spellings as its program
 * ledger (`employerMatch`), so the two can never count different rows.
 *
 * Two reads on `lca_cases_emp` (employer_slug, received_date), each bounded by
 * the employer's own rows: one aggregate, and the newest filing that answered
 * Section H. The breakdown is counted over CERTIFIED LCAs only, because a
 * withdrawn or denied LCA's positions were never certified; the visa line and
 * the two declarations count every filing, because they describe what the
 * employer filed and said, whatever DOL then did with it.
 */

const CERT = "case_status = 'CERTIFIED'";

/**
 * The columns the detail backfill adds (`ingest_flag_disclosure.py
 * --backfill-lca-detail`). They arrive together, so one of them stands for
 * all ten. Until they exist the aggregate asks only for the visa line, which
 * the table has always carried: naming a missing column throws, and the page
 * would lose the visa counts along with everything else.
 */
const DETAIL_SENTINEL = "workers";

const VISA_SQL =
  "SUM(CASE WHEN visa_class = 'H-1B' THEN 1 ELSE 0 END) AS visa_h1b, " +
  "SUM(CASE WHEN visa_class = 'E-3 Australian' THEN 1 ELSE 0 END) AS visa_e3, " +
  "SUM(CASE WHEN visa_class = 'H-1B1 Chile' THEN 1 ELSE 0 END) AS visa_h1b1_chile, " +
  "SUM(CASE WHEN visa_class = 'H-1B1 Singapore' THEN 1 ELSE 0 END) AS visa_h1b1_singapore ";

const DETAIL_SQL =
  `SUM(CASE WHEN ${CERT} AND workers IS NOT NULL THEN 1 ELSE 0 END) AS detail_rows, ` +
  `SUM(CASE WHEN ${CERT} THEN workers END) AS positions, ` +
  `SUM(CASE WHEN ${CERT} THEN new_employment END) AS new_employment, ` +
  `SUM(CASE WHEN ${CERT} THEN change_employer END) AS change_employer, ` +
  `SUM(CASE WHEN ${CERT} THEN continued_employment END) AS continued_employment, ` +
  `SUM(CASE WHEN ${CERT} THEN change_previous_employment END) AS change_previous_employment, ` +
  `SUM(CASE WHEN ${CERT} THEN new_concurrent_employment END) AS new_concurrent_employment, ` +
  `SUM(CASE WHEN ${CERT} THEN amended_petition END) AS amended_petition, ` +
  `SUM(CASE WHEN ${CERT} AND wage_level = 'I' THEN 1 ELSE 0 END) AS level_1, ` +
  `SUM(CASE WHEN ${CERT} AND wage_level = 'II' THEN 1 ELSE 0 END) AS level_2, ` +
  `SUM(CASE WHEN ${CERT} AND wage_level = 'III' THEN 1 ELSE 0 END) AS level_3, ` +
  `SUM(CASE WHEN ${CERT} AND wage_level = 'IV' THEN 1 ELSE 0 END) AS level_4, ` +
  // Blank only among rows the backfill reached: a NULL on an older row means
  // "not read yet", not "no OES level", and must not be counted as either.
  `SUM(CASE WHEN ${CERT} AND workers IS NOT NULL AND wage_level IS NULL THEN 1 ELSE 0 END) AS level_blank, ` +
  "SUM(CASE WHEN h1b_dependent IS NOT NULL THEN 1 ELSE 0 END) AS dependent_rows, " +
  "SUM(CASE WHEN h1b_dependent = 1 THEN 1 ELSE 0 END) AS dependent_yes, " +
  "SUM(CASE WHEN willful_violator IS NOT NULL THEN 1 ELSE 0 END) AS violator_rows, " +
  "SUM(CASE WHEN willful_violator = 1 THEN 1 ELSE 0 END) AS violator_yes, ";

/** The aggregate, with or without the detail columns, over one employer's spellings (`where`). */
export function lcaProfileSql(hasDetail: boolean, where: string): string {
  return (
    "SELECT COUNT(*) AS filings, " +
    (hasDetail ? DETAIL_SQL : "") +
    VISA_SQL +
    `FROM lca_cases INDEXED BY lca_cases_emp WHERE ${where}`
  );
}

export function lcaNewestFlagsSql(where: string): string {
  return (
    "SELECT h1b_dependent, willful_violator, COALESCE(received_date, decision_date) AS filed " +
    `FROM lca_cases INDEXED BY lca_cases_emp WHERE ${where} ` +
    "AND (h1b_dependent IS NOT NULL OR willful_violator IS NOT NULL) " +
    "ORDER BY filed DESC LIMIT 1"
  );
}

export const getLcaProfile = cache(async (slug: string): Promise<LcaProfile | null> => {
  const match = await employerMatch(slug);
  if (!match) return null;
  const args = match.args;
  const hasDetail = (await tableColumns("lca_cases")).has(DETAIL_SENTINEL);
  const [row, newest] = await Promise.all([
    // Columns the reduced query doesn't name come back undefined, which shapes to 0.
    one<LcaProfileRow>(lcaProfileSql(hasDetail, match.where), args),
    // The declarations are a nicety on top of the counts; a failed read drops them, not the panel.
    hasDetail ? one<LcaNewestRow>(lcaNewestFlagsSql(match.where), args).catch(() => null) : Promise.resolve(null),
  ]);
  return shapeLcaProfile(row, newest);
});
