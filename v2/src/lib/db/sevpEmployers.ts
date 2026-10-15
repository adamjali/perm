import "server-only";

import { cache } from "react";

import { one, rows } from "./client";
import { tableColumns } from "./tableColumns";

/**
 * ICE's top-200 OPT and CPT employer lists, as scripts/ingest_sevp_top_employers.py
 * stored them: every year ICE linked, both lists, in ICE's printed order.
 */

export type SevpListKind = "opt" | "cpt";

export interface SevpRow {
  rank: number;
  employer: string;
  total: number;
  opt: number | null;
  stemOpt: number | null;
  cpt: number | null;
}

export interface SevpList {
  year: number;
  list: SevpListKind;
  rows: SevpRow[];
  /** ICE's own ordering slips, named so the table isn't read as our sort. */
  asPrinted: string[];
}

const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));

export const getSevpLists = cache(async (): Promise<SevpList[]> => {
  if (!(await tableColumns("sevp_top_employers")).has("year")) return [];
  const [data, doc] = await Promise.all([
    rows<Record<string, unknown>>(
      "SELECT year, list, rank, employer, total, opt, stem_opt, cpt FROM sevp_top_employers ORDER BY year DESC, list DESC, rank",
    ),
    one<{ json: string }>("SELECT json FROM perm_docs WHERE key = 'sevp_top_employers'").catch(() => null),
  ]);
  let printed: Record<string, { as_printed?: string[] }> = {};
  try {
    printed = doc?.json ? (JSON.parse(doc.json) as { lists?: typeof printed }).lists ?? {} : {};
  } catch {
    printed = {};
  }
  const out = new Map<string, SevpList>();
  for (const r of data) {
    const year = Number(r.year);
    const list = r.list === "cpt" ? "cpt" : "opt";
    const key = `${year}-${list}`;
    if (!out.has(key)) out.set(key, { year, list, rows: [], asPrinted: printed[key]?.as_printed ?? [] });
    out.get(key)!.rows.push({
      rank: Number(r.rank),
      employer: String(r.employer),
      total: Number(r.total),
      opt: num(r.opt),
      stemOpt: num(r.stem_opt),
      cpt: num(r.cpt),
    });
  }
  return [...out.values()];
});
