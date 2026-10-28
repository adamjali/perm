import { MONTH_ABBR } from "@convex/lib/months";

/** One labelled mark on the plan's time axis. */
export interface Tick {
  /** The first of the month it marks, ISO. */
  iso: string;
  /** "Apr", or the year at a January ("2027"), or both on the first mark ("Apr 2027"). */
  label: string;
  /** A January: drawn a little stronger. */
  year: boolean;
}

/** The months between labels, the first that keeps the axis to `TICKS_MAX` labels. */
const MONTH_STEPS = [1, 2, 3, 6, 12, 24, 60, 120, 240] as const;
export const TICKS_MAX = 12;

const indexOf = (iso: string) => Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7)) - 1;

/**
 * The labelled months between two days: every month on a short plan, every quarter or half
 * year on a longer one, whole years (every 5th, 10th, 20th) on a decades-long one. Months fall on
 * the calendar (Jan, Apr, Jul, Oct for quarters), a January reads as its year, and the first mark
 * carries its year so the axis never shows months with no year.
 */
export function axisTicks(fromIso: string, toIso: string): Tick[] {
  const first = indexOf(fromIso) + 1;
  const last = indexOf(toIso);
  if (last < first) return [];
  const step = MONTH_STEPS.find((n) => Math.ceil((last - first + 1) / n) <= TICKS_MAX) ?? MONTH_STEPS[MONTH_STEPS.length - 1]!;
  const out: Tick[] = [];
  for (let i = first; i <= last; i++) {
    const y = Math.floor(i / 12);
    const m = i % 12;
    const on = step < 12 ? m % step === 0 : m === 0 && y % (step / 12) === 0;
    if (!on) continue;
    const label = m === 0 ? String(y) : out.length === 0 ? `${MONTH_ABBR[m]} ${y}` : MONTH_ABBR[m]!;
    out.push({ iso: `${y}-${String(m + 1).padStart(2, "0")}-01`, label, year: m === 0 });
  }
  return out;
}
