import type { FigureTrend } from "@/components/data/FigureRow";
import type { LineFlow } from "@/lib/board";
import { formatInt } from "@/lib/format";
import { weekdayName } from "@convex/lib/months";

/**
 * The homepage figures' directions, from what the page already reads: the
 * wait against the same reading a month before, the line's 30-day flow, and
 * the last day's decisions against the same weekday's typical count. For
 * someone waiting, a shorter wait, a shrinking line and a busier day are good.
 */

/** The wait now against a month before; within a week is level. */
export function waitTrend(nowDays: number, monthBeforeDays: number | null | undefined): FigureTrend | undefined {
  if (monthBeforeDays == null || !Number.isFinite(monthBeforeDays)) return undefined;
  const d = Math.round(nowDays - monthBeforeDays);
  if (Math.abs(d) < 7) return { text: "Level with a month ago", dir: "level", tone: "neutral" };
  return { text: `${formatInt(Math.abs(d))} days ${d < 0 ? "quicker" : "longer"} in a month`, dir: d < 0 ? "down" : "up", tone: d < 0 ? "good" : "bad" };
}

/** What the line gained or lost over the 30 days its flow covers. */
export function backlogTrend(flow: Pick<LineFlow, "change" | "trend"> | null | undefined, days = 30): FigureTrend | undefined {
  if (!flow) return undefined;
  if (flow.trend === "level") return { text: `Level over ${days} days`, dir: "level", tone: "neutral" };
  const n = formatInt(Math.abs(flow.change));
  return flow.trend === "shrinking"
    ? { text: `${n} fewer in ${days} days`, dir: "down", tone: "good" }
    : { text: `${n} more in ${days} days`, dir: "up", tone: "bad" };
}

/** A day's decisions against a typical day of the same weekday; within 10% is "near". */
export function dayTrend(date: string, changePct: number | null | undefined): FigureTrend | undefined {
  if (changePct == null || !Number.isFinite(changePct)) return undefined;
  const wd = weekdayName(date) ?? "day";
  if (Math.abs(changePct) < 10) return { text: `Near a typical ${wd}`, dir: "level", tone: "neutral" };
  return { text: `${Math.abs(changePct)}% ${changePct > 0 ? "above" : "below"} a typical ${wd}`, dir: changePct > 0 ? "up" : "down", tone: changePct > 0 ? "good" : "bad" };
}
