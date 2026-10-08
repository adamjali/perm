/**
 * A PERM case at RFI ISSUED, dated from its own RFI day.
 *
 * An RFI takes a case out of filing order, so the cases-ahead date doesn't
 * apply. The record says what does (scripts/backtest_queue.py, `rfiClock` in
 * perm_docs['estimator_backtest'], re-measured every night from every RFI our
 * sweep watched from the day it began):
 *
 *   - cases leave RFI on day 30 to 32 (the response window; AILA's notes of an
 *     OFLC panel, Sep 27 2024, give it as 30 days, and our sweep sees the move
 *     a day after DOL makes it);
 *   - most go back to analyst review and DOL decides them a few days later.
 *
 * So the date is the RFI day plus the two medians, the range runs from the two
 * early quartiles to the 30 days plus the slow end, and the slow end is the
 * record's own 90th percentile once it can be read, the attorney's two weeks
 * until then. No range is wider than MAX_BAND_DAYS.
 */

import { boundRange } from './decisionPace';

export interface RfiClock {
  /** Days from entering RFI to leaving it. */
  leaveDays: { p25: number | null; p50: number; p75: number | null };
  /** Days from leaving RFI (back to a pending status) to DOL's decision. */
  afterLeaveDays: { p25: number | null; p50: number; p75: number | null; p90: number | null };
  /** Days after leaving that the range's late end allows. */
  slowEndDays: number;
  slowEndFrom: 'measured' | "an immigration attorney's estimate";
  /** RFIs watched from their first day. */
  watched: number;
  /** The first day of our record: an RFI begun on or before it has no known start. */
  watchedFrom: string;
  /** The out-of-sample test, once the record is long enough; null before. */
  test: { judged: number; decided: number; typicalMissDays: number | null; insideShare: number; stuckShare: number } | null;
}

export type RfiEstimate =
  | {
      kind: 'estimate';
      /** `YYYY-MM-DD` */
      date: string;
      earliest: string;
      latest: string;
      /** Days the case has been at RFI. */
      daysInRfi: number;
    }
  | { kind: 'refused'; reason: 'start-unknown' | 'past-window'; detail: string };

const dayNum = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);
const isoOf = (n: number) => new Date(n * 86_400_000).toISOString().slice(0, 10);

export function estimateRfiCase(input: {
  /** The day our sweep saw the case enter RFI, `YYYY-MM-DD`, or null. */
  enteredOn: string | null;
  today: string;
  clock: RfiClock;
}): RfiEstimate {
  const { enteredOn, clock } = input;
  if (!enteredOn || enteredOn <= clock.watchedFrom) {
    return {
      kind: 'refused',
      reason: 'start-unknown',
      detail: 'This RFI began before our daily record of DOL did, so the day it began, which the date counts from, is unknown.',
    };
  }
  const start = dayNum(enteredOn);
  const today = dayNum(input.today);
  const lv = clock.leaveDays;
  const af = clock.afterLeaveDays;
  const day = start + lv.p50 + af.p50;
  const lateEnd = start + (lv.p75 ?? lv.p50) + clock.slowEndDays;
  if (today > lateEnd) {
    return {
      kind: 'refused',
      reason: 'past-window',
      detail: `This RFI has run ${today - start} days, past the usual 30 and the days DOL usually takes after them. A case still at RFI by now usually has an extension or a second request, and neither can be dated.`,
    };
  }
  const [early, late] = boundRange(Math.max(day, today), start + (lv.p25 ?? lv.p50) + (af.p25 ?? 0), lateEnd, today);
  return {
    kind: 'estimate',
    date: isoOf(Math.max(day, today)),
    earliest: isoOf(early),
    latest: isoOf(late),
    daysInRfi: today - start,
  };
}
