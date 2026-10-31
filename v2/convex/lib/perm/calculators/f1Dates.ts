import { addDays, differenceInCalendarDays, format, isValid, parseISO } from "date-fns";

/**
 * Three dates people on F-1 and H-1B ask about, each from the regulation as eCFR printed it on Oct 28 2026:
 *
 *  - Cap-gap, 8 CFR 214.2(f)(5)(vii)(A): the status, and any post-completion or STEM OPT work authorization, of an
 *    F-1 student named in a timely filed, nonfrivolous H-1B cap petition asking for a change of status "will be
 *    automatically extended until April 1 of the fiscal year for which such H-1B status is being requested or until
 *    the validity start date of the approved petition, whichever is earlier" (April 1 since the H-1B modernization
 *    rule, 89 FR 103054, effective Jan 17 2025; it was October 1 before). It ends at once if the petition or the change of status is
 *    rejected, denied, revoked or withdrawn, (vii)(B).
 *  - OPT unemployment, 8 CFR 214.2(f)(10)(ii)(E): no more than 90 days in all during post-completion OPT; 150 in all
 *    once a 24-month STEM extension is granted, the first OPT period included.
 *  - The 240-day rule, 8 CFR 274a.12(b)(20): an H-1B (and the other listed classes) whose stay has expired, with an
 *    extension timely filed, may keep working for the same employer "for a period not to exceed 240 days beginning
 *    on the date of the expiration of the authorized period of stay", ending early on a denial.
 *
 * Arithmetic only. Whether a petition was timely, nonfrivolous, or the employer the same is a finding.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const iso = (d: Date) => format(d, "yyyy-MM-dd");

function day(name: string, v: string): Date {
  const d = parseISO(v);
  if (!DATE_RE.test(v) || !isValid(d) || iso(d) !== v) throw new Error(`${name}: expected a real date as YYYY-MM-DD, got ${JSON.stringify(v)}`);
  return d;
}

/** The federal fiscal year a day falls in: October to September, named by the year it ends. */
export function fiscalYearOfDay(isoDay: string): number {
  const d = day("isoDay", isoDay);
  return d.getFullYear() + (d.getMonth() >= 9 ? 1 : 0);
}

export interface CapGapInput {
  /** The H-1B start date the petition asks for (usually October 1). */
  requestedStart: string;
  /** The approved petition's validity start date, once approved. */
  approvedStart?: string;
  /** The day the petition was filed. */
  filed: string;
  /** The last day of the OPT work authorization (the EAD's end, or the STEM extension's). */
  optEnds: string;
}

export interface CapGapResult {
  fiscalYear: number;
  /** April 1 of that fiscal year. */
  aprilFirst: string;
  /** The day the extension runs until: April 1, or the approved start if earlier. */
  until: string;
  byApproval: boolean;
  /** The OPT was still valid on the day the petition was filed, so there is work authorization to extend. */
  optValidAtFiling: boolean;
  /** The OPT ends before the H-1B starts: the gap the rule exists for. */
  gap: boolean;
}

export function calculateCapGap(input: CapGapInput): CapGapResult {
  const fiscalYear = fiscalYearOfDay(input.requestedStart);
  day("filed", input.filed);
  day("optEnds", input.optEnds);
  if (input.approvedStart) day("approvedStart", input.approvedStart);
  const aprilFirst = `${fiscalYear}-04-01`;
  const byApproval = Boolean(input.approvedStart && input.approvedStart < aprilFirst);
  const until = byApproval ? input.approvedStart! : aprilFirst;
  return {
    fiscalYear,
    aprilFirst,
    until,
    byApproval,
    optValidAtFiling: input.filed <= input.optEnds,
    gap: input.optEnds < (input.approvedStart ?? input.requestedStart),
  };
}

export const OPT_UNEMPLOYMENT_DAYS = 90;
export const STEM_OPT_UNEMPLOYMENT_DAYS = 150;

export interface OptUnemploymentInput {
  /** A 24-month STEM extension has been granted. */
  stem: boolean;
  /** Days of unemployment already counted before the current stretch. */
  usedBefore: number;
  /** The first day of the current stretch without work, if there is one. */
  unemployedSince?: string;
  today: string;
}

export interface OptUnemploymentResult {
  limit: number;
  /** Days counted so far, the current stretch through today included. */
  used: number;
  left: number;
  /** The day the limit is reached if the current stretch goes on: the last day still inside it. */
  lastDay: string | null;
  over: boolean;
}

export function calculateOptUnemployment(input: OptUnemploymentInput): OptUnemploymentResult {
  const limit = input.stem ? STEM_OPT_UNEMPLOYMENT_DAYS : OPT_UNEMPLOYMENT_DAYS;
  const before = Math.max(0, Math.floor(input.usedBefore));
  const today = day("today", input.today);
  let current = 0;
  let lastDay: string | null = null;
  if (input.unemployedSince) {
    const since = day("unemployedSince", input.unemployedSince);
    // Every day without work counts, the first one and today included.
    current = Math.max(0, differenceInCalendarDays(today, since) + 1);
    lastDay = iso(addDays(since, limit - before - 1));
  }
  const used = before + current;
  return { limit, used, left: Math.max(0, limit - used), lastDay, over: used > limit };
}

export const EXTENSION_PENDING_DAYS = 240;

export interface PendingExtensionResult {
  /** The last day of the 240, counting the I-94's end date as the first (the reading that ends earliest). */
  lastDay: string;
  /** The same count starting the day after the I-94 ends: one day later. */
  lastDayCountingFromNext: string;
  /** The extension was filed on or before the I-94's end: timely, as the rule needs. */
  filedInTime: boolean;
}

export function calculatePendingExtension(input: { i94Ends: string; extensionFiled: string }): PendingExtensionResult {
  const end = day("i94Ends", input.i94Ends);
  day("extensionFiled", input.extensionFiled);
  return {
    lastDay: iso(addDays(end, EXTENSION_PENDING_DAYS - 1)),
    lastDayCountingFromNext: iso(addDays(end, EXTENSION_PENDING_DAYS)),
    filedInTime: input.extensionFiled <= input.i94Ends,
  };
}
