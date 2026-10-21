/**
 * What the two-clocks figure says, from the central rule (calculatePriorityDateRetention, 8 CFR
 * 205.1(a)(3)(iii)(C) and INA 204(j)): the day an employer's withdrawal stops revoking the I-140,
 * the day the I-485 can move to a new job, and, for any day the reader leaves, which of the two
 * holds. Pure, so the server's render and the browser's first render say the same thing. The
 * dates are the "three 180-day clocks" guide's own worked example.
 */
import { calculatePriorityDateRetention } from "@/lib/perm";
import { monthDay } from "@convex/lib/months";
import { MS_PER_DAY } from "@/lib/time";

export const APPROVED = "2026-04-20";
export const I485_FILED = "2026-05-04";
const rule = calculatePriorityDateRetention({ i140Approved: APPROVED, i485Filed: I485_FILED });
/** From this day an employer's withdrawal no longer revokes the I-140. */
export const SAFE_FROM = rule.withdrawalSafeFrom;
/** From this day the I-485 can move to a same or similar job. */
export const PORTABLE_FROM = rule.portableFrom!;

const dayOf = (iso: string) => Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${APPROVED}T00:00:00Z`)) / MS_PER_DAY);
const iso = (day: number) => new Date(Date.parse(`${APPROVED}T00:00:00Z`) + day * MS_PER_DAY).toISOString().slice(0, 10);

/** Days from the approval: where each lane starts and ends. */
export const I485_DAY = dayOf(I485_FILED);
export const SAFE_DAY = dayOf(SAFE_FROM);
export const PORTABLE_DAY = dayOf(PORTABLE_FROM);
/** The leaving day's sweep: from the approval to three weeks after the I-485's 180 days. */
export const LEAVE_MIN = 0;
export const LEAVE_MAX = PORTABLE_DAY + 21;

export interface ClocksReading {
  leave: string;
  /** Whether a withdrawal on the leaving day would leave the I-140 approved. */
  i140Holds: boolean;
  /** Whether the I-485 can move to a same or similar job on the leaving day. */
  portable: boolean;
  sentence: string;
}

/** The reading for leaving `day` days after the I-140 approval. */
export function readClocks(day: number): ClocksReading {
  const leave = iso(day);
  const r = calculatePriorityDateRetention({ i140Approved: APPROVED, i485Filed: I485_FILED, employerWithdrew: leave });
  const i140Holds = !r.withdrawal!.autoRevokes;
  const portable = leave >= PORTABLE_FROM;
  const sentence = !i140Holds
    ? `Leave on ${monthDay(leave)}: a withdrawal would revoke the I-140, and the I-485 can't move yet.`
    : !portable
      ? `Leave on ${monthDay(leave)}: the I-140 survives a withdrawal, but the I-485 can't move until ${monthDay(PORTABLE_FROM)}.`
      : `Leave on ${monthDay(leave)}: the I-140 survives a withdrawal, and the I-485 can move to a same or similar job.`;
  return { leave, i140Holds, portable, sentence };
}
