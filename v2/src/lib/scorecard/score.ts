/**
 * Grading recorded predictions, and summarising the grades.
 *
 * WHY A SAMPLE AND NOT HAND-PICKED CASES (2026-09-26). The scorecard used to
 * grade five cases somebody chose. Two had been decided, from two different
 * models, and the page printed their median as "the" miss. A daily random
 * sample across every filing month, recorded before the outcome and graded
 * when DOL decides, is the only version of this that can't be cherry-picked.
 *
 * SURVIVORSHIP IS THE TRAP. Grading only the cases already decided favours
 * whichever predictions called an EARLY decision, because those resolve first.
 * So besides the error on decided cases, every summary carries a "settled"
 * figure: of the predictions whose date passed more than `SETTLE_DAYS` ago,
 * how many were decided within that many days of it. A case still pending
 * then counts as a miss, which is what it is.
 *
 * AND A CASE STILL PENDING PAST ITS DATE IS ALREADY LATE (2026-10-03). On
 * Oct 13 a case predicted for Oct 10 and not yet decided is at least 3 days
 * off, and that only grows. `missAtLeastDays` and `biasAtLeastDays` count every
 * such case at the days it is already late, beside the decided ones. Each of
 * those can only move further out, so the medians are floors: the method is
 * at least this far off, whatever DOL does next.
 *
 * Plain module, pure functions, so the unit project tests every rule.
 */

import { daysBetween } from "@/lib/time";

/**
 * `watched` is the date a subscriber's own case page showed, recorded once per
 * case (predictWatched). It is ours, kept apart from the random sample so the
 * two can't be mixed, and it is never a rival in the head-to-head.
 */
export type Source = "ours" | "watched" | "rival-a" | "rival-b" | "rival-c";

export type Program = "perm" | "pwd" | "seasonal" | "bulletin";

export interface PredictionRow {
  source: Source;
  program: Program;
  model: string;
  recordedOn: string;
  predicted: string;
  bandEarly: string | null;
  bandLate: string | null;
  /** First day the sweep saw the case final, `YYYY-MM-DD` (Eastern). */
  decidedOn: string | null;
  /** The final status word, when decided. */
  outcome: string | null;
}

/** Days after a predicted date before an undecided case counts as a miss. */
export const SETTLE_DAYS = 30;

/**
 * The wage-request estimate's method names. Predictions recorded before Oct 3
 * 2026 counted the wait from the month a request was received instead of from
 * DOL's own count date, which put most of them in the past; they were
 * relabelled PWD_BEFORE_FIX in the table (kept, never deleted) and the page
 * grades only PWD_MODEL.
 */
export const PWD_MODEL = "pwd-queue";
export const PWD_BEFORE_FIX = "pwd-queue-request-month";
/**
 * The wage-request DAY (Oct 8 2026): requests in process filed earlier, over
 * DOL's measured pace (estimatePwdDay). The page shows it wherever the sweep's
 * count is fresh, so the sample records it there and the month elsewhere.
 */
export const PWD_DAY_MODEL = "pwd-day";

export type Horizon = "0-30" | "31-90" | "91-180" | "181+";
export const HORIZONS: readonly Horizon[] = ["0-30", "31-90", "91-180", "181+"];

/** How far ahead the prediction reached, from the day it was recorded. */
export function horizonOf(recordedOn: string, predicted: string): Horizon {
  const d = daysBetween(recordedOn, predicted);
  if (d <= 30) return "0-30";
  if (d <= 90) return "31-90";
  if (d <= 180) return "91-180";
  return "181+";
}

/**
 * A withdrawal is not a decision on DOL's clock. The employer pulled the case,
 * often within days of filing, and scoring it would reward any model that
 * guessed early. Recorded, never graded.
 */
export function isGradedOutcome(outcome: string | null, program: Program = "perm"): boolean {
  if (!outcome) return false;
  if (/WITHDRAWN/i.test(outcome)) return false;
  // H-2A, H-2B and CW-1 are graded on certifications only, like for like with
  // the panel, which dates them from DOL's past certifications ("Half of the
  // applications DOL certified..."). A rejection or denial runs on its own
  // notices and is recorded, not graded.
  if (program === "seasonal") return /CERTIFICATION/i.test(outcome);
  return true;
}

