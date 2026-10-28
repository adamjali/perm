import "server-only";

import { cache } from "react";

import {
  decidedSpan,
  lineFlow,
  MONTH_DAYS,
  SPAN_MIN_DECISIONS,
  statusMoves,
  WEEK_DAYS,
  type DecidedSpan,
  type LineFlow,
  type SpanReading,
  type StatusMove,
} from "@/lib/board";
import { dolDayBounds, dolDayOf } from "@/lib/dolDay";
import { MS_PER_DAY } from "@/lib/time";

import { exec, rows } from "./client";
import { OBSERVED_SOURCE } from "./decisionPace";
import { doc } from "./publicData";
import { DIRECT_EVENT_SOURCE } from "./rfi";
import { getSweepCoverage } from "./sweepCoverage";

/**
 * The PERM half of the board (/today): where DOL's decisions fell on its last
 * working day and on the working days a week and a month before it, whether the
 * line grew over 30 days, and how each status moved.
 *
 * Every read is bounded by a date range on an indexed column. The sweep's own refresh call
 * (/api/revalidate-sweep, after every pass) runs them once and saves the result as
 * perm_docs['board']; /today and the planner read that, and run the reads live only when it's
 * missing or older than the newest sweep. A read that fails throws: the page keeps its last
 * good render rather than showing an empty board as a quiet day.
 */

export interface PermBoard {
  /** DOL's last working day our record holds whole, `YYYY-MM-DD`. */
  day: string;
  /** Where that day's decisions out of analyst review fell, withdrawals left out. */
  span: DecidedSpan | null;
  /** The 30 days ending that day: filed against decided. */
  flow: LineFlow & { from: string; to: string };
  /** Each status's moves over the last working day and the 7 days ending it. */
  movesDay: StatusMove[];
  movesWeek: StatusMove[];
  /** The same reading on DOL's working day 7 or more days before. */
  weekBefore: SpanReading | null;
  /** And 30 or more days before: the step's pace and the change in its wait. */
  monthBefore: SpanReading | null;
}

