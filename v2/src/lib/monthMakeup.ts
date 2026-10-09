/**
 * One filing month in five numbers, for the month page's headline: how much
 * of it DOL has decided and how, how much is still in its ordinary line, and
 * how much is pending outside it (on hold, at an RFI, on appeal).
 *
 * Pure, so the unit project holds it.
 */

import { ORDINARY_QUEUE, type StatusCount } from "@/lib/liveQueue";

export interface MonthMakeup {
  total: number;
  decided: number;
  certified: number;
  denied: number;
  /** The employer withdrew: a decision on DOL's clock, not DOL's. */
  withdrawn: number;
  /** Any other final status (a lapsed certification counts as certified). */
  otherDecided: number;
  /** Pending in analyst review: DOL's ordinary line, worked in filing order. */
  inLine: number;
  /** Pending anywhere else: hold, RFI, NORD, supervised recruitment, appeal. */
  outside: number;
}

export function monthMakeup(statuses: readonly StatusCount[]): MonthMakeup {
  const m: MonthMakeup = { total: 0, decided: 0, certified: 0, denied: 0, withdrawn: 0, otherDecided: 0, inLine: 0, outside: 0 };
  for (const s of statuses) {
    const n = s.count;
    m.total += n;
    const status = s.status.toUpperCase();
    if (!s.isFinal) {
      if (status === ORDINARY_QUEUE) m.inLine += n;
      else m.outside += n;
      continue;
    }
    m.decided += n;
    if (status.startsWith("WITHDRAWN")) m.withdrawn += n;
    else if (status.startsWith("CERTIFIED")) m.certified += n;
    else if (status.startsWith("DENIED")) m.denied += n;
    else m.otherDecided += n;
  }
  return m;
}
