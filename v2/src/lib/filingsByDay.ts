/**
 * How many cases were filed each day, every program (perm_docs['filings_by_day'], written by
 * scripts/build_filings_by_day.py after each case-status pass). DOL's live record and its
 * published files together, each case counted once by case number: on its live filing day when
 * the live record holds it, else on the file's received day. Plain module: the hub page reads the
 * document on the server and its period picker sums days in the browser.
 */

import { MONTH_ABBR, monthDay } from "@convex/lib/months";
import { MS_PER_DAY } from "@convex/lib/time";

export const FILING_PROGRAMS = ["perm", "pwd", "lca", "seasonal"] as const;
export type FilingProgram = (typeof FILING_PROGRAMS)[number];

export const PROGRAM_NAMES: Record<FilingProgram, { name: string; plural: string; one: string }> = {
  perm: { name: "PERM", plural: "PERM cases", one: "PERM case" },
  pwd: { name: "Wage requests", plural: "wage requests", one: "wage request" },
  lca: { name: "H-1B LCAs", plural: "H-1B LCAs", one: "H-1B LCA" },
  seasonal: { name: "H-2A, H-2B and CW-1", plural: "H-2A, H-2B and CW-1 filings", one: "H-2A, H-2B or CW-1 filing" },
};

/** One filing day: filed (live and file-only together), still waiting, only in a file, dated otherwise by a file. */
export interface FilingDay {
  day: string;
  filed: number;
  waiting: number;
  fileOnly: number;
  mismatch: number;
}

export interface FilingsDoc {
  /** The Eastern day the counts run to (today's are so far). */
  asOf: string;
  computedAt: number;
  from: string;
  programs: Record<FilingProgram, { days: FilingDay[]; liveFrom: string | null }>;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);

/** The stored document, or null when it can't be read as one. A program it lacks reads as no days. */
export function parseFilingsDoc(json: string | null | undefined): FilingsDoc | null {
  if (!json) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.asOf !== "string" || !DAY_RE.test(r.asOf)) return null;
  const progs = (r.programs ?? {}) as Record<string, unknown>;
  const programs = {} as FilingsDoc["programs"];
  for (const p of FILING_PROGRAMS) {
    const src = (progs[p] ?? {}) as { days?: unknown; liveFrom?: unknown };
    const days: FilingDay[] = [];
    for (const row of Array.isArray(src.days) ? src.days : []) {
      if (!Array.isArray(row) || typeof row[0] !== "string" || !DAY_RE.test(row[0])) continue;
      days.push({ day: row[0], filed: n(row[1]), waiting: n(row[2]), fileOnly: n(row[3]), mismatch: n(row[4]) });
    }
    days.sort((a, b) => a.day.localeCompare(b.day));
    programs[p] = { days, liveFrom: typeof src.liveFrom === "string" && DAY_RE.test(src.liveFrom) ? src.liveFrom : null };
  }
  return { asOf: r.asOf, computedAt: n(r.computedAt), from: typeof r.from === "string" ? r.from : "", programs };
}

