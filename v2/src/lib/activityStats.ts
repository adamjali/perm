/**
 * Derivations over DOL's daily decision series, outside the server-only
 * boundary so the `unit` vitest project (happy-dom) can import them.
 *
 * The queries live in src/lib/turso/activity.ts. Everything here is pure.
 */

export interface ActivityDay {
  /** ISO date, "YYYY-MM-DD". */
  date: string;
  total: number;
  certified: number;
  denied: number;
  withdrawn: number;
}

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/**
 * Monday = 0.
 *
 * Date-only strings parse as UTC midnight and every operation here stays in
 * UTC, so nothing shifts a day at a timezone boundary. The site already lost
 * a day once to `toISOString().slice(0,10)` on a local date.
 */
export function weekdayIndex(iso: string): number {
  return (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;
}

export function isWeekend(iso: string): boolean {
  return weekdayIndex(iso) >= 5;
}

/** The Monday of the ISO week a date falls in, as "YYYY-MM-DD". */
export function weekStart(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - weekdayIndex(iso));
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Weekly roll-up
// ---------------------------------------------------------------------------

export interface ActivityWeek {
  weekStart: string;
  total: number;
  certified: number;
  denied: number;
  withdrawn: number;
  /** How many of the seven days carry a record. */
  daysRecorded: number;
}

/**
 * A week is plotted only when this many of its seven days carry a record.
 *
 * A partial week draws as a dip nothing in the world caused. The series starts
 * on a Wednesday and the live segment ends mid-week, so without a floor the
 * chart opens and closes on a cliff, and the October-2025 hole leaves two
 * weeks holding a single day each, which would draw as a collapse to near zero
 * rather than as the absence of measurement that it is.
 */
export const MIN_DAYS_FOR_WEEK = 5;

/**
 * Weeks, with an explicit `null` wherever the record does not support one.
 *
 * The nulls are the point. A caller drawing a line has to segment on them,
 * because a gap in a series is a BREAK and not a point to interpolate through.
 * This series holds two real holes: 23 days in October 2025, and 43 days
 * between 2026-06-30 and 2026-08-13 where the quarterly disclosure file had
 * stopped and the live scan had not started. Both are periods with no
 * measurement, not periods of no work.
 */
export function toWeeks(days: readonly ActivityDay[]): (ActivityWeek | null)[] {
  if (days.length === 0) return [];
  const by = new Map<string, ActivityWeek>();
  for (const d of days) {
    const k = weekStart(d.date);
    const w = by.get(k) ?? {
      weekStart: k,
      total: 0,
      certified: 0,
      denied: 0,
      withdrawn: 0,
      daysRecorded: 0,
    };
    w.total += d.total;
    w.certified += d.certified;
    w.denied += d.denied;
    w.withdrawn += d.withdrawn;
    w.daysRecorded += 1;
    by.set(k, w);
  }
  // Walk every calendar week between the ends, so an absent week is a null in
  // the array rather than a missing element the chart would close up over.
  const out: (ActivityWeek | null)[] = [];
  const cursor = new Date(`${weekStart(days[0]!.date)}T00:00:00Z`);
  const end = new Date(`${weekStart(days[days.length - 1]!.date)}T00:00:00Z`);
  while (cursor.getTime() <= end.getTime()) {
    const w = by.get(cursor.toISOString().slice(0, 10));
    out.push(w && w.daysRecorded >= MIN_DAYS_FOR_WEEK ? w : null);
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return out;
}

export interface WeekPoint {
  /** Index into the full week array, so runs keep their real x position. */
  i: number;
  week: ActivityWeek;
}

/**
 * Contiguous runs of plottable weeks.
 *
 * Each run is drawn as its own polyline on a shared axis, so the hole between
 * two runs stays visible as a hole.
 */
export function segments(weeks: readonly (ActivityWeek | null)[]): WeekPoint[][] {
  const out: WeekPoint[][] = [];
  let run: WeekPoint[] = [];
  weeks.forEach((week, i) => {
    if (week) {
      run.push({ i, week });
      return;
    }
    if (run.length > 0) out.push(run);
    run = [];
  });
  if (run.length > 0) out.push(run);
  return out;
}

// ---------------------------------------------------------------------------
// The working week
// ---------------------------------------------------------------------------

export interface WeekdayProfile {
  /** 0 = Monday. */
  weekday: number;
  label: string;
  days: number;
  mean: number;
  max: number;
  /** Days on this weekday with no decisions at all. */
  zeroDays: number;
}

/**
 * Mean decisions by day of the week.
 *
 * THIS EXISTS BECAUSE THE OBVIOUS ASSUMPTION IS WRONG. The natural claim, and
 * the one this codebase states in prose on two live pages, is that DOL does
 * not decide cases at weekends. Measured over the disclosure series: 254
 * recorded weekend days, NOT ONE of them zero, carrying 19,361 decisions or
 * 5.18% of the corpus, at a Saturday mean of 91 and a Sunday mean of 82
 * against a weekday mean near 520. Weekend work is small and it is real, and
 * a chart that treats it as an outage is wrong in a way nobody would catch.
 */
export function weekdayProfile(days: readonly ActivityDay[]): WeekdayProfile[] {
  const buckets: number[][] = [[], [], [], [], [], [], []];
  for (const d of days) buckets[weekdayIndex(d.date)]!.push(d.total);
  return buckets.map((v, weekday) => ({
    weekday,
    label: DOW[weekday]!,
    days: v.length,
    mean: v.length === 0 ? 0 : Math.round(v.reduce((a, b) => a + b, 0) / v.length),
    max: v.length === 0 ? 0 : Math.max(...v),
    zeroDays: v.filter((x) => x === 0).length,
  }));
}

export interface Pace {
  perWeekday: number;
  weekdays: number;
  perWeekendDay: number | null;
  weekendDays: number;
  from: string;
  to: string;
}

/**
 * The pace over the most recent `window` days, weekday and weekend kept apart.
 *
 * NOT `businessDayPace` from dolPace.ts, and the difference is 23%. That
 * function calls every day carrying at least one decision a business day, and
 * since no recorded weekend day is ever zero, no weekend is ever excluded: on
 * the last 28 days of the disclosure series it reports 644 "per working day"
 * where Monday to Friday averages 832 and Saturday and Sunday average 172. A
 * rate only means anything if its denominator is the thing it names.
 *
 * Returns null rather than 0 when the window holds no weekday. A pace of zero
 * and "we cannot say" are different statements and only one is safe to print.
 */
export function pace(days: readonly ActivityDay[], window = 28): Pace | null {
  const w = days.slice(-window);
  if (w.length === 0) return null;
  const wd = w.filter((d) => !isWeekend(d.date));
  const we = w.filter((d) => isWeekend(d.date));
  if (wd.length === 0) return null;
  const sum = (xs: ActivityDay[]) => xs.reduce((a, b) => a + b.total, 0);
  return {
    perWeekday: Math.round(sum(wd) / wd.length),
    weekdays: wd.length,
    perWeekendDay: we.length === 0 ? null : Math.round(sum(we) / we.length),
    weekendDays: we.length,
    from: w[0]!.date,
    to: w[w.length - 1]!.date,
  };
}

// ---------------------------------------------------------------------------
// Extremes and mix
// ---------------------------------------------------------------------------

/** The day before and the day after, as ISO strings. */
function neighbours(iso: string): [string, string] {
  const d = new Date(`${iso}T00:00:00Z`);
  const before = new Date(d);
  before.setUTCDate(before.getUTCDate() - 1);
  const after = new Date(d);
  after.setUTCDate(after.getUTCDate() + 1);
  return [
    before.toISOString().slice(0, 10),
    after.toISOString().slice(0, 10),
  ];
}

/**
 * Is this day sitting against a hole in the record?
 *
 * A recorded day whose neighbour is missing is not comparable to one in a
 * complete stretch. Both ends of the October-2025 hole are exactly this:
 * 2025-10-01 and 2025-10-07 each carry a total of ONE, bracketed by a 5-day
 * and a 23-day absence. A quietest-day ranking that includes them reports the
 * shape of our record as though it were the shape of DOL's work.
 *
 * A day at the very start or end of a series is not adjacent to a hole; the
 * series simply has not begun or has ended.
 */
export function adjacentToGap(
  iso: string,
  recorded: ReadonlySet<string>,
  first: string,
  last: string,
): boolean {
  const [before, after] = neighbours(iso);
  if (iso > first && !recorded.has(before)) return true;
  if (iso < last && !recorded.has(after)) return true;
  return false;
}

/**
 * The heaviest and lightest WEEKDAYS in a series.
 *
 * Weekdays on both ends. A ranking that mixes them puts a Sunday at the bottom
 * of every quietest-day list, which says nothing except that it was a Sunday.
 *
 * Days against a hole in the record are dropped from BOTH ends and counted, so
 * a caller can say how many were set aside rather than quietly presenting a
 * gap artefact as the quietest day DOL ever had.
 */
export function weekdayExtremes(
  days: readonly ActivityDay[],
  n = 5,
): { busiest: ActivityDay[]; quietest: ActivityDay[]; excluded: number } {
  if (days.length === 0) return { busiest: [], quietest: [], excluded: 0 };
  const recorded = new Set(days.map((d) => d.date));
  const first = days[0]!.date;
  const last = days[days.length - 1]!.date;
  const wd = days.filter((d) => !isWeekend(d.date));
  const clean = wd.filter((d) => !adjacentToGap(d.date, recorded, first, last));
  // Tie-break on date so the ordering is deterministic. Without it two days
  // sharing a total swap places between builds and a "quietest day" changes
  // identity for no reason.
  const byTotal = [...clean].sort(
    (a, b) => b.total - a.total || a.date.localeCompare(b.date),
  );
  return {
    busiest: byTotal.slice(0, n),
    quietest: byTotal.slice(-n).reverse(),
    excluded: wd.length - clean.length,
  };
}

export interface OutcomeQuarter {
  /** "2026-Q2". */
  quarter: string;
  total: number;
  certifiedPct: number;
  deniedPct: number;
  withdrawnPct: number;
}

/**
 * The outcome mix per federal quarter.
 *
 * A share rather than a count, because a count moves with how many cases DOL
 * happened to clear that quarter and the question here is what happened to
 * them. Partial quarters are kept and carry their own total, so a reader can
 * see which bar rests on 9,457 decisions and which on 83,827.
 */
export function outcomeByQuarter(days: readonly ActivityDay[]): OutcomeQuarter[] {
  const by = new Map<string, { t: number; c: number; d: number; w: number }>();
  for (const day of days) {
    const [y, m] = day.date.split("-");
    const q = `${y}-Q${Math.floor((Number(m) - 1) / 3) + 1}`;
    const b = by.get(q) ?? { t: 0, c: 0, d: 0, w: 0 };
    b.t += day.total;
    b.c += day.certified;
    b.d += day.denied;
    b.w += day.withdrawn;
    by.set(q, b);
  }
  return [...by.entries()]
    .sort((a, z) => a[0].localeCompare(z[0]))
    .filter(([, b]) => b.t > 0)
    .map(([quarter, b]) => ({
      quarter,
      total: b.t,
      certifiedPct: (b.c / b.t) * 100,
      deniedPct: (b.d / b.t) * 100,
      withdrawnPct: (b.w / b.t) * 100,
    }));
}
