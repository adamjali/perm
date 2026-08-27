/**
 * Wage-distribution derivations, outside the server-only boundary.
 *
 * Same reason as dolPace.ts and queueAhead.ts: the explorer is a client
 * component and the unit vitest project runs happy-dom, where importing
 * server-only throws.
 *
 * The percentile ARITHMETIC lives in SQL, because computing it here would
 * mean shipping 373,162 wages through the RSC payload to produce five
 * numbers. What lives here is the part that decides whether those numbers
 * may be shown at all, and the bin width for the histogram.
 */

/**
 * Below this, no figure is reported at all.
 *
 * A median over nine cases is one person's salary wearing a statistic's
 * clothes, and this repo already refuses that shape elsewhere: the
 * processing-times page withholds a cohort median until the cohort is
 * mature, and the denial-rate rankings carry a minimum population. Thirty is
 * the point at which a median stops moving by thousands of dollars when one
 * case lands.
 */
export const MIN_FOR_MEDIAN = 30;

/**
 * Below this, the 5th and 95th are withheld while the middle is still shown.
 *
 * A separate and higher floor because a tail is a much smaller sample than
 * the set it comes from. At n = 40, the 5th percentile rests on the second
 * case in the sorted list: that is one filing, not a percentile, and printing
 * it beside a median computed from forty would imply the two are equally
 * solid. A hundred puts five cases in each tail, which is the least that can
 * move without the figure jumping.
 */
export const MIN_FOR_TAILS = 100;

export interface WagePercentiles {
  n: number;
  avg: number | null;
  p5: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p95: number | null;
}

export interface WageReportability {
  /** Any figure at all may be shown. */
  showMiddle: boolean;
  /** The 5th and 95th may be shown. */
  showTails: boolean;
  /** Why something is withheld, or null when everything is reportable. */
  note: string | null;
}

/**
 * What this many cases will support.
 *
 * Returns a REASON rather than a boolean pair alone, because a withheld
 * figure with no explanation reads as a bug in the page rather than a limit
 * of the data.
 */
export function reportability(n: number): WageReportability {
  if (n < MIN_FOR_MEDIAN) {
    return {
      showMiddle: false,
      showTails: false,
      note:
        n === 0
          ? "No certified cases with a usable wage match these filters."
          : `Only ${n.toLocaleString("en-US")} ${n === 1 ? "case matches" : "cases match"} these filters. Below ${MIN_FOR_MEDIAN} a median moves by thousands when a single case lands, so no figure is shown.`,
    };
  }
  if (n < MIN_FOR_TAILS) {
    return {
      showMiddle: true,
      showTails: false,
      note: `The 5th and 95th are withheld: with ${n.toLocaleString("en-US")} cases each tail would rest on fewer than five filings.`,
    };
  }
  return { showMiddle: true, showTails: true, note: null };
}

/**
 * A histogram bin width that lands on a number a person can read.
 *
 * Derived from the middle of the SELECTED subset rather than fixed, because a
 * fixed ladder that suits the whole corpus puts every software developer in
 * one bar. Snapped to a 1/2/5 ladder so the axis reads $10k, $25k, $50k
 * rather than $13,842.
 */
export function binWidth(p5: number | null, p95: number | null): number {
  const span = p5 !== null && p95 !== null ? p95 - p5 : 0;
  if (!(span > 0)) return 10_000;
  const target = span / 20;
  const magnitude = 10 ** Math.floor(Math.log10(target));
  for (const step of [1, 2, 5, 10]) {
    if (magnitude * step >= target) return Math.max(1_000, magnitude * step);
  }
  return Math.max(1_000, magnitude * 10);
}

export interface WageBin {
  /** Lower edge, inclusive. */
  from: number;
  count: number;
}

/**
 * Clamp a raw bin series to the reportable range, folding the tails in.
 *
 * A handful of $2m wages would otherwise stretch the axis so far that the
 * body of the distribution collapses into one bar. The outliers are not
 * dropped: they are counted into an explicit final bin, so the total still
 * adds up to n and the page can say how many sit beyond the edge.
 */
export function clampBins(
  bins: readonly WageBin[],
  lo: number,
  hi: number,
): { bins: WageBin[]; below: number; above: number } {
  const kept: WageBin[] = [];
  let below = 0;
  let above = 0;
  for (const b of bins) {
    if (b.from < lo) below += b.count;
    else if (b.from > hi) above += b.count;
    else kept.push({ ...b });
  }
  return { bins: kept, below, above };
}
