import "server-only";

import { cache } from "react";

import { rows } from "./client";

/**
 * Each decided PERM joined to the wage request it names (scripts/build_pwd_links.py): how long
 * after the wage determination an employer's, a law firm's or a job's PERM cases went in, and
 * how soon after the quiet period ended. One row per entity where 10 or more cases link, one for
 * every case together, each over the same window of determinations.
 */

export type PwdLinkKind = "employer" | "attorney" | "occupation";

export interface PwdLinkRow {
  /** Decided PERM cases that name a wage request DOL's files hold. */
  linked: number;
  /** For a law firm: the employers among them. */
  clients: number | null;
  /** Days from the wage determination to the PERM's filing: the quarter, middle and three-quarter marks. */
  pwdToPerm: { p25: number; p50: number; p75: number };
  /** Days from the quiet period's end to filing, and how many went in within two weeks; null under the floor. */
  quiet: { n: number; p50: number; within: number } | null;
  /** The wage determinations read, first and last day. */
  window: { from: string; to: string };
}

export interface PwdLinks {
  mine: PwdLinkRow | null;
  all: PwdLinkRow | null;
}

const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));

export function pwdLinkRow(r: Record<string, unknown> | undefined): PwdLinkRow | null {
  if (!r) return null;
  const quietP50 = num(r.quiet_to_file_p50);
  const within = num(r.quiet_within);
  return {
    linked: Number(r.linked),
    clients: num(r.clients),
    pwdToPerm: { p25: Number(r.pwd_to_perm_p25), p50: Number(r.pwd_to_perm_p50), p75: Number(r.pwd_to_perm_p75) },
    quiet: quietP50 !== null && within !== null ? { n: Number(r.quiet_n), p50: quietP50, within } : null,
    window: { from: String(r.from_day), to: String(r.to_day) },
  };
}

/**
 * One entity's row and every case's, or null when the table doesn't exist yet. A failed read
 * throws, so the page keeps its last good render rather than dropping the section as if there
 * were nothing to show.
 */
export const getPwdLinks = cache(async (kind: PwdLinkKind, slug: string): Promise<PwdLinks | null> => {
  try {
    const got = await rows<Record<string, unknown>>(
      "SELECT * FROM perm_pwd_stats WHERE (kind = ? AND slug = ?) OR (kind = 'all' AND slug = '')",
      [kind, slug],
    );
    return { mine: pwdLinkRow(got.find((r) => r.kind === kind)), all: pwdLinkRow(got.find((r) => r.kind === "all")) };
  } catch (e) {
    if (/no such table/i.test(String(e))) return null;
    throw e;
  }
});
