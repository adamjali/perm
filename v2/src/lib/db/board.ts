import "server-only";

import { cache } from "react";

import { decidedSpan, lineFlow, statusMoves, type DecidedSpan, type LineFlow, type StatusMove } from "@/lib/board";
import { dolDayBounds, dolDayOf } from "@/lib/dolDay";
import { MS_PER_DAY } from "@/lib/time";

import { rows } from "./client";
import { OBSERVED_SOURCE } from "./decisionPace";
import { DIRECT_EVENT_SOURCE } from "./rfi";

/**
 * The PERM half of the board (/today): where DOL's decisions fell on its last
 * working day, whether the line grew over 30 days, and how each status moved.
 *
 * Every read is bounded by a date range on an indexed column, and the page is
 * cached and expired by the sweep (/api/revalidate-sweep), so these run once a
 * pass, not once a visit. A read that fails throws: the page keeps its last
 * good render rather than showing an empty board as a quiet day.
 */

export interface PermBoard {
  /** DOL's last working day our record holds whole, `YYYY-MM-DD`. */
  day: string;
  /** Decisions that day (the daily series' own count). */
  decidedThatDay: number;
  /** Where that day's decisions out of analyst review fell, withdrawals left out. */
  span: DecidedSpan | null;
  /** The 30 days ending that day: filed against decided. */
  flow: LineFlow & { from: string; to: string };
  /** Each status's moves over the last working day and the 7 days ending it. */
  movesDay: StatusMove[];
  movesWeek: StatusMove[];
  /** The same reading a week earlier: DOL's working day 7 or more days before, and where its decisions fell. */
  weekBefore: { day: string; span: DecidedSpan | null } | null;
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

/** The newest worked day at least 7 days before `day`, from a list of worked days newest first. */
export function weekBeforeOf(day: string, worked: readonly string[]): string | null {
  const limit = isoMinus(day, 7);
  return worked.find((d) => d <= limit) ?? null;
}

export const getPermBoard = cache(async (): Promise<PermBoard | null> => {
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
  const prior = weekBeforeOf(day, worked.map((d) => String(d.date)));
  const [span, priorSpan, filed30, movesDay, movesWeek, filedDay, filedWeek] = await Promise.all([
    permSpanOn(day),
    prior ? permSpanOn(prior) : Promise.resolve(null),
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
    decidedThatDay: Number(last.total) || 0,
    span,
    flow: { ...lineFlow(filed30, decided30), from: from30, to: day },
    movesDay: statusMoves(movesDay, "ANALYST REVIEW", filedDay),
    movesWeek: statusMoves(movesWeek, "ANALYST REVIEW", filedWeek),
    weekBefore: prior ? { day: prior, span: priorSpan } : null,
  };
});

// ---------------------------------------------------------------------------
// The wage-request half: PERM wage requests (P-100, the PERM visa class).
// ---------------------------------------------------------------------------

/** PERM wage requests: the P-100 office, visa class PERM or not yet stated. */
const PWD_RANGE = ["P-100-", "P-100."] as const;
const PERM_WAGE = "(s.visa_type IS NULL OR upper(s.visa_type) = 'PERM')";

export interface PwdBoard {
  /** DOL's last working day with determinations in our record, `YYYY-MM-DD`. */
  day: string;
  determinedThatDay: number;
  span: DecidedSpan | null;
  flow: LineFlow & { from: string; to: string };
  /** Requests in process now. */
  inProcess: number;
  /** The same reading a week earlier. */
  weekBefore: { day: string; span: DecidedSpan | null } | null;
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

export const getPwdBoard = cache(async (): Promise<PwdBoard | null> => {
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
  const [day, determinedThatDay] = last;
  const bounds = dolDayBounds(day);
  if (!bounds) return null;
  const from30 = isoMinus(day, 29);
  const prior = weekBeforeOf(day, worked.map(([d]) => d));
  const [span, priorSpan, filed, inProcess] = await Promise.all([
    pwdSpanOn(day),
    prior ? pwdSpanOn(prior) : Promise.resolve(null),
    rows<{ n: number }>(
      `SELECT COUNT(*) AS n FROM pwd_case_status s INDEXED BY pwd_case_status_filed
        WHERE s.case_number >= ? AND s.case_number < ? AND s.filing_date >= ? AND s.filing_date <= ? AND ${PERM_WAGE}`,
      [...PWD_RANGE, from30, day],
    ),
    rows<{ n: number }>(
      `SELECT COUNT(*) AS n FROM pwd_case_status s WHERE s.case_number >= ? AND s.case_number < ?
         AND s.current_status = 'IN PROCESS' AND ${PERM_WAGE}`,
      [...PWD_RANGE],
    ),
  ]);
  const determined30 = [...byDay].filter(([d]) => d >= from30 && d <= day).reduce((a, [, n]) => a + n, 0);
  return {
    day,
    determinedThatDay,
    span,
    flow: { ...lineFlow(Number(filed[0]?.n) || 0, determined30), from: from30, to: day },
    inProcess: Number(inProcess[0]?.n) || 0,
    weekBefore: prior ? { day: prior, span: priorSpan } : null,
  };
});
