import "server-only";

import table from "../../scripts/data/naics_titles.json";

/**
 * NAICS titles, from the Census Bureau's own 2022 and 2017 code lists.
 *
 * DOL's PERM file prints the employer's industry as a bare code
 * (`EMP_NAICS`, Form 9089 Section A, Item 13). The titles come from
 * `scripts/data/naics_titles.json`, which `scripts/build_naics_titles.py`
 * writes from Census's "2-6 digit" lists (2022 wins; a code 2022 retired keeps
 * its 2017 title). The ingest labels its facets with the same file and the
 * same parent-fallback rule, so a code reads the same in a facet and a row.
 *
 * Server-only: the table is 130 KB, which belongs in no browser bundle.
 */

type Entry = [string, number];
const TITLES = table as unknown as Record<string, Entry>;

/**
 * The title for a code, or its nearest parent's, naming whose it is.
 * `541599` has no title of its own, so it reads as its 4-digit group's.
 */
export function naicsTitle(code: string | null | undefined): { code: string; title: string } | null {
  if (!code || !/^\d{2,6}$/.test(code)) return null;
  for (let n = code.length; n >= 2; n--) {
    const hit = TITLES[code.slice(0, n)];
    if (hit) return { code: code.slice(0, n), title: hit[0] };
  }
  return null;
}

export interface NaicsSector {
  /** A 2-digit code, or a range such as `31-33` where Census gives several codes one title. */
  code: string;
  title: string;
}

/**
 * The twenty sectors, in code order. Census gives Manufacturing three 2-digit
 * codes (31-33), Retail two (44-45) and Transportation two (48-49); each is
 * one choice here and filters on all its codes.
 */
export function naicsSectors(): NaicsSector[] {
  const twos = Object.keys(TITLES)
    .filter((k) => k.length === 2)
    .sort();
  const out: NaicsSector[] = [];
  for (const k of twos) {
    const title = TITLES[k]![0];
    const last = out[out.length - 1];
    if (last && last.title === title) {
      const first = last.code.slice(0, 2);
      last.code = `${first}-${k}`;
    } else {
      out.push({ code: k, title });
    }
  }
  return out;
}
