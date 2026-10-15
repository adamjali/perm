/**
 * Reading the wage-request day estimate's two docs: the sweep's count of PERM
 * wage requests in process with DOL's measured pace
 * (perm_docs['pwd_day_queue'], written after every PWD pass), and the range
 * the nightly backtest measured for each distance (perm_docs['pwd_backtest']
 * .day). Plain module so the unit project tests it; the reader is
 * src/lib/db/pwdDayQueue.ts.
 *
 * Both are on DOL's days since Oct 15 2026 (`clock: "dol"` on the count,
 * `unit: "workday"` on the backtest's day section). A count written before
 * then dates each exit by the morning our sweep saw it, which is the day
 * after DOL made it, so its days are moved back one. A backtest written
 * before then measured the retired calendar-day method: its range and its
 * test line describe a different date, so neither is used.
 */

import { measureWorkdayPace, type MeasuredRangeRow, type PwdDayQueue } from "@/lib/perm";

export interface PwdDayData {
  queue: PwdDayQueue;
  measuredRange: MeasuredRangeRow[];
  /** The backtest's newest start day with enough decided requests to quote. */
  tested: { decided: number; typicalMissDays: number; within7Share: number | null; through: string } | null;
}

/** A start day is quoted once this many of its requests have been decided. */
const TESTED_MIN = 100;

type Num = number | null | undefined;
const isNum = (x: Num): x is number => typeof x === "number" && Number.isFinite(x);

export function parsePwdDayData(queueJson: string | null, backtestJson: string | null): PwdDayData | null {
  if (!queueJson) return null;
  let q: { asOf?: string; clock?: string; byDay?: unknown; days?: { date?: string; n?: number }[] };
  try {
    q = JSON.parse(queueJson);
  } catch {
    return null;
  }
  if (!q.asOf || !Array.isArray(q.byDay) || !Array.isArray(q.days)) return null;
  const byDay: [string, number][] = [];
  for (const r of q.byDay as unknown[]) {
    if (Array.isArray(r) && typeof r[0] === "string" && isNum(Number(r[1]))) byDay.push([r[0], Number(r[1])]);
  }
  const shift = q.clock === "dol" ? 0 : 1;
  const days: { date: string; n: number }[] = [];
  for (const d of q.days) {
    const t = Date.parse(`${d.date}T00:00:00Z`);
    const n = Number(d.n);
    if (Number.isNaN(t) || !Number.isFinite(n)) continue;
    days.push({ date: new Date(t - shift * 86_400_000).toISOString().slice(0, 10), n });
  }
  const pace = measureWorkdayPace(days);
  if (!pace || byDay.length === 0) return null;

  const measuredRange: MeasuredRangeRow[] = [];
  let tested: PwdDayData["tested"] = null;
  if (backtestJson) {
    try {
      const b = JSON.parse(backtestJson) as {
        end?: string;
        day?: {
          unit?: string;
          rangeModel?: Record<string, Num>[];
          origins?: { day?: { decided?: number; typicalMissDays?: Num; within7Share?: Num } }[];
        };
      };
      const current = b.day?.unit === "workday";
      for (const r of current ? b.day?.rangeModel ?? [] : []) {
        if ([r.fromDays, r.toDays, r.earlyDays, r.lateDays].every(isNum)) {
          measuredRange.push({
            fromDays: r.fromDays as number,
            toDays: r.toDays as number,
            earlyDays: Math.min(0, r.earlyDays as number),
            lateDays: Math.max(0, r.lateDays as number),
          });
        }
      }
      const origins = current ? b.day?.origins ?? [] : [];
      for (let i = origins.length - 1; i >= 0; i--) {
        const s = origins[i]?.day;
        if (s && isNum(s.decided) && s.decided >= TESTED_MIN && isNum(s.typicalMissDays) && b.end) {
          tested = {
            decided: s.decided,
            typicalMissDays: s.typicalMissDays,
            within7Share: isNum(s.within7Share) ? s.within7Share : null,
            through: b.end,
          };
          break;
        }
      }
    } catch {
      // The range and the test line are extras; the date stands without them.
    }
  }
  return { queue: { asOf: q.asOf, byDay, pace }, measuredRange, tested };
}
