/**
 * The scorecard in plain words (Oct 7 2026).
 *
 * The admin table printed "8" and "4" under two column headings and the owner
 * read it as Rival A beating us, with no way to tell whether that was a real
 * lead, luck, or the sample. These functions turn the figures into a few
 * sentences: who was closer, whether a split that size could be luck, and
 * what grading only the decided cases hides. Every surface prints these
 * sentences, and the writer stores them in the doc, so the morning report
 * says the same thing without a second copy of the rules.
 *
 * Pure, so the unit project tests every rule.
 */

import { addDays, format, parseISO } from "date-fns";

import { formatInt } from "@/lib/format";

import { HORIZONS, SETTLE_DAYS, type Cell, type HeadToHead, type Horizon } from "./score";

export const SOURCE_NAME: Record<string, string> = {
  ours: "Us",
  "rival-a": "Rival A",
  "rival-b": "Rival B",
  "rival-c": "Rival C",
};

export const sourceName = (s: string) => SOURCE_NAME[s] ?? s;

const dayWord = (n: number) => `${formatInt(Math.round(n))} ${Math.round(n) === 1 ? "day" : "days"}`;

/**
 * How often fair coin flips split at least this unevenly: the two-sided exact
 * sign test over the cases one side won, ties left out. Null with nothing to
 * split. Summed in log space so a long-running scorecard can't underflow.
 */
export function chanceOfSplit(a: number, b: number): number | null {
  const n = a + b;
  if (n === 0) return null;
  const k = Math.max(a, b);
  let logP = n * Math.log(0.5); // P(X = 0)
  let tail = 0;
  for (let i = 0; i <= n; i++) {
    if (i > 0) logP += Math.log(n - i + 1) - Math.log(i);
    if (i >= k) tail += Math.exp(logP);
  }
  return Math.min(1, 2 * tail);
}

/** "about 4 times in 10", "about 1 time in 60": a chance a reader can feel. */
export function chanceWords(p: number): string {
  if (p >= 0.95) return "almost always";
  if (p >= 0.15) return `about ${Math.round(p * 10)} times in 10`;
  if (p < 0.001) return "less than 1 time in 1,000";
  const n = Math.round(1 / p);
  if (n >= 100) return `about 1 time in ${formatInt(Math.round(n / 50) * 50)}`;
  if (n >= 20) return `about 1 time in ${formatInt(Math.round(n / 5) * 5)}`;
  return `about 1 time in ${n}`;
}

/** Under 1 in 20 by luck, the usual line for "not chance". */
export const CLEAR_P = 0.05;

export interface RivalReading {
  source: string;
  name: string;
  /** Who was closer more often on the cases both dated. */
  leader: "ours" | "rival" | "even" | "none";
  /** True once a split this uneven would happen by luck under 1 time in 20. */
  clear: boolean;
  headline: string;
  points: string[];
}

/**
 * One rival against us, from the head-to-head on the same cases.
 *
 * The late-and-waiting point is the one that matters most early on: a side
 * that dates cases sooner wins the first decisions and carries the misses
 * nobody has graded yet.
 */
