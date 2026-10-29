import { socGroup } from "@/lib/socCode";
import { successorsOf } from "@/lib/socCrosswalk";
import { SOC_MAJOR_GROUPS } from "@/lib/socGroups";
import { titleSlug } from "@/lib/socTitleKey";

/**
 * The job code finder's rules, kept apart from the database so they're tested on their own
 * (src/lib/db/socTitles.ts reads the rows; scripts/build_soc_titles.py writes them).
 *
 * A title's answer is the codes employers filed it under in DOL's files, each with its share
 * of the title's filings, then the codes O*NET lists the title under that no employer used.
 * A code that BLS retired in 2018 (15-1132) is marked with the codes it became.
 */

export type SocSource = "dol" | "onet" | "both";

/** One code, as perm_docs['soc_codes'] carries it. */
export interface SocCode {
  soc: string;
  title: string;
  zone: number | null;
  perm: number;
  pwd: number;
  lca: number;
  /** The occupation page's slug (/perm-wages/<slug>), when the code has one. */
  slug: string | null;
  /** How many titles point at the code. */
  titles: number;
}

/** One soc_titles row. */
export interface SocTitleRow {
  key: string;
  soc: string;
  title: string;
  source: SocSource;
  filings: number;
  perm: number;
  pwd: number;
  lca: number;
  spellings: [string, number][];
  keyFilings: number;
}

export interface TitleCode {
  soc: string;
  codeTitle: string;
  filings: number;
  /** Of the title's filings under every code; null for a code only O*NET names. */
  share: number | null;
  perm: number;
  pwd: number;
  lca: number;
  /** O*NET lists the title under this code too. */
  onet: boolean;
  slug: string | null;
  zone: number | null;
  spellings: [string, number][];
  /** For a code BLS retired in 2018: the codes it became. */
  becameCodes: string[];
}

export interface TitleAnswer {
  key: string;
  title: string;
  /** The title's filings under every code. */
  total: number;
  /** Its own page's address segment, when it has one. */
  slug: string | null;
  codes: TitleCode[];
}

export interface CodeAnswer {
  soc: string;
  title: string;
  known: boolean;
  zone: number | null;
  slug: string | null;
  filings: number;
  /** For a 2010 code: the 2018 codes it became, with their titles. */
  became: { soc: string; title: string; slug: string | null }[];
}

/** The codes in a soc_codes doc's compact rows: [soc, title, zone, perm, pwd, lca, slug, titles]. */
export function parseCodes(rows: unknown): Map<string, SocCode> {
  const out = new Map<string, SocCode>();
  if (!Array.isArray(rows)) return out;
  for (const r of rows) {
    if (!Array.isArray(r) || typeof r[0] !== "string" || !/^\d{2}-\d{4}$/.test(r[0])) continue;
    out.set(r[0], {
      soc: r[0],
      title: String(r[1] ?? r[0]),
      zone: typeof r[2] === "number" ? r[2] : null,
      perm: Number(r[3]) || 0,
      pwd: Number(r[4]) || 0,
      lca: Number(r[5]) || 0,
      slug: typeof r[6] === "string" && r[6] ? r[6] : null,
      titles: Number(r[7]) || 0,
    });
  }
  return out;
}

/** What a typed query is: a code (2018 or 2010, either spelling), words, or nothing. */
export type SocQuery = { kind: "code"; soc: string } | { kind: "words"; text: string } | { kind: "empty" };

export function parseSocQuery(raw: string): SocQuery {
  const q = (raw ?? "").trim();
  if (!q) return { kind: "empty" };
  // "15-1252", "15-1252.00", "151252", "15 1252": a reader types a code more ways than DOL prints one.
  const m = /^(\d{2})[\s-]?(\d{4})(?:\.\d{2})?$/.exec(q);
  if (m) return { kind: "code", soc: `${m[1]}-${m[2]}` };
  return { kind: "words", text: q };
}

export function answerForCode(soc: string, codes: Map<string, SocCode>): CodeAnswer {
  const code = codes.get(soc);
  const became = successorsOf(soc).map((s) => ({ soc: s, title: codes.get(s)?.title ?? s, slug: codes.get(s)?.slug ?? null }));
  return {
    soc,
    title: code?.title ?? became[0]?.title ?? soc,
    known: !!code,
    zone: code?.zone ?? null,
    slug: code?.slug ?? null,
    filings: code ? code.perm + code.pwd + code.lca : 0,
    became,
  };
}

/**
 * One title's answer from its rows: the codes employers used, busiest first, then the ones only O*NET
 * names. The share is of the title's filings under every code, kept rows or not, so the shares can add
 * to under 100%: the rest went to codes used too rarely to list.
 */
export function answerForTitle(rows: readonly SocTitleRow[], codes: Map<string, SocCode>, pageMin: number): TitleAnswer | null {
  if (!rows.length) return null;
  const key = rows[0]!.key;
  const total = Math.max(0, ...rows.map((r) => r.keyFilings), rows.reduce((n, r) => n + r.filings, 0));
  const list = rows
    .map<TitleCode>((r) => {
      const code = codes.get(r.soc);
      return {
        soc: r.soc,
        codeTitle: code?.title ?? r.soc,
        filings: r.filings,
        share: r.filings > 0 && total > 0 ? r.filings / total : null,
        perm: r.perm,
        pwd: r.pwd,
        lca: r.lca,
        onet: r.source !== "dol",
        slug: code?.slug ?? null,
        zone: code?.zone ?? null,
        spellings: r.spellings,
        becameCodes: successorsOf(r.soc),
      };
    })
    .sort((a, b) => b.filings - a.filings || a.soc.localeCompare(b.soc));
  return { key, title: rows[0]!.title, total, slug: total >= pageMin ? titleSlug(key) : null, codes: list };
}

/** The share as a reader reads it: never a clean 0% or 100% the counts don't have. */
export function shareLabel(share: number | null): string {
  if (share === null) return "";
  if (share >= 0.995 && share < 1) return "over 99%";
  if (share > 0 && share < 0.01) return "under 1%";
  return `${Math.round(share * 100)}%`;
}

/** The 23 major groups with the codes and filings in each, from the codes doc. */
export interface MajorGroup {
  major: string;
  name: string;
  codes: SocCode[];
  filings: number;
}

export function majorGroups(codes: Map<string, SocCode>): MajorGroup[] {
  const groups = new Map<string, SocCode[]>();
  for (const c of codes.values()) {
    const major = c.soc.slice(0, 2);
    if (!SOC_MAJOR_GROUPS[major]) continue;
    groups.set(major, [...(groups.get(major) ?? []), c]);
  }
  return [...groups.entries()]
    .map(([major, list]) => ({
      major,
      name: SOC_MAJOR_GROUPS[major]!,
      codes: list.sort((a, b) => a.soc.localeCompare(b.soc)),
      filings: list.reduce((n, c) => n + c.perm + c.pwd + c.lca, 0),
    }))
    .sort((a, b) => a.major.localeCompare(b.major));
}

/** Where a code goes when it's picked: its occupation page, else the wage tool set to it. */
export function codeHref(soc: string, slug: string | null): string {
  return slug ? `/perm-wages/${slug}` : `/tools/wage-levels?soc=${encodeURIComponent(socGroup(soc) ?? soc)}`;
}
