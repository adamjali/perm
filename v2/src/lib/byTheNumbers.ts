/**
 * The shaping behind "PERM by the numbers": plain functions over the rows the
 * reader in `lib/db/byTheNumbers.ts` returns, so every rule here is tested
 * without a database.
 *
 * Nothing is modelled. Each figure is a count of DOL's own case records as our
 * sweep holds them; the functions only fold spellings together, bucket days
 * into weeks and pick the largest few.
 */

import { shiftMonth } from "@convex/lib/months";

/** One raw group from the database: a value as DOL printed it, its employer and a count. */
export interface SpellingRow {
  /** The value exactly as DOL printed it (a job title, an employer name). */
  value: string | null;
  /** The employer's slug, so a job title can say how many employers filed it. */
  slug: string | null;
  n: number;
}

export interface FoldedValue {
  /** The spelling DOL printed most often for this value. */
  label: string;
  /** Cases filed under any spelling of it. */
  cases: number;
  /** Distinct employers among those cases. */
  employers: number;
  /** The employer slug, when the fold is by employer. */
  slug: string | null;
}

/** "  Software   engineer " and "SOFTWARE ENGINEER" are one title. */
export function foldKey(v: string): string {
  return v.trim().replace(/\s+/g, " ").toUpperCase();
}

/**
 * Fold spellings of one value together and rank by cases.
 *
 * DOL prints a job title or a name the way each filer typed it, so "Software
 * Engineer" and "SOFTWARE ENGINEER" are one job. The label shown is the
 * spelling filed most often (ties go to the one that sorts first, so a render
 * is stable), never a case change of our own.
 */
export function foldSpellings(rows: readonly SpellingRow[], take: number): FoldedValue[] {
  const groups = new Map<string, { cases: number; slugs: Set<string>; spellings: Map<string, number> }>();
  for (const r of rows) {
    if (!r.value || !r.value.trim()) continue;
    const key = foldKey(r.value);
    const g = groups.get(key) ?? { cases: 0, slugs: new Set<string>(), spellings: new Map<string, number>() };
    g.cases += r.n;
    if (r.slug) g.slugs.add(r.slug);
    const spelled = r.value.trim().replace(/\s+/g, " ");
    g.spellings.set(spelled, (g.spellings.get(spelled) ?? 0) + r.n);
    groups.set(key, g);
  }
  const out: FoldedValue[] = [];
  for (const g of groups.values()) {
    const label = [...g.spellings.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]![0];
    out.push({ label, cases: g.cases, employers: g.slugs.size, slug: g.slugs.size === 1 ? [...g.slugs][0]! : null });
  }
  return out.sort((a, b) => b.cases - a.cases || (a.label < b.label ? -1 : 1)).slice(0, take);
}

/** One employer's raw rows: its slug, a spelling of its name, and a count. */
export interface EmployerRow {
  slug: string | null;
  name: string | null;
  n: number;
}

/**
 * Rank employers by cases, one row per slug, named by the spelling on most of
 * its cases. A row without a slug can't be linked and is left out: it would
 * be a name the reader can't open.
 */
export function rankEmployers(rows: readonly EmployerRow[], take: number): FoldedValue[] {
  const bySlug = new Map<string, { cases: number; names: Map<string, number> }>();
  for (const r of rows) {
    if (!r.slug) continue;
    const g = bySlug.get(r.slug) ?? { cases: 0, names: new Map<string, number>() };
    g.cases += r.n;
    const name = (r.name ?? "").trim().replace(/\s+/g, " ");
    if (name) g.names.set(name, (g.names.get(name) ?? 0) + r.n);
    bySlug.set(r.slug, g);
  }
  const out: FoldedValue[] = [];
  for (const [slug, g] of bySlug) {
    const label = [...g.names.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0] ?? slug;
    out.push({ label, cases: g.cases, employers: 1, slug });
  }
  return out.sort((a, b) => b.cases - a.cases || (a.label < b.label ? -1 : 1)).slice(0, take);
}

const DAY_MS = 86_400_000;

function toUtc(iso: string): number {
  return Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
}

