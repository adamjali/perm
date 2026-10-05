/**
 * One printed employer name to the employer page it belongs to, with the few
 * figures the browser extension shows beside a job posting.
 *
 * HOW A NAME IS MATCHED, CHEAPEST AND SUREST FIRST:
 *
 * 1. Exact, published PERM employer: `perm_entities.merge_key` equal to the
 *    name's entity key or program key (`idx_pe_merge`).
 * 2. Exact, any employer page: `employer_page_map.key` equal to the name's
 *    program key, read only once that column's index exists, because without
 *    it the read walks every spelling of every employer.
 * 3. Possible: the busiest published PERM employer whose name contains the
 *    query and whose key begins with every word of it (employerNameMatch.ts),
 *    or, when no name contains it, whose letters lead with the query's once
 *    spaces and punctuation go ("Walmart" -> "WAL-MART ASSOCIATES").
 *    Always labelled possible, with the matched name shown.
 *
 * A SMALL EXACT MATCH GIVES WAY TO A MUCH BUSIER NAMESAKE. Job sites print the
 * brand ("Amazon", "Deloitte"), and DOL's files hold a 1-case "AMAZON" and a
 * 4-case "Deloitte LLP" beside the companies people mean. An exact match under
 * SMALL_EXACT published cases is set aside for the busiest possible match when
 * that one has at least BUSIER_BY times its cases and BUSY_FLOOR in all, and
 * the answer says "possible", so the reader sees which company it chose.
 *
 * Nothing else is guessed. A name that matches none of the three is "no
 * record", said plainly.
 *
 * The figures are the ones the employer page itself prints: published PERM
 * decisions and the certified share (withheld under 30 decided, the site's
 * rule for printing a rate at all), cases DOL shows pending now, the newest
 * filing the live record holds, and H-1B LCAs in DOL's published files.
 */
import "server-only";

import { SITE_URL } from "@/lib/constants/site";
import { entityKey, programKey } from "@/lib/entitySlug";
import { cleanEmployerQuery, pickPossibleMatch } from "@/lib/employerNameMatch";
import { one } from "@/lib/turso/client";
import { entityPending } from "@/lib/turso/entityDetail";
import { searchByLetters, searchByName } from "@/lib/turso/entities";
import { employerMatch } from "@/lib/turso/employerSlugs";
import { otherEmployerRecord } from "@/lib/turso/otherEmployers";
import { getEntityBySlug, getFreshness } from "@/lib/turso/publicData";
import type { ReadResult } from "./reads";
import { certifiedShare } from "./share";

/** Below this many decided cases the site prints no certified share. */
export const MIN_DECIDED_FOR_SHARE = 30;
/** Candidates the possible-match step reads, busiest first. */
const CANDIDATES = 25;
/** An exact match with fewer published cases than this can give way to a namesake. */
export const SMALL_EXACT = 30;
/** How many times busier the namesake must be. */
export const BUSIER_BY = 10;
/** And the fewest published cases it may have. */
export const BUSY_FLOOR = 100;

export type LookupMatch = "exact" | "possible" | "none";
export type PageKind = "perm" | "live" | "other";

export interface LookupEmployer {
  name: string;
  slug: string;
  url: string;
  /** perm: a published PERM sponsor; live: PERM filings DOL hasn't published yet; other: H-1B, wage-request or seasonal filings only. */
  page: PageKind;
  perm: {
    /** Cases in DOL's published files: decided, so certified, denied or withdrawn. */
    published: number;
    certified: number;
    denied: number;
    /** certified / (certified + denied), or null under the floor. */
    certifiedShare: number | null;
    /** Cases DOL's live record shows still open. */
    pending: number | null;
    /** The newest filing date the live record holds, YYYY-MM-DD. */
    newestFiling: string | null;
    filingsLast12Months: number | null;
  };
  /** H-1B labor condition applications in DOL's published files. */
  h1bLcas: number | null;
  /** Prevailing wage requests, published and live. */
  wageRequests: number | null;
}