export interface Grade {
  /** decided minus predicted: positive means DOL decided LATER than predicted. */
  errorDays: number;
  /** Null when the prediction carried no band. */
  inBand: boolean | null;
}

export function grade(row: Pick<PredictionRow, "predicted" | "bandEarly" | "bandLate">, decidedOn: string): Grade {
  const errorDays = daysBetween(row.predicted, decidedOn);
  const inBand =
    row.bandEarly && row.bandLate
      ? decidedOn >= row.bandEarly && decidedOn <= row.bandLate
      : null;
  return { errorDays, inBand };
}

const median = (xs: number[]): number | null => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : Math.round((s[m - 1]! + s[m]!) / 2);
};

export interface Cell {
  recorded: number;
  graded: number;
  /** Median of |decided - predicted| over graded cases. */
  typicalMissDays: number | null;
  /** Median of decided - predicted: positive = decided later than predicted. */
  biasDays: number | null;
  /** Share of graded cases decided inside the band, when bands exist. */
  inBandShare: number | null;
  /** Share of graded cases within 14 days either way. */
  within14Share: number | null;
  /** Predictions whose date passed more than SETTLE_DAYS ago. */
  settled: number;
  /** Of those, decided within SETTLE_DAYS of the date (pending counts as a miss). */
  settledHitShare: number | null;
  /** Past their date and still pending (withdrawals left out). */
  overdue: number;
  /** Median days those are past their date so far. */
  overdueDays: number | null;
  /** Median |miss| with each overdue case at the days it is already late: a floor. */
  missAtLeastDays: number | null;
  /** Median signed miss counted the same way: a floor on how late the method runs. */
  biasAtLeastDays: number | null;
}

export function summariseCell(rows: readonly PredictionRow[], today: string): Cell {
  const graded = rows.filter((r) => r.decidedOn && isGradedOutcome(r.outcome, r.program));
  const errs = graded.map((r) => grade(r, r.decidedOn!).errorDays);
  const banded = graded.filter((r) => r.bandEarly && r.bandLate);
  const inBand = banded.filter((r) => grade(r, r.decidedOn!).inBand).length;
  const settledRows = rows.filter(
    (r) => daysBetween(r.predicted, today) > SETTLE_DAYS && !(r.outcome && !isGradedOutcome(r.outcome, r.program)),
  );
  const hits = settledRows.filter(
    (r) => r.decidedOn && Math.abs(daysBetween(r.predicted, r.decidedOn)) <= SETTLE_DAYS,
  ).length;
  const lateSoFar = rows
    .filter((r) => !r.decidedOn && daysBetween(r.predicted, today) > 0)
    .map((r) => daysBetween(r.predicted, today));
  const withLate = [...errs, ...lateSoFar];
  return {
    recorded: rows.length,
    graded: graded.length,
    typicalMissDays: median(errs.map(Math.abs)),
    biasDays: median(errs),
    inBandShare: banded.length ? inBand / banded.length : null,
    within14Share: graded.length ? errs.filter((e) => Math.abs(e) <= 14).length / graded.length : null,
    settled: settledRows.length,
    settledHitShare: settledRows.length ? hits / settledRows.length : null,
    overdue: lateSoFar.length,
    overdueDays: median(lateSoFar),
    missAtLeastDays: median(withLate.map(Math.abs)),
    biasAtLeastDays: median(withLate),
  };
}

export interface Summary {
  computedOn: string;
  /** Oldest recording day, so the page can say how long this has been running. */
  since: string | null;
  bySource: Record<string, {
    all: Cell;
    byModel: Record<string, Cell>;
    byHorizon: Record<Horizon, Cell>;
  }>;
}

