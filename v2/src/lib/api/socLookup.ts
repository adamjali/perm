import "server-only";

import { socProfile } from "@/lib/db/socProfile";
import { findSoc, getSocCodes } from "@/lib/db/socTitles";
import type { SocProfile } from "@/lib/socProfile";
import { SITE_URL } from "@/lib/constants/site";
import { SEARCH_TEXT_MIN, SUGGEST_MAX_LENGTH } from "@/lib/search/limits";
import type { ReadResult } from "./reads";

/**
 * The job code finder as an answer for /v1/lookup/soc and the MCP tool `find_soc_code`: one read,
 * so the two can't differ. A title answers with the codes employers filed it under in DOL's files
 * and their shares; a code with its title, and a 2010 code with the codes it became.
 */

export interface SocLookup {
  query: string;
  /** The code typed, read as one. */
  code: {
    soc: string;
    title: string;
    known: boolean;
    filings: number;
    jobZone: number | null;
    became: { soc: string; title: string }[];
    /** O*NET's description of the job, its core tasks and its Job Zone's name; null where O*NET has none. */
    description: string | null;
    tasks: string[];
    jobZoneName: string | null;
    /** The job's PERM figures under the site's floors (a rate needs 30 decided cases, a median 10). */
    perm: SocProfile["figures"];
    /** The titles employers filed most under the code, each with its share of the code's filings. */
    filedTitles: { title: string; filings: number; share: number }[];
  } | null;
  titles: {
    title: string;
    filings: number;
    codes: { soc: string; title: string; filings: number; share: number | null; onetLists: boolean; became: string[] }[];
  }[];
  /** Codes whose own name matches the words. */
  codes: { soc: string; title: string }[];
}

const SOURCE = "U.S. Department of Labor, OFLC disclosure files (PERM, prevailing wage, LCA), and the O*NET 31.0 Database (USDOL/ETA, CC BY 4.0)";

/** The query as the finder takes it, or a sentence saying why not. */
export function cleanSocQuery(raw: string | null): { ok: true; value: string } | { ok: false; message: string } {
  const q = (raw ?? "").trim();
  if (q.length < SEARCH_TEXT_MIN || q.length > SUGGEST_MAX_LENGTH) {
    return { ok: false, message: `Send a job title or a SOC code, ${SEARCH_TEXT_MIN} to ${SUGGEST_MAX_LENGTH} characters, as ?q=.` };
  }
  return { ok: true, value: q };
}

/**
 * A code's profile, or null when it can't be read: the code's own answer still stands without it, as the
 * finder's descriptions do (`withSummaries`).
 */
async function profileOf(soc: string): Promise<SocProfile | null> {
  try {
    return await socProfile(soc);
  } catch (e) {
    console.error("[soc] code profile failed", e);
    return null;
  }
}

export async function lookupSoc(q: string): Promise<ReadResult<SocLookup>> {
  const [found, codes] = await Promise.all([findSoc(q), getSocCodes()]);
  if (!codes) {
    return { ok: false, status: 503, code: "not_loaded", message: "The job code table isn't loaded yet. Try again later." };
  }
  const url = `${SITE_URL}/soc-codes?q=${encodeURIComponent(q)}`;
  if (!found.code && !found.titles.length && !found.codes.length) {
    return { ok: false, status: 404, code: "not_found", message: `No job title or SOC code matched "${q}".`, url };
  }
  const profile = found.code?.known ? await profileOf(found.code.soc) : null;
  return {
    ok: true,
    data: {
      query: found.query,
      code: found.code
        ? {
            soc: found.code.soc,
            title: found.code.title,
            known: found.code.known,
            filings: found.code.filings,
            jobZone: found.code.zone,
            became: found.code.became.map((b) => ({ soc: b.soc, title: b.title })),
            description: profile?.description ?? null,
            tasks: profile?.tasks ?? [],
            jobZoneName: profile?.zoneName ?? null,
            perm: profile?.figures ?? null,
            filedTitles: (profile?.titles ?? []).map((t) => ({ title: t.title, filings: t.filings, share: Math.round(t.share * 1000) / 1000 })),
          }
        : null,
      titles: found.titles.map((t) => ({
        title: t.title,
        filings: t.total,
        codes: t.codes.map((c) => ({
          soc: c.soc,
          title: c.codeTitle,
          filings: c.filings,
          share: c.share === null ? null : Math.round(c.share * 1000) / 1000,
          onetLists: c.onet,
          became: c.becameCodes,
        })),
      })),
      codes: found.codes.map((c) => ({ soc: c.soc, title: c.title })),
    },
    meta: { source: SOURCE, asOf: codes.spans.perm?.to ?? null, url },
  };
}
