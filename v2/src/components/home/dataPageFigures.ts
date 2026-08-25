import type { DataPageFigures } from "./LiveDataBand";

/**
 * Derives one evidential figure per data page from the PERM disclosure stats.
 *
 * Pure and separately testable, because the alternative is arithmetic inlined
 * in a server component where nothing can assert it. Every branch degrades to
 * `null` rather than to a plausible wrong number: a card with no figure is
 * visibly incomplete, a card with a fabricated figure is not.
 *
 * ON THE TWO SHARES. `topEmployers` and `topAttorneys` are the 250 largest
 * rows DOL publishes, and DOL prints a single law practice under several
 * spellings, so the row count is an upper bound on the number of distinct
 * firms. That makes a NAME or a RANK unsafe and a SHARE safe: merging the
 * duplicates would pull further firms into the top 250 and the share could
 * only rise, so this figure understates. It is never presented as a count of
 * firms.
 */

interface StateStat {
  state: string;
  total: number;
}
interface EntityStat {
  total: number;
}
/**
 * Every percentile is nullable in the stored schema, and that is not a
 * formality: a ladder is only meaningful if all three rungs exist AND ascend.
 */
interface WageLadder {
  p10: number | null;
  p50: number | null;
  p90: number | null;
}

export interface DisclosureLike {
  uniqueCases?: number;
  byState?: StateStat[];
  wageLadder?: WageLadder | null;
  topEmployers?: EntityStat[];
  topAttorneys?: EntityStat[];
  risk?: { baseline?: { denialRate: number; denied: number; decided: number } };
}

/** Share of all cases covered by a set of entity rows, as whole percent. */
function shareOfCases(
  rows: EntityStat[] | undefined,
  uniqueCases: number | undefined,
): number | null {
  if (!rows?.length || !uniqueCases || uniqueCases <= 0) return null;
  const covered = rows.reduce((sum, r) => sum + r.total, 0);
  if (covered <= 0) return null;
  // A share above 100 means the inputs disagree about what a case is; that is
  // a data fault, not a figure to print.
  const pct = Math.round((covered / uniqueCases) * 100);
  return pct > 100 ? null : pct;
}

export function deriveFigures(
  d: DisclosureLike | null | undefined,
): DataPageFigures {
  if (!d) {
    return {
      states: null,
      wages: null,
      employerShare: null,
      attorneyShare: null,
      denial: null,
    };
  }

  let states: DataPageFigures["states"] = null;
  if (d.byState?.length) {
    const rows = d.byState;
    const top = rows.reduce((a, b) => (b.total > a.total ? b : a), rows[0]!);
    const low = rows.reduce((a, b) => (b.total < a.total ? b : a), rows[0]!);
    // One jurisdiction cannot be both the largest and the smallest unless the
    // list has a single row, in which case the span says nothing.
    if (top.state !== low.state) {
      states = {
        count: rows.length,
        top: top.state,
        topCases: top.total,
        low: low.state,
        lowCases: low.total,
      };
    }
  }

  const wl = d.wageLadder;
  const wages =
    wl &&
    wl.p10 != null &&
    wl.p50 != null &&
    wl.p90 != null &&
    wl.p10 > 0 &&
    wl.p50 >= wl.p10 &&
    wl.p90 >= wl.p50
      ? { p10: wl.p10, p50: wl.p50, p90: wl.p90 }
      : null;

  const base = d.risk?.baseline;
  const denial =
    base && base.decided > 0 && base.denied >= 0
      ? { rate: base.denialRate, denied: base.denied, decided: base.decided }
      : null;

  return {
    states,
    wages,
    employerShare: shareOfCases(d.topEmployers, d.uniqueCases),
    attorneyShare: shareOfCases(d.topAttorneys, d.uniqueCases),
    denial,
  };
}