export function summarise(rows: readonly PredictionRow[], today: string, program: Program = "perm"): Summary {
  const mine = rows.filter((r) => r.program === program);
  const since = mine.reduce<string | null>((a, r) => (a === null || r.recordedOn < a ? r.recordedOn : a), null);
  const bySource: Summary["bySource"] = {};
  const sources = [...new Set(mine.map((r) => r.source))].sort();
  for (const src of sources) {
    const s = mine.filter((r) => r.source === src);
    const byModel: Record<string, Cell> = {};
    for (const m of [...new Set(s.map((r) => r.model))].sort()) {
      byModel[m] = summariseCell(s.filter((r) => r.model === m), today);
    }
    const byHorizon = Object.fromEntries(
      HORIZONS.map((h) => [h, summariseCell(s.filter((r) => horizonOf(r.recordedOn, r.predicted) === h), today)]),
    ) as Record<Horizon, Cell>;
    bySource[src] = { all: summariseCell(s, today), byModel, byHorizon };
  }
  return { computedOn: today, since, bySource };
}

/** One rival against ours, on the cases both predicted the same day. */
export interface HeadToHead {
  /** Cases both predicted on the same day. */
  shared: number;
  /** Of those, decided (withdrawals left out). */
  decided: number;
  /** Median |miss| on the decided shared cases, each side. */
  oursTypicalDays: number | null;
  rivalTypicalDays: number | null;
  /** Shared cases each side was closer on, decided or already settled. */
  oursCloser: number;
  rivalCloser: number;
  ties: number;
  /** Still waiting past BOTH dates: the later prediction is already the closer one. */
  settledWhileWaiting: number;
  /**
   * Shared cases still waiting past each side's own date (Oct 7 2026; older
   * docs lack them). A side with many is being flattered by grading only the
   * decided cases, since each of these becomes a miss of at least the days
   * it is already late.
   */
  oursLateWaiting?: number;
  rivalLateWaiting?: number;
  /**
   * A floor on each side's miss over the same cases (Oct 8 2026; older docs
   * lack them): every decided case at its miss, and every case still waiting
   * past at least one side's date at the days each side is late so far (0 if
   * that side's date is still ahead). Waiting cases only get later, so these
   * can only rise.
   */
  floorCases?: number;
  oursAtLeastDays?: number | null;
  rivalAtLeastDays?: number | null;
  /** The same comparison split by the kind of case our method dated (Oct 8 2026). */
  byKind?: Partial<Record<CaseKind, HeadToHead>>;
}

/**
 * What kind of case our date was for, read from the method that dated it:
 * a case in DOL's ordinary line (`working`), one whose filing month DOL's
 * queue had already passed (`passed`), or one at a request for information.
 * They differ in how hard they are to date, and a rival can lead on one kind
 * while trailing on the other, so the head-to-head is read for each.
 */
export type CaseKind = "working" | "passed" | "rfi";
export const CASE_KINDS: readonly CaseKind[] = ["working", "passed", "rfi"];
const PASSED_MODELS = new Set(["stragglers", "dol-average"]);
export function caseKindOf(model: string): CaseKind {
  if (PASSED_MODELS.has(model)) return "passed";
  if (model === "rfi-clock") return "rfi";
  return "working";
}

/** Day number of an ISO date, for midpoint arithmetic. */
const dayNumber = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);

/**
 * Who is closer on a case still waiting, if that is already decided.
 *
 * DOL can only decide today or later. Once today is past the midpoint of the
 * two dates, any such day is nearer the later date, so the later one has won
 * whatever happens; on the midpoint itself a decision today would tie. Before
 * that the earlier date can still be the closer one, and the case waits.
 */
function settledWinner(ours: string, rival: string, today: string): "ours" | "rival" | "tie" | null {
  if (ours === rival) return dayNumber(today) > dayNumber(ours) ? "tie" : null;
  const t = dayNumber(today) * 2;
  if (t <= dayNumber(ours) + dayNumber(rival)) return null;
  return ours > rival ? "ours" : "rival";
}

function emptyHeadToHead(): HeadToHead {
  return {
    shared: 0, decided: 0, oursTypicalDays: null, rivalTypicalDays: null,
    oursCloser: 0, rivalCloser: 0, ties: 0, settledWhileWaiting: 0,
    oursLateWaiting: 0, rivalLateWaiting: 0,
    floorCases: 0, oursAtLeastDays: null, rivalAtLeastDays: null,
  };
}

