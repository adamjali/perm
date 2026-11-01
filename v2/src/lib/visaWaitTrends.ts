import type { FigureTrend } from "@/components/data/FigureRow";
import { formatMonthDay } from "@/lib/dolFormat";
import { formatInt } from "@/lib/format";
import type { WaitCell } from "@/lib/visaWaits";

/**
 * How State's work-visa waits moved since its previous reading (this site keeps
 * one per date State printed). The chip names that date: State has gone months
 * between readings. A shorter wait and more consulates with a quick interview
 * are good.
 */

type Read = WaitCell & { reading: string };

/** A work-visa interview within 15 days: same day, or 15 days or less (State's "< 0.5 Month" and "0.5 Month"). */
export function isQuickWork(c: WaitCell): boolean {
  return c.kind === "same_day" || (c.kind === "value" && c.days !== null && c.days <= 15);
}

/** The newest reading before `newest`, or null. */
function readingBefore(history: readonly Read[], newest: string): string | null {
  let best: string | null = null;
  for (const c of history) if (c.reading < newest && (best === null || c.reading > best)) best = c.reading;
  return best;
}

/** A difference in days as State would say it: months from a month up (State prints months), days under that. */
function span(days: number): string {
  if (days < 30) return `${formatInt(days)} day${days === 1 ? "" : "s"}`;
  const m = Math.round((days / 30) * 2) / 2;
  return `${String(m).replace(/\.0$/, "")} month${m === 1 ? "" : "s"}`;
}

/** State's own figure in days: 0 for same day, null without a figure. */
const daysOf = (c: WaitCell): number | null => (c.kind === "same_day" ? 0 : c.kind === "value" ? c.days : null);

/**
 * One consulate's wait against its previous reading, in State's own figures;
 * within 5 days is level. A "<" figure ("< 0.5 Month") is a bound, so a move
 * to or from one is "at least" the difference, and two bounds are level.
 */
export function postWaitMoved(history: readonly Read[], post: string, now: WaitCell, newest: string): FigureTrend | undefined {
  const then = readingBefore(history, newest);
  const prev = then ? history.find((c) => c.reading === then && c.post === post) : undefined;
  const a = prev ? daysOf(prev) : null;
  const b = daysOf(now);
  if (!then || !prev || a === null || b === null) return undefined;
  const since = formatMonthDay(then) ?? then;
  const d = Math.round(b - a);
  const nowBound = now.bound === "under";
  const prevBound = prev.bound === "under";
  if (Math.abs(d) < 5 || (nowBound && prevBound)) return { text: `Level with ${since}`, dir: "level", tone: "neutral" };
  // Shorter to a bound, or longer from one, is at least the difference.
  const atLeast = (d < 0 && nowBound) || (d > 0 && prevBound) ? "At least " : "";
  const words = `${span(Math.abs(d))} ${d < 0 ? "shorter" : "longer"} than ${since}`;
  return {
    text: atLeast ? `${atLeast}${words}` : `${words[0]!.toUpperCase()}${words.slice(1)}`,
    dir: d < 0 ? "down" : "up",
    tone: d < 0 ? "good" : "bad",
  };
}

/** How many consulates offered a quick work-visa interview, against the previous reading. */
export function quickMoved(history: readonly Read[], nowCount: number, newest: string): FigureTrend | undefined {
  const then = readingBefore(history, newest);
  if (!then) return undefined;
  const before = history.filter((c) => c.reading === then && isQuickWork(c)).length;
  const since = formatMonthDay(then) ?? then;
  const d = nowCount - before;
  if (d === 0) return { text: `Same as ${since}`, dir: "level", tone: "neutral" };
  return d > 0
    ? { text: `${formatInt(d)} more than ${since}`, dir: "up", tone: "good" }
    : { text: `${formatInt(-d)} fewer than ${since}`, dir: "down", tone: "bad" };
}
