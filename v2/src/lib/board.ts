import { classifyMove, cutoffLabel, moveLabel, type MoveKind } from "@/lib/bulletinNext";
import { parseCutoff, type BulletinMonth, type CountryKey } from "@/lib/perm";
import { shiftMonth } from "@convex/lib/months";
import { DAYS_PER_MONTH } from "@convex/lib/time";

/**
 * The board's arithmetic, kept out of the database layer so it can be tested:
 * where in the filing calendar DOL's decisions on a day fell, whether a line
 * grew or shrank over a window, and how each status moved.
 *
 * Plain module (no server-only), like queueAhead.ts.
 */

/** Where the filing days of one day's decisions fell. */
export interface DecidedSpan {
  /** How many decisions the span is drawn from. */
  n: number;
  /** The middle decision's filing day. */
  middle: string;
  /** The 10th and 90th percentile filing days: stragglers and quick cases left out. */
  from: string;
  to: string;
}

/** Fewer decisions than this on a day say little about where DOL is. */
export const SPAN_MIN_DECISIONS = 50;

/**
 * The middle and the middle 80% of the filing days DOL decided on one day.
 *
 * DOL works a filing month in employer-name order, so one day's decisions
 * spread over most of a month; the middle of them moves steadily (Dec 19 on
 * Oct 19 2026 to Jan 13 on Oct 27). A single "day DOL is on" would be a
 * claim the data can't make, so the span is given with it.
 */
export function decidedSpan(filingDays: readonly string[]): DecidedSpan | null {
  const days = filingDays.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  const n = days.length;
  if (n < SPAN_MIN_DECISIONS) return null;
  const at = (q: number) => days[Math.min(n - 1, Math.max(0, Math.floor(q * (n - 1))))]!;
  return { n, middle: at(0.5), from: at(0.1), to: at(0.9) };
}

export type Trend = "growing" | "shrinking" | "level";

export interface LineFlow {
  /** Cases filed in the window, as our record holds them. */
  filed: number;
  /** Cases decided in the window (withdrawals included: they leave the line too). */
  decided: number;
  /** filed - decided: what the line gained (negative: lost) over the window. */
  change: number;
  trend: Trend;
}

/** Within this share of the window's decisions, the line is called level. */
export const LEVEL_SHARE = 0.03;

/** Whether a line grew or shrank: what came in against what went out. */
export function lineFlow(filed: number, decided: number): LineFlow {
  const change = filed - decided;
  const trend: Trend =
    Math.abs(change) <= Math.max(1, decided * LEVEL_SHARE) ? "level" : change > 0 ? "growing" : "shrinking";
  return { filed, decided, change, trend };
}

export interface StatusMove {
  status: string;
  /** Cases that moved into the status in the window (new filings included for the first stage). */
  in: number;
  /** Cases that moved out of it. */
  out: number;
  /** in - out. */
  net: number;
}

/**
 * Each status's moves over a window, from the event log's (from, to, count)
 * rows. New filings arrive as rows, not events, so the first stage takes them
 * as `newFilings`. Sorted by the size of the move, biggest first.
 */
export function statusMoves(
  transitions: readonly { from: string; to: string; n: number }[],
  firstStage: string,
  newFilings: number,
): StatusMove[] {
  const by = new Map<string, StatusMove>();
  const get = (s: string) => {
    const k = s.trim().toUpperCase();
    let m = by.get(k);
    if (!m) by.set(k, (m = { status: k, in: 0, out: 0, net: 0 }));
    return m;
  };
  for (const t of transitions) {
    if (!t.from || !t.to || t.from.trim().toUpperCase() === t.to.trim().toUpperCase()) continue;
    get(t.from).out += t.n;
    get(t.to).in += t.n;
  }
  if (newFilings > 0) get(firstStage).in += newFilings;
  for (const m of by.values()) m.net = m.in - m.out;
  return [...by.values()].sort((a, b) => Math.abs(b.net) - Math.abs(a.net) || a.status.localeCompare(b.status));
}