export interface LookupData {
  query: string;
  match: LookupMatch;
  employer: LookupEmployer | null;
  /** Under this many decided cases no certified share is given. */
  shareFloor: number;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const day = (v: unknown): string | null => (v ? String(v).slice(0, 10) : null);

let mapKeyIndexed: Promise<boolean> | null = null;
let mapKeyCheckedAt = 0;
/** Whether `employer_page_map` has its index on `key` yet. Rechecked hourly. */
function mapHasKeyIndex(now = Date.now()): Promise<boolean> {
  if (!mapKeyIndexed || now - mapKeyCheckedAt > 3_600_000) {
    mapKeyCheckedAt = now;
    mapKeyIndexed = one<{ n: number }>(
      "SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'index' AND name = 'employer_page_map_key'",
    )
      .then((r) => Number(r?.n ?? 0) > 0)
      .catch(() => false);
  }
  return mapKeyIndexed;
}

async function exactPermSlug(name: string): Promise<string | null> {
  const keys = [...new Set([entityKey(name), programKey(name)].filter((k) => k.length >= 2))];
  if (keys.length === 0) return null;
  const r = await one<{ slug: string }>(
    `SELECT slug FROM perm_entities WHERE kind = 'employer' AND merge_key IN (${keys.map(() => "?").join(", ")}) ORDER BY rank LIMIT 1`,
    keys,
  );
  return r ? String(r.slug) : null;
}

async function exactMappedPage(name: string): Promise<{ slug: string; kind: PageKind } | null> {
  const key = programKey(name);
  if (key.length < 2 || !(await mapHasKeyIndex())) return null;
  const r = await one<{ page_slug: string; page_kind: string }>(
    "SELECT page_slug, page_kind FROM employer_page_map WHERE key = ? ORDER BY page_kind = 'perm' DESC, page_slug LIMIT 1",
    [key],
  );
  if (!r) return null;
  const kind = String(r.page_kind);
  return kind === "perm" || kind === "live" || kind === "other" ? { slug: String(r.page_slug), kind } : null;
}

/** Counts over the employer's own spellings, from the tables' employer indexes. */
async function spellingCounts(slug: string): Promise<{ lcas: number | null; newestFiling: string | null; livePending: number | null }> {
  const match = await employerMatch(slug).catch(() => null);
  if (!match) return { lcas: null, newestFiling: null, livePending: null };
  const [lca, live] = await Promise.all([
    one<{ n: number }>(`SELECT COUNT(*) AS n FROM lca_cases INDEXED BY lca_cases_emp WHERE ${match.where}`, match.args).catch(
      () => null,
    ),
    one<{ newest: string | null; pending: number }>(
      "SELECT MAX(filing_date) AS newest, SUM(CASE WHEN is_final = 0 THEN 1 ELSE 0 END) AS pending " +
        `FROM perm_live_recent INDEXED BY perm_live_recent_emp WHERE ${match.where}`,
      match.args,
    ).catch(() => null),
  ]);
  return { lcas: num(lca?.n), newestFiling: day(live?.newest), livePending: num(live?.pending) };
}

async function describe(slug: string, kind: PageKind): Promise<LookupEmployer | null> {
  const url = `${SITE_URL}/perm-employers/${slug}`;
  if (kind === "perm") {
    const [e, pending, counts] = await Promise.all([
      getEntityBySlug("employer", slug),
      entityPending("employer", slug).catch(() => null),
      spellingCounts(slug),
    ]);
    if (!e) return null;
    return {
      name: e.name,
      slug: e.slug,
      url,
      page: "perm",
      perm: {
        published: e.total,
        certified: e.certified,
        denied: e.denied,
        certifiedShare: certifiedShare(e.certified, e.denied, MIN_DECIDED_FOR_SHARE),
        pending: pending ? pending.pending : counts.livePending,
        newestFiling: counts.newestFiling,
        filingsLast12Months: e.recent12m ?? null,
      },
      h1bLcas: counts.lcas,
      wageRequests: null,
    };
  }
  if (kind === "live") {
    const [r, counts] = await Promise.all([
      one<{ name: string; cases: number }>("SELECT name, cases FROM perm_live_only_index WHERE slug = ?", [slug]),
      spellingCounts(slug),
    ]);
    if (!r) return null;
    return {
      name: String(r.name),
      slug,
      url,
      page: "live",
      perm: {
        published: 0,
        certified: 0,
        denied: 0,
        certifiedShare: null,
        pending: counts.livePending,
        newestFiling: counts.newestFiling,
        filingsLast12Months: null,
      },
      h1bLcas: counts.lcas,
      wageRequests: null,
    };
  }
  const [o, counts] = await Promise.all([otherEmployerRecord(slug), spellingCounts(slug)]);
  if (!o) return null;
  return {
    name: o.name,
    slug: o.slug,
    url,
    page: "other",
    perm: {
      published: 0,
      certified: 0,
      denied: 0,
      certifiedShare: null,
      pending: counts.livePending,
      newestFiling: counts.newestFiling,
      filingsLast12Months: null,
    },
    h1bLcas: o.lca,
    wageRequests: o.pwd,
  };
}

type Resolved = { match: LookupMatch; employer: LookupEmployer | null };

export async function resolveEmployer(query: string): Promise<Resolved> {
  let candidates: Awaited<ReturnType<typeof searchByName>> | null = null;
  const possible = async () => {
    if (!candidates) {
      // Two searches, weighed together busiest first. The name search alone misses
      // a brand whose page is spelled with the gaps elsewhere ("Walmart" against
      // WAL-MART ASSOCIATES; "Lowes" against LOWE'S COMPANIES, 270 cases, while it
      // did find LOWES LANDSCAPING, 6). The letters search ignores spaces and
      // punctuation (Rule D in scripts/entity_identity.py).
      const letters = programKey(query).replace(/ /g, "");
      const [byName, byLetters] = await Promise.all([
        searchByName("employer", query, CANDIDATES),
        letters.length >= 4 ? searchByLetters("employer", letters, CANDIDATES) : Promise.resolve([]),
      ]);
      const seen = new Set<string>();
      candidates = [...byName, ...byLetters]
        .filter((e) => (seen.has(e.slug) ? false : (seen.add(e.slug), true)))
        .sort((a, b) => b.total - a.total);
    }
    return pickPossibleMatch(query, candidates);
  };
  /** An exact match, unless it's small and a namesake is far busier. */
  const exactOrBusier = async (employer: LookupEmployer): Promise<Resolved> => {
    const own = employer.perm.published;
    if (own >= SMALL_EXACT) return { match: "exact", employer };
    const best = await possible().catch(() => null);
    if (!best || best.slug === employer.slug || best.total < Math.max(BUSIER_BY * own, BUSY_FLOOR)) {
      return { match: "exact", employer };
    }
    const busier = await describe(best.slug, "perm");
    return busier ? { match: "possible", employer: busier } : { match: "exact", employer };
  };

  const permSlug = await exactPermSlug(query);
  if (permSlug) {
    const employer = await describe(permSlug, "perm");
    if (employer) return exactOrBusier(employer);
  }
  const mapped = await exactMappedPage(query);
  if (mapped) {
    const employer = await describe(mapped.slug, mapped.kind);
    if (employer) return exactOrBusier(employer);
  }
  const best = await possible();
  if (best) {
    const employer = await describe(best.slug, "perm");
    if (employer) return { match: "possible", employer };
  }
  return { match: "none", employer: null };
}

/* A small memory of recent answers, so a busy employer's posting viewed by many
   people costs one set of reads an hour per copy of the site. */
const TTL_MS = 3_600_000;
const MAX_REMEMBERED = 5_000;
const remembered = new Map<string, { at: number; value: { match: LookupMatch; employer: LookupEmployer | null } }>();

export async function lookupEmployer(raw: string, now = Date.now()): Promise<ReadResult<LookupData>> {
  const query = cleanEmployerQuery(raw);
  if (!query) {
    return { ok: false, status: 400, code: "bad_request", message: "Send the employer's name, 2 to 120 characters, as ?name=." };
  }
  const memo = programKey(query) || query.toLowerCase();
  let hit = remembered.get(memo);
  if (!hit || now - hit.at > TTL_MS) {
    const value = await resolveEmployer(query);
    if (remembered.size >= MAX_REMEMBERED) remembered.clear();
    hit = { at: now, value };
    remembered.set(memo, hit);
  }
  const f = await getFreshness().catch(() => ({}) as Record<string, { asOf: string | null } | undefined>);
  const { match, employer } = hit.value;
  return {
    ok: true,
    data: { query, match, employer, shareFloor: MIN_DECIDED_FOR_SHARE },
    meta: {
      source:
        "U.S. Department of Labor, OFLC PERM and LCA disclosure files (decided cases) and FLAG case status (pending)",
      asOf: day(f["perm-cases"]?.asOf),
      url: employer ? employer.url : `${SITE_URL}/perm-employers?q=${encodeURIComponent(query)}`,
    },
  };
}

/** Test seam. */
export function forgetLookupsForTests(): void {
  remembered.clear();
  mapKeyIndexed = null;
  mapKeyCheckedAt = 0;
}
