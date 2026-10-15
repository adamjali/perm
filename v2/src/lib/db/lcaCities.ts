import "server-only";

import { cache } from "react";

import { one, rows } from "./client";

/**
 * H-1B LCAs by worksite city (`lca_cities`, built by
 * scripts/build_lca_cities.py), keyed exactly as the PERM city pages are, so
 * a city page joins its PERM record to its H-1B record by key. A city with
 * 20 or more LCAs and no PERM page has a row too, and gets a page of its own.
 * A missing table reads as "no H-1B record", never an error page.
 */

export interface LcaCity {
  key: string;
  slug: string;
  label: string;
  total: number;
  certified: number;
  fyFrom: number | null;
  fyTo: number | null;
  /** The first fiscal year the top lists cover. */
  since: number | null;
  employers: { slug: string | null; name: string; n: number }[];
  occupations: { code: string; title: string; slug: string | null; n: number }[];
  hasPermPage: boolean;
}

type Row = Record<string, unknown>;

function shape(r: Row): LcaCity | null {
  let d: Partial<Pick<LcaCity, "employers" | "occupations" | "hasPermPage">> & { since?: number };
  try {
    d = JSON.parse(String(r.detail ?? "{}"));
  } catch {
    return null;
  }
  return {
    key: String(r.key),
    slug: String(r.slug),
    label: String(r.label),
    total: Number(r.total ?? 0),
    certified: Number(r.certified ?? 0),
    fyFrom: r.fy_from == null ? null : Number(r.fy_from),
    fyTo: r.fy_to == null ? null : Number(r.fy_to),
    since: d.since ?? null,
    employers: d.employers ?? [],
    occupations: d.occupations ?? [],
    hasPermPage: Boolean(d.hasPermPage),
  };
}

const COLS = "key, slug, label, total, certified, fy_from, fy_to, detail";

async function read(where: string, arg: string): Promise<LcaCity | null> {
  try {
    const r = await one<Row>(`SELECT ${COLS} FROM lca_cities WHERE ${where} = ?`, [arg]);
    return r ? shape(r) : null;
  } catch (e) {
    if (/no such table/i.test(String(e))) return null;
    throw e;
  }
}

/** The H-1B record for a PERM city page, by its key. */
export const lcaCityByKey = cache((key: string) => read("key", key));

/** A city page with no PERM record, by its slug. */
export const lcaCityBySlug = cache((slug: string) => read("slug", slug));

/** The cities with H-1B records and no PERM page, for the sitemap. */
export async function lcaOnlyCities(): Promise<{ slug: string }[]> {
  try {
    const got = await rows<{ slug: string; detail: string }>("SELECT slug, detail FROM lca_cities ORDER BY total DESC");
    return got.filter((r) => !shape({ ...r, key: "", label: "", total: 0, certified: 0 })?.hasPermPage).map((r) => ({ slug: String(r.slug) }));
  } catch (e) {
    if (/no such table/i.test(String(e))) return [];
    throw e;
  }
}
