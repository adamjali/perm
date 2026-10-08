/**
 * Reading the nightly backtest's measurement of the printed pace range
 * (perm_docs['estimator_backtest']). Plain module so the unit project tests
 * the rules; the reader is src/lib/turso/rangeCoverage.ts.
 */

import { SERVED_MIN_JUDGED, type MeasuredBucket, type RangeCoverage } from "@/lib/perm";

/*
 * NO FALLBACK ON AGE (owner, Oct 8 2026). The newest measurement is always
 * used, because a measured range from last week beats the pace rule today.
 * The test is kept running instead: it runs nightly on GitHub's full pass and
 * again on the server's own clock (permtracker-uscis@backtests), the health
 * check fails `estimator_backtest` past 3 days, and the scorecard alarm says so
 * in the morning email.
 */

type Num = number | null | undefined;
const isNum = (x: Num): x is number => typeof x === "number" && Number.isFinite(x);

function bucketsOf(raw: unknown): MeasuredBucket[] {
  if (!Array.isArray(raw)) return [];
  const out: MeasuredBucket[] = [];
  for (const b of raw as Record<string, Num | boolean>[]) {
    if (!b || b.measured !== true) continue;
    const { fromDays, toDays, earlyDays, lateDays, decided, judged } = b as Record<string, Num>;
    if (![fromDays, toDays, earlyDays, lateDays, decided, judged].every(isNum)) continue;
    const inside = (b as Record<string, Num>).insideShare;
    const stuck = (b as Record<string, Num>).stuckShare;
    out.push({
      fromDays: fromDays as number,
      toDays: toDays as number,
      earlyDays: Math.min(0, earlyDays as number),
      lateDays: Math.max(0, lateDays as number),
      decided: decided as number,
      judged: judged as number,
      insideShare: isNum(inside) ? inside : null,
      stuckShare: isNum(stuck) ? stuck : null,
    });
  }
  return out;
}

export function parseRangeCoverage(json: string): RangeCoverage | null {
  try {
    const d = JSON.parse(json) as {
      end?: string;
      current?: { within7Share?: number | null } | null;
      rangeCoverage?: { judged?: number; insideShare?: number | null } | null;
      rangeModel?: { buckets?: unknown; judgeDays?: number } | null;
      servedRange?: { judged?: number; insideShare?: number | null; stuckShare?: number | null } | null;
    };
    const judged = d.rangeCoverage?.judged ?? 0;
    const inside = d.rangeCoverage?.insideShare;
    if (!d.end || !(judged > 0) || typeof inside !== "number") return null;
    const within7 = d.current?.within7Share;
    const out: RangeCoverage = {
      insideShare: inside,
      judged,
      within7Share: typeof within7 === "number" ? within7 : null,
      through: d.end,
    };
    const measured = bucketsOf(d.rangeModel?.buckets);
    if (measured.length) {
      out.measured = measured;
      out.judgeDays = isNum(d.rangeModel?.judgeDays) ? d.rangeModel.judgeDays : 14;
      const s = d.servedRange;
      out.served =
        s && isNum(s.judged) && isNum(s.insideShare) && isNum(s.stuckShare)
          ? { judged: s.judged, insideShare: s.insideShare, stuckShare: s.stuckShare }
          : null;
    }
    return out;
  } catch {
    return null;
  }
}

/** The stored backtest's range fields, as much of them as a reader needs. */
export interface BacktestRangeFields {
  rangeCoverage?: { judged: number; insideShare: number | null } | null;
  rangeModel?: { buckets?: unknown; judgeDays?: number } | null;
  servedRange?: { judged?: number; insideShare?: number | null; stuckShare?: number | null } | null;
}

/** How often the range the site prints near the front held, and on what. */
export interface PrintedRangeCheck {
  share: number;
  judged: number;
  /** Still waiting `judgeDays` after their date; null for the pace rule's test. */
  stuckShare: number | null;
  judgeDays: number;
  /** out-of-sample: tested on start days it wasn't drawn from; in-sample: on its own cases. */
  kind: "out-of-sample" | "in-sample" | "pace-rule";
}

/**
 * The near-front range's test, in the order a reader should trust it: the
 * out-of-sample test once it has SERVED_MIN_JUDGED cases, else the measured
 * range on its own cases, else (an older doc) the pace rule's test.
 */
export function printedRangeCheck(bt: BacktestRangeFields | null | undefined): PrintedRangeCheck | null {
  if (!bt) return null;
  const judgeDays = isNum(bt.rangeModel?.judgeDays) ? bt.rangeModel.judgeDays : 14;
  const near = bucketsOf(bt.rangeModel?.buckets).find((b) => b.fromDays === 0);
  if (near) {
    const s = bt.servedRange;
    if (s && isNum(s.judged) && s.judged >= SERVED_MIN_JUDGED && isNum(s.insideShare) && isNum(s.stuckShare)) {
      return { share: s.insideShare, judged: s.judged, stuckShare: s.stuckShare, judgeDays, kind: "out-of-sample" };
    }
    if (near.insideShare !== null) {
      return { share: near.insideShare, judged: near.judged, stuckShare: near.stuckShare, judgeDays, kind: "in-sample" };
    }
  }
  const r = bt.rangeCoverage;
  if (r && isNum(r.insideShare) && r.judged > 0) {
    return { share: r.insideShare, judged: r.judged, stuckShare: null, judgeDays: 7, kind: "pace-rule" };
  }
  return null;
}
