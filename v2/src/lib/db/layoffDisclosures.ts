import "server-only";

import { cache } from "react";

import { one, rows } from "./client";
import { newestAnswer, parseLayoffDoc, type EmployerLayoffAnswer, type LayoffDoc } from "@/lib/layoffDisclosures";

/**
 * perm_docs['layoff_disclosures'], as build_layoff_disclosures.py writes it. A
 * failed read throws, so the page keeps its last good render; no doc yet is null.
 */
export const getLayoffDisclosures = cache(async (): Promise<LayoffDoc | null> => {
  const r = await one<{ json: string }>("SELECT json FROM perm_docs WHERE key = 'layoff_disclosures'");
  return r ? parseLayoffDoc(JSON.parse(String(r.json))) : null;
});

/**
 * One employer's answers on its newest decided fiscal year, from its own cases
 * (the employer index, a few thousand rows at most), for the line on its page.
 * Null when it said no there, never answered, or the column isn't loaded yet;
 * any other failure throws, like the page's other DOL records.
 */
export const getEmployerLayoffAnswer = cache(async (slug: string): Promise<EmployerLayoffAnswer | null> => {
  try {
    const got = await rows<{ fy: unknown; layoff: string | null; n: unknown; lo: unknown; hi: unknown }>(
      "SELECT fiscal_year AS fy, layoff, COUNT(*) AS n, MIN(decision_date) AS lo, MAX(decision_date) AS hi " +
        "FROM perm_cases WHERE employer_slug = ? GROUP BY fiscal_year, layoff",
      [slug],
    );
    return newestAnswer(
      got.map((r) => ({
        fy: Number(r.fy),
        layoff: r.layoff,
        n: Number(r.n),
        from: r.lo ? String(r.lo).slice(0, 10) : null,
        through: r.hi ? String(r.hi).slice(0, 10) : null,
      })),
    );
  } catch (e) {
    if (/no such column: layoff/i.test(String(e))) return null;
    throw e;
  }
});
