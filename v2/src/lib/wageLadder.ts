/**
 * Wage-ladder types and derivations, outside the server-only boundary.
 *
 * Same split as dolPace.ts and wageStats.ts: the arithmetic that decides what
 * may be drawn has to be importable from the `unit` vitest project, which runs
 * happy-dom, where importing `server-only` throws. The QUERIES live in
 * src/lib/turso/wages.ts.
 *
 * A ladder here is one row of `perm_wage_stats`: seven percentiles over the
 * certified cases in one cell, materialised by scripts/ingest_perm_disclosure.py
 * with numpy's linear interpolation. Nothing in this file computes a
 * percentile; publicData.ts owns the one copy of that SQL.
 */

/** The seven rungs, low to high, as the table stores them. */
export const RUNGS = ["p5", "p10", "p25", "p50", "p75", "p90", "p95"] as const;
export type Rung = (typeof RUNGS)[number];

/** How each rung is labelled where it is named rather than drawn. */
export const RUNG_LABEL: Record<Rung, string> = {
  p5: "5th",
  p10: "10th",
  p25: "25th",
  p50: "Median",
  p75: "75th",
  p90: "90th",
  p95: "95th",
};

export interface Ladder {
  /** What this ladder describes: an occupation title, a state, a year. */
  label: string;
  /** Stable id for keys and links: SOC code, state code, or fiscal year. */
  key: string;
  /** Cases behind the ladder. Every figure carries its population. */
  count: number;
  p5: number | null;
  p10: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p90: number | null;
  p95: number | null;
  mean: number | null;
}

/**
 * A ladder is drawable only when every rung resolved.
 *
 * A partial ladder drawn as a span would silently shorten at one end and read
 * as a narrower distribution rather than as missing data.
 */
export function isComplete(l: Ladder): boolean {
  return RUNGS.every((r) => l[r] !== null);
}

/** The lowest and highest rung across a set, for a SHARED axis. */
export function ladderExtent(ladders: readonly Ladder[]): [number, number] | null {
  const lo: number[] = [];
  const hi: number[] = [];
  for (const l of ladders) {
    if (l.p5 !== null) lo.push(l.p5);
    if (l.p95 !== null) hi.push(l.p95);
  }
  if (lo.length === 0 || hi.length === 0) return null;
  return [Math.min(...lo), Math.max(...hi)];
}

/**
 * Do two ladders overlap at all?
 *
 * The whole two-markets finding rests on this being FALSE for the pairs it
 * names, so it is measured rather than asserted in prose. Software Developers
 * open at $89,565 on the 5th; Meat, Poultry and Fish Cutters close at $31,408
 * on the 95th. Nothing in between belongs to either.
 */
export function overlaps(a: Ladder, b: Ladder): boolean {
  if (a.p5 === null || a.p95 === null || b.p5 === null || b.p95 === null) {
    return true; // Unknown is not evidence of separation.
  }
  return a.p5 <= b.p95 && b.p5 <= a.p95;
}

export interface RungStep {
  from: Rung;
  to: Rung;
  /** How many times larger the upper rung is than the lower one. */
  ratio: number;
}

/**
 * The widest jump between two neighbouring rungs.
 *
 * A ladder whose rungs are evenly spaced describes one population. A ladder
 * with a step in it describes two, and a median lands somewhere in the step
 * where nobody actually is. Georgia's ladder rises 3.31 times between the
 * median and the 75th percentile, because the state files poultry processing
 * and Atlanta software through the same process; California's widest step is
 * a quarter of that.
 *
 * Measured rather than asserted, so a page can name the states where it holds
 * without a human keeping a list up to date.
 */
export function widestStep(l: Ladder): RungStep | null {
  let best: RungStep | null = null;
  for (let i = 0; i + 1 < RUNGS.length; i++) {
    const from = RUNGS[i]!;
    const to = RUNGS[i + 1]!;
    const lo = l[from];
    const hi = l[to];
    if (lo === null || hi === null || lo <= 0) continue;
    const ratio = hi / lo;
    if (!best || ratio > best.ratio) best = { from, to, ratio };
  }
  return best;
}