export function readRival(source: string, h: HeadToHead): RivalReading {
  const name = sourceName(source);
  const won = h.oursCloser;
  const lost = h.rivalCloser;
  const compared = won + lost + h.ties;
  if (compared === 0) {
    return {
      source,
      name,
      leader: "none",
      clear: false,
      headline: `Nothing to compare with ${name} yet`,
      points: [`We've both dated ${formatInt(h.shared)} of the same cases, and DOL hasn't decided any of them.`],
    };
  }
  const p = chanceOfSplit(won, lost);
  const clear = p !== null && p < CLEAR_P;
  const leader: RivalReading["leader"] = won > lost ? "ours" : lost > won ? "rival" : "even";
  const headline =
    leader === "even"
      ? `Even with ${name} so far`
      : leader === "ours"
        ? clear
          ? `We're ahead of ${name}`
          : `We lead ${name} so far, not clearly yet`
        : clear
          ? `${name} is ahead of us`
          : `${name} leads so far, not clearly yet`;

  const points: string[] = [];
  const waitingNote = h.settledWhileWaiting > 0
    ? `, counting ${formatInt(h.settledWhileWaiting)} still waiting past both dates, where the later date already wins`
    : "";
  points.push(
    `Of ${formatInt(compared)} cases we both dated that can be judged${waitingNote}: we were closer on ${formatInt(won)}, ${name} on ${formatInt(lost)}${h.ties ? `, ${formatInt(h.ties)} tied` : ""}.`,
  );
  if (h.oursTypicalDays !== null && h.rivalTypicalDays !== null) {
    points.push(
      `Typical miss on the ${formatInt(h.decided)} decided: us ${dayWord(h.oursTypicalDays)}, ${name} ${dayWord(h.rivalTypicalDays)}.`,
    );
  }
  if (p !== null && leader !== "even") {
    const hi = Math.max(won, lost);
    const lo = Math.min(won, lost);
    points.push(
      clear
        ? `${formatInt(hi)} to ${formatInt(lo)} is unlikely to be luck: fair coin flips split that unevenly ${chanceWords(p)}.`
        : `${formatInt(hi)} to ${formatInt(lo)} could still be luck: fair coin flips split at least that unevenly ${chanceWords(p)}.`,
    );
  }
  const theirs = h.rivalLateWaiting;
  const mine = h.oursLateWaiting;
  if (theirs !== undefined && mine !== undefined && theirs !== mine && Math.max(theirs, mine) >= 3) {
    const more = theirs > mine ? name : "We";
    const moreN = Math.max(theirs, mine);
    const lessN = Math.min(theirs, mine);
    const lessName = theirs > mine ? "ours" : `${name}'s`;
    const effect =
      theirs > mine
        ? leader === "rival"
          ? "so its lead can shrink"
          : "so our lead can grow"
        : leader === "ours"
          ? "so our lead can shrink"
          : `so ${name}'s lead can grow`;
    points.push(
      `${more === "We" ? "We have" : `${more} has`} ${formatInt(moreN)} ${moreN === 1 ? "date" : "dates"} on these cases already passed with no decision, against ${lessN === 0 ? `none of ${lessName}` : `${formatInt(lessN)} of ${lessName}`}. Each one becomes a miss of at least the days it's late once DOL decides, ${effect}.`,
    );
  }
  return { source, name, leader, clear, headline, points };
}

/** The weekly backtest's headline figures, as `scripts/backtest_queue.py` writes them. */
export interface BacktestFigures {
  t0: string;
  end: string;
  current: {
    decided: number;
    typicalMissDays: number | null;
    biasDays?: number | null;
    within7Share: number | null;
  } | null;
  rangeCoverage?: { judged: number; insideShare: number | null } | null;
}

/**
 * Which way a method leans: decided minus predicted, so negative means DOL
 * decided before the date given. Under 2 days either way reads as no lean.
 */
export function leanWords(biasDays: number | null): string | null {
  if (biasDays === null || Math.abs(biasDays) < 2) return null;
  return biasDays < 0
    ? `DOL usually decided about ${dayWord(-biasDays)} before the date given`
    : `DOL usually decided about ${dayWord(biasDays)} after the date given`;
}

/** The first day a prediction can settle: its date a full SETTLE_DAYS past. */
export function settlesFrom(since: string): string {
  return format(addDays(parseISO(since), SETTLE_DAYS + 1), "yyyy-MM-dd");
}

/**
 * What our own figures say, strongest evidence first: the backtest over
 * thousands of real decisions, then the daily sample, then what the sample
 * can't tell yet.
 */
