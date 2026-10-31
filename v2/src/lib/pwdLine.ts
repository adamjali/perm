/**
 * Where DOL really is in the PERM wage-request line, from our own daily check
 * of DOL's case-status service (perm_docs['pwd_day_queue']: requests still in
 * process and requests filed, each filing day). DOL's own published month
 * trails it by weeks: on Oct 30 2026 DOL's figure of Sep 30 said June 2026
 * while our check showed July 27's requests being decided (owner, Oct 31:
 * "why do we have not as up to date data?").
 *
 * The working day is the earliest busy filing day (BUSY_DAY requests or more)
 * that DOL hasn't decided half of. Quiet days (weekends, holidays) are skipped,
 * because a handful of requests can't say where the line is. Plain module so
 * the unit project tests it; the reader is src/lib/db/pwdDayQueue.ts.
 */

import { longDate } from "@convex/lib/months";

/** A filing day with at least this many requests says where the line is. */
export const BUSY_DAY = 100;
/** A busy day below this share decided is the one DOL is working through. */
export const WORKING_BELOW = 0.5;

export interface PwdLine {
  /** The filing day DOL is deciding now (ISO). */
  day: string;
  /** Requests filed that day, and the share of them decided. */
  filed: number;
  decidedShare: number;
  /** The busy day before it, and how much of it is decided. */
  before: { day: string; decidedShare: number } | null;
  /** The day our check ran (ISO), and the days between filing and it. */
  asOf: string;
  waitDays: number;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const ms = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

export function sweepPwdLine(queueJson: string | null): PwdLine | null {
  if (!queueJson) return null;
  let q: { asOf?: unknown; byDay?: unknown; filedByDay?: unknown };
  try {
    q = JSON.parse(queueJson);
  } catch {
    return null;
  }
  if (typeof q.asOf !== "string" || !DAY.test(q.asOf) || !Array.isArray(q.filedByDay) || !Array.isArray(q.byDay)) return null;
  const waiting = new Map<string, number>();
  for (const r of q.byDay as unknown[]) {
    if (Array.isArray(r) && typeof r[0] === "string") waiting.set(r[0], Number(r[1]) || 0);
  }
  const busy: { day: string; filed: number; share: number }[] = [];
  for (const r of q.filedByDay as unknown[]) {
    if (!Array.isArray(r) || typeof r[0] !== "string" || !DAY.test(r[0])) continue;
    const filed = Number(r[1]);
    if (!Number.isFinite(filed) || filed < BUSY_DAY) continue;
    const left = Math.min(waiting.get(r[0]) ?? 0, filed);
    busy.push({ day: r[0], filed, share: (filed - left) / filed });
  }
  busy.sort((a, b) => (a.day < b.day ? -1 : 1));
  const at = busy.findIndex((d) => d.share < WORKING_BELOW);
  // The first busy day on record still mostly waiting means the record doesn't
  // reach back far enough to see where DOL is: say nothing rather than guess.
  if (at <= 0) return null;
  const now = busy[at]!;
  const prev = busy[at - 1]!;
  return {
    day: now.day,
    filed: now.filed,
    decidedShare: now.share,
    before: { day: prev.day, decidedShare: prev.share },
    asOf: q.asOf,
    waitDays: Math.round((ms(q.asOf) - ms(now.day)) / 86_400_000),
  };
}

/** "about 3 months" (or weeks under two months) between a filing and the check. */
export function waitPhrase(days: number): string {
  if (days < 60) {
    const w = Math.max(1, Math.round(days / 7));
    return `about ${w} ${w === 1 ? "week" : "weeks"}`;
  }
  const m = Math.round((days / 30.44) * 2) / 2;
  return `about ${m % 1 ? m.toFixed(1) : m} months`;
}

/**
 * The sentence an article or a page quotes: our check first, DOL's own dated
 * month after it, so a reader who meets DOL's month elsewhere sees why the two
 * differ. `dol` is lib/dolNow.ts's reading of DOL's table.
 */
export function lineSentence(line: PwdLine, dol: { frontier: string | null; asOf: string | null }): string {
  const head = `By our daily check of DOL's case status on ${longDate(line.asOf)}, DOL is deciding PERM wage requests filed on ${longDate(line.day)}, ${waitPhrase(line.waitDays)} after they were filed.`;
  if (!dol.frontier) return head;
  return `${head} DOL's own table${dol.asOf ? `, dated ${dol.asOf},` : ""} names ${dol.frontier}.`;
}

/** "about 3 months as of October 30, 2026": the wait alone, for a list or a table cell. */
export function lineWait(line: PwdLine): string {
  return `${waitPhrase(line.waitDays)} as of ${longDate(line.asOf)}`;
}
