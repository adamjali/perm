/**
 * What the queue figure shows, from the same pieces the queue month pages use: the cases in line
 * (analyst review) by filing month, DOL's recent pace (cases decided per calendar day), and the
 * estimate's own date arithmetic (estimateByPace: today plus the cases ahead over the pace,
 * rounded to whole days). The figure runs that arithmetic forward as a time-lapse, so the day the
 * picked month reaches the front is the day the estimate gives. Pure: no clock, no DOM.
 */
import { estimateByPace, type MeasuredPace } from "@/lib/perm";
import { monthEndDate, type BacklogRow } from "@/lib/caseEstimateInputs";
import { MS_PER_DAY } from "@/lib/time";
import { inLine } from "@/lib/queueAhead";
import { longDate, monthYear } from "@convex/lib/months";


export interface QueueMonth {
  month: string;
  inLine: number;
}

export interface QueueRun {
  /** The months drawn, oldest first: from the month before DOL's to the newest. */
  months: QueueMonth[];
  /** Cases in line from months older than the first drawn (they go first). */
  earlier: number;
  /** Cases DOL decides per calendar day, as measured (MeasuredPace.pace), and over how many days. */
  pace: number;
  paceDays: number;
  /** The run's first day, ISO: today. */
  today: string;
  /** The month the reader watches, YYYY-MM. */
  pick: string;
  /** DOL's published month, YYYY-MM, and the date DOL published it. */
  dolMonth: string;
  dolAsOf: string | null;
  /** Days from today until the picked month reaches the front, and until its last case does. */
  reachDays: number;
  endDays: number;
  /** The estimate's dates for those two moments, ISO. */
  reachDate: string;
  endDate: string;
}

const index = (ym: string) => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1;
const monthOf = (i: number) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * MS_PER_DAY).toISOString().slice(0, 10);

/**
 * The run for today's line, or null when there's nothing honest to show: no pace, no published
 * month, or an estimate the rules refuse (stale data, beyond the horizon).
 */
export function buildQueueRun(input: {
  backlog: readonly BacklogRow[];
  pace: MeasuredPace | null;
  dolMonth: string | null;
  dolAsOf?: string | null;
  sweepFinishedOn: string | null;
  today: string;
  /** Months after DOL's that the reader watches (3: a typical case still waiting). */
  pickAfter?: number;
}): QueueRun | null {
  const { backlog, pace, dolMonth, dolAsOf = null, sweepFinishedOn, today, pickAfter = 3 } = input;
  if (!pace || !dolMonth) return null;
  const sorted = [...backlog].sort((a, b) => a.month.localeCompare(b.month));
  const first = monthOf(index(dolMonth) - 1);
  const months = sorted.filter((m) => m.month >= first).map((m) => ({ month: m.month, inLine: inLine(m) }));
  const earlier = sorted.filter((m) => m.month < first).reduce((sum, m) => sum + inLine(m), 0);
  const pick = monthOf(index(dolMonth) + pickAfter);
  const picked = months.find((m) => m.month === pick);
  if (!picked || picked.inLine === 0) return null;

  const ahead = earlier + months.filter((m) => m.month < pick).reduce((sum, m) => sum + m.inLine, 0);
  const sweepAgeDays = sweepFinishedOn ? Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${sweepFinishedOn}T00:00:00Z`)) / MS_PER_DAY) : 0;
  const reach = estimateByPace({
    today: Math.floor(Date.parse(`${today}T00:00:00Z`) / MS_PER_DAY),
    casesAhead: ahead,
    pace,
    status: "ANALYST REVIEW",
    monthsBehindFrontier: index(pick) - index(dolMonth),
    sweepAgeDays,
  });
  const end = monthEndDate({ backlog, month: pick, pace, frontierMonth: dolMonth, sweepFinishedOn, today });
  if (reach.kind !== "estimate" || end?.kind !== "estimate") return null;
  const reachDate = new Date(reach.day * MS_PER_DAY).toISOString().slice(0, 10);
  const daysTo = (iso: string) => Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / MS_PER_DAY);
  return {
    months,
    earlier,
    pace: pace.pace,
    paceDays: pace.daysUsed,
    today,
    pick,
    dolMonth,
    dolAsOf,
    reachDays: daysTo(reachDate),
    endDays: daysTo(end.date),
    reachDate,
    endDate: end.date,
  };
}

/** What's left in line, month by month, `t` days into the run (DOL works the oldest first). */
export function remainingAt(run: QueueRun, t: number): { earlier: number; months: number[] } {
  let decided = Math.max(0, run.pace * t);
  const earlier = Math.max(0, run.earlier - decided);
  decided = Math.max(0, decided - run.earlier);
  const months = run.months.map((m) => {
    const left = Math.max(0, m.inLine - decided);
    decided = Math.max(0, decided - m.inLine);
    return left;
  });
  return { earlier, months };
}

/** The oldest drawn month with cases left `t` days into the run: the front tray. */
export function frontMonth(run: QueueRun, t: number): string {
  const left = remainingAt(run, t);
  return run.months.find((_, i) => left.months[i]! > 0)?.month ?? run.pick;
}

/** The readout `t` days into the run: the day, and where the line is. */
export function queueReading(run: QueueRun, t: number): string {
  const days = Math.round(t);
  if (days >= run.endDays) return `Around ${longDate(run.endDate)}: the line reaches the end of ${monthYear(run.pick)}.`;
  if (days >= run.reachDays) return `Around ${longDate(run.reachDate)}: the line reaches ${monthYear(run.pick)}.`;
  // The front tray: the oldest drawn month with cases left (the few older ones sit on the desk). A month older
  // than the one DOL publishes is its tail, so the words say so beside a page that quotes DOL's month.
  const front = frontMonth(run, t);
  const when = longDate(addDays(run.today, days));
  if (index(front) < index(run.dolMonth)) return `${when}: DOL is finishing ${monthYear(front)}'s last cases.`;
  return `${when}: the front tray is ${monthYear(front)}.`;
}
