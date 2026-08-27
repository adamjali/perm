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

/** The next day, as "YYYY-MM-DD". */
function nextDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Every calendar day in the series' own span, absent days filled with ZERO.
 *
 * THIS IS THE MOST IMPORTANT FUNCTION IN THE FILE AND IT CORRECTS A REAL
 * MISREADING. The `dol-disclosure` series is not a log somebody kept; it is
 * `GROUP BY decision_date` over the whole case corpus, and the proof is that
 * it sums to 373,939, which is `SELECT COUNT(*) FROM perm_cases` exactly. A
 * day with no decisions therefore produces NO ROW. Absence means ZERO, not
 * "nobody measured".
 *
 * Treating those 57 absent days as holes hid the single most dramatic event in
 * the record. Measured straight from the corpus, DOL issued TWO determinations
 * in the thirty days of October 2025 (one on the 1st, one on the 7th) and 19
 * on the 31st, the day it announced it had resumed processing. As weeks that
 * is 3,306 then 2,615 then 1,196 then 1, 0, 0, 30, then 2,458. Drawn as a gap
 * it is invisible; drawn as zeros it is the story.
 *
 * ONLY FOR A SERIES DERIVED BY GROUPING. A live scan that simply has not run
 * on some day is genuinely unmeasured, and filling that with zero would invent
 * an outage. `flag-live` is contiguous, so it needs no fill either way.
 *
 * Nothing outside the series' own first and last date is invented: a day after
 * the last is the series ENDING, which is a different fact and stays absent.
 */
export function fillZeros(days: readonly ActivityDay[]): ActivityDay[] {
  if (days.length === 0) return [];
  const have = new Map(days.map((d) => [d.date, d]));
  const out: ActivityDay[] = [];
  const last = days[days.length - 1]!.date;
  for (let iso = days[0]!.date; iso <= last; iso = nextDay(iso)) {
    out.push(
      have.get(iso) ?? { date: iso, total: 0, certified: 0, denied: 0, withdrawn: 0 },
    );
  }
  return out;
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
 * A week is plotted only when it holds all seven days.
 *
 * AFTER `fillZeros` THIS ONLY EVER TRIMS THE ENDS. Every interior week of a
 * zero-filled series is complete by construction, so the floor's whole job is
 * to drop the partial week at each end: a series starting on a Wednesday would
 * otherwise open on a cliff that nothing in the world caused.
 *
 * It emphatically does NOT hide the October 2025 collapse any more. That was
 * the bug: with a 5-day floor over an unfilled series, three genuine
 * near-zero weeks were withheld as "unmeasurable" and the largest stoppage in
 * the record rendered as blank space.
 */
export const MIN_DAYS_FOR_WEEK = 7;

/**
 * Weeks, with an explicit `null` wherever the record does not support one.
 *
 * The nulls mark a break, and a caller drawing a line has to segment on them,
 * because a gap in a series is never a point to interpolate through. After
 * `fillZeros` a null means one of exactly two things and neither is "DOL
 * stopped": a partial week at an end of this series, or a stretch belonging to
 * a DIFFERENT series (the 44 days between the disclosure corpus ending on
 * 2026-06-30 and the live scan beginning on 2026-08-13). A period when DOL
 * really did stop is zeros, and zeros are drawn.
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
 * Mean decisions by day of the week. FEED IT A ZERO-FILLED SERIES.
 *
 * THIS EXISTS BECAUSE THE OBVIOUS ASSUMPTION IS WRONG, AND THE FIRST
 * CORRECTION OF IT WAS ALSO WRONG. The natural claim, stated in prose on two
 * live pages, is that DOL does not decide cases at weekends. Measured over the
 * zero-filled disclosure series it is closer to the truth than it looks:
 *
 *   Mon 471   Tue 541   Wed 526   Thu 493   Fri 442   Sat 73   Sun 63
 *
 * so a weekend day runs about an eighth of a weekday and weekends carry 5.18%
 * of every decision in the corpus. But 33 of 287 weekend days ARE zero (11
 * Saturdays, 22 Sundays), which the first pass missed by counting only
 * RECORDED days, where absence had already removed every zero. It then
 * published "not one weekend day is zero", which was an artefact of the
 * filtering rather than a fact about DOL.
 *
 * The durable finding is the one that survives both readings: weekend output
 * is small, it is routine, and it is not nothing.
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

/**
 * The heaviest and lightest WEEKDAYS in a series.
 *
 * Weekdays on both ends. A ranking that mixes them puts a Sunday at the bottom
 * of every quietest-day list, which says nothing except that it was a Sunday.
 *
 * NO GAP-EXCLUSION, AND THE EARLIER VERSION WAS WRONG TO HAVE ONE. It dropped
 * 33 weekdays for sitting "against a hole in the record", on the belief that a
 * recorded day beside an absent one measures the edge of our data. For a
 * series derived by grouping, an absent day is a day DOL decided nothing, so
 * those were real zero-decision weekdays and excluding them removed exactly
 * the days worth seeing: 2024-01-01, both Independence Days, and the whole of
 * October 2025. Feed this a zero-filled series and the extremes are true.
 */
export function weekdayExtremes(
  days: readonly ActivityDay[],
  n = 5,
): { busiest: ActivityDay[]; quietest: ActivityDay[] } {
  const wd = days.filter((d) => !isWeekend(d.date));
  // Tie-break on date so the ordering is deterministic. Without it two days
  // sharing a total swap places between builds and a "quietest day" changes
  // identity for no reason - and with zeros in the series, ties are now the
  // common case rather than a rarity.
  const byTotal = [...wd].sort(
    (a, b) => b.total - a.total || a.date.localeCompare(b.date),
  );
  return {
    busiest: byTotal.slice(0, n),
    quietest: byTotal.slice(-n).reverse(),
  };
}

/** Weekdays with no decisions at all, oldest first. */
export function zeroWeekdays(days: readonly ActivityDay[]): ActivityDay[] {
  return days.filter((d) => !isWeekend(d.date) && d.total === 0);
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
