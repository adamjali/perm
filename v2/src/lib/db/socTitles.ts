import "server-only";

import { FuzzyIndex } from "@/lib/fuzzy";
import {
  answerForCode,
  answerForTitle,
  parseCodes,
  parseSocQuery,
  type CodeAnswer,
  type SocCode,
  type SocSource,
  type SocTitleRow,
  type TitleAnswer,
} from "@/lib/socFinder";
import { titleKey } from "@/lib/socTitleKey";
import { SUGGEST_MAX_LENGTH } from "@/lib/search/limits";
import { rows } from "./client";
import { doc } from "./publicData";

/**
 * The job code finder's reads: soc_titles and the two docs scripts/build_soc_titles.py writes.
 *
 * The titles (71,000 keys) are held in each web process as a fuzzy index, the way the name
 * suggestions are (src/lib/db/nameSuggest.ts), read a letter at a time and kept six hours: the
 * table moves with the quarterly loads. A title's codes are a point read on its key.
 */

const TTL_MS = 6 * 60 * 60 * 1000;

export interface SocCodesDoc {
  builtAt: string;
  onetRelease: string;
  spans: { perm?: { from: string; to: string }; pwd?: { fyFrom: number; fyTo: number }; lca?: { fyFrom: number; fyTo: number } };
  counts: { rows: number; titles: number; dolTitles: number; codes: number; pages: number };
  pageMin: number;
  codes: Map<string, SocCode>;
}

interface RawCodesDoc extends Omit<SocCodesDoc, "codes"> {
  codes: unknown;
}

let codesCache: { at: number; value: Promise<SocCodesDoc | null> } | null = null;

/** The codes doc, parsed; null when the builder hasn't written it. */
export function getSocCodes(): Promise<SocCodesDoc | null> {
  if (codesCache && Date.now() - codesCache.at < TTL_MS) return codesCache.value;
  const value = doc<RawCodesDoc>("soc_codes").then((d) => (d ? { ...d, codes: parseCodes(d.codes) } : null));
  codesCache = { at: Date.now(), value };
  value.catch(() => {
    if (codesCache?.value === value) codesCache = null;
  });
  return value;
}

export interface SocTitlePage {
  slug: string;
  title: string;
  filings: number;
  /** The code employers used most for the title, and its filings. */
  topSoc: string | null;
  topFilings: number;
}

/** Every title with a page of its own, busiest first. */
export async function getSocTitlePages(): Promise<{ pageMin: number; pages: SocTitlePage[] } | null> {
  const d = await doc<{ pageMin: number; pages: [string, string, number, string | null, number][] }>("soc_title_pages");
  if (!d) return null;
  return {
    pageMin: d.pageMin,
    pages: (d.pages ?? []).map(([slug, title, filings, topSoc, topFilings]) => ({
      slug,
      title,
      filings,
      topSoc: topSoc ?? null,
      topFilings: Number(topFilings) || 0,
    })),
  };
}

interface KeyRow {
  key: string;
  title: string;
  total: number;
}

/** Key ranges each read on its own, so no single answer is large (nameSuggest.ts says why). */
const KEY_RANGES: [string, string | null][] = [
  ["", "a"],
  ...("abcdefghijklmnopqrstuvwxy".split("").map((c, i, all) => [c, all[i + 1] ?? "z"] as [string, string])),
  ["z", null],
];