function isoOf(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** The Monday on or before a day. */
export function mondayOf(iso: string): string {
  const t = toUtc(iso);
  const dow = (new Date(t).getUTCDay() + 6) % 7; // Monday 0
  return isoOf(t - dow * DAY_MS);
}

export interface WeekCount {
  /** The week's Monday. */
  week: string;
  count: number;
  /** True for the week holding `through`, which hasn't ended yet. */
  partial: boolean;
}

/**
 * Bucket daily counts into Monday-to-Sunday weeks from `from` to `through`,
 * every week present, an empty one as 0.
 *
 * The first week starts on the Monday on or after `from`, so a week the
 * record only half covers is never drawn as a dip. The last week is marked
 * partial when it ends after `through`: a chart says "so far" rather than
 * showing a drop that hasn't happened.
 */
export function weeklyCounts(days: readonly { date: string; count: number }[], from: string, through: string): WeekCount[] {
  let start = mondayOf(from);
  if (start < from.slice(0, 10)) start = isoOf(toUtc(start) + 7 * DAY_MS);
  const end = toUtc(through);
  const weeks: WeekCount[] = [];
  for (let t = toUtc(start); t <= end; t += 7 * DAY_MS) {
    weeks.push({ week: isoOf(t), count: 0, partial: t + 6 * DAY_MS > end });
  }
  const index = new Map(weeks.map((w, i) => [w.week, i]));
  for (const d of days) {
    const i = index.get(mondayOf(d.date));
    if (i !== undefined && d.date <= through.slice(0, 10)) weeks[i]!.count += d.count;
  }
  return weeks;
}

/** "2026-10-25" minus `n` days. */
export function daysBefore(iso: string, n: number): string {
  return isoOf(toUtc(iso) - n * DAY_MS);
}

export interface BulletinYear {
  year: number;
  /** Twelve entries, January first: true when the bulletin for that month is held. */
  months: (boolean | null)[];
}

/**
 * The visa bulletin archive as a calendar: one row per year from the first
 * bulletin held to the newest, each month marked held or missing. A month
 * before the first or after the newest is null (not drawn), never "missing".
 */
export function bulletinCalendar(held: readonly string[]): BulletinYear[] {
  const months = [...new Set(held.map((m) => m.slice(0, 7)))].filter((m) => /^\d{4}-\d{2}$/.test(m)).sort();
  if (months.length === 0) return [];
  const first = months[0]!;
  const last = months[months.length - 1]!;
  const has = new Set(months);
  const years: BulletinYear[] = [];
  for (let y = Number(first.slice(0, 4)); y <= Number(last.slice(0, 4)); y++) {
    const row: (boolean | null)[] = [];
    for (let m = 1; m <= 12; m++) {
      const ym = `${y}-${String(m).padStart(2, "0")}`;
      row.push(ym < first || ym > last ? null : has.has(ym));
    }
    years.push({ year: y, months: row });
  }
  return years;
}

/** How many months the calendar holds and how many inside its span are missing. */
export function bulletinTally(years: readonly BulletinYear[]): { held: number; missing: number } {
  let held = 0;
  let missing = 0;
  for (const y of years) {
    for (const m of y.months) {
      if (m === true) held += 1;
      else if (m === false) missing += 1;
    }
  }
  return { held, missing };
}

/** The first filing month the monthly chart draws: H1BPerm's start, and two full fiscal years back. */
export const FLOW_FROM = "2024-01";

/**
 * The decision sources a month can be drawn from, best first: DOL's published
 * files, then our nightly sweep. Each covers a span of days; a month is drawn
 * from a source only when that span covers the whole month (or, for the
 * current month, its start), so a source that began on the 27th never reads
 * as a month of almost nothing.
 */
export const FLOW_SOURCES = ["dol-disclosure", "sweep-observed"] as const;

export interface DecidedMonthRow {
  month: string;
  source: string;
  total: number;
  certified: number;
  denied: number;
  withdrawn: number;
}

export interface SourceSpan {
  source: string;
  first: string;
  last: string;
}

export interface FlowDecided {
  certified: number;
  denied: number;
  withdrawn: number;
  /** Any other final status DOL used. */
  other: number;
  total: number;
}

export interface FlowMonth {
  month: string;
  /** PERM cases filed that month, as our record holds them today. */
  filed: number;
  /** The month holding `today`: both counts are still filling. */
  current: boolean;
  /** Null where no source covers the month. */
  decided: FlowDecided | null;
  source: string | null;
}

const lastDayOf = (ym: string) => new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).toISOString().slice(0, 10);

/** Filed by filing month and decided by decision month, from `from` through the month holding `today`. */
export function monthlyFlow(input: {
  from: string;
  today: string;
  filed: readonly { month: string; total: number }[];
  decided: readonly DecidedMonthRow[];
  spans: readonly SourceSpan[];
}): FlowMonth[] {
  const thisMonth = input.today.slice(0, 7);
  const filed = new Map(input.filed.map((f) => [f.month, f.total]));
  const out: FlowMonth[] = [];
  for (let m = input.from; m <= thisMonth; m = shiftMonth(m, 1)) {
    const current = m === thisMonth;
    const start = `${m}-01`;
    const end = current ? start : lastDayOf(m);
    const source =
      FLOW_SOURCES.find((s) => {
        const span = input.spans.find((x) => x.source === s);
        return span ? span.first <= start && span.last >= end : false;
      }) ?? null;
    const row = source ? input.decided.find((d) => d.month === m && d.source === source) : undefined;
    const decided: FlowDecided | null = source
      ? {
          certified: row?.certified ?? 0,
          denied: row?.denied ?? 0,
          withdrawn: row?.withdrawn ?? 0,
          other: Math.max(0, (row?.total ?? 0) - (row?.certified ?? 0) - (row?.denied ?? 0) - (row?.withdrawn ?? 0)),
          total: row?.total ?? 0,
        }
      : null;
    out.push({ month: m, filed: filed.get(m) ?? 0, current, decided, source });
  }
  return out;
}

/** A stretch of months added up, with the months that have no decision record named rather than counted as zero. */
export function flowTotals(months: readonly FlowMonth[]): { filed: number; decided: number; certified: number; noRecord: string[] } {
  let filed = 0;
  let decided = 0;
  let certified = 0;
  const noRecord: string[] = [];
  for (const m of months) {
    filed += m.filed;
    if (m.decided) {
      decided += m.decided.total;
      certified += m.decided.certified;
    } else noRecord.push(m.month);
  }
  return { filed, decided, certified, noRecord };
}
