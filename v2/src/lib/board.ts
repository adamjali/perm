import { classifyMove, cutoffLabel, moveLabel, type MoveKind } from "@/lib/bulletinNext";
import { parseCutoff, type BulletinMonth, type CountryKey } from "@/lib/perm";
import { shiftMonth } from "@convex/lib/months";

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

/** "about 3 months", "about 9½ months": days as months to the nearest half. */
export function aboutMonths(days: number): string {
  const halves = Math.round(days / 15.2);
  if (halves < 2) return `about ${Math.max(1, Math.round(days))} days`;
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