/** `$139,027`. Whole dollars: a wage published to the cent is not a fact. */
export function money(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

/** `$139k`, for an axis where the full figure will not fit. */
export function moneyShort(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}m`;
  return `$${Math.round(n / 1000)}k`;
}

// ---------------------------------------------------------------------------
// Wage against outcome
// ---------------------------------------------------------------------------

/** Band edges in dollars. The top band is open-ended. */
export const WAGE_BAND_EDGES = [60_000, 80_000, 100_000, 130_000] as const;

/**
 * The floor under a published denial rate. Must equal `DEFAULT_RATE_FLOOR`.
 *
 * DECLARED HERE RATHER THAN IMPORTED, AND THE REASON IS A SILENT FAILURE THAT
 * ACTUALLY SHIPPED FOR ONE ITERATION. `DEFAULT_RATE_FLOOR` and
 * `wilsonInterval` live in `components/tools/RateBars.tsx`, which begins with
 * `"use client"`. This module is reachable from `lib/turso/wages.ts`, which is
 * `server-only`, so under React Server Components those imports resolve to
 * CLIENT REFERENCES rather than to the values. `32020 >= <client reference>`
 * is simply `false`, so every wage band rendered "withheld" over tens of
 * thousands of cases, with no error anywhere: the page returned 200 and the
 * numbers were gone. Vitest does not apply the RSC boundary, so all 28 unit
 * tests stayed green through it.
 *
 * `equivalence.test.ts` asserts this constant and `wilsonInterval` below agree
 * exactly with the RateBars originals, which is the anti-drift guarantee the
 * import was supposed to provide, obtained in the one place where importing
 * both is safe. The real fix is to move the shared maths out of a "use client"
 * file into `src/lib/`; that file belongs to another agent.
 */
export const MIN_DECIDED_FOR_BAND_RATE = 100;

/**
 * Wilson score interval for a proportion, in percent.
 *
 * Character-for-character the arithmetic in `RateBars.wilsonInterval`, pinned
 * by a test that imports both and compares them across a grid of inputs. The
 * normal approximation is wrong exactly where these rates live, near zero with
 * small counts, and yields negative lower bounds; Wilson stays inside 0 to 100
 * by construction.
 */
export function wilsonInterval(
  denied: number,
  decided: number,
  z = 1.96,
): { lo: number; hi: number } | null {
  if (!Number.isFinite(denied) || !Number.isFinite(decided) || decided <= 0) return null;
  const p = denied / decided;
  const denom = 1 + (z * z) / decided;
  const centre = (p + (z * z) / (2 * decided)) / denom;
  const half =
    (z * Math.sqrt((p * (1 - p)) / decided + (z * z) / (4 * decided * decided))) / denom;
  return {
    lo: Math.max(0, (centre - half) * 100),
    hi: Math.min(100, (centre + half) * 100),
  };
}

export interface WageBandRate {
  /** Printed label, e.g. "$60k to $80k". */
  band: string;
  /** Lower edge in dollars: the sort key and the axis position. */
  from: number;
  /** Upper edge, or null for the open-ended top band. */
  to: number | null;
  /** Certified plus denied. Withdrawn is deliberately not in here. */
  decided: number;
  denied: number;
  /** Percent of decided cases denied, or null when the band is too thin. */
  deniedPct: number | null;
  /** 95% Wilson interval in percent, or null when the band is too thin. */
  interval: { lo: number; hi: number } | null;
}

export interface WageBandSeries {
  /** A fiscal year, or "all" for the pooled window. */
  fiscalYear: string;
  bands: WageBandRate[];
}

export function bandLabel(from: number, to: number | null): string {
  const k = (n: number) => `$${Math.round(n / 1000)}k`;
  if (from === 0) return `Under ${k(to as number)}`;
  if (to === null) return `${k(from)} and up`;
  return `${k(from)} to ${k(to)}`;
}

/**
 * Grouped counts into a full set of bands, one entry per edge.
 *
 * Every band is emitted even when the query returned no row for it, so a band
 * that is genuinely empty shows as empty instead of vanishing and letting the
 * neighbours close up over its place on the axis.
 */
export function toBands(
  counts: readonly { from: number; decided: number; denied: number }[],
): WageBandRate[] {
  const edges = [0, ...WAGE_BAND_EDGES];
  const byFrom = new Map(counts.map((c) => [c.from, c]));
  return edges.map((from, i) => {
    const to = i + 1 < edges.length ? (edges[i + 1] as number) : null;
    const row = byFrom.get(from);
    const decided = row?.decided ?? 0;
    const denied = row?.denied ?? 0;
    return {
      band: bandLabel(from, to),
      from,
      to,
      decided,
      denied,
      // A rate over a thin band is one filing wearing a percentage's clothes.
      deniedPct:
        decided >= MIN_DECIDED_FOR_BAND_RATE ? (denied / decided) * 100 : null,
      // The interval is what makes the mid-band hump a finding rather than an
      // impression. Wilson rather than the normal approximation, because these
      // proportions sit near zero where the normal approximation produces
      // negative lower bounds. Measured: FY2025 reads 2.57% [2.43, 2.72] under
      // $60k against 3.61% [3.26, 4.00] at $60k-$80k, and FY2026 4.94%
      // [4.71, 5.18] against 6.62% [6.12, 7.17]. Both pairs are SEPARATED, so
      // the hump survives the test rather than merely surviving a glance.
      interval:
        decided >= MIN_DECIDED_FOR_BAND_RATE ? wilsonInterval(denied, decided) : null,
    };
  });
}

/**
 * Is the denial rate monotonically falling as the wage rises?
 *
 * Asked rather than assumed, because the answer is not the same in every
 * year. Measured on the disclosure corpus: FY2024 falls at every step; FY2025
 * and FY2026 both RISE from the bottom band into $60k-$80k and fall from
 * there. Pooling all three hides it, because FY2024's very high bottom band
 * cancels the later years' hump almost exactly.
 *
 * Bands with a withheld rate are skipped rather than treated as zero.
 */
export function isMonotonicFalling(bands: readonly WageBandRate[]): boolean {
  const known = bands
    .filter((b) => b.deniedPct !== null)
    .sort((a, b) => a.from - b.from);
  for (let i = 1; i < known.length; i++) {
    if ((known[i]!.deniedPct as number) > (known[i - 1]!.deniedPct as number)) {
      return false;
    }
  }
  return true;
}

/** The band with the highest rate, ignoring withheld ones. */
export function worstBand(bands: readonly WageBandRate[]): WageBandRate | null {
  const known = bands.filter((b) => b.deniedPct !== null);
  if (known.length === 0) return null;
  return known.reduce((a, b) =>
    (b.deniedPct as number) > (a.deniedPct as number) ? b : a,
  );
}
