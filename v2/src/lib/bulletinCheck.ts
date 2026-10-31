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
  /**
   * The real wait as a multiple of the pace's months, at the quarter, half and three-quarter marks of past readers
   * (scripts/backtest_bulletin.py `ratio_marks`). Null where too few readers came current to place the mark.
   */
  marks?: WaitMarks;
}

export interface WaitMarks {
  fast: number | null;
  typical: number | null;
  slow: number | null;
}

function readMarks(v: unknown): WaitMarks | undefined {
  if (!v || typeof v !== "object") return undefined;
  const m = v as Record<string, unknown>;
  const one = (x: unknown) => (typeof x === "number" && x > 0 && x < 100 ? x : null);
  const out = { fast: one(m.fast), typical: one(m.typical), slow: one(m.slow) };
  return out.fast === null && out.typical === null ? undefined : out;
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
      const marks = readMarks(r.ratioMarks);
      out[g] = { readers, reached, typicalMissMonths, withinQuarterShare, ...(marks ? { marks } : {}) };
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

/**
 * The reader's own wait, three ways, from how past readers this far behind fared: the pace's months times each
 * measured mark. Null without marks for the nearest tested distance; `slow` null when too few came current to say.
 */
export function waitMarks(check: BulletinCheck | null, gapDays: number, paceMonths: number): WaitMarks | null {
  if (!check || !(paceMonths > 0)) return null;
  const g = nearestGap(check, gapDays);
  const marks = g === null ? undefined : check[g]?.marks;
  if (!marks) return null;
  const times = (x: number | null) => (x === null ? null : Math.round(paceMonths * x * 10) / 10);
  return { fast: times(marks.fast), typical: times(marks.typical), slow: times(marks.slow) };
}
