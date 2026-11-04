import "server-only";

import { cache } from "react";

import { brightJobs, type BrightJob, type OnetBrightRow, type PermTitleRow, type ProjectionRow } from "@/lib/brightOutlook";

import { one, rows } from "./client";

/**
 * The reads behind /bright-outlook-jobs: O*NET's Bright Outlook occupations (onet_occupations, scripts/ingest_onet.py),
 * BLS's 2025-35 projections (bls_projections, scripts/ingest_bls.py), each PERM occupation page's decided cases
 * (perm_entities) and the certified H-1B LCAs per code from the salary explorer's precomputed doc
 * (perm_docs['lca_filter_options'], scripts/build_lca_facets.py, codes with 30 or more). Four small reads, about
 * 2,700 rows together. A failed read throws, so the page keeps its last good render; the LCA doc missing only
 * drops the LCA column.
 */
export const getBrightOutlook = cache(async (): Promise<{ jobs: BrightJob[]; lcaFloor: number | null }> => {
  const [onet, projections, perm, lcaDoc] = await Promise.all([
    rows<OnetBrightRow>(
      "SELECT onet_code, soc7, title, bright FROM onet_occupations WHERE bright IS NOT NULL AND bright <> '' ORDER BY onet_code",
    ),
    rows<ProjectionRow>("SELECT soc7, title, change_pct, openings, median_wage FROM bls_projections"),
    rows<{ code: string; slug: string; name: string; total: number | string; certified: number | string; denied: number | string }>(
      "SELECT code, slug, name, total, certified, denied FROM perm_entities WHERE kind = 'occupation' AND code IS NOT NULL",
    ),
    one<{ json: string }>("SELECT json FROM perm_docs WHERE key = 'lca_filter_options'"),
  ]);
  const lca = new Map<string, number>();
  let lcaFloor: number | null = null;
  if (lcaDoc) {
    try {
      const d = JSON.parse(String(lcaDoc.json)) as { minCases?: number; occupations?: { value: string; n: number }[] };
      lcaFloor = typeof d.minCases === "number" ? d.minCases : null;
      for (const o of d.occupations ?? []) lca.set(String(o.value).slice(0, 7), Number(o.n) || 0);
    } catch {
      lca.clear();
    }
  }
  const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));
  const jobs = brightJobs(
    onet.map((r) => ({ onet_code: String(r.onet_code), soc7: String(r.soc7), title: String(r.title), bright: String(r.bright) })),
    projections.map((p) => ({
      soc7: String(p.soc7),
      title: String(p.title ?? ""),
      change_pct: num(p.change_pct),
      openings: num(p.openings),
      median_wage: num(p.median_wage),
    })),
    perm.map((p): PermTitleRow => ({
      code: String(p.code),
      slug: String(p.slug),
      name: String(p.name),
      total: Number(p.total) || 0,
      certified: Number(p.certified) || 0,
      denied: Number(p.denied) || 0,
    })),
    lca,
  );
  return { jobs, lcaFloor };
});
