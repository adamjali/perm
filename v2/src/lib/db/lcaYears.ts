import "server-only";

import { rows } from "./client";
import { employerMatch } from "./employerSlugs";
import type { YearCount } from "@/components/entities/YearBars";

/**
 * An employer's H-1B LCAs by fiscal year, FY2008 on: certified, denied and withdrawn, summed over the
 * spellings the employer map gives the page (`employerMatch`), from `lca_cases_years` in the LCA database
 * (scripts/build_lca_years.py, over DOL's FY2020-on files and its FY2008 to FY2019 ones). A spelling only an
 * old file carries, and the map has never seen, isn't in the series, so the chart says "matched to this page".
 *
 * Empty while the table isn't built; any other failure throws, so a page keeps its last good render.
 */
export async function lcaYears(slug: string): Promise<YearCount[]> {
  const match = await employerMatch(slug);
  if (!match) return [];
  try {
    const got = await rows<{ fy: number | string; certified: number | string; denied: number | string; withdrawn: number | string }>(
      "SELECT fy, SUM(certified) AS certified, SUM(denied) AS denied, SUM(withdrawn) AS withdrawn " +
        `FROM lca_cases_years WHERE ${match.where} GROUP BY fy ORDER BY fy`,
      match.args,
    );
    return got.map((r) => ({
      fy: Number(r.fy),
      certified: Number(r.certified) || 0,
      denied: Number(r.denied) || 0,
      withdrawn: Number(r.withdrawn) || 0,
    }));
  } catch (e) {
    if (/no such table/i.test(String(e))) return [];
    throw e;
  }
}
