/**
 * When in the month before does a visa bulletin come out? Measured from the
 * Internet Archive's FIRST capture of each bulletin page, which is a floor on
 * publication: the page existed by then. So every figure here is "at least":
 * a bulletin captured on the 14th may have been published on the 9th.
 *
 * A bulletin first captured only after its own month began says nothing
 * about the day, because the archive simply wasn't watching: it began
 * crawling these pages in December 2017 (every 2014-2017 bulletin was first
 * captured on 2017-12-03) and missed several 2019-2020 months. Those are SET
 * ASIDE, counted and named, never put in the denominator, where they would
 * drag every share down for reasons that have nothing to do with the State
 * Department. The bias that leaves: a bulletin published in the last days of
 * a month may be caught only after, which makes these days read a little
 * early; the page says so.
 *
 * The State Department publishes no release date and keeps no record of one.
 * This is the only publication evidence there is. Pure; the captures are a
 * typed table (`bulletinCaptures.ts`) written by
 * `scripts/measure_bulletin_captures.py`.
 */

import { monthBefore } from "@/lib/bulletinNext";

export interface FirstCapture {
  /** The bulletin, `YYYY-MM`. */
  month: string;
  /** Its first archive capture with the page served, as an Eastern date, `YYYY-MM-DD`. */
  captured: string;
}

/** The day of the month before on which the bulletin was captured, or null when it wasn't captured in that month. */
function dayInMonthBefore(c: FirstCapture): number | null {
  return c.captured.slice(0, 7) === monthBefore(c.month) ? Number(c.captured.slice(8, 10)) : null;
}

/**
 * For each day 1 to 31 of the month before, how many bulletins were already
 * captured by then, out of those captured in the month before at all.
 */
export function releaseByDay(captures: readonly FirstCapture[]): Array<{ day: number; captured: number; of: number }> {
  const days = captures.map(dayInMonthBefore).filter((d): d is number => d !== null);
  const out: Array<{ day: number; captured: number; of: number }> = [];
  for (let day = 1; day <= 31; day += 1) {
    out.push({ day, captured: days.filter((d) => d <= day).length, of: days.length });
  }
  return out;
}

export interface ReleaseSummary {
  /** Bulletins captured in the month before: the ones with evidence. */
  months: number;
  /** Bulletins first captured only later, which say nothing about the day. */
  setAside: number;
  /** The earliest day of the month before any bulletin was captured. */
  earliestDay: number | null;
  /** The first day by which at least half the bulletins had been captured. */
  halfBy: number | null;
  /** The first day by which at least nine in ten had been captured. */
  ninetyBy: number | null;
  first: string;
  last: string;
}

/** Below this many bulletins the shares are too coarse to print. */
const MIN_MONTHS = 6;

export function releaseSummary(captures: readonly FirstCapture[]): ReleaseSummary | null {
  const rows = releaseByDay(captures);
  const months = rows[30]!.of;
  if (months < MIN_MONTHS) return null;
  const by = (share: number) => rows.find((r) => r.captured >= share * r.of)?.day ?? null;
  // The span of the bulletins with evidence, not of every capture: the set-aside
  // 2014-2017 months would otherwise put a start date on figures they aren't in.
  const sorted = captures.filter((c) => dayInMonthBefore(c) !== null).sort((a, z) => a.month.localeCompare(z.month));
  return {
    months,
    setAside: captures.length - months,
    earliestDay: rows.find((r) => r.captured > 0)?.day ?? null,
    halfBy: by(0.5),
    ninetyBy: by(0.9),
    first: sorted[0]!.month,
    last: sorted[sorted.length - 1]!.month,
  };
}

/** 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st, 22nd, 23rd, 31st. */
export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? "th" : n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th";
  return `${n}${suffix}`;
}