export function readOurs(
  ours: Cell,
  byHorizon: Record<Horizon, Cell> | null,
  since: string | null,
  backtest: BacktestFigures | null,
): string[] {
  const out: string[] = [];
  const bt = backtest?.current ?? null;
  const sampleLean = ours.graded >= 10 ? leanWords(ours.biasDays) : null;
  const btLean = bt && bt.decided >= 100 ? leanWords(bt.biasDays ?? null) : null;
  if (bt && bt.typicalMissDays !== null) {
    out.push(
      `On ${formatInt(bt.decided)} real DOL decisions (the weekly backtest), our dates were typically ${dayWord(bt.typicalMissDays)} off${bt.within7Share !== null ? `, and ${Math.round(bt.within7Share * 100)}% landed within a week` : ""}.`,
    );
  }
  if (sampleLean && btLean && Math.sign(ours.biasDays!) === Math.sign(bt!.biasDays!)) {
    out.push(
      `Both checks say our dates run ${ours.biasDays! < 0 ? "late" : "early"}: in the backtest ${btLean}, and in the daily sample ${sampleLean.replace(/^DOL usually decided /, "")}.`,
    );
  } else if (btLean) {
    out.push(`In the backtest, ${btLean}.`);
  } else if (sampleLean) {
    out.push(`In the daily sample, ${sampleLean}.`);
  }
  // The backtest's range check covers thousands of cases; the sample's, dozens.
  const range = backtest?.rangeCoverage;
  const inside = range && range.insideShare !== null && range.judged >= 100
    ? { share: range.insideShare, n: range.judged }
    : ours.inBandShare !== null && ours.graded >= 10
      ? { share: ours.inBandShare, n: ours.graded }
      : null;
  if (inside && inside.share < 0.5) {
    out.push(
      `Only ${Math.round(inside.share * 100)}% of ${formatInt(inside.n)} decisions landed inside the range we printed, so the single date is the better guide.`,
    );
  }
  if (byHorizon) {
    const near = byHorizon["0-30"].graded;
    const far = HORIZONS.filter((h) => h !== "0-30").reduce((n, h) => n + byHorizon[h].graded, 0);
    if (ours.graded > 0 && near / ours.graded >= 0.8) {
      out.push(
        `${formatInt(near)} of our ${formatInt(ours.graded)} grades are for dates within a month${far ? `; ${formatInt(far)} ${far === 1 ? "is" : "are"} further out` : ""}. Dates a month or more ahead haven't come due, so the long-range test hasn't really started.`,
      );
    }
  }
  if (since && ours.settled === 0) {
    out.push(
      `The fair test, which counts a case still waiting a month past its date as a miss, begins about ${format(parseISO(settlesFrom(since)), "MMMM d")}.`,
    );
  }
  return out;
}

/**
 * The case page dates a case three ways, and "ours" in the scorecard is all of
 * them: whichever the page would have shown that day. Read together they hid
 * the finding that mattered (Oct 7 2026): the main method was typically 4 days
 * off, and DOL's published average, the fallback for cases the queue has just
 * passed, accounted for most of the grades and the worst misses.
 */
export const METHOD_NAME: Record<string, string> = {
  "decision-pace": "Our main method (cases ahead of yours, at DOL's measured pace)",
  "dol-average": "DOL's published average, which the case page shows for cases DOL's queue has just passed",
  stragglers: "The behind-the-queue rate, for cases the queue passed earlier",
  "queue-advance": "The queue's monthly advance",
};

/** One sentence per method with at least `min` grades, busiest first. */
export function readMethods(byModel: Record<string, Cell> | null | undefined, min = 3): string[] {
  if (!byModel) return [];
  return Object.entries(byModel)
    .filter(([, c]) => c.graded >= min && c.typicalMissDays !== null)
    .sort((a, b) => b[1].graded - a[1].graded)
    .map(([m, c]) => {
      const far = c.within14Share === null ? 0 : c.graded - Math.round(c.within14Share * c.graded);
      const lean = c.biasDays !== null && Math.abs(c.biasDays) >= 2
        ? `, and its dates run ${c.biasDays < 0 ? "late" : "early"}`
        : "";
      return `${METHOD_NAME[m] ?? m}: ${formatInt(c.graded)} graded, typically ${dayWord(c.typicalMissDays!)} off${far ? `, ${formatInt(far)} more than two weeks off` : ""}${lean}.`;
    });
}

/**
 * A letter for a typical miss, so a column of figures reads at a glance. The
 * scale is printed wherever a grade is: A within 3 days, B within a week, C
 * within two weeks, D within a month, F beyond.
 */