/** `iso` moved by `days` calendar days. */
export function shiftDay(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T12:00:00Z`) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

export interface PeriodTotal {
  from: string;
  to: string;
  filed: number;
  waiting: number;
  fileOnly: number;
  mismatch: number;
  /** Days in the period with at least one filing. */
  days: number;
}

/** Every count of the days from `from` to `to`, both included. */
export function periodTotal(days: readonly FilingDay[], from: string, to: string): PeriodTotal {
  const t: PeriodTotal = { from, to, filed: 0, waiting: 0, fileOnly: 0, mismatch: 0, days: 0 };
  for (const d of days) {
    if (d.day < from || d.day > to) continue;
    t.filed += d.filed;
    t.waiting += d.waiting;
    t.fileOnly += d.fileOnly;
    t.mismatch += d.mismatch;
    if (d.filed > 0) t.days += 1;
  }
  return t;
}

/** Every day from `from` to `to`, a day with no filings as zero, so a chart shows the quiet days too. */
export function fillDays(days: readonly FilingDay[], from: string, to: string): FilingDay[] {
  const by = new Map(days.map((d) => [d.day, d]));
  const out: FilingDay[] = [];
  for (let d = from; d <= to; d = shiftDay(d, 1)) {
    out.push(by.get(d) ?? { day: d, filed: 0, waiting: 0, fileOnly: 0, mismatch: 0 });
    if (out.length > 4000) break;
  }
  return out;
}

const weekday = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();

/**
 * The usual count for a day like `day`: the median of the same weekday over the eight weeks
 * before, so a Monday is set against Mondays (a weekend is a fraction of a weekday). Null with
 * fewer than four of them on record.
 */
export function usualFor(days: readonly FilingDay[], day: string): number | null {
  const by = new Map(days.map((d) => [d.day, d.filed]));
  const wd = weekday(day);
  const vals: number[] = [];
  for (let k = 1; k <= 8; k++) {
    const d = shiftDay(day, -7 * k);
    if (weekday(d) === wd && by.has(d)) vals.push(by.get(d) ?? 0);
  }
  if (vals.length < 4) return null;
  vals.sort((a, b) => a - b);
  const m = vals.length >> 1;
  const hi = vals[m] ?? 0;
  return vals.length % 2 ? hi : Math.round(((vals[m - 1] ?? hi) + hi) / 2);
}

/** The page that lists one day's filings, opened on a program. */
export function dayHref(day: string, program: FilingProgram = "perm"): string {
  const base = `/perm-queue/${day.slice(0, 7)}/${day.slice(8, 10)}`;
  return program === "perm" ? base : `${base}?kind=${program}`;
}

/** The longest period one ask of /api/filings-by-day answers. */
export const RANGE_MAX_DAYS = 2300;

/** How many days back /filings-by-day carries in its own HTML; an older period is asked for. */
export const PAGE_WINDOW_DAYS = 100;

/** The periods the hub offers, newest first: each is the days back from the document's day, today included. */
export const PERIODS = [
  { key: "30", label: "30 days", days: 30 },
  { key: "90", label: "90 days", days: 90 },
  { key: "365", label: "A year", days: 365 },
] as const;
export type PeriodKey = (typeof PERIODS)[number]["key"] | "custom";

export interface Bucket {
  key: string;
  from: string;
  to: string;
  filed: number;
  waiting: number;
  /** Runs past the document's day (today, or this week or month): still filling. */
  partial: boolean;
}

/** "Nov 4" for a day, "Nov 2026" for a month (the month names are convex/lib/months.ts's). */
export function shortDay(iso: string): string {
  return monthDay(iso) ?? iso;
}
export function shortMonth(iso: string): string {
  return `${MONTH_ABBR[Number(iso.slice(5, 7)) - 1] ?? iso.slice(5, 7)} ${iso.slice(0, 4)}`;
}

/** Monday of `iso`'s week. */
export function weekStart(iso: string): string {
  const wd = (new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7;
  return shiftDay(iso, -wd);
}

/**
 * The period as chart columns: a day each up to two months, a week (from Monday) up to two
 * years, a month beyond, so a column never shrinks under a usable width. Each column covers
 * only days inside the period; one that reaches `today` is still filling.
 */
export function buckets(days: readonly FilingDay[], from: string, to: string, today: string): { unit: "day" | "week" | "month"; rows: Bucket[] } {
  const span = Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / MS_PER_DAY) + 1;
  const unit = span <= 62 ? "day" : span <= 730 ? "week" : "month";
  const keyOf = (d: string) => (unit === "day" ? d : unit === "week" ? weekStart(d) : d.slice(0, 7));
  const rows: Bucket[] = [];
  const at = new Map<string, Bucket>();
  for (const d of fillDays(days, from, to)) {
    const key = keyOf(d.day);
    let b = at.get(key);
    if (!b) {
      b = { key, from: d.day, to: d.day, filed: 0, waiting: 0, partial: false };
      at.set(key, b);
      rows.push(b);
    }
    b.to = d.day;
    b.filed += d.filed;
    b.waiting += d.waiting;
  }
  for (const b of rows) {
    const end = unit === "day" ? b.from : unit === "week" ? shiftDay(b.key, 6) : shiftDay(`${b.key}-01`, 40).slice(0, 7) + "-01";
    b.partial = unit === "day" ? b.from >= today : unit === "week" ? end >= today : today < end && today >= `${b.key}-01`;
  }
  return { unit, rows };
}
