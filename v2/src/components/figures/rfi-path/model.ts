/**
 * What the RFI figure shows, from the pieces the case page and the RFI page use: the RFI clock
 * the nightly backtest measures (perm_docs['estimator_backtest'].rfiClock), the RFIs our sweep
 * watched DOL issue (stage_stats.rfiPath), and the case page's own estimate (estimateRfiCase).
 * The example is an RFI issued today, so its dates are the ones the case page would print for
 * one. Pure: no clock, no DOM.
 */
import { estimateRfiCase, RFI_DUE_DAYS, type RfiClock } from "@/lib/perm";
import { sumOutcomes, type RfiPath } from "@/lib/stageMoves";
import { MS_PER_DAY } from "@/lib/time";
import { longDate } from "@convex/lib/months";

export interface RfiRun {
  /** The example RFI's first day, ISO: today. */
  rfiDay: string;
  /** DOL's response window, in days (the central constant). */
  dueDays: number;
  /** Days from the RFI to leaving RFI status: half had left by then (the clock's median). */
  leaveDay: number;
  /** Days from the RFI to the case page's date, and to the two ends of its range. */
  decideDay: number;
  earliestDay: number;
  latestDay: number;
  /** The same moments as dates, ISO. */
  dueDate: string;
  leaveDate: string;
  decideDate: string;
  earliestDate: string;
  latestDate: string;
  /** Days after leaving RFI: half and three in four were decided by then, and over how many cases. */
  afterHalf: number;
  afterThreeQuarters: number | null;
  afterWatched: number | null;
  /** RFIs watched from their first day, and the day the record begins. */
  watched: number;
  watchedFrom: string;
  /** Days after leaving RFI that the range's late end allows, and where that figure comes from. */
  slowEndDays: number;
  slowEndFrom: RfiClock["slowEndFrom"];
  /** RFIs decided after the reply was in, and how many of them were certified; null when none yet. */
  afterReply: { decided: number; certified: number } | null;
}

const dayNum = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / MS_PER_DAY);
const addDays = (iso: string, n: number) => new Date((dayNum(iso) + n) * MS_PER_DAY).toISOString().slice(0, 10);

/**
 * The run for an RFI issued `today`, or null when there's nothing honest to show: no measured
 * clock, or an estimate the rule refuses.
 */
export function buildRfiRun(input: { clock: RfiClock | null; path: RfiPath | null; today: string }): RfiRun | null {
  const { clock, path, today } = input;
  if (!clock) return null;
  const est = estimateRfiCase({ enteredOn: today, today, clock });
  if (est.kind !== "estimate") return null;
  const start = dayNum(today);
  const leaveDay = clock.leaveDays.p50;
  const afterReply = path ? sumOutcomes(path.afterReply) : 0;
  return {
    rfiDay: today,
    dueDays: RFI_DUE_DAYS,
    leaveDay,
    decideDay: dayNum(est.date) - start,
    earliestDay: dayNum(est.earliest) - start,
    latestDay: dayNum(est.latest) - start,
    dueDate: addDays(today, RFI_DUE_DAYS),
    leaveDate: addDays(today, leaveDay),
    decideDate: est.date,
    earliestDate: est.earliest,
    latestDate: est.latest,
    afterHalf: clock.afterLeaveDays.p50,
    afterThreeQuarters: clock.afterLeaveDays.p75,
    afterWatched: clock.afterLeaveWatched ?? null,
    watched: clock.watched,
    watchedFrom: clock.watchedFrom,
    slowEndDays: clock.slowEndDays,
    slowEndFrom: clock.slowEndFrom,
    afterReply: path && afterReply > 0 ? { decided: afterReply, certified: path.afterReply.certified } : null,
  };
}

/** The run starts this many days before the RFI, with the case still in the line. */
export const LEAD_DAYS = 6;

/** The readout `t` days after the RFI went out. */
export function rfiReading(run: RfiRun, t: number): string {
  const days = Math.round(t);
  if (days < 0) return `${longDate(addDays(run.rfiDay, days))}: the case is in analyst review, in filing order.`;
  if (days === 0) return `${longDate(run.rfiDay)}: DOL issues the RFI. The case leaves the line.`;
  if (days < run.leaveDay) {
    const left = run.dueDays - days;
    return left > 0
      ? `${longDate(addDays(run.rfiDay, days))}: day ${days} of the RFI. The employer has ${left} ${left === 1 ? "day" : "days"} left to answer.`
      : `${longDate(addDays(run.rfiDay, days))}: day ${days}. DOL's ${run.dueDays} days are up.`;
  }
  if (days < run.decideDay) return `${longDate(addDays(run.rfiDay, days))}: back in analyst review, out of filing order.`;
  return `Around ${longDate(run.decideDate)}: the date the case page gives, between ${longDate(run.earliestDate)} and ${longDate(run.latestDate)}.`;
}