const isoMinus = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T12:00:00Z`) - days * MS_PER_DAY).toISOString().slice(0, 10);

/** The (from, to, count) moves in an instant range, the sweep's own events only. */
async function movesBetween(lo: number, hi: number): Promise<{ from: string; to: string; n: number }[]> {
  const r = await rows<{ f: string; t: string; n: number }>(
    `SELECT from_status AS f, to_status AS t, COUNT(*) AS n FROM perm_case_events
      WHERE changed_at >= ? AND changed_at < ? AND source = ? GROUP BY from_status, to_status`,
    [lo, hi, DIRECT_EVENT_SOURCE],
  );
  return r.map((x) => ({ from: String(x.f ?? ""), to: String(x.t ?? ""), n: Number(x.n) || 0 }));
}

async function filedBetween(from: string, to: string): Promise<number> {
  const r = await rows<{ n: number }>(
    // is_final named so the read seeks case_status_final (is_final, filing_date)
    // twice instead of walking all of it (measured: a 444,000-entry scan).
    "SELECT COUNT(*) AS n FROM perm_case_status WHERE is_final IN (0, 1) AND filing_date >= ? AND filing_date <= ?",
    [from, to],
  );
  return Number(r[0]?.n) || 0;
}

/** Where one DOL day's PERM decisions out of analyst review fell, withdrawals left out. */
async function permSpanOn(day: string): Promise<DecidedSpan | null> {
  const bounds = dolDayBounds(day);
  if (!bounds) return null;
  const r = await rows<{ f: string }>(
    `SELECT s.filing_date AS f FROM perm_case_events e JOIN perm_case_status s ON s.case_number = e.case_number
      WHERE e.changed_at >= ? AND e.changed_at < ? AND e.source = ? AND e.to_final = 1
        AND e.from_status = 'ANALYST REVIEW' AND e.to_status <> 'WITHDRAWN' AND s.filing_date IS NOT NULL`,
    [bounds.lo, bounds.hi, DIRECT_EVENT_SOURCE],
  );
  return decidedSpan(r.map((x) => String(x.f)));
}

/** The newest worked day at least `days` before `day`, from a list of worked days newest first. */
export function dayBeforeOf(day: string, worked: readonly string[], days: number): string | null {
  const limit = isoMinus(day, days);
  return worked.find((d) => d <= limit) ?? null;
}

/** A reading on an earlier day, or none when the record holds no worked day that far back. */
const readingOn = async (day: string | null, spanOn: (d: string) => Promise<DecidedSpan | null>): Promise<SpanReading | null> =>
  day ? { day, span: await spanOn(day) } : null;

async function readPermBoard(): Promise<PermBoard | null> {
  // The newest 40 days of the daily series: its last row is DOL's last
  // working day our record holds whole (the day in progress is withheld).
  const series = await rows<{ date: string; total: number }>(
    "SELECT date, total FROM daily_decisions WHERE source = ? ORDER BY date DESC LIMIT 40",
    [OBSERVED_SOURCE],
  );
  const worked = series.filter((d) => Number(d.total) > 0);
  const last = worked[0];
  if (!last) return null;
  const day = String(last.date);
  const bounds = dolDayBounds(day);
  if (!bounds) return null;

  const from30 = isoMinus(day, 29);
  const week = dolDayBounds(isoMinus(day, 6));
  // An earlier reading needs a day with enough decisions to draw its span: a Saturday's
  // stragglers would read as nothing.
  const workedDays = worked.filter((d) => Number(d.total) >= SPAN_MIN_DECISIONS).map((d) => String(d.date));
  const [span, weekBefore, monthBefore, filed30, movesDay, movesWeek, filedDay, filedWeek] = await Promise.all([
    permSpanOn(day),
    readingOn(dayBeforeOf(day, workedDays, WEEK_DAYS), permSpanOn),
    readingOn(dayBeforeOf(day, workedDays, MONTH_DAYS), permSpanOn),
    filedBetween(from30, day),
    movesBetween(bounds.lo, bounds.hi),
    week ? movesBetween(week.lo, bounds.hi) : Promise.resolve([]),
    filedBetween(day, day),
    filedBetween(isoMinus(day, 6), day),
  ]);
  const decided30 = series
    .filter((d) => String(d.date) >= from30 && String(d.date) <= day)
    .reduce((a, d) => a + (Number(d.total) || 0), 0);
  return {
    day,
    span,
    flow: { ...lineFlow(filed30, decided30), from: from30, to: day },
    movesDay: statusMoves(movesDay, "ANALYST REVIEW", filedDay),
    movesWeek: statusMoves(movesWeek, "ANALYST REVIEW", filedWeek),
    weekBefore,
    monthBefore,
  };
}

// ---------------------------------------------------------------------------
// The wage-request half: PERM wage requests (P-100, the PERM visa class).
// ---------------------------------------------------------------------------

/** PERM wage requests: the P-100 office, visa class PERM or not yet stated. */
const PWD_RANGE = ["P-100-", "P-100."] as const;
const PERM_WAGE = "(s.visa_type IS NULL OR upper(s.visa_type) = 'PERM')";

export interface PwdBoard {
  /** DOL's last working day with determinations in our record, `YYYY-MM-DD`. */
  day: string;
  span: DecidedSpan | null;
  flow: LineFlow & { from: string; to: string };
  /** The same reading a week and a month earlier. */
  weekBefore: SpanReading | null;
  monthBefore: SpanReading | null;
}

/** Where one DOL day's PERM wage determinations fell, withdrawals left out. */
async function pwdSpanOn(day: string): Promise<DecidedSpan | null> {
  const bounds = dolDayBounds(day);
  if (!bounds) return null;
  const r = await rows<{ f: string }>(
    `SELECT s.filing_date AS f FROM pwd_case_events e INDEXED BY pwd_events_recent
       JOIN pwd_case_status s ON s.case_number = e.case_number
      WHERE e.changed_at >= ? AND e.changed_at < ? AND e.case_number >= ? AND e.case_number < ? AND e.to_final = 1
        AND e.from_status = 'IN PROCESS' AND e.to_status <> 'WITHDRAWN' AND ${PERM_WAGE} AND s.filing_date IS NOT NULL`,
    [bounds.lo, bounds.hi, ...PWD_RANGE],
  );
  return decidedSpan(r.map((x) => String(x.f)));
}

async function readPwdBoard(): Promise<PwdBoard | null> {
  const since = Date.now() - 40 * MS_PER_DAY;
  // One row per sweep stamp (a run writes one), folded into DOL's days.
  const stamps = await rows<{ t: number; n: number }>(
    // INDEXED BY: without statistics SQLite took the case-number range and
    // walked every wage request's events ever recorded.
    `SELECT e.changed_at AS t, COUNT(*) AS n FROM pwd_case_events e INDEXED BY pwd_events_recent
       JOIN pwd_case_status s ON s.case_number = e.case_number
      WHERE e.changed_at >= ? AND e.case_number >= ? AND e.case_number < ? AND e.to_final = 1
        AND e.from_status = 'IN PROCESS' AND ${PERM_WAGE} GROUP BY e.changed_at`,
    [since, ...PWD_RANGE],
  );
  const byDay = new Map<string, number>();
  for (const s of stamps) {
    const d = dolDayOf(Number(s.t));
    byDay.set(d, (byDay.get(d) ?? 0) + (Number(s.n) || 0));
  }
  // The day in progress is withheld: its overnight batch hasn't landed.
  const today = dolDayOf(Date.now());
  const worked = [...byDay].filter(([d, n]) => d < today && n > 0).sort(([a], [b]) => (a < b ? 1 : -1));
  const last = worked[0];
  if (!last) return null;
  const [day] = last;
  const from30 = isoMinus(day, 29);
  const workedDays = worked.filter(([, n]) => n >= SPAN_MIN_DECISIONS).map(([d]) => d);
  const [span, weekBefore, monthBefore, filed] = await Promise.all([
    pwdSpanOn(day),
    readingOn(dayBeforeOf(day, workedDays, WEEK_DAYS), pwdSpanOn),
    readingOn(dayBeforeOf(day, workedDays, MONTH_DAYS), pwdSpanOn),
    rows<{ n: number }>(
      `SELECT COUNT(*) AS n FROM pwd_case_status s INDEXED BY pwd_case_status_filed
        WHERE s.case_number >= ? AND s.case_number < ? AND s.filing_date >= ? AND s.filing_date <= ? AND ${PERM_WAGE}`,
      [...PWD_RANGE, from30, day],
    ),
  ]);
  const determined30 = [...byDay].filter(([d]) => d >= from30 && d <= day).reduce((a, [, n]) => a + n, 0);
  return {
    day,
    span,
    flow: { ...lineFlow(Number(filed[0]?.n) || 0, determined30), from: from30, to: day },
    weekBefore,
    monthBefore,
  };
}

// ---------------------------------------------------------------------------
// The saved board: written once a sweep, read by every page that shows it.
// ---------------------------------------------------------------------------

export const BOARD_DOC = "board";

export interface BoardDoc {
  perm: PermBoard | null;
  pwd: PwdBoard | null;
  /** When it was written, epoch ms (perm_docs.computed_at). */
  computedAt: number;
}

/** Runs the board's reads and saves the result. Called by the sweep's refresh, once a pass. */
export async function writeBoardDoc(): Promise<BoardDoc> {
  const [perm, pwd] = await Promise.all([readPermBoard(), readPwdBoard()]);
  const computedAt = Date.now();
  await exec("INSERT OR REPLACE INTO perm_docs (key, json, computed_at) VALUES (?, ?, ?)", [
    BOARD_DOC,
    JSON.stringify({ perm, pwd }),
    computedAt,
  ]);
  return { perm, pwd, computedAt };
}

/** The saved board, or null when it's missing or older than the newest sweep (its write failed or hasn't run). */
const savedBoard = cache(async (): Promise<BoardDoc | null> => {
  const [saved, coverage] = await Promise.all([doc<BoardDoc>(BOARD_DOC), getSweepCoverage()]);
  if (!saved) return null;
  return coverage && saved.computedAt < coverage.checkedAt ? null : saved;
});

export const getPermBoard = cache(async (): Promise<PermBoard | null> => {
  const saved = await savedBoard();
  return saved ? saved.perm : readPermBoard();
});

export const getPwdBoard = cache(async (): Promise<PwdBoard | null> => {
  const saved = await savedBoard();
  return saved ? saved.pwd : readPwdBoard();
});
