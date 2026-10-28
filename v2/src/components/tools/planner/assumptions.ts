import type { BulletinCheck } from "@/lib/bulletinCheck";
import { nearestGap } from "@/lib/bulletinCheck";
import type { PlanBase } from "@/lib/db/planFigures";
import type { BulletinMethod, PlanFigures, Span } from "@/lib/perm";
import type { PlanAnswer, PlanCategory } from "@/lib/planQuery";

import type { LengthKey } from "./format";

/**
 * What the reader changed on top of today's figures, and the figures the plan then runs on.
 * Pure: the planner keeps an `Overrides` in state and asks `figuresFor` each render.
 */

export interface Overrides {
  /** A step's own lengths, in days. The I-140's applies to the category chosen. */
  lengths: Partial<Record<LengthKey, Span>>;
  method: BulletinMethod;
  /** The cutoff's pace in days a month, in place of the line's measured pace. */
  paceDaysPerMonth: number | null;
  /** Green cards the line is issued a year, in place of the last fiscal year's. */
  perYear: number | null;
  /** Whether a filed case is dated from the cases ahead of it (the default) or from DOL's plain wait. */
  byQueue: { pwd: boolean; perm: boolean };
}

export const NO_OVERRIDES: Overrides = {
  lengths: {},
  method: "pace",
  paceDaysPerMonth: null,
  perYear: null,
  byQueue: { pwd: true, perm: true },
};

/** How many things the reader has changed, for the "back to today's figures" button. */
export function changedCount(o: Overrides): number {
  return (
    Object.keys(o.lengths).length +
    (o.method !== NO_OVERRIDES.method ? 1 : 0) +
    (o.paceDaysPerMonth !== null ? 1 : 0) +
    (o.perYear !== null ? 1 : 0) +
    (o.byQueue.pwd ? 0 : 1) +
    (o.byQueue.perm ? 0 : 1)
  );
}

/** How far off the cutoff's pace has been at a distance past the cutoff, from the bulletin backtest. */
export function missFrom(check: BulletinCheck | null): PlanFigures["missMonthsAt"] {
  if (!check) return null;
  return (gapDays) => {
    const g = nearestGap(check, gapDays);
    return g === null ? null : (check[g]?.typicalMissMonths ?? null);
  };
}

/** The base figures with the reader's own in place, and the queue answer folded in. */
export function figuresFor(
  base: PlanBase,
  o: Overrides,
  category: PlanCategory,
  answer: PlanAnswer | null,
  check: BulletinCheck | null,
): PlanFigures {
  const own = o.lengths;
  const i140 = { ...base.spans.i140, ...(own.i140 ? { [category]: own.i140 } : {}) };
  const line = answer?.line ?? null;
  return {
    ...base,
    spans: {
      pwd: own.pwd ?? base.spans.pwd,
      recruitment: own.recruitment ?? base.spans.recruitment,
      perm: own.perm ?? base.spans.perm,
      i140Prep: own.i140Prep ?? base.spans.i140Prep,
      i140,
      i485: own.i485 ?? base.spans.i485,
      ead: own.ead ?? base.spans.ead,
      ap: own.ap ?? base.spans.ap,
      consular: own.consular ?? base.spans.consular,
    },
    pwdByQueue: o.byQueue.pwd ? (answer?.pwd ?? null) : null,
    permByQueue: o.byQueue.perm ? (answer?.perm ?? null) : null,
    paceDaysPerMonth: o.paceDaysPerMonth,
    bulletinMethod: o.method,
    missMonthsAt: missFrom(check),
    supply: line ? { peopleAhead: line.peopleAhead, perYear: o.perYear ?? line.perYear } : null,
  };
}

/** The base span a step's inputs show, before the reader's own. */
export function baseSpan(base: PlanBase, key: LengthKey, category: PlanCategory): Span | null {
  return key === "i140" ? base.spans.i140[category] : base.spans[key];
}

/**
 * A span with one track set to what the reader typed, the others pushed to keep the order:
 * a typical past the slow end makes that the slow end too, so the number stays in its own box.
 */
export function withTrack(s: Span, track: keyof Span, value: number): Span {
  const v = Math.max(0, value);
  if (track === "low") return { low: v, mid: Math.max(s.mid, v), high: Math.max(s.high, v) };
  if (track === "high") return { low: Math.min(s.low, v), mid: Math.min(s.mid, v), high: v };
  return { low: Math.min(s.low, v), mid: v, high: Math.max(s.high, v) };
}