export interface BulletinMoveRow {
  category: string;
  cells: { country: CountryKey; latest: string; move: string; kind: MoveKind; movedDays: number | null }[];
}

/**
 * Each category and country's final-action cutoff in the newest bulletin and
 * how it moved from the bulletin before. A previous bulletin that isn't the
 * month right before says nothing about this month's move, so it's left blank.
 */
export function bulletinMoves(
  latest: BulletinMonth,
  previous: BulletinMonth | null,
  categories: readonly string[],
  countries: readonly CountryKey[],
): BulletinMoveRow[] {
  const prevOk = previous !== null && shiftMonth(latest.bulletinMonth, -1) === previous.bulletinMonth;
  return categories.map((category) => ({
    category,
    cells: countries.map((country) => {
      const now = parseCutoff(latest.finalAction[category]?.[country]);
      const m = prevOk
        ? classifyMove(parseCutoff(previous!.finalAction[category]?.[country]), now)
        : { kind: "unknown" as MoveKind, movedDays: null };
      // A cell that stays Current or Unavailable says "unchanged", not its own label twice.
      const move = m.kind === "current" || m.kind === "unavailable" ? "unchanged" : moveLabel(m.kind, m.movedDays);
      return { country, latest: cutoffLabel(now), move, kind: m.kind, movedDays: m.movedDays };
    }),
  }));
}

const DAY_MS = 86_400_000;
const dayNum = (iso: string) => Date.parse(`${iso}T12:00:00Z`) / DAY_MS;

/**
 * Where a day's decisions fell, drawn as a ruler that ends on the day DOL
 * decided them: positions as percentages of the ruler. Filed before the middle
 * reads as decided, from the middle to the decision day as still waiting.
 * The ruler starts a little before the span so its first part has room.
 */
export interface Ruler {
  start: string;
  middle: number;
  from: number;
  to: number;
  /** Days from the middle filing day to the decision day: what a decided case waited. */
  waitedDays: number;
  /** Month boundaries inside the ruler, as positions, for ticks. */
  ticks: number[];
}

export function rulerOf(span: DecidedSpan, decidedOn: string): Ruler | null {
  const end = dayNum(decidedOn);
  const from = dayNum(span.from);
  const mid = dayNum(span.middle);
  const to = dayNum(span.to);
  if (![end, from, mid, to].every(Number.isFinite) || !(mid <= end) || !(from <= to)) return null;
  const startDay = Math.round(from - Math.max(7, (end - from) * 0.15));
  const len = end - startDay;
  const pct = (d: number) => Math.min(100, Math.max(0, ((d - startDay) / len) * 100));
  const start = new Date(startDay * DAY_MS).toISOString().slice(0, 10);
  const ticks: number[] = [];
  const d = new Date(`${start.slice(0, 7)}-01T12:00:00Z`);
  for (d.setUTCMonth(d.getUTCMonth() + 1); dayNum(d.toISOString().slice(0, 10)) < end; d.setUTCMonth(d.getUTCMonth() + 1)) {
    ticks.push(pct(dayNum(d.toISOString().slice(0, 10))));
  }
  return { start, middle: pct(mid), from: pct(from), to: pct(to), waitedDays: Math.round(end - mid), ticks };
}

/** Past this many months a span reads in years ("about 34 years", never "about 405 months"). */
const YEARS_FROM_MONTHS = 24;

/** "about 3 months", "about 9½ months", "about 34 years": a span to the nearest half month, or half year past two. */
export function aboutMonths(days: number): string {
  const halves = Math.round(days / (DAYS_PER_MONTH / 2));
  if (halves < 2) return `about ${Math.max(1, Math.round(days))} days`;
  if (halves >= YEARS_FROM_MONTHS * 2) {
    const halfYears = Math.round(days / (DAYS_PER_MONTH * 6));
    return `about ${Math.floor(halfYears / 2)}${halfYears % 2 ? "½" : ""} years`;
  }
  const whole = Math.floor(halves / 2);
  return `about ${whole}${halves % 2 ? "½" : ""} month${halves === 2 ? "" : "s"}`;
}

