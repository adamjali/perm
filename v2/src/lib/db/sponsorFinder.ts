import "server-only";

import { finderSql, type FinderFilters } from "../sponsorFinder";
import { one, rows } from "./client";

/**
 * The sponsor finder's read: a count and one page over `sponsor_index`.
 * Measured on production Oct 4 2026: the default count 68 ms, a page 5 ms.
 * Null when the table isn't built yet, so the page says so instead of
 * showing an empty list.
 */

export interface FinderRow {
  slug: string;
  name: string;
  state: string | null;
  sector: string | null;
  capExempt: boolean;
  permRecent: number;
  permDecided: number;
  permRate: number | null;
  lca24m: number;
  transferShare: number | null;
  seniorShare: number | null;
  debarred: boolean;
  warn2y: number;
}

const n = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));

export async function findSponsors(f: FinderFilters): Promise<{ total: number; rows: FinderRow[] } | null> {
  const q = finderSql(f);
  try {
    const [count, page] = await Promise.all([
      one<{ n: number | string }>(q.count, q.args),
      rows<Record<string, unknown>>(q.page, q.pageArgs),
    ]);
    return {
      total: Number(count?.n ?? 0),
      rows: page.map((r) => ({
        slug: String(r.slug),
        name: String(r.name),
        state: r.state ? String(r.state) : null,
        sector: r.sector_label ? String(r.sector_label) : null,
        capExempt: Number(r.cap_exempt) === 1,
        permRecent: Number(r.perm_recent ?? 0),
        permDecided: Number(r.perm_decided ?? 0),
        permRate: n(r.perm_rate),
        lca24m: Number(r.lca_24m ?? 0),
        transferShare: n(r.transfer_share),
        seniorShare: n(r.senior_share),
        debarred: Number(r.debarred) === 1,
        warn2y: Number(r.warn_2y ?? 0),
      })),
    };
  } catch (e) {
    if (/no such table/i.test(String(e))) return null;
    throw e;
  }
}
