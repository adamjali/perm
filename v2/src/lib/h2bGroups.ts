/**
 * DOL's H-2B assignment groups (scripts/ingest_h2b_groups.py): reading
 * perm_docs['h2b_group_timing'] and picking a case's estimate. Plain module so
 * the unit project tests it; the readers are in src/lib/turso/h2bGroups.ts.
 *
 * The estimate itself is computed once, in Python (`group_estimate`), and
 * stored per season and group, so the page, the scorecard and the backtest
 * read one number.
 */

export interface GroupDays {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  basis: string;
}

export interface H2bGroupTiming {
  peaks: Record<string, { applications: number; groups: Record<string, { cases: number; decided: number }> }>;
  estimates: Record<string, { previous: string; scale: number; groups: Record<string, GroupDays> }>;
}

/** What the panel says about a case's group. */
export interface GroupPick {
  letter: string;
  /** How many groups that season had. */
  of: number;
  /** "January 2026" */
  season: string;
  /** "January 2025" */
  previous: string;
  /** This season's applications against last season's, as a percent change. */
  morePercent: number;
  days: GroupDays;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const seasonWords = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;

export function parseGroupTiming(json: string | null): H2bGroupTiming | null {
  if (!json) return null;
  try {
    const d = JSON.parse(json) as Partial<H2bGroupTiming>;
    if (!d.peaks || !d.estimates) return null;
    return { peaks: d.peaks, estimates: d.estimates };
  } catch {
    return null;
  }
}

const ok = (g: Partial<GroupDays> | undefined): g is GroupDays =>
  !!g && [g.p10, g.p25, g.p50, g.p75, g.p90].every((x) => typeof x === "number" && Number.isFinite(x));

/** The estimate for a case in `letter` of `peak`, or null when there is none. */
export function pickGroup(doc: H2bGroupTiming | null, peak: string, letter: string): GroupPick | null {
  const est = doc?.estimates[peak];
  const days = est?.groups[letter];
  if (!est || !ok(days)) return null;
  const groups = Object.keys(doc!.peaks[peak]?.groups ?? est.groups);
  return {
    letter,
    of: groups.length,
    season: seasonWords(peak),
    previous: seasonWords(est.previous),
    morePercent: Math.round((est.scale - 1) * 100),
    days,
  };
}