/** The longest wait the board draws on one scale: a year, or longer when a wait runs past it, in whole quarters. */
export function waitScaleDays(waits: readonly number[]): number {
  const longest = Math.max(365, ...waits.filter((w) => Number.isFinite(w)));
  return Math.ceil(longest / 91.3) * 91.3;
}

/** A change and which way it went: forward or quicker is good, back or slower is bad. */
export interface Shift {
  text: string;
  tone: "good" | "bad" | "flat";
}

/** How far the middle decision's filing day moved since an earlier reading. */
export function positionShift(prevMiddle: string, middle: string, since: string): Shift | null {
  const d = Math.round(dayNum(middle) - dayNum(prevMiddle));
  if (!Number.isFinite(d)) return null;
  if (d === 0) return { text: `No move since ${since}`, tone: "flat" };
  const n = Math.abs(d);
  return d > 0
    ? { text: `Moved ${n} day${n === 1 ? "" : "s"} forward since ${since}`, tone: "good" }
    : { text: `Moved ${n} day${n === 1 ? "" : "s"} back since ${since}`, tone: "bad" };
}

/** A median against the one before it: shorter is quicker. */
export function medianShift(prev: number, now: number, prevLabel: string): Shift {
  const d = Math.round((now - prev) * 10) / 10;
  if (d === 0) return { text: `Same as ${prevLabel}`, tone: "flat" };
  const n = Math.abs(d);
  return d > 0
    ? { text: `${n} month${n === 1 ? "" : "s"} slower than ${prevLabel}`, tone: "bad" }
    : { text: `${n} month${n === 1 ? "" : "s"} quicker than ${prevLabel}`, tone: "good" };
}

/** A bulletin cell's move from the month before, in words with its direction. */
export function bulletinShift(kind: MoveKind, movedDays: number | null, month: string): Shift | null {
  const n = Math.abs(movedDays ?? 0);
  switch (kind) {
    case "advanced": return { text: `Moved ${n} days forward in ${month}`, tone: "good" };
    case "went-current": return { text: `Became current in ${month}`, tone: "good" };
    case "opened": return { text: `Reopened in ${month}`, tone: "good" };
    case "retrogressed": return { text: `Moved ${n} days back in ${month}`, tone: "bad" };
    case "retrogressed-from-current": return { text: `A cutoff returned in ${month}`, tone: "bad" };
    case "shut": return { text: `Became unavailable in ${month}`, tone: "bad" };
    case "held":
    case "current":
    case "unavailable": return { text: `No move in ${month}`, tone: "flat" };
    default: return null;
  }
}

/** A step's state in a word or two, the way a status board says it. */
export interface StepStatus {
  /** Which state, for its picture. */
  kind: "shrinking" | "growing" | "level" | "quicker" | "slower" | "steady" | "advancing" | "retrogressed" | "holding";
  word: string;
  /** The figure behind the word. */
  detail?: string;
  tone: "good" | "warn" | "bad" | "flat";
}

const fmt = (n: number) => Math.abs(n).toLocaleString("en-US");

/** Whether a line shrank or grew over the window: what came in against what went out. */
export function backlogStatus(flow: LineFlow, days = 30): StepStatus {
  if (flow.trend === "level") return { kind: "level", word: "Backlog level", detail: `Even over ${days} days`, tone: "flat" };
  return flow.trend === "shrinking"
    ? { kind: "shrinking", word: "Backlog shrinking", detail: `${fmt(flow.change)} fewer in ${days} days`, tone: "good" }
    : { kind: "growing", word: "Backlog growing", detail: `${fmt(flow.change)} more in ${days} days`, tone: "warn" };
}

