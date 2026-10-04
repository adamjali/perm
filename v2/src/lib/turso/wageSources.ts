import "server-only";

import { cache } from "react";

import { one } from "./client";

/**
 * Where H-1B prevailing wages come from, from perm_docs['lca_wage_sources']
 * (scripts/build_wage_sources.py): the split between OES, private surveys and
 * union contracts by fiscal year, the survey publishers and surveys, and the
 * employers that use surveys most. Null when the doc isn't built yet.
 */

export interface WageSourceYear {
  fy: number;
  total: number;
  OES: number;
  Survey: number;
  CBA: number;
  SCA: number;
  DBA: number;
  Other: number;
}

export interface WageSourcesDoc {
  asOf: string;
  rows: number;
  years: WageSourceYear[];
  publishers: { name: string; n: number; spellings: string[] }[];
  surveys: { name: string; n: number }[];
  employers: { slug: string | null; name: string; survey: number; lcas: number }[];
}

export const getWageSources = cache(async (): Promise<WageSourcesDoc | null> => {
  const r = await one<{ json: string }>("SELECT json FROM perm_docs WHERE key = 'lca_wage_sources'").catch(() => null);
  if (!r) return null;
  try {
    return JSON.parse(String(r.json)) as WageSourcesDoc;
  } catch {
    return null;
  }
});
