/**
 * Reading the RFI clock from the nightly backtest's doc
 * (perm_docs['estimator_backtest'].rfiClock, scripts/backtest_queue.py).
 * Plain module so the unit project tests it; the reader is
 * src/lib/turso/rfiClock.ts.
 */

import type { RfiClock } from "@/lib/perm";

type Num = number | null | undefined;
const num = (x: Num): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);

export function parseRfiClock(json: string | null): RfiClock | null {
  if (!json) return null;
  try {
    const c = (JSON.parse(json) as { rfiClock?: Record<string, unknown> }).rfiClock;
    if (!c) return null;
    const lv = (c.leaveDays ?? {}) as Record<string, Num>;
    const af = (c.afterLeaveDays ?? {}) as Record<string, Num>;
    const leaveP50 = num(lv.p50);
    const afterP50 = num(af.p50);
    const slow = num(c.slowEndDays as Num);
    const from = typeof c.watchedFrom === "string" ? c.watchedFrom : null;
    if (leaveP50 === null || afterP50 === null || slow === null || !from) return null;
    const t = c.test as RfiClock["test"] | undefined;
    return {
      leaveDays: { p25: num(lv.p25), p50: leaveP50, p75: num(lv.p75) },
      afterLeaveDays: { p25: num(af.p25), p50: afterP50, p75: num(af.p75), p90: num(af.p90) },
      slowEndDays: slow,
      slowEndFrom: c.slowEndFrom === "measured" ? "measured" : "an immigration attorney's estimate",
      watched: num(c.watched as Num) ?? 0,
      watchedFrom: from,
      test: t && typeof t.judged === "number" ? t : null,
    };
  } catch {
    return null;
  }
}