/** A median against the one before it, in a word. */
export function paceStatus(prev: number, now: number): StepStatus {
  const d = Math.round((now - prev) * 10) / 10;
  if (d === 0) return { kind: "steady", word: "Holding steady", tone: "flat" };
  return d < 0 ? { kind: "quicker", word: "Getting quicker", tone: "good" } : { kind: "slower", word: "Getting slower", tone: "bad" };
}

/** A bulletin cell's move, in a word: forward is advancing, back is retrogression. */
export function bulletinStatus(kind: MoveKind): StepStatus | null {
  switch (kind) {
    case "advanced":
    case "went-current":
    case "opened":
      return { kind: "advancing", word: "Advancing", tone: "good" };
    case "retrogressed":
    case "retrogressed-from-current":
    case "shut":
      return { kind: "retrogressed", word: "Retrogressed", tone: "bad" };
    case "held":
    case "current":
    case "unavailable":
      return { kind: "holding", word: "Holding", tone: "flat" };
    default:
      return null;
  }
}

/** How far back the board reads a step's pace and the change in its wait. */
export const WEEK_DAYS = 7;
export const MONTH_DAYS = 30;

/** One reading of a step: the day DOL decided, and where that day's decisions fell. */
export interface SpanReading {
  day: string;
  span: DecidedSpan | null;
}

/** A step's wait now, how fast DOL moves through filing days, and how the wait changed. */
export interface PaceReading {
  /** Days the middle decision on the newest day had waited. */
  waitDays: number;
  /** Filing days DOL moved through per calendar day since the earlier reading; 1 holds the wait level. */
  perDay: number | null;
  /** The wait now less the wait then, in days: negative is shorter. */
  waitChange: number | null;
  /** The earlier reading's day. */
  since: string | null;
}

/** Filing days moved per calendar day, to one decimal place. */
const PER_DAY_PLACES = 10;

/** The step's pace and wait from two readings a month apart; nothing without the newest span. */
export function paceReading(now: SpanReading, then: SpanReading | null): PaceReading | null {
  if (!now.span) return null;
  const waitDays = Math.round(dayNum(now.day) - dayNum(now.span.middle));
  if (!Number.isFinite(waitDays)) return null;
  if (!then?.span) return { waitDays, perDay: null, waitChange: null, since: null };
  const elapsed = dayNum(now.day) - dayNum(then.day);
  const moved = dayNum(now.span.middle) - dayNum(then.span.middle);
  const waitThen = Math.round(dayNum(then.day) - dayNum(then.span.middle));
  return {
    waitDays,
    perDay: elapsed > 0 ? Math.round((moved / elapsed) * PER_DAY_PLACES) / PER_DAY_PLACES : null,
    waitChange: waitDays - waitThen,
    since: then.day,
  };
}

/** The reading in three short lines, for the step's fold. `since` is the earlier day as words. */
export function paceFacts(r: PaceReading, since: string | null): string[] {
  const out = [`Waited ${r.waitDays.toLocaleString("en-US")} days, filed to decided`];
  if (r.perDay !== null && since) {
    out.push(`DOL moved through ${r.perDay} filing day${r.perDay === 1 ? "" : "s"} a day since ${since}; at 1 the wait holds level`);
  }
  if (r.waitChange !== null && since) {
    const n = Math.abs(r.waitChange);
    out.push(
      r.waitChange === 0
        ? `The same wait as on ${since}`
        : `${n} day${n === 1 ? "" : "s"} ${r.waitChange > 0 ? "longer" : "shorter"} than on ${since}`,
    );
  }
  return out;
}

/** A bulletin line's measured pace (cutoff months gained per calendar month), in words for the step's fold. */
export function cutoffPaceFact(pace: number | null): string | null {
  if (pace === null || !Number.isFinite(pace)) return null;
  const r = Math.round(pace * PER_DAY_PLACES) / PER_DAY_PLACES;
  return `The cutoff has gained ${r} month${r === 1 ? "" : "s"} a month; at 1 the wait holds level, under 1 it grows`;
}
