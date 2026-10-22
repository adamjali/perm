/**
 * What the wage-queue figure shows, from the same pieces the wage-request lookup uses: the PERM
 * wage requests DOL has in process by filing day and its pace a working day
 * (perm_docs['pwd_day_queue'], src/lib/pwdDay.ts), and the day estimate itself (estimatePwdDay:
 * the requests filed earlier over that pace, walked in the days DOL works from the day the count
 * covers). The figure runs that walk forward as a time-lapse in working days, so the picked month
 * reaches the front, and its last day is done, on the days the lookup would give. Pure: no clock,
 * no DOM.
 */
import { addBusinessDays, estimatePwdDay, type PwdDayQueue } from "@/lib/perm";
import { longDate, monthYear } from "@convex/lib/months";
import type { QueueMonth } from "../dol-queue/model";

export interface PwdQueueRun {
  /** The months drawn, oldest first: from the month before DOL's to the newest. */
  months: QueueMonth[];
  /** Requests in process filed before the first drawn month (they go first). */
  earlier: number;
  /** Requests DOL finishes a working day, and over how many working days that was measured. */
  pace: number;
  paceDays: number;
  /** The day the count covers: the queue as DOL left it, `YYYY-MM-DD`. */
  counted: string;
  /** The month the reader watches, YYYY-MM. */
  pick: string;
  /** DOL's published month for PERM wage requests on the OEWS survey, and the date DOL published it. */
  dolMonth: string;
  dolAsOf: string | null;
  /** Requests ahead of the picked month's first and last filing day, by the estimator's rule. */
  aheadReach: number;
  aheadEnd: number;
  /** Working days from the count to each moment, unrounded: where the time-lapse holds. */
  reachWork: number;
  endWork: number;
  /** The estimator's own dates for a request filed on the picked month's first and last day. */
  reachDate: string;
  endDate: string;
}

const index = (ym: string) => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1;
const monthOf = (i: number) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
const lastDay = (ym: string) => new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).toISOString().slice(0, 10);
const dayBefore = (iso: string) => new Date(Date.parse(`${iso}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

/** Requests filed before `day`, with that day's own counted half: estimatePwdDay's rule. */
function aheadOf(queue: PwdDayQueue, day: string): number {
  let ahead = 0;
  for (const [fd, n] of queue.byDay) {
    if (fd < day) ahead += n;
    else if (fd === day) ahead += n / 2;
  }
  return ahead;
}

/**
 * The run for today's count, or null when there's nothing honest to show: no DOL month, a count
 * the estimator calls stale, or no requests in the picked month.
 */
export function buildPwdQueueRun(input: {
  queue: PwdDayQueue | null;
  dolMonth: string | null;
  dolAsOf?: string | null;
  today: string;
  /** Months after DOL's published one that the reader watches (3: a typical request still waiting). */
  pickAfter?: number;
}): PwdQueueRun | null {
  const { queue, dolMonth, dolAsOf = null, today, pickAfter = 3 } = input;
  if (!queue || !dolMonth || !/^\d{4}-\d{2}$/.test(dolMonth)) return null;
  const byMonth = new Map<string, number>();
  for (const [fd, n] of queue.byDay) byMonth.set(fd.slice(0, 7), (byMonth.get(fd.slice(0, 7)) ?? 0) + n);
  const first = monthOf(index(dolMonth) - 1);
  const held = [...byMonth.keys()].sort();
  const months = held.filter((m) => m >= first).map((m) => ({ month: m, inLine: byMonth.get(m)! }));
  const earlier = held.filter((m) => m < first).reduce((sum, m) => sum + byMonth.get(m)!, 0);
  // The month to watch: three after DOL's, or the newest before it that has requests waiting.
  let pick = monthOf(index(dolMonth) + pickAfter);
  while (!byMonth.get(pick) && index(pick) > index(dolMonth) + 1) pick = monthOf(index(pick) - 1);
  if (!byMonth.get(pick)) return null;

  const firstDay = `${pick}-01`;
  const endDay = lastDay(pick);
  const reach = estimatePwdDay({ filingDate: firstDay, today, queue });
  const end = estimatePwdDay({ filingDate: endDay, today, queue });
  if (reach.kind !== "estimate" || end.kind !== "estimate") return null;
  const aheadReach = aheadOf(queue, firstDay);
  const aheadEnd = aheadOf(queue, endDay);
  return {
    months,
    earlier,
    pace: queue.pace.perWorkday,
    paceDays: queue.pace.workdaysUsed,
    counted: dayBefore(queue.asOf),
    pick,
    dolMonth,
    dolAsOf,
    aheadReach,
    aheadEnd,
    reachWork: aheadReach / queue.pace.perWorkday,
    endWork: aheadEnd / queue.pace.perWorkday,
    reachDate: reach.date,
    endDate: end.date,
  };
}

/** What's left in line, month by month, `w` working days into the run (DOL works the oldest first). */
export function pwdRemainingAt(run: PwdQueueRun, w: number): { earlier: number; months: number[] } {
  let decided = Math.max(0, run.pace * w);
  const earlier = Math.max(0, run.earlier - decided);
  decided = Math.max(0, decided - run.earlier);
  const months = run.months.map((m) => {
    const left = Math.max(0, m.inLine - decided);
    decided = Math.max(0, decided - m.inLine);
    return left;
  });
  return { earlier, months };
}

/** The oldest drawn month with requests left `w` working days in: the front tray. */
export function pwdFrontMonth(run: PwdQueueRun, w: number): string {
  const left = pwdRemainingAt(run, w);
  return run.months.find((_, i) => left.months[i]! > 0)?.month ?? run.pick;
}

/** The calendar day `w` working days after the count, the way the estimator walks: weekends and holidays skipped. */
export function pwdDayAt(run: PwdQueueRun, w: number): string {
  const n = Math.round(w);
  return n < 1 ? run.counted : addBusinessDays(run.counted, n);
}

/** The readout `w` working days into the run. */
export function pwdReading(run: PwdQueueRun, w: number): string {
  if (w >= run.endWork) return `Around ${longDate(run.endDate)}: requests filed on the last day of ${monthYear(run.pick)} are decided.`;
  if (w >= run.reachWork) return `Around ${longDate(run.reachDate)}: the line reaches ${monthYear(run.pick)}.`;
  const day = pwdDayAt(run, w);
  const lead = w < 0.5 ? `${longDate(day)}, as DOL left it` : longDate(day);
  // A month older than the one DOL publishes is its tail: say so, beside a page that quotes DOL's month.
  const front = pwdFrontMonth(run, w);
  if (index(front) < index(run.dolMonth)) return `${lead}: DOL is finishing ${monthYear(front)}'s last requests.`;
  return `${lead}: the front tray is ${monthYear(front)}.`;
}
