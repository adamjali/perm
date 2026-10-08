/**
 * How well "at the past pace it reaches your date in about N months" has held
 * on past bulletins: scripts/backtest_bulletin.py replays the arithmetic on
 * every bulletin since October 2016 and stores perm_docs['bulletin_backtest'].
 *
 * The green card line and the I-485 tool print the sentence beside their own
 * figure, because a bulletin moves in jumps and the long-run pace cannot see
 * them: measured Oct 7 2026, a date a year past the cutoff was typically about
 * 7 months off and within a quarter of the real wait 1 time in 4.
 *
 * Plain module, pure functions.
 */

export interface GapResult {
  readers: number;
  reached: number;
  typicalMissMonths: number;
  withinQuarterShare: number;
}

/** Keyed by days past the cutoff, as tested: 90, 180, 365 and 730. */
export type BulletinCheck = Record<number, GapResult>;

export function parseBulletinCheck(json: string): BulletinCheck | null {
  let d: unknown;
  try {
    d = JSON.parse(json);
  } catch {
    return null;
  }
  const by = (d as { byGap?: Record<string, Record<string, unknown>> } | null)?.byGap;
  if (!by || typeof by !== "object") return null;
  const out: BulletinCheck = {};
  for (const [gap, r] of Object.entries(by)) {
    const g = Number(gap);
    if (!Number.isInteger(g) || g <= 0 || !r) continue;
    const { readers, reached, typicalMissMonths, withinQuarterShare } = r;
    if (
      typeof readers === "number" && readers > 0 &&
      typeof reached === "number" &&
      typeof typicalMissMonths === "number" && typicalMissMonths >= 0 &&
      typeof withinQuarterShare === "number" && withinQuarterShare >= 0 && withinQuarterShare <= 1
    ) {
      out[g] = { readers, reached, typicalMissMonths, withinQuarterShare };
    }
  }
  return Object.keys(out).length ? out : null;
}

/** The tested distance nearest a reader's own gap, on a log scale (a year is nearer two years than three months). */
export function nearestGap(check: BulletinCheck, gapDays: number): number | null {
  const gaps = Object.keys(check).map(Number);
  if (gaps.length === 0 || !(gapDays > 0)) return null;
  return gaps.reduce((best, g) => (Math.abs(Math.log(g / gapDays)) < Math.abs(Math.log(best / gapDays)) ? g : best));
}

const DISTANCE: Record<number, string> = {
  90: "about three months",
  180: "about six months",
  365: "about a year",
  730: "about two years",
};

/** "1 time in 4": a share as the nearest plain fraction a reader can hold. */
function timesIn(share: number): string {
  if (share >= 0.9) return "almost every time";
  if (share >= 0.45) return `${Math.round(share * 10)} times in 10`;
  const n = Math.max(2, Math.round(1 / Math.max(share, 0.05)));
  return `1 time in ${n}`;
}

/**
 * The sentence, or null when there is no test for this reader: no doc, or a
 * date already current (nothing to estimate).
 */
export function bulletinCheckSentence(check: BulletinCheck | null, gapDays: number): string | null {
  if (!check) return null;
  const g = nearestGap(check, gapDays);
  if (g === null) return null;
  const r = check[g]!;
  const miss = Math.round(r.typicalMissMonths);
  return (
    `Tested on ${r.readers.toLocaleString("en-US")} past bulletin readings: for a date ${DISTANCE[g] ?? `${g} days`} past the ` +
    `cutoff, this pace was typically ${miss} month${miss === 1 ? "" : "s"} off, and within a quarter of the real wait ` +
    `${timesIn(r.withinQuarterShare)}.`
  );
}
