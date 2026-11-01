import type { FigureTrend } from "@/components/data/FigureRow";
import { approvedShare, slotShort, type FormTotal, type LinePoint } from "@/lib/uscisForms";

/**
 * How a USCIS form's quarter moved against the quarter before it that USCIS
 * published (a quarter not held is skipped, and the chip names the quarter it
 * compares with). For someone waiting: a shorter median and fewer waiting are
 * good, a higher share approved is good, and more received is information.
 */

const monthsWords = (m: number) => (m === 1 ? "1 month" : `${m.toFixed(1).replace(/\.0$/, "")} months`);

/** Median months against an earlier figure named `label`; within 0.15 months is level, shorter is good. */
export function monthsVs(now: number | null | undefined, before: number | null | undefined, label: string): FigureTrend | undefined {
  if (now == null || before == null) return undefined;
  const d = now - before;
  if (Math.abs(d) < 0.15) return { text: `Level with ${label}`, dir: "level", tone: "neutral" };
  const n = Math.round(Math.abs(d) * 10) / 10;
  return d < 0
    ? { text: `${monthsWords(n)} quicker than ${label}`, dir: "down", tone: "good" }
    : { text: `${monthsWords(n)} slower than ${label}`, dir: "up", tone: "bad" };
}

/**
 * A count against an earlier one named `label`, as a percentage; within 2% is
 * level. `good` says which way helps someone waiting: "fewer" (people in line),
 * "more" (approvals), or null for information (applications received).
 */
export function countVs(now: number | null | undefined, before: number | null | undefined, label: string, good: "fewer" | "more" | null): FigureTrend | undefined {
  if (now == null || before == null || before <= 0) return undefined;
  const pct = (now - before) / before;
  if (Math.abs(pct) < 0.02) return { text: `Level with ${label}`, dir: "level", tone: "neutral" };
  const up = pct > 0;
  return {
    text: `${Math.round(Math.abs(pct) * 100)}% ${up ? "more" : "fewer"} than ${label}`,
    dir: up ? "up" : "down",
    tone: good === null ? "info" : (good === "more") === up ? "good" : "bad",
  };
}

/** The newest point before quarter `fy` `quarter` that `match` accepts. */
export function pointBefore<T extends { fy: number; quarter: number }>(points: readonly T[], fy: number, quarter: number, match: (p: T) => boolean): T | undefined {
  const at = fy * 4 + quarter;
  let best: T | undefined;
  for (const p of points) {
    const i = p.fy * 4 + p.quarter;
    if (i < at && match(p) && (!best || i > best.fy * 4 + best.quarter)) best = p;
  }
  return best;
}

/** The lead line's median against the quarter before that has one. */
export function medianMoved(points: readonly LinePoint[]): FigureTrend | undefined {
  const held = points.filter((p) => p.row?.medianMonths != null);
  const now = held.at(-1);
  const before = held.at(-2);
  if (!now || !before) return undefined;
  return monthsVs(now.row!.medianMonths, before.row!.medianMonths, slotShort(before.slot));
}

/** The total before `newest` that carries `key`, skipping quarters without it. */
function previous(totals: readonly FormTotal[], newest: FormTotal, key: "pending" | "received"): FormTotal | undefined {
  const at = totals.indexOf(newest);
  for (let i = at - 1; i >= 0; i--) if (totals[i]![key] != null) return totals[i];
  return undefined;
}

/** A form's count against the quarter before that carries it: fewer waiting is good, received is information. */
export function countMoved(totals: readonly FormTotal[], newest: FormTotal | null, key: "pending" | "received"): FigureTrend | undefined {
  const before = newest ? previous(totals, newest, key) : undefined;
  if (!newest || !before) return undefined;
  return countVs(newest[key], before[key], slotShort(before.slot), key === "pending" ? "fewer" : null);
}

/** The share approved against the quarter before, in points; within 1 point is level. */
export function approvalMoved(totals: readonly FormTotal[], newest: FormTotal | null): FigureTrend | undefined {
  const now = newest ? approvedShare(newest) : null;
  if (now === null || !newest) return undefined;
  const at = totals.indexOf(newest);
  let before: FormTotal | undefined;
  for (let i = at - 1; i >= 0; i--) if (approvedShare(totals[i]!) !== null) { before = totals[i]; break; }
  const then = before ? approvedShare(before) : null;
  if (!before || then === null) return undefined;
  const d = Math.round((now - then) * 100);
  const label = slotShort(before.slot);
  if (Math.abs(d) < 1) return { text: `Level with ${label}`, dir: "level", tone: "neutral" };
  return d > 0
    ? { text: `${d} point${d === 1 ? "" : "s"} above ${label}`, dir: "up", tone: "good" }
    : { text: `${-d} point${d === -1 ? "" : "s"} below ${label}`, dir: "down", tone: "bad" };
}
