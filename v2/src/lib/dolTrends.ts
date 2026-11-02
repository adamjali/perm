import type { FigureTrend } from "@/components/data/FigureRow";
import { analystReviewAverage, analystReviewWindows, windowPhrase } from "@convex/lib/dolProcessingTimes";
import type { ProcessingTimesSnapshot } from "@/lib/db/processingTimes";
import { formatMonth, formatMonthDay, monthsMoved } from "@/lib/dolFormat";

/**
 * How DOL's own figures moved, read from the readings this site keeps (DOL
 * overwrites its page and keeps no archive). Each answers as a card chip: the
 * direction, and whether that's good for someone waiting. A shorter average is
 * good; a queue month moving forward is good; a month that held is level.
 */

/**
 * DOL's average days to a determination against the month before it. From Oct 31 2026 DOL prints averages over
 * the last 30, 90 and 180 days instead of by month, so the newest reading's 30-day figure is set against its own
 * 90-day one: the recent decisions against the longer window, both DOL's.
 */
export function averageTrend(history: readonly ProcessingTimesSnapshot[]): FigureTrend | undefined {
  const windows = history[0] ? analystReviewWindows(history[0].permAverageDays) : [];
  if (windows.length >= 2) {
    const [recent, longer] = windows as [(typeof windows)[number], (typeof windows)[number]];
    const d = recent.calendarDays - longer.calendarDays;
    const n = /\d+/.exec(longer.period)?.[0];
    const vs = n ? `the ${n}-day average` : `the average over ${windowPhrase(longer.period)}`;
    if (Math.abs(d) < 3) return { text: `About level with ${vs}`, dir: "level", tone: "neutral" };
    return { text: `${Math.abs(d)} days ${d < 0 ? "shorter" : "longer"} than ${vs}`, dir: d < 0 ? "down" : "up", tone: d < 0 ? "good" : "bad" };
  }
  const rows = history
    .map((s) => analystReviewAverage(s.permAverageDays))
    .filter((r): r is NonNullable<typeof r> & { month: string; calendarDays: number } => !!r?.month && r.calendarDays != null);
  const now = rows[0];
  const before = now ? rows.find((r) => r.month < now.month) : undefined;
  if (!now || !before) return undefined;
  const d = now.calendarDays - before.calendarDays;
  const then = formatMonth(before.month)?.split(" ")[0] ?? "the month before";
  if (Math.abs(d) < 3) return { text: `About level with ${then}`, dir: "level", tone: "neutral" };
  return { text: `${Math.abs(d)} days ${d < 0 ? "shorter" : "longer"} than ${then}`, dir: d < 0 ? "down" : "up", tone: d < 0 ? "good" : "bad" };
}

/**
 * How far a queue's month moved over about a month of DOL's readings: the
 * newest reading against the newest one dated at least `days` earlier.
 */
export function queueMoveTrend(
  history: readonly ProcessingTimesSnapshot[],
  pick: (s: ProcessingTimesSnapshot) => { month: string | null | undefined; asOf: string | null | undefined },
  days = 28,
): FigureTrend | undefined {
  const reads = history
    .map((s) => pick(s))
    .filter((r): r is { month: string; asOf: string } => !!r.month && !!r.asOf && /^\d{4}-\d{2}-\d{2}/.test(r.asOf));
  const now = reads[0];
  if (!now) return undefined;
  const cutoff = new Date(Date.parse(`${now.asOf.slice(0, 10)}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);
  const before = reads.find((r) => r.asOf.slice(0, 10) <= cutoff);
  if (!before) return undefined;
  const moved = monthsMoved(before.month, now.month);
  if (moved == null) return undefined;
  const since = formatMonthDay(before.asOf.slice(0, 10)) ?? "a month ago";
  if (moved === 0) return { text: `Unmoved since ${since}`, dir: "level", tone: "neutral" };
  const n = Math.abs(moved);
  return {
    text: `${moved > 0 ? "Forward" : "Back"} ${n} month${n === 1 ? "" : "s"} since ${since}`,
    dir: moved > 0 ? "up" : "down",
    tone: moved > 0 ? "good" : "bad",
  };
}