/** One side's comparison over a list of paired cases. */
function compare(pairs: readonly [PredictionRow, PredictionRow][], today: string): HeadToHead {
  const h = emptyHeadToHead();
  const oursErr: number[] = [];
  const rivalErr: number[] = [];
  const oursFloor: number[] = [];
  const rivalFloor: number[] = [];
  for (const [o, r] of pairs) {
    h.shared += 1;
    if (r.decidedOn && !isGradedOutcome(r.outcome)) continue;
    if (r.decidedOn) {
      h.decided += 1;
      const eo = Math.abs(daysBetween(o.predicted, r.decidedOn));
      const er = Math.abs(daysBetween(r.predicted, r.decidedOn));
      oursErr.push(eo);
      rivalErr.push(er);
      oursFloor.push(eo);
      rivalFloor.push(er);
      if (eo < er) h.oursCloser += 1;
      else if (er < eo) h.rivalCloser += 1;
      else h.ties += 1;
      continue;
    }
    const oursLate = o.predicted < today;
    const rivalLate = r.predicted < today;
    if (oursLate) h.oursLateWaiting! += 1;
    if (rivalLate) h.rivalLateWaiting! += 1;
    if (oursLate || rivalLate) {
      oursFloor.push(Math.max(0, daysBetween(o.predicted, today)));
      rivalFloor.push(Math.max(0, daysBetween(r.predicted, today)));
    }
    const won = settledWinner(o.predicted, r.predicted, today);
    if (!won) continue;
    h.settledWhileWaiting += 1;
    if (won === "ours") h.oursCloser += 1;
    else if (won === "rival") h.rivalCloser += 1;
    else h.ties += 1;
  }
  h.oursTypicalDays = median(oursErr);
  h.rivalTypicalDays = median(rivalErr);
  h.floorCases = oursFloor.length;
  h.oursAtLeastDays = median(oursFloor);
  h.rivalAtLeastDays = median(rivalFloor);
  return h;
}

/**
 * Ours against each rival on exactly the same cases, so neither side's figure
 * comes from an easier sample.
 *
 * A case still waiting is counted for the side it can no longer lose to (see
 * settledWinner): grading only the decided cases would favour whoever dates
 * cases sooner, because early decisions arrive first.
 */
export function headToHead(
  rows: readonly (PredictionRow & { caseNumber: string })[],
  today: string,
): Record<string, HeadToHead> {
  const key = (r: { recordedOn: string; caseNumber: string }) => `${r.recordedOn}|${r.caseNumber}`;
  const ours = new Map<string, PredictionRow & { caseNumber: string }>();
  for (const r of rows) if (r.source === "ours" && r.program === "perm") ours.set(key(r), r);
  const out: Record<string, HeadToHead> = {};
  for (const src of [...new Set(rows.filter((r) => r.source !== "ours" && r.source !== "watched").map((r) => r.source))].sort()) {
    const pairs: [PredictionRow, PredictionRow][] = [];
    for (const r of rows) {
      if (r.source !== src || r.program !== "perm") continue;
      const o = ours.get(key(r));
      if (o) pairs.push([o, r]);
    }
    const h = compare(pairs, today);
    const byKind: Partial<Record<CaseKind, HeadToHead>> = {};
    for (const kind of CASE_KINDS) {
      const these = pairs.filter(([o]) => caseKindOf(o.model) === kind);
      if (these.length) byKind[kind] = compare(these, today);
    }
    h.byKind = byKind;
    out[src] = h;
  }
  return out;
}

/** A small, seeded generator, so a day's sample can be reproduced from its date. */
export function rngFor(seedText: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seedText.length; i++) {
    h ^= seedText.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Up to `k` distinct items, uniformly, without replacement. */
export function pick<T>(items: readonly T[], k: number, rng: () => number): T[] {
  const a = [...items];
  const n = Math.min(k, a.length);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (a.length - i));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a.slice(0, n);
}