async function loadKeys(): Promise<FuzzyIndex<KeyRow>> {
  const all: KeyRow[] = [];
  for (const [lo, hi] of KEY_RANGES) {
    const part = await rows<{ title_key: string; title: string; total: number | string }>(
      `SELECT title_key, max(title) AS title, max(key_filings) AS total FROM soc_titles
       WHERE title_key >= ?${hi ? " AND title_key < ?" : ""} GROUP BY title_key`,
      hi ? [lo, hi] : [lo],
    );
    for (const r of part) all.push({ key: r.title_key, title: r.title, total: Number(r.total) || 0 });
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return FuzzyIndex.build(all, (r) => r.title, (r) => r.total);
}

let keysCache: { at: number; index: Promise<FuzzyIndex<KeyRow>> } | null = null;

function keyIndex(): Promise<FuzzyIndex<KeyRow>> {
  if (keysCache && Date.now() - keysCache.at < TTL_MS) return keysCache.index;
  const index = loadKeys();
  keysCache = { at: Date.now(), index };
  index.catch(() => {
    if (keysCache?.index === index) keysCache = null;
  });
  return index;
}

interface DbTitleRow {
  title_key: string;
  soc7: string;
  title: string;
  source: string;
  filings: number | string;
  perm: number | string;
  pwd: number | string;
  lca: number | string;
  spellings: string | null;
  key_filings: number | string;
}

function toRow(r: DbTitleRow): SocTitleRow {
  let spellings: [string, number][] = [];
  try {
    const parsed = r.spellings ? (JSON.parse(r.spellings) as unknown) : [];
    if (Array.isArray(parsed)) spellings = parsed.filter((s): s is [string, number] => Array.isArray(s) && typeof s[0] === "string");
  } catch {
    spellings = [];
  }
  return {
    key: r.title_key,
    soc: r.soc7,
    title: r.title,
    source: (["dol", "onet", "both"].includes(r.source) ? r.source : "dol") as SocSource,
    filings: Number(r.filings) || 0,
    perm: Number(r.perm) || 0,
    pwd: Number(r.pwd) || 0,
    lca: Number(r.lca) || 0,
    spellings,
    keyFilings: Number(r.key_filings) || 0,
  };
}

const ROW_COLS = "title_key, soc7, title, source, filings, perm, pwd, lca, spellings, key_filings";

async function rowsForKeys(keys: string[]): Promise<Map<string, SocTitleRow[]>> {
  const out = new Map<string, SocTitleRow[]>();
  if (!keys.length) return out;
  const got = await rows<DbTitleRow>(
    `SELECT ${ROW_COLS} FROM soc_titles WHERE title_key IN (${keys.map(() => "?").join(",")})`,
    keys,
  );
  for (const r of got) out.set(r.title_key, [...(out.get(r.title_key) ?? []), toRow(r)]);
  return out;
}

/** One title's answer by its key; null when no row holds it. */
export async function getSocTitle(key: string): Promise<TitleAnswer | null> {
  const codes = await getSocCodes();
  if (!codes) return null;
  const got = await rowsForKeys([key]);
  return answerForTitle(got.get(key) ?? [], codes.codes, codes.pageMin);
}

export interface CodeTitles {
  /** Titles employers filed under the code, busiest first. */
  filed: { key: string; title: string; filings: number; share: number; keyFilings: number }[];
  /** Titles O*NET lists for the code. */
  onet: string[];
}

/** The titles a code is filed under, and the ones O*NET gives it. */
export async function titlesForCode(soc: string, limit = 15): Promise<CodeTitles> {
  // A deployment without the table yet holds no titles; any other failure is the caller's to report.
  const none = (e: unknown): [] => {
    if (String(e).includes("no such table")) return [];
    throw e;
  };
  const [filed, onet] = await Promise.all([
    rows<{ title_key: string; title: string; filings: number | string; key_filings: number | string }>(
      `SELECT title_key, title, filings, key_filings FROM soc_titles WHERE soc7 = ? AND filings > 0
       ORDER BY filings DESC LIMIT ?`,
      [soc, limit],
    ).catch(none),
    rows<{ title: string }>(
      `SELECT title FROM soc_titles WHERE soc7 = ? AND source != 'dol' ORDER BY key_filings DESC, title LIMIT 12`,
      [soc],
    ).catch(none),
  ]);
  return {
    filed: filed.map((r) => ({
      key: r.title_key,
      title: r.title,
      filings: Number(r.filings) || 0,
      share: Number(r.key_filings) > 0 ? (Number(r.filings) || 0) / Number(r.key_filings) : 0,
      keyFilings: Number(r.key_filings) || 0,
    })),
    onet: [...new Set(onet.map((r) => r.title))],
  };
}

let codeIndexCache: { codes: Map<string, SocCode>; index: FuzzyIndex<SocCode> } | null = null;

/** BLS's own names for the jobs, matched like the titles: about 900, so built once per codes doc. */
function codeIndexFor(codes: Map<string, SocCode>): FuzzyIndex<SocCode> {
  if (codeIndexCache?.codes !== codes) {
    codeIndexCache = { codes, index: new FuzzyIndex([...codes.values()], (c) => c.title, (c) => c.perm + c.pwd + c.lca) };
  }
  return codeIndexCache.index;
}

/** How close a title must be to be offered: the matcher's floor, a little raised. */
const MATCH_MIN = 0.7;

export interface SocSearch {
  query: string;
  /** A typed code, read as one. */
  code: CodeAnswer | null;
  /** The titles the words can mean, best first, each with its codes. */
  titles: TitleAnswer[];
  /** Codes whose own title matches the words (BLS's name for the job). */
  codes: CodeAnswer[];
}

/** The finder's answer for whatever was typed: a code, or words to match against titles and code names. */
export async function findSoc(raw: string, limit = 5): Promise<SocSearch> {
  const query = (raw ?? "").trim().slice(0, SUGGEST_MAX_LENGTH);
  const parsed = parseSocQuery(query);
  const codesDoc = await getSocCodes();
  const codes = codesDoc?.codes ?? new Map<string, SocCode>();
  if (parsed.kind === "empty") return { query, code: null, titles: [], codes: [] };
  if (parsed.kind === "code") {
    return { query, code: answerForCode(parsed.soc, codes), titles: [], codes: [] };
  }
  const index = await keyIndex();
  // The exact key first, so "Software Engineer" can't lose to a closer-spelled rarer title.
  const exact = titleKey(parsed.text);
  // Among titles equally close to what was typed, the one employers file most comes first:
  // "softwre enginer" means Software Engineer (200,000 filings), not a rarer longer title.
  const hits = index
    .search(parsed.text, { limit: 20, min: MATCH_MIN })
    .sort((x, y) => Math.round(y.score * 50) - Math.round(x.score * 50) || y.item.total - x.item.total)
    .slice(0, limit * 2)
    .map((h) => h.item.key);
  const keys = [...new Set([exact, ...hits])].slice(0, limit + 1);
  const byKey = await rowsForKeys(keys);
  const titles = keys
    .map((k) => answerForTitle(byKey.get(k) ?? [], codes, codesDoc?.pageMin ?? Infinity))
    .filter((a): a is TitleAnswer => a !== null)
    .slice(0, limit);
  const codeHits = codeIndexFor(codes).search(parsed.text, { limit: 3, min: 0.8 }).map((h) => answerForCode(h.item.soc, codes));
  return { query, code: null, titles, codes: codeHits };
}
