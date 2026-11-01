import type { FigureTrend } from "@/components/data/FigureRow";
import { approvedShare, slotShort, type FormTotal, type LinePoint } from "@/lib/uscisForms";

/**
 * How a USCIS form's quarter moved against the quarter before it that USCIS
 * published (a quarter not held is skipped, and the chip names the quarter it
 * compares with). For someone waiting: a shorter median and fewer waiting are
 * good, a higher share approved is good, and more received is information.
 */

const monthsWords = (m: number) => (m === 1 ? "1 month" : `${m.toFixed(1).replace(/\.0$/, "")} months`);

/** The lead line's median against the quarter before; within 0.15 months is level. */
export function medianMoved(points: readonly LinePoint[]): FigureTrend | undefined {
  const held = points.filter((p) => p.row?.medianMonths != null);
  const now = held.at(-1);
  const before = held.at(-2);
  if (!now || !before) return undefined;
  const d = now.row!.medianMonths! - before.row!.medianMonths!;
  const then = slotShort(before.slot);
  if (Math.abs(d) < 0.15) return { text: `Level with ${then}`, dir: "level", tone: "neutral" };
  const n = Math.round(Math.abs(d) * 10) / 10;
  return d < 0
    ? { text: `${monthsWords(n)} quicker than ${then}`, dir: "down", tone: "good" }
    : { text: `${monthsWords(n)} slower than ${then}`, dir: "up", tone: "bad" };
}

/** The total before `newest` that carries `key`, skipping quarters without it. */
function previous(totals: readonly FormTotal[], newest: FormTotal, key: "pending" | "received"): FormTotal | undefined {
  const at = totals.indexOf(newest);
  for (let i = at - 1; i >= 0; i--) if (totals[i]![key] != null) return totals[i];
  return undefined;
}

/** A count against the quarter before, as a percentage; within 2% is level. */
export function countMoved(totals: readonly FormTotal[], newest: FormTotal | null, key: "pending" | "received"): FigureTrend | undefined {
  const now = newest?.[key];
  const before = newest ? previous(totals, newest, key) : undefined;
  const then = before?.[key];
  if (now == null || before == null || then == null || then <= 0) return undefined;
  const pct = (now - then) / then;
  const label = slotShort(before.slot);
  if (Math.abs(pct) < 0.02) return { text: `Level with ${label}`, dir: "level", tone: "neutral" };
  const words = `${Math.round(Math.abs(pct) * 100)}% ${pct < 0 ? "fewer" : "more"} than ${label}`;
  if (key === "received") return { text: words, dir: pct < 0 ? "down" : "up", tone: "info" };
  return { text: words, dir: pct < 0 ? "down" : "up", tone: pct < 0 ? "good" : "bad" };
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