export function letterFor(days: number | null): "A" | "B" | "C" | "D" | "F" | null {
  if (days === null) return null;
  if (days <= 3) return "A";
  if (days <= 7) return "B";
  if (days <= 14) return "C";
  if (days <= 30) return "D";
  return "F";
}

export const GRADE_SCALE = "A within 3 days, B within a week, C within two weeks, D within a month, F beyond";

/** The miss a grade is given on: counting the late-and-waiting ones when the cell has them. */
export const gradedMiss = (c: Cell) => (c.missAtLeastDays ?? c.typicalMissDays);

/**
 * Priority dates: the site's pace against dividing by yearly visas, on the
 * same dates (scripts/backtest_bulletin.py, `supplyDivision`). The approach
 * is a rival's; its API is closed to scripts and its inputs can't be rebuilt,
 * so it is re-run on USCIS's inventory and Table V and named as an approach,
 * never as the rival's own figures.
 */
export interface SupplyGap {
  pace: { reached: number; readers: number; typicalMissMonths: number | null; stillWaitingPastEstimate: number };
  supply: { reached: number; typicalMissMonths: number | null; stillWaitingPastEstimate: number };
  closerWhenReached: { pace: number; supply: number; tie: number };
}

export interface SupplyDivision {
  tableVYear: number | null;
  inventoryReports: string[];
  byGap: Record<string, SupplyGap>;
}

export function parseSupplyDivision(json: string | null | undefined): SupplyDivision | null {
  if (!json) return null;
  try {
    const sd = (JSON.parse(json) as { supplyDivision?: SupplyDivision }).supplyDivision;
    return sd && sd.byGap && typeof sd.byGap === "object" ? sd : null;
  } catch {
    return null;
  }
}

const GAP_WORDS: Record<string, string> = { "90": "3 months", "180": "6 months", "365": "a year" };
const monthWord = (n: number) => `${n.toFixed(1)} ${n === 1 ? "month" : "months"}`;

export function readSupplyDivision(sd: SupplyDivision | null): string[] {
  if (!sd) return [];
  const reports = sd.inventoryReports.length;
  const out: string[] = [
    `Our "months until current" (the cutoff's past pace) against dividing the people ahead by the line's yearly green cards, the approach a rival uses, re-run on USCIS's ${formatInt(reports)} inventory ${reports === 1 ? "report" : "reports"} since ${sd.inventoryReports[0] ?? "-"} and Table V for ${sd.tableVYear ?? "-"}. Its own figures can't be fetched (its robots.txt closes the API) or rebuilt.`,
  ];
  for (const [gap, g] of Object.entries(sd.byGap)) {
    const words = GAP_WORDS[gap];
    if (!words) continue;
    const { pace, supply, tie } = g.closerWhenReached;
    if (pace + supply + tie === 0) {
      out.push(`Dates ${words} past the cutoff: none has come current yet.`);
      continue;
    }
    const p = chanceOfSplit(pace, supply);
    const luck = p === null ? "" : p < CLEAR_P
      ? ` That split is unlikely to be luck (${chanceWords(p)}).`
      : ` That could still be luck (${chanceWords(p)}).`;
    const misses = g.pace.typicalMissMonths !== null && g.supply.typicalMissMonths !== null
      ? ` Typical miss: the pace ${monthWord(g.pace.typicalMissMonths)}, the division ${monthWord(g.supply.typicalMissMonths)}.`
      : "";
    out.push(
      `Dates ${words} past the cutoff that came current (${formatInt(g.pace.reached)} of ${formatInt(g.pace.readers)}): the pace was closer on ${formatInt(pace)}, the division on ${formatInt(supply)}${tie ? `, ${formatInt(tie)} tied` : ""}.${luck}${misses} Still waiting past the estimate: ${formatInt(g.pace.stillWaitingPastEstimate)} by the pace, ${formatInt(g.supply.stillWaitingPastEstimate)} by the division; each becomes a miss once it comes current.`,
    );
  }
  return out;
}
